"use server";

import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/data/notifications";

export async function enviarDesafioAction(_challengerId: string, challengedId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  // Force challenger to be the authenticated user — never trust the client param
  const { error } = await supabase.from("x1_battles").insert({
    challenger_id: user.id,
    challenged_id: challengedId,
    status: "pendente",
  });

  if (error) return { error: error.message };

  try {
    const { data: challenger } = await supabase.from("sellers").select("name").eq("id", user.id).maybeSingle();
    await createNotification(supabase, {
      seller_id: challengedId,
      type: "arena_x1",
      title: "Novo Desafio Arena X1!",
      message: `${challenger?.name ?? "Um colega"} te chamou para uma batalha na Arena X1. Acesse o Meu Painel para aceitar ou recusar.`,
    });
  } catch { /* notificação é opcional */ }

  return { error: null };
}

export async function finalizarBatalhaAction(batalhaId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { data: batalha } = await supabase
    .from("x1_battles")
    .select("challenger_id, challenged_id, status, created_at")
    .eq("id", batalhaId)
    .maybeSingle();

  if (!batalha) return { error: "Batalha não encontrada." };
  if (batalha.status === "finalizado") return { error: "Batalha já finalizada." };

  // Verify the caller is a participant
  const isParticipant = batalha.challenger_id === user.id || batalha.challenged_id === user.id;
  if (!isParticipant) return { error: "Acesso negado: você não é participante desta batalha." };

  const oppId = batalha.challenger_id === user.id ? batalha.challenged_id : batalha.challenger_id;

  // Compute totals server-side from the sales table — do not trust client-supplied amounts
  const startDate = (batalha.created_at as string).split("T")[0];
  const today = new Date().toISOString().split("T")[0];

  const [myRes, oppRes] = await Promise.all([
    supabase.from("sales").select("amount").in("status", ["Aprovado", "Concluída"])
      .eq("seller_id", user.id).gte("sale_date", startDate).lte("sale_date", today),
    supabase.from("sales").select("amount").in("status", ["Aprovado", "Concluída"])
      .eq("seller_id", oppId).gte("sale_date", startDate).lte("sale_date", today),
  ]);

  const meuTotal = (myRes.data ?? []).reduce((acc, r) => acc + Number(r.amount), 0);
  const oponenteTotal = (oppRes.data ?? []).reduce((acc, r) => acc + Number(r.amount), 0);

  const actualWinnerId = meuTotal > oponenteTotal ? user.id : meuTotal < oponenteTotal ? oppId : user.id;

  const { error } = await supabase.from("x1_battles").update({
    status: "finalizado",
    winner_id: actualWinnerId,
    winner_amount: Math.max(meuTotal, oponenteTotal),
    loser_amount: Math.min(meuTotal, oponenteTotal),
    finished_at: new Date().toISOString(),
  }).eq("id", batalhaId);

  if (error) return { error: error.message };

  try {
    const { data: winnerData } = await supabase.from("sellers").select("name").eq("id", actualWinnerId).maybeSingle();
    await createNotification(supabase, {
      seller_id: oppId,
      type: "arena_x1",
      title: "Batalha X1 Encerrada",
      message: `A batalha foi encerrada. Vencedor: ${winnerData?.name ?? "desconhecido"}.`,
    });
  } catch { /* opcional */ }

  return { error: null };
}
