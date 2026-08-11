"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSellerAdmin } from "@/lib/auth";

export async function createCalendarEventAction(input: {
  title: string;
  event_type: "reuniao" | "campanha" | "fechamento";
  event_day: number;
  month: number;
  year: number;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Acesso negado: Usuário não autenticado." };

  // Correção de Arquitetura: Conversão para o formato DATE (YYYY-MM-DD) do PostgreSQL
  const formattedDate = `${input.year}-${String(input.month).padStart(2, '0')}-${String(input.event_day).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      title: input.title,
      event_type: input.event_type,
      event_date: formattedDate,
    })
    .select()
    .single();

  if (!error) revalidatePath("/dashboard", "layout");

  return { data, error: error?.message ?? null };
}

export async function deleteCalendarEventAction(id: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Acesso negado: Usuário não autenticado." };

  if (!(await isSellerAdmin(supabase, user.id, user.email))) {
    return { error: "Acesso negado: apenas administradores podem excluir eventos do calendário." };
  }

  const { error } = await supabase.from("calendar_events").delete().eq("id", id);

  if (!error) revalidatePath("/dashboard", "layout");

  return { error: error?.message ?? null };
}