"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function resolveActingId(supabase: Awaited<ReturnType<typeof createClient>>, targetSellerId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { userId: null, sellerId: null };
  const sellerId = targetSellerId || user.id;
  return { userId: user.id, sellerId };
}

// ── LISTAS ──────────────────────────────────────────────────

export async function criarListaAction(title: string, targetSellerId?: string) {
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
    .insert({ seller_id: sellerId, title: title.trim(), position })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/rotina");
  return { success: true, list: data };
}

export async function editarListaAction(listId: string, title: string) {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("kanban_lists")
    .update({ title: title.trim() })
    .eq("id", listId);

  if (error) return { error: error.message };
  revalidatePath("/rotina");
  return { success: true };
}

export async function excluirListaAction(listId: string) {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  const { error } = await supabase.from("kanban_lists").delete().eq("id", listId);
  if (error) return { error: error.message };
  revalidatePath("/rotina");
  return { success: true };
}

export async function reordenarListasAction(listIds: string[]) {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  await Promise.all(
    listIds.map((id, position) =>
      supabase.from("kanban_lists").update({ position }).eq("id", id)
    )
  );
  return { success: true };
}

// ── CARTÕES ─────────────────────────────────────────────────

export async function criarCartaoAction(listId: string, title: string, description?: string, targetSellerId?: string) {
  const supabase = await createClient();
  const { userId, sellerId } = await resolveActingId(supabase, targetSellerId);
  if (!userId) return { error: "Não autenticado." };

  const { data: existing } = await supabase
    .from("kanban_cards")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (existing?.position ?? -1) + 1;
  const { data, error } = await supabase
    .from("kanban_cards")
    .insert({ list_id: listId, seller_id: sellerId, title: title.trim(), description: description?.trim() || null, position })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath("/rotina");
  return { success: true, card: data };
}

export async function editarCartaoAction(cardId: string, title: string, description?: string) {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  const { error } = await supabase
    .from("kanban_cards")
    .update({ title: title.trim(), description: description?.trim() || null })
    .eq("id", cardId);

  if (error) return { error: error.message };
  revalidatePath("/rotina");
  return { success: true };
}

export async function moverCartaoAction(cardId: string, newListId: string) {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  const { data: existing } = await supabase
    .from("kanban_cards")
    .select("position")
    .eq("list_id", newListId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (existing?.position ?? -1) + 1;
  const { error } = await supabase
    .from("kanban_cards")
    .update({ list_id: newListId, position })
    .eq("id", cardId);

  if (error) return { error: error.message };
  revalidatePath("/rotina");
  return { success: true };
}

export async function excluirCartaoAction(cardId: string) {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  const { error } = await supabase.from("kanban_cards").delete().eq("id", cardId);
  if (error) return { error: error.message };
  revalidatePath("/rotina");
  return { success: true };
}

export async function reordenarCartoesAction(cardIds: string[], listId: string) {
  const supabase = await createClient();
  const { userId } = await resolveActingId(supabase);
  if (!userId) return { error: "Não autenticado." };

  await Promise.all(
    cardIds.map((id, position) =>
      supabase.from("kanban_cards").update({ position, list_id: listId }).eq("id", id)
    )
  );
  return { success: true };
}

export async function carregarRotinaAction(targetSellerId?: string) {
  const supabase = await createClient();
  const { userId, sellerId } = await resolveActingId(supabase, targetSellerId);
  if (!userId) return { lists: [], cards: [] };

  const [listsRes, cardsRes] = await Promise.all([
    supabase.from("kanban_lists").select("*").eq("seller_id", sellerId).order("position"),
    supabase.from("kanban_cards").select("*").eq("seller_id", sellerId).order("position"),
  ]);

  return { lists: listsRes.data ?? [], cards: cardsRes.data ?? [] };
}

export async function listarVendedoresParaKanbanAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: me } = await supabase.from("sellers").select("is_admin").eq("id", user.id).maybeSingle();
  if (!me?.is_admin) return [];

  const { data } = await supabase
    .from("sellers")
    .select("id, name, avatar")
    .eq("status", "Ativo")
    .order("name");

  return data ?? [];
}
