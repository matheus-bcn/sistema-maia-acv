"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createSale, importSalesFromRows } from "@/lib/data/sales";

export async function createSaleAction(input: {
  seller_id: string;
  amount: number;
  sale_date: string;
  channel: string;
}) {
  const supabase = await createClient();

  // P1 - Validação de segurança na Server Action
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Acesso negado: Usuário não autenticado." };
  }

  const result = await createSale(supabase, input);
  
  if (!result.error) {
    revalidatePath("/");
    revalidatePath("/dashboard", "layout");
    revalidatePath("/modo-tv", "page");
  }
  
  return result;
}

export async function importSalesAction(
  rows: { seller_id: string; amount: number; channel?: string; sale_date?: string }[]
) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Acesso negado: Usuário não autenticado." };
  }

  const result = await importSalesFromRows(supabase, rows);
  
  if (!result.error) {
    revalidatePath("/");
    revalidatePath("/dashboard", "layout");
    revalidatePath("/modo-tv", "page");
  }
  
  return result;
}

export async function deleteSaleAction(id: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Acesso negado: Usuário não autenticado." };
  }

  const { error } = await supabase
    .from("sales")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao deletar venda no banco:", error);
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/modo-tv", "page");

  return { error: null };
}

// ========================================================
// MOTOR DE IMPORTAÇÃO AUTOMÁTICA NATIVA (ZERO DEPENDÊNCIAS)
// ========================================================
export async function importPdvReportAction(formData: FormData, sellerId: string) {
  const supabase = await createClient();

  // 1. Validação de Segurança
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Acesso negado: Usuário não autenticado." };
  }

  if (!sellerId) {
    return { error: "Por favor, selecione um vendedor antes de processar." };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { error: "Nenhum arquivo foi enviado." };
  }

  try {
    // Lê o arquivo CSV/TXT nativamente como texto puro sem usar pacotes externos vulneráveis
    const textContent = await file.text();

    const { data: sellerData } = await supabase
      .from("sellers")
      .select("name")
      .eq("id", sellerId)
      .maybeSingle();

    const sellerName = sellerData?.name ?? "Vendedor Selecionado";

    const rows: { seller_id: string; amount: number; sale_date: string; channel: string }[] = [];
    const lines = textContent.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Quebra a linha considerando a estrutura de colunas separadas por vírgula do Word/CSV
      const columns = line.split(",");

      if (columns.length >= 4) {
        // Encontra a coluna que possui o padrão de data (DD/MM/AAAA)
        const dateStr = columns.find(col => /(\d{2})\/(\d{2})\/(\d{4})/.test(col));
        // Encontra a coluna que possui o número do PDV (6 dígitos iniciando com 113)
        const pdvStr = columns.find(col => /\b(113\d{3})\b/.test(col));

        if (dateStr && pdvStr) {
          const dateMatch = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (dateMatch) {
            const day = dateMatch[1];
            const month = dateMatch[2];
            const year = dateMatch[3];
            const sale_date = `${year}-${month}-${day}`; // Conversão para formato do banco (AAAA-MM-DD)

            // Limpa as aspas do valor total (geralmente posicionado na última coluna)
            const rawAmount = columns[columns.length - 1].replace(/"/g, "").trim();
            const amount = parseFloat(rawAmount.replace(/\./g, "").replace(",", "."));

            if (!isNaN(amount) && amount > 0) {
              rows.push({
                seller_id: sellerId,
                amount,
                sale_date,
                channel: "atendimento" // Força o canal atendimento conforme regra de negócio
              });
            }
          }
        }
      } else {
        // Fallback caso as linhas venham separadas por espaços/tabulações originais do sistema
        const dateMatch = line.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        const pdvMatch = line.match(/\b(113\d{3})\b/);

        if (dateMatch && pdvMatch) {
          const day = dateMatch[1];
          const month = dateMatch[2];
          const year = dateMatch[3];
          const sale_date = `${year}-${month}-${day}`;

          const moneyMatches = line.match(/(\d{1,3}(\.\d{3})*,\d{2}|\d+,\d{2})/g);
          if (moneyMatches && moneyMatches.length > 0) {
            const rawAmount = moneyMatches[moneyMatches.length - 1];
            const amount = parseFloat(rawAmount.replace(/\./g, "").replace(",", "."));

            if (!isNaN(amount) && amount > 0) {
              rows.push({
                seller_id: sellerId,
                amount,
                sale_date,
                channel: "atendimento"
              });
            }
          }
        }
      }
    }

    if (rows.length === 0) {
      return { 
        error: "Não foi possível identificar nenhuma linha de venda legítima. Certifique-se de salvar o arquivo no formato CSV ou Texto (.txt)." 
      };
    }

    // Salva o lote completo de vendas de uma só vez no banco de dados
    const result = await importSalesFromRows(supabase, rows);

    if (result.error) {
      return { error: result.error };
    }

    revalidatePath("/");
    revalidatePath("/dashboard", "layout");
    revalidatePath("/modo-tv", "page");
    revalidatePath("/historico");

    return { 
      success: true, 
      inserted: result.inserted, 
      sellerName 
    };

  } catch (err: any) {
    console.error("Falha ao ler arquivo:", err);
    return { error: "Erro crítico ao ler o arquivo de texto enviado: " + err.message };
  }
}