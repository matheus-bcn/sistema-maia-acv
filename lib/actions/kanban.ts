"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

async function resolveActingId(supabase: Awaited<ReturnType<typeof createClient>>, targetSellerId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { userId: null, sellerId: null };
  const sellerId = targetSellerId || user.id;
  return { userId: user.id, sellerId };
}

async function checkIsAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, email?: string | null) {
  // Prefer server-only env var; fall back to NEXT_PUBLIC for backwards compatibility
  const masterEmail = (
    process.env.MASTER_ADMIN_EMAIL ||
    process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL
  )?.toLowerCase();
  if (masterEmail && email && email.toLowerCase() === masterEmail) return true;
  const { data } = await supabase.from("sellers").select("is_admin").eq("id", userId).maybeSingle();
  return !!(data?.is_admin);
}

// Returns true if userId owns the resource OR if the resource belongs to an admin board (team board)
async function canModifyBoardResource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  resourceOwnerId: string
): Promise<boolean> {
  if (userId === resourceOwnerId) return true;
  if (await checkIsAdmin(supabase, userId)) return true;
  // Allow modification if the resource is on the team/admin board
  if (await checkIsAdmin(supabase, resourceOwnerId)) return true;
  return false;
}

// ── PAINEL GERAL ─────────────────────────────────────────────

export async function carregarPainelGeralAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { lists: [], cards: [], adminId: null, isAdmin: false };

  const isAdmin = await checkIsAdmin(supabase, user.id, user.email);

  if (isAdmin) {
    const adminId = user.id;
    const [listsRes, cardsRes] = await Promise.all([
      supabase.from("kanban_lists").select("*").eq("seller_id", adminId).order("position"),
      supabase.from("kanban_cards").select("*").eq("seller_id", adminId).order("position"),
    ]);
    return { lists: listsRes.data ?? [], cards: cardsRes.data ?? [], adminId, isAdmin: true };
  }

  // Non-admin: find the admin's board — try is_admin flag first (any status),
  // then fall back to matching the master email.
  const masterEmail = (
    process.env.MASTER_ADMIN_EMAIL ||
    process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL ||
    "admin@onlinegrafica.com"
  ).toLowerCase();

  let adminSeller: { id: string } | null = null;

  const { data: byFlag } = await supabase
    .from("sellers")
    .select("id")
    .eq("is_admin", true)
    .order("status", { ascending: false }) // Ativo antes de Inativo
    .limit(1)
    .maybeSingle();

  if (byFlag) {
    adminSeller = byFlag;
  } else {
    const { data: byEmail } = await supabase
      .from("sellers")
      .select("id")
      .eq("email", masterEmail)
      .limit(1)
      .maybeSingle();
    adminSeller = byEmail ?? null;
  }

  if (!adminSeller) return { lists: [], cards: [], adminId: null, isAdmin: false };

  // Usa service role para contornar o RLS (vendedor lendo board do admin)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const [listsRes, cardsRes] = await Promise.all([
    serviceClient.from("kanban_lists").select("*").eq("seller_id", adminSeller.id).order("position"),
    serviceClient.from("kanban_cards").select("*").eq("seller_id", adminSeller.id).order("position"),
  ]);
  return { lists: listsRes.data ?? [], cards: cardsRes.data ?? [], adminId: adminSeller.id, isAdmin: false };
}

// ── LISTAS ──────────────────────────────────────────────────

