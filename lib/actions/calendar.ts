"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createCalendarEventAction(input: {
  title: string;
  event_type: "reuniao" | "campanha" | "fechamento";
  event_day: number;
  month: number;
  year: number;
}) {
  const supabase = await createClient();

  // P1 — Validação de segurança rigorosa na Server Action (Evita bypass de API)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Acesso negado: Usuário não autenticado." };
  }

  // P2 — Inserção real no banco de dados (CRUD de eventos do calendário)
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      title: input.title,
      event_type: input.event_type,
      event_day: input.event_day,
      month: input.month,
      year: input.year,
    })
    .select()
    .single();

  if (!error) {
    // P1 — Expurgar o cache de toda a árvore do dashboard para sincronização visual imediata
    revalidatePath("/dashboard", "layout");
  }

  return { data, error: error?.message ?? null };
}

export async function deleteCalendarEventAction(id: string) {
  const supabase = await createClient();

  // P1 — Validação de segurança rigorosa na Server Action
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Acesso negado: Usuário não autenticado." };
  }

  // P2 — Remoção física/lógica do evento (CRUD de eventos do calendário)
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id);

  if (!error) {
    revalidatePath("/dashboard", "layout");
  }

  return { error: error?.message ?? null };
}