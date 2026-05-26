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

  // CORREÇÃO: Garantindo que sale_date e channel nunca sejam undefined (exigência do TypeScript)
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
// MOTOR DE IMPORTAÇÃO AUTOMÁTICA NATIVA (ZERO DEPENDÊNCIAS)
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
      if (!line) continue;

      const columns = line.split(",");
      if (columns.length >= 4) {
        const dateStr = columns.find(col => /(\d{2})\/(\d{2})\/(\d{4})/.test(col));
        const pdvStr = columns.find(col => /\b(113\d{3})\b/.test(col));

        if (dateStr && pdvStr) {
          const dateMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (dateMatch) {
            const sale_date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
            
            // Otimização: Regex mais robusto para extrair apenas o valor financeiro limpo
            const rawAmount = columns[columns.length - 1].replace(/[^\d,-]/g, "");
            const amount = parseFloat(rawAmount.replace(",", "."));

            if (!isNaN(amount) && amount > 0) {
              rows.push({ seller_id: sellerId, amount, sale_date, channel: "atendimento" });
            }
          }
        }
      }
    }

    if (rows.length === 0) {
      return { error: "Nenhuma linha válida encontrada. O formato deve conter Data (DD/MM/AAAA) e PDV." };
    }

    const result = await importSalesFromRows(supabase, rows);
    if (result.error) return { error: result.error };

    revalidatePath("/", "layout");

    return { success: true, inserted: result.inserted, sellerName };

  } catch (err: any) {
    return { error: "Erro crítico ao ler o arquivo: " + err.message };
  }
}