export async function criarListaAction(title: string, color = "violet", targetSellerId?: string) {
  const supabase = await createClient();
  const { userId, sellerId } = await resolveActingId(supabase, targetSellerId);
  if (!userId) return { error: "Não autenticado." };

  const { data: existing } = await supabase
    .from("kanban_lists")
    .select("position")
    .eq("seller_id", sellerId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (existing?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from("kanban_lists")
    .insert({ seller_id: sellerId, title: title.trim(), color, position })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/rotina");
  return { success: true, list: data };
}

export async function editarListaAction(listId: string, title: string, color = "violet") {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  const { data: list } = await supabase.from("kanban_lists").select("seller_id").eq("id", listId).maybeSingle();
  if (!list) return { error: "Lista não encontrada." };
  if (!await canModifyBoardResource(supabase, userId, list.seller_id)) return { error: "Acesso negado." };

  const { error } = await supabase
    .from("kanban_lists")
    .update({ title: title.trim(), color })
    .eq("id", listId);

  if (error) return { error: error.message };
  revalidatePath("/rotina");
  return { success: true };
}

export async function excluirListaAction(listId: string) {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  const { data: list } = await supabase.from("kanban_lists").select("seller_id").eq("id", listId).maybeSingle();
  if (!list) return { error: "Lista não encontrada." };
  if (!await canModifyBoardResource(supabase, userId, list.seller_id)) return { error: "Acesso negado." };

  const { error } = await supabase.from("kanban_lists").delete().eq("id", listId);
  if (error) return { error: error.message };
  revalidatePath("/rotina");
  return { success: true };
}

export async function reordenarListasAction(listIds: string[]) {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  await Promise.all(listIds.map((id, position) =>
    supabase.from("kanban_lists").update({ position }).eq("id", id)
  ));
  return { success: true };
}

// ── CARTÕES ─────────────────────────────────────────────────

export async function criarCartaoAction(
  listId: string,
  title: string,
  description?: string,
  priority = "Normal",
  due_date?: string,
  assignedTo?: string,
  targetSellerId?: string,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };
  const { userId, sellerId } = await resolveActingId(supabase, targetSellerId);
  if (!userId) return { error: "Não autenticado." };

  // Service role is only used when writing to another user's board
  let boardClient: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceClient> = supabase;
  if (targetSellerId && targetSellerId !== userId) {
    const callerIsAdmin = await checkIsAdmin(supabase, userId, user.email);
    if (!callerIsAdmin) {
      // Non-admin: only allowed to write cards to the admin's board (team board)
      const targetIsAdmin = await checkIsAdmin(supabase, targetSellerId);
      if (!targetIsAdmin) return { error: "Acesso negado." };
    }
    boardClient = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }

  const { data: existing } = await boardClient
    .from("kanban_cards")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (existing?.position ?? -1) + 1;
  const { data, error } = await boardClient
    .from("kanban_cards")
    .insert({
      list_id: listId, seller_id: sellerId, title: title.trim(),
      description: description?.trim() || null, priority,
      due_date: due_date || null, assigned_to: assignedTo || null, position,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (assignedTo && assignedTo !== userId) {
    try {
      const { data: assigner } = await supabase.from("sellers").select("name").eq("id", userId).maybeSingle();
      const dueInfo = due_date ? ` — prazo: ${new Date(due_date + "T00:00:00").toLocaleDateString("pt-BR")}` : "";
      await supabase.from("notifications").insert({
        seller_id: assignedTo, type: "tarefa_atribuida",
        title: "Nova tarefa atribuída a você",
        message: `${assigner?.name ?? "Admin"}: "${title.trim()}"${dueInfo}`,
      });
    } catch { /* não bloqueia */ }
  }

  revalidatePath("/rotina");
  return { success: true, card: data };
}

export async function editarCartaoAction(
  cardId: string,
  title: string,
  description?: string,
  priority = "Normal",
  due_date?: string,
  assignedTo?: string,
  prevAssignedTo?: string,
) {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  const { data: card } = await supabase.from("kanban_cards").select("seller_id").eq("id", cardId).maybeSingle();
  if (!card) return { error: "Cartão não encontrado." };
  if (!await canModifyBoardResource(supabase, userId, card.seller_id)) return { error: "Acesso negado." };

  const { error } = await supabase
    .from("kanban_cards")
    .update({
      title: title.trim(), description: description?.trim() || null,
      priority, due_date: due_date || null, assigned_to: assignedTo || null,
    })
    .eq("id", cardId);

  if (error) return { error: error.message };

  if (assignedTo && assignedTo !== userId && assignedTo !== prevAssignedTo) {
    try {
      const { data: assigner } = await supabase.from("sellers").select("name").eq("id", userId).maybeSingle();
      const dueInfo = due_date ? ` — prazo: ${new Date(due_date + "T00:00:00").toLocaleDateString("pt-BR")}` : "";
      await supabase.from("notifications").insert({
        seller_id: assignedTo, type: "tarefa_atribuida",
        title: "Nova tarefa atribuída a você",
        message: `${assigner?.name ?? "Admin"}: "${title.trim()}"${dueInfo}`,
      });
    } catch { /* não bloqueia */ }
  }

  revalidatePath("/rotina");
  return { success: true };
}

export async function moverCartaoAction(cardId: string, newListId: string) {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  const { data: existing } = await supabase
    .from("kanban_cards").select("position").eq("list_id", newListId)
    .order("position", { ascending: false }).limit(1).maybeSingle();

  const position = (existing?.position ?? -1) + 1;
  const { error } = await supabase
    .from("kanban_cards").update({ list_id: newListId, position }).eq("id", cardId);

  if (error) return { error: error.message };
  revalidatePath("/rotina");
  return { success: true };
}

export async function excluirCartaoAction(cardId: string) {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  const { data: card } = await supabase.from("kanban_cards").select("seller_id").eq("id", cardId).maybeSingle();
  if (!card) return { error: "Cartão não encontrado." };
  if (!await canModifyBoardResource(supabase, userId, card.seller_id)) return { error: "Acesso negado." };

  const { error } = await supabase.from("kanban_cards").delete().eq("id", cardId);
  if (error) return { error: error.message };
  revalidatePath("/rotina");
  return { success: true };
}

export async function reordenarCartoesAction(cardIds: string[], listId: string) {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  await Promise.all(cardIds.map((id, position) =>
    supabase.from("kanban_cards").update({ position, list_id: listId }).eq("id", id)
  ));
  return { success: true };
}

export async function carregarRotinaAction(targetSellerId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { lists: [], cards: [] };

  const sellerId = targetSellerId || user.id;

  // When reading another seller's board, verify admin status and use service role
  // (RLS uses public.is_admin() which requires sellers.is_admin=true in DB;
  //  service role bypasses this so email-only admins still work)
  let client: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceClient> = supabase;
  if (targetSellerId && targetSellerId !== user.id) {
    const isAdmin = await checkIsAdmin(supabase, user.id, user.email);
    if (!isAdmin) return { lists: [], cards: [] };
    client = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }

  const [listsRes, cardsRes] = await Promise.all([
    client.from("kanban_lists").select("*").eq("seller_id", sellerId).order("position"),
    client.from("kanban_cards").select("*").eq("seller_id", sellerId).order("position"),
  ]);
  return { lists: listsRes.data ?? [], cards: cardsRes.data ?? [] };
}

export async function listarVendedoresParaKanbanAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Sellers list is non-sensitive (all authenticated users can already read it via RLS).
  // Admin gate is enforced in the UI; here we just verify authentication.
  const { data } = await supabase
    .from("sellers")
    .select("id, name, avatar")
    .eq("status", "Ativo")
    .order("name");

  return data ?? [];
}

// ── COMENTÁRIOS ─────────────────────────────────────────────

export async function carregarComentariosAction(cardId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: comments } = await supabase
    .from("kanban_card_comments")
    .select("*")
    .eq("card_id", cardId)
    .order("created_at", { ascending: true });

  if (!comments || comments.length === 0) return [];

  const authorIds = [...new Set(comments.map((c: any) => c.author_id))];
  const { data: authors } = await supabase
    .from("sellers")
    .select("id, name, avatar")
    .in("id", authorIds);

  const authorMap = Object.fromEntries((authors ?? []).map((a: any) => [a.id, a]));
  return comments.map((c: any) => ({
    ...c,
    author: authorMap[c.author_id] ?? { name: "Admin", avatar: null },
  }));
}

export async function criarComentarioAction(cardId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("kanban_card_comments")
    .insert({ card_id: cardId, author_id: user.id, content: content.trim() });

  if (error) return { error: error.message };
  return { success: true };
}

export async function excluirComentarioAction(commentId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: comment } = await supabase
    .from("kanban_card_comments")
    .select("author_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return { error: "Comentário não encontrado." };

  const isAdmin = await checkIsAdmin(supabase, user.id);
  if (comment.author_id !== user.id && !isAdmin) {
    return { error: "Acesso negado: você só pode excluir seus próprios comentários." };
  }

  const { error } = await supabase
    .from("kanban_card_comments")
    .delete()
    .eq("id", commentId);

  if (error) return { error: error.message };
  return { success: true };
}
