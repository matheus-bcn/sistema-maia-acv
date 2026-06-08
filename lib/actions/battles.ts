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
