"use server";

import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/data/notifications";

export async function enviarDesafioAction(challengerId: string, challengedId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const { error } = await supabase.from("x1_battles").insert({
    challenger_id: challengerId,
    challenged_id: challengedId,
    status: "pendente",
  });

  if (error) return { error: error.message };

  // Notifica o vendedor desafiado
  try {
    const { data: challenger } = await supabase.from("sellers").select("name").eq("id", challengerId).maybeSingle();
    await createNotification(supabase, {
      seller_id: challengedId,
      type: "arena_x1",
      title: "Novo Desafio Arena X1!",
      message: `${challenger?.name ?? "Um colega"} te chamou para uma batalha na Arena X1. Acesse o Meu Painel para aceitar ou recusar.`,
    });
  } catch { /* notificação é opcional */ }

  return { error: null };
}

export async function finalizarBatalhaAction(batalhaId: string, meuId: string, meuTotal: number, oponenteTotal: number) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado." };

  const winnerId = meuTotal >= oponenteTotal ? meuId : null;
  const { data: batalha } = await supabase.from("x1_battles").select("challenger_id, challenged_id").eq("id", batalhaId).maybeSingle();
  if (!batalha) return { error: "Batalha não encontrada." };

  const oppId = batalha.challenger_id === meuId ? batalha.challenged_id : batalha.challenger_id;
  const actualWinnerId = meuTotal > oponenteTotal ? meuId : meuTotal < oponenteTotal ? oppId : meuId;

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
