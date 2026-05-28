"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createSale, importSalesFromRows } from "@/lib/data/sales";

export async function createSaleAction(input: {
  seller_id: string;
  amount: number;
  sale_date?: string;
  channel?: string;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Acesso negado: Usuário não autenticado." };

  const result = await createSale(supabase, {
    ...input,
    sale_date: input.sale_date || new Date().toISOString(),
    channel: input.channel || "comercial"
  });
  
  if (!result.error) {
    revalidatePath("/", "layout");
  }
  return result;
}

export async function deleteSaleAction(id: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Acesso negado: Usuário não autenticado." };

  const { error } = await supabase.from("sales").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

// ========================================================
// AÇÃO: EXCLUSÃO EM MASSA (LIMPAR MÊS)
// ========================================================
export async function deleteAllSalesAction(startDate: string, endDate: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Acesso negado: Usuário não autenticado." };

  const { error } = await supabase
    .from("sales")
    .delete()
    .gte("sale_date", `${startDate}T00:00:00`)
    .lte("sale_date", `${endDate}T23:59:59`);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

// ========================================================
// MOTOR DE IMPORTAÇÃO AUTOMÁTICA NATIVA (SISTEMA DE SCRAPING)
// ========================================================
export async function importPdvReportAction(formData: FormData, sellerId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Acesso negado: Usuário não autenticado." };
  if (!sellerId) return { error: "Por favor, selecione um vendedor antes de processar." };

  const file = formData.get("file") as File;
  if (!file) return { error: "Nenhum arquivo foi enviado." };

  try {
    const textContent = await file.text();
    const { data: sellerData } = await supabase.from("sellers").select("name").eq("id", sellerId).maybeSingle();
    const sellerName = sellerData?.name ?? "Vendedor Selecionado";

    const rows: { seller_id: string; amount: number; sale_date: string; channel: string }[] = [];
    const lines = textContent.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Filtro Ouro: Se a linha estiver vazia ou NÃO começar com um dígito (PV), pule-a.
      // Isso elimina cabeçalhos como "Data:", "Vendas:", "Total:", etc.
      if (!line || !/^\d/.test(line)) continue;

      // 1. Extrair a Data (Formato DD/MM/AAAA)
      const dateMatch = line.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      
      // 2. Extrair o Valor Financeiro (Busca a última sequência numérica no final da string)
      const amountMatch = line.match(/\s([\d.,]+)\s*$/);

      if (dateMatch && amountMatch) {
        const sale_date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
        
        // 3. Limpeza Matemática (Transforma "2.475,00" em 2475.00)
        const rawAmount = amountMatch[1];
        const cleanAmount = rawAmount.replace(/\./g, "").replace(",", ".");
        const amount = parseFloat(cleanAmount);

        // Apenas lança se for um valor real maior que zero
        if (!isNaN(amount) && amount > 0) {
          rows.push({ seller_id: sellerId, amount, sale_date, channel: "atendimento" });
        }
      }
    }

    if (rows.length === 0) {
      return { error: "Nenhuma linha válida encontrada. Verifique se o arquivo possui as transações com valores reais." };
    }

    const result = await importSalesFromRows(supabase, rows);
    if (result.error) return { error: result.error };

    revalidatePath("/", "layout");

    return { success: true, inserted: result.inserted, sellerName };

  } catch (err: any) {
    return { error: "Erro crítico ao ler o arquivo: " + err.message };
  }
}