"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createSeller, updateSellerStatus, updateSeller } from "@/lib/data/sellers";
import type { SellerStatus } from "@/types";

interface SellerForm {
  name: string;
  email: string;
  password?: string;
  category: string;
}

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Acesso negado: Usuário não autenticado." };

  const { data: sellerData } = await supabase.from("sellers").select("is_admin").eq("id", user.id).maybeSingle();
  if (!sellerData?.is_admin) return { error: "Acesso negado: apenas administradores podem gerenciar vendedores." };

  return { userId: user.id };
}

export async function createSellerAction(form: SellerForm) {
  const supabase = await createClient();

  const auth = await requireAdmin(supabase);
  if ("error" in auth) return { error: auth.error };

  if (!form.name.trim()) return { error: "O nome do vendedor é obrigatório." };

  const { seller, error } = await createSeller(supabase, {
    name: form.name,
    email: form.email,
    role: form.category, // Correção: Mapeia a "categoria" do modal para a coluna "role" do DB
    password: form.password,
    status: "Ativo"
  } as any);

  if (error) {
    console.error("Erro ao criar vendedor:", error);
    return { error };
  }

  revalidatePath("/equipe");
  revalidatePath("/dashboard", "layout");
  return { seller, error: null };
}

export async function updateSellerAction(id: string, form: SellerForm) {
  const supabase = await createClient();

  const auth = await requireAdmin(supabase);
  if ("error" in auth) return { error: auth.error };

  const { data, error } = await updateSeller(supabase, id, {
    name: form.name,
    email: form.email,
    role: form.category, // Correção: Mapeia a "categoria" do modal para a coluna "role" do DB
    password: form.password,
  });

  if (error) {
    console.error("Erro ao atualizar vendedor:", error);
    return { error };
  }

  revalidatePath("/equipe");
  revalidatePath("/dashboard", "layout");
  return { data, error: null };
}

export async function updateSellerStatusAction(id: string, status: SellerStatus) {
  const supabase = await createClient();

  const auth = await requireAdmin(supabase);
  if ("error" in auth) throw new Error(auth.error);

  const { error } = await updateSellerStatus(supabase, id, status);

  if (error) {
    console.error("Erro ao atualizar status:", error);
    throw new Error(error);
  }

  revalidatePath("/equipe");
  revalidatePath("/dashboard", "layout");
  return true;
}