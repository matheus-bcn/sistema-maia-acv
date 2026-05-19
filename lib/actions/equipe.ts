"use server"

import { createClient } from '@supabase/supabase-js'

// 1. AÇÃO PARA CRIAR VENDEDOR, LOGIN E TELEFONE (CORRIGIDA)
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
      throw new Error("Chave SUPABASE_SERVICE_ROLE_KEY não encontrada no .env.local. Pare o terminal e rode npm run dev novamente.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // A. Tenta criar o usuário na Autenticação do Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true 
    });

    // Se o usuário já existir no Auth, ignoramos o erro e seguimos para garantir a inserção na tabela
    if (authError && !authError.message.includes("already been registered")) {
      throw new Error("Erro no Auth: " + authError.message);
    }

    // B. Cadastra o perfil preenchendo APENAS as colunas que existem de fato ('phone' e 'role')
    const { error: dbError } = await supabaseAdmin.from('sellers').insert({
      name: nome,
      email: email,
      phone: phone,
      role: category,      // <-- CORREÇÃO: Salva o nível na coluna 'role' aceita pelo banco
      status: 'Ativo',
      is_admin: is_admin,
      is_deleted: false
    });

    if (dbError) {
      throw new Error("Erro no Banco (Sellers): " + dbError.message);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// 2. AÇÃO PARA DELETAR LOGIN E OCULTAR VENDEDOR (Soft Delete)
export async function deletarVendedorAction(id: string, email: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Chave SUPABASE_SERVICE_ROLE_KEY ausente. Verifique o .env.local e reinicie o servidor.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // A. Oculta o vendedor mantendo as vendas dele na estatística geral
    const { error: dbError } = await supabaseAdmin.from('sellers').update({ 
      status: 'Inativo', 
      is_deleted: true 
    }).eq('id', id);

    if (dbError) {
      throw new Error("Erro na Tabela Sellers: " + dbError.message + " (Verifique se a coluna 'is_deleted' foi criada).");
    }

    // B. Procura o usuário no Auth pelo e-mail e deleta o acesso
    const { data: { users }, error: authListError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authListError) {
      throw new Error("Erro ao buscar login: " + authListError.message);
    }

    const userToDelete = users.find(u => u.email === email);

    if (userToDelete) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);
      if (deleteError) throw new Error("Erro ao deletar login: " + deleteError.message);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}