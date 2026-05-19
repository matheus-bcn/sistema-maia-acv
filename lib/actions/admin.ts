"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 1. CADASTRAR NOVO VENDEDOR
export async function createSellerAction(name: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Acesso negado: Usuário não autenticado." };

  if (!name.trim()) return { error: "O nome do vendedor é obrigatório." };

  const { data, error } = await supabase
    .from("sellers")
    .insert({ name, status: "ativo" }) // Assumindo que a tabela sellers tem um campo status
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath("/equipe", "page");
  revalidatePath("/dashboard", "layout"); // Atualiza dropdowns de nova venda
  return { data, error: null };
}

// 2. ATUALIZAR OU CRIAR META MENSAL
export async function updateMonthlyGoalAction(amount: number, month: number, year: number) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Acesso negado: Usuário não autenticado." };

  if (amount <= 0) return { error: "A meta deve ser maior que zero." };

  // Usamos upsert para atualizar se já existir uma meta para o mês/ano, ou criar uma nova
  const { error } = await supabase
    .from("goals")
    .upsert(
      { amount, month, year },
      { onConflict: 'month, year' } // Exige que exista uma constraint (unique) no banco para month+year
    );

  // Fallback caso não tenha a constraint unique configurada no banco
  if (error && error.code === '23505') {
     return { error: "Erro de conflito. Verifique as chaves da tabela goals." };
  } else if (error) {
     return { error: error.message };
  }

  revalidatePath("/configuracao", "page");
  revalidatePath("/dashboard", "layout");
  return { success: true, error: null };
}

// 3. CADASTRAR PREMIAÇÃO
export async function createAwardAction(title: string, requiredAmount: number, description: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Acesso negado." };

  const { error } = await supabase
    .from("awards")
    .insert({ title, required_amount: requiredAmount, description });

  if (error) return { error: error.message };

  revalidatePath("/premiacoes", "page");
  return { success: true, error: null };
}