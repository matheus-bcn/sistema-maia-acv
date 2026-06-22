"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 1. ATUALIZAR OU CRIAR META MENSAL DE EQUIPE
export async function updateMonthlyGoalAction(amount: number) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Acesso negado: Usuário não autenticado." };

  const { data: sellerData } = await supabase.from("sellers").select("is_admin").eq("id", user.id).maybeSingle();
  if (!sellerData?.is_admin) return { error: "Acesso negado: apenas administradores podem alterar a meta." };

  if (amount <= 0) return { error: "A meta deve ser maior que zero." };

  await supabase.from("goals").delete().eq("type", "equipe");

  const { error } = await supabase
    .from("goals")
    .insert({ type: "equipe", target_value: amount });

  if (error) return { error: error.message };

  revalidatePath("/configuracao", "page");
  revalidatePath("/dashboard", "layout");
  return { success: true, error: null };
}

// 2. CADASTRAR PREMIAÇÃO
export async function createAwardAction(title: string, requiredAmount: number, description: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Acesso negado." };

  const { data: sellerData } = await supabase.from("sellers").select("is_admin").eq("id", user.id).maybeSingle();
  if (!sellerData?.is_admin) return { error: "Acesso negado: apenas administradores podem criar premiações." };

  if (!title.trim()) return { error: "Título é obrigatório." };
  if (requiredAmount <= 0) return { error: "O valor requerido deve ser positivo." };

  const { error } = await supabase
    .from("awards")
    .insert({ title: title.trim(), required_amount: requiredAmount, description: description.trim() });

  if (error) return { error: error.message };

  revalidatePath("/premiacoes", "page");
  return { success: true, error: null };
}