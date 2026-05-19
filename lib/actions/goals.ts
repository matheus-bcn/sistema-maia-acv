"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  upsertTeamGoal,
  upsertIndividualBaseGoal,
} from "@/lib/data/goals";

export async function saveTeamGoalAction(targetValue: number) {
  const supabase = await createClient();

  // Validação de segurança na Server Action
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Acesso negado: Usuário não autenticado." };
  }

  const result = await upsertTeamGoal(supabase, targetValue);
  
  if (!result.error) {
    revalidatePath("/dashboard", "layout");
    revalidatePath("/modo-tv", "page");
  }
  
  return result;
}

export async function saveIndividualBaseGoalAction(targetValue: number) {
  const supabase = await createClient();

  // Validação de segurança na Server Action
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Acesso negado: Usuário não autenticado." };
  }

  const result = await upsertIndividualBaseGoal(supabase, targetValue);
  
  if (!result.error) {
    revalidatePath("/dashboard", "layout");
    revalidatePath("/modo-tv", "page");
  }
  
  return result;
}