"use server"

import { revalidatePath } from "next/cache";
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from "@/lib/supabase/server";

// 1. CRIAR VENDEDOR COM LOGIN SEGURO (E INTEGRAÇÃO COM TRIGGER DO DB)
export async function criarVendedorComLoginAction(
  nome: string, 
  email: string, 
  senha: string, 
  is_admin: boolean = false,
  phone: string = "",
  category: string = "Iniciante"
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Erro de ambiente: SUPABASE_SERVICE_ROLE_KEY ausente.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // A. Cria o usuário no Auth (Isso dispara a Trigger no DB que cria a linha em 'sellers')
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true,
      user_metadata: { name: nome } // Passa o nome para a Trigger
    });

    if (authError && !authError.message.includes("already been registered")) {
      throw new Error("Erro no Auth: " + authError.message);
    }

    const userId = authData?.user?.id;

    // B. Atualiza o perfil criado pela Trigger com as informações extras
    if (userId) {
      const { error: dbError } = await supabaseAdmin.from('sellers').update({
        phone: phone,
        role: category,
        is_admin: is_admin,
        status: 'Ativo'
      }).eq('id', userId);

      if (dbError) throw new Error("Erro ao atualizar perfil: " + dbError.message);
    }

    revalidatePath("/equipe");
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 2. ATUALIZAR STATUS DO VENDEDOR (Ativo/Inativo)
export async function updateSellerStatusAction(id: string, status: "Ativo" | "Inativo") {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Acesso negado.");

  const { error } = await supabase.from('sellers').update({ status }).eq('id', id);
  
  if (error) throw new Error(error.message);

  revalidatePath("/equipe");
  revalidatePath("/dashboard", "layout");
  return true;
}

// 3. DELETAR LOGIN E OCULTAR VENDEDOR (Soft Delete)
export async function deletarVendedorAction(id: string, email: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error("Credenciais de Admin ausentes.");

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // A. Soft Delete no banco
    const { error: dbError } = await supabaseAdmin.from('sellers').update({ 
      status: 'Inativo' 
    }).eq('id', id);

    if (dbError) throw new Error("Erro ao desativar vendedor: " + dbError.message);

    // B. Deleta o acesso na Autenticação
    const { data: { users }, error: authListError } = await supabaseAdmin.auth.admin.listUsers();
    if (authListError) throw new Error("Erro ao buscar usuários: " + authListError.message);

    const userToDelete = users.find(u => u.email === email);
    if (userToDelete) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);
      if (deleteError) throw new Error("Erro ao remover login: " + deleteError.message);
    }

    revalidatePath("/equipe");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}