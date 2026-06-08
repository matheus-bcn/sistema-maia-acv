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

    type ImportRow = {
      seller_id: string;
      amount: number;
      sale_date: string;
      channel: string;
      customer_name: string;
      pdv_number: string;
    };
    const rows: ImportRow[] = [];
    const lines = textContent.split(/\r?\n/);

    // Formato: {PV}  {PDV}  {DD/MM/YYYY}  {NOME DO CLIENTE}  {VALOR}
    // O PDV é o número da OS. Separadores são 2+ espaços (relatório de colunas fixas).
    const fullPattern = /^(\d+)\s+(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s{2,}([\d.,]+)\s*$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || !/^\d/.test(line)) continue;

      const match = line.match(fullPattern);
      if (match) {
        const pdv_number = match[2];
        const [d, m, y] = match[3].split("/");
        const sale_date = `${y}-${m}-${d}`;
        const customer_name = match[4].trim();
        const amount = parseFloat(match[5].replace(/\./g, "").replace(",", "."));

        if (!isNaN(amount) && amount > 0) {
          rows.push({ seller_id: sellerId, amount, sale_date, channel: "atendimento", customer_name, pdv_number });
        }
      } else {
        // Fallback para linhas sem cliente legível — extrai apenas data e valor
        const dateMatch = line.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        const amountMatch = line.match(/\s([\d.,]+)\s*$/);
        if (dateMatch && amountMatch) {
          const sale_date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
          const amount = parseFloat(amountMatch[1].replace(/\./g, "").replace(",", "."));
          if (!isNaN(amount) && amount > 0) {
            rows.push({ seller_id: sellerId, amount, sale_date, channel: "atendimento", customer_name: "", pdv_number: "" });
          }
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