"use server"

import { revalidatePath } from "next/cache";
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isSellerAdmin } from "@/lib/auth";

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Acesso negado: usuário não autenticado." };

  if (!(await isSellerAdmin(supabase, user.id, user.email))) {
    return { error: "Acesso negado: apenas administradores." };
  }

  return { userId: user.id };
}

// 1. CRIAR VENDEDOR COM LOGIN SEGURO
export async function criarVendedorComLoginAction(
  nome: string,
  email: string,
  senha: string,
  is_admin: boolean = false,
  phone: string = "",
  category: string = "Iniciante"
) {
  const auth = await requireAdmin();
  if ("error" in auth) return { success: false, error: auth.error };

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Erro de ambiente: SUPABASE_SERVICE_ROLE_KEY ausente.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true,
      user_metadata: { name: nome },
    });

    if (authError && !authError.message.includes("already been registered")) {
      throw new Error("Erro no Auth: " + authError.message);
    }

    const userId = authData?.user?.id;

    if (userId) {
      const { error: dbError } = await supabaseAdmin.from('sellers').upsert({
        id: userId,
        name: nome,
        email: email,
        phone: phone,
        role: category,
        is_admin: is_admin, // safe: caller already verified as admin above
        status: 'Ativo',
      }, { onConflict: 'id' });

      if (dbError) throw new Error("Erro ao salvar perfil: " + dbError.message);
    } else {
      throw new Error("Não foi possível obter o ID do usuário criado no Auth.");
    }

    revalidatePath("/equipe");
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 2. DELETAR LOGIN E OCULTAR VENDEDOR
export async function deletarVendedorAction(id: string) {
  const auth = await requireAdmin();
  if ("error" in auth) return { success: false, error: auth.error };

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error("Credenciais de Admin ausentes.");

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { error: dbError } = await supabaseAdmin.from('sellers').update({
      status: 'Inativo',
    }).eq('id', id);

    if (dbError) throw new Error("Erro ao desativar vendedor: " + dbError.message);

    // Usar o ID diretamente — evita carregar todos os usuários do sistema
    try {
      await supabaseAdmin.auth.admin.deleteUser(id);
    } catch (authError: unknown) {
      const msg = authError instanceof Error ? authError.message : String(authError);
      if (!msg.toLowerCase().includes("not found")) {
        throw new Error("Erro ao remover login: " + msg);
      }
    }

    revalidatePath("/equipe");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
