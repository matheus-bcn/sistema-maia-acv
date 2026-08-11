"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createSale, importSalesFromRows } from "@/lib/data/sales";
import { getSellerGoal } from "@/lib/data/goals";
import { createNotification } from "@/lib/data/notifications";
import { isSellerAdmin } from "@/lib/auth";

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

  const { data: sale } = await supabase.from("sales").select("seller_id").eq("id", id).maybeSingle();
  if (!sale) return { error: "Venda não encontrada." };

  const isAdmin = await isSellerAdmin(supabase, user.id, user.email);

  if (sale.seller_id !== user.id && !isAdmin) {
    return { error: "Acesso negado: você não pode excluir vendas de outro vendedor." };
  }

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

  if (!(await isSellerAdmin(supabase, user.id, user.email))) {
    return { error: "Acesso negado: apenas administradores podem excluir vendas em massa." };
  }

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

type ImportRow = {
  seller_id: string;
  amount: number;
  sale_date: string;
  channel: string;
  customer_name: string;
  pdv_number: string;
};

// Normaliza nome de cliente: maiúsculas + espaços simples
function normalizeCustomerName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, " ");
}

// Detecta o formato do relatório pelo conteúdo do arquivo
function detectFileFormat(text: string): "atendimento" | "comercial" | "unknown" {
  // Assinatura do relatório comercial (O.S.)
  if (/OrctoEmiss|Vr\.Produzido|O\.S\. emitidas/i.test(text)) {
    return "comercial";
  }
  // Assinatura do relatório de atendimento (PDV):
  // Linhas de dados começam com dígitos, PDV, data com ano de 4 dígitos
  if (/^\d+\s+\d+\s+\d{2}\/\d{2}\/\d{4}/m.test(text)) {
    return "atendimento";
  }
  return "unknown";
}

// Parser para o relatório de Atendimento (PDV)
// Formato: {PV}  {PDV}  {DD/MM/YYYY}  {NOME DO CLIENTE}  {VALOR}
function parseAtendimentoReport(text: string, sellerId: string): ImportRow[] {
  const rows: ImportRow[] = [];
  const lines = text.split(/\r?\n/);
  const fullPattern = /^(\d+)\s+(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s{2,}([\d.,]+)\s*$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !/^\d/.test(trimmed)) continue;

    const match = trimmed.match(fullPattern);
    if (match) {
      const pdv_number = match[1]; // Nº da transação/venda (único por operação)
      const [d, m, y] = match[3].split("/");
      const sale_date = `${y}-${m}-${d}`;
      const customer_name = normalizeCustomerName(match[4]);
      const amount = parseFloat(match[5].replace(/\./g, "").replace(",", "."));
      if (!isNaN(amount) && amount > 0) {
        rows.push({ seller_id: sellerId, amount, sale_date, channel: "atendimento", customer_name, pdv_number });
      }
    } else {
      // Fallback: extrai apenas data e valor sem cliente
      const dateMatch = trimmed.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      const amountMatch = trimmed.match(/\s([\d.,]+)\s*$/);
      if (dateMatch && amountMatch) {
        const sale_date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
        const amount = parseFloat(amountMatch[1].replace(/\./g, "").replace(",", "."));
        if (!isNaN(amount) && amount > 0) {
          rows.push({ seller_id: sellerId, amount, sale_date, channel: "atendimento", customer_name: "", pdv_number: "" });
        }
      }
    }
  }

  return rows;
}

// Extrai o nome do cliente de uma linha do relatório comercial
function extractCustomerComercial(rawLine: string, isType2: boolean): string {
  if (isType2) {
    // Tipo 2: cliente aparece após /NN/ (código do vendedor)
    const afterSlash = rawLine.match(/\/\d+\/(.+)/);
    if (!afterSlash) return "";
    let part = afterSlash[1];
    // Corta no primeiro duplo espaço (descrição do produto começa ali)
    const dsi = part.indexOf("  ");
    if (dsi > -1) part = part.substring(0, dsi);
    // Remove terminadores de coluna do fim (ex: "Cancel.:", "l.:", "Dt.")
    for (let i = 0; i < 3; i++) {
      part = part.replace(/\s+(?:Cancel\.|cel\.|el\.|Dt\.|l\.|t\.)[:\s]*$/i, "").trim();
      part = part.replace(/\s+\.?:?\s*$/i, "").trim();
    }
    return part.trim();
  }

  // Tipo 1: cliente entre dois blocos de 4+ espaços após a data
  const m1 = rawLine.match(/\d{2}\/\d{2}\/\d+\s{4,}([^\s].+?)\s{4,}/);
  return m1 ? m1[1].trim() : "";
}

// Parser para o relatório Comercial (O.S.)
// O ano no campo de data é corrompido no export — extrai do cabeçalho do relatório
function parseComercialReport(text: string, sellerId: string, yearOverride?: string): ImportRow[] {
  const lines = text.split(/\r?\n/);
  const rows: ImportRow[] = [];

  // Extrai o ano real do cabeçalho — tenta múltiplos padrões nas primeiras 30 linhas
  let reportYear = yearOverride || "";
  if (!reportYear) {
    for (const line of lines.slice(0, 30)) {
      // Padrão 1: "emissão de 01/05/2025 a 31/05/2025"
      const m1 = line.match(/emiss[a\?ã]o\s+de\s+\d{2}\/\d{2}\/(\d{4})/i);
      if (m1) { reportYear = m1[1]; break; }
      // Padrão 2: qualquer data DD/MM/20XX no cabeçalho
      const m2 = line.match(/\d{2}\/\d{2}\/(20\d{2})/);
      if (m2) { reportYear = m2[1]; break; }
      // Padrão 3: ano isolado 20XX
      const m3 = line.match(/\b(20\d{2})\b/);
      if (m3) { reportYear = m3[1]; break; }
    }
  }
  if (!reportYear) reportYear = new Date().getFullYear().toString();

  for (const rawLine of lines) {
    // Linha de dados tipo 1: começa com 2+ espaços seguidos de 6 dígitos
    const isType1 = /^\s{2,}\d{6}/.test(rawLine);
    // Linha de dados tipo 2: começa com "Usu" (garbled "Usuário") seguido de 6 dígitos
    const isType2 = /^Usu.{0,4}\d{6}/.test(rawLine);
    if (!isType1 && !isType2) continue;

    // Ignora linha de totalização
    if (/Total de O\.S\.|listadas/i.test(rawLine)) continue;

    // Número da O.S. (primeiro bloco de 6 dígitos)
    const osMatch = rawLine.match(/(\d{6})/);
    if (!osMatch) continue;
    const pdv_number = osMatch[1];

    // Data: dia e mês da linha, ano do cabeçalho (o ano impresso está corrompido)
    const dateMatch = rawLine.match(/(\d{2})\/(\d{2})\/\d+/);
    if (!dateMatch) continue;
    const sale_date = `${reportYear}-${dateMatch[2]}-${dateMatch[1]}`;

    // Valor: último número monetário no fim da linha (Vr.Produzido)
    const valueMatch = rawLine.match(/\s+([\d.]+,\d{2})\s*$/);
    if (!valueMatch) continue;
    const amount = parseFloat(valueMatch[1].replace(/\./g, "").replace(",", "."));
    if (isNaN(amount) || amount <= 0) continue;

    const customer_name = normalizeCustomerName(extractCustomerComercial(rawLine, isType2));

    rows.push({ seller_id: sellerId, amount, sale_date, channel: "comercial", customer_name, pdv_number });
  }

  return rows;
}

export async function importPdvReportAction(
  formData: FormData,
  sellerId: string,
  canal: "atendimento" | "comercial",
  anoRelatorio?: string
) {
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

    // Valida se o formato do arquivo corresponde ao canal selecionado
    const detectedFormat = detectFileFormat(textContent);
    if (detectedFormat !== "unknown" && detectedFormat !== canal) {
      const canalLabel = canal === "comercial" ? "Comercial (O.S.)" : "Atendimento (PDV)";
      const detectadoLabel = detectedFormat === "comercial" ? "Comercial (O.S.)" : "Atendimento (PDV)";
      return {
        error: `Formato incorreto! Você selecionou "${canalLabel}" mas o arquivo parece ser do tipo "${detectadoLabel}". Verifique o arquivo e tente novamente para evitar erros na contabilidade.`,
      };
    }

    const rows =
      canal === "comercial"
        ? parseComercialReport(textContent, sellerId, anoRelatorio)
        : parseAtendimentoReport(textContent, sellerId);

    if (rows.length === 0) {
      return { error: "Nenhuma linha válida encontrada. Verifique se o arquivo possui transações com valores reais." };
    }

    // Deduplicação: remove linhas cujo número de transação já existe no banco para este vendedor
    const pdvNumbers = rows.map(r => r.pdv_number).filter(Boolean);
    let uniqueRows = rows;
    let skippedCount = 0;

    if (pdvNumbers.length > 0) {
      const { data: existingRecords } = await supabase
        .from("sales")
        .select("pdv_number")
        .eq("seller_id", sellerId)
        .in("pdv_number", pdvNumbers);

      if (existingRecords && existingRecords.length > 0) {
        const existingSet = new Set(existingRecords.map((r: any) => r.pdv_number).filter(Boolean));
        uniqueRows = rows.filter(r => !r.pdv_number || !existingSet.has(r.pdv_number));
        skippedCount = rows.length - uniqueRows.length;
      }
    }

    if (uniqueRows.length === 0) {
      return { error: `Relatório já importado. Todas as ${rows.length} transações já existem no sistema.` };
    }

    const result = await importSalesFromRows(supabase, uniqueRows);
    if (result.error) return { error: result.error };

    revalidatePath("/", "layout");

    // Verifica se o vendedor bateu a meta mensal após o import
    try {
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const [goalValue, { data: salesData }] = await Promise.all([
        getSellerGoal(supabase, sellerId),
        supabase.from("sales").select("amount").eq("seller_id", sellerId).gte("sale_date", inicioMes).lte("sale_date", fimMes).in("status", ["Aprovado", "Concluída"]),
      ]);

      const totalMes = (salesData ?? []).reduce((s, r) => s + Number(r.amount), 0);

      if (totalMes >= goalValue) {
        const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
        const { data: jaNotificou } = await supabase
          .from("notifications")
          .select("id")
          .eq("seller_id", sellerId)
          .eq("type", "meta_batida")
          .gte("created_at", `${mesAno}-01T00:00:00`)
          .limit(1)
          .maybeSingle();

        if (!jaNotificou) {
          await createNotification(supabase, {
            seller_id: sellerId,
            type: "meta_batida",
            title: "Meta Mensal Batida!",
            message: `Parabéns, ${sellerName}! Você atingiu R$ ${totalMes.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} este mês, superando sua meta.`,
          });
        }
      }
    } catch { /* notificação é opcional, não bloqueia o import */ }

    return { success: true, inserted: result.inserted, skipped: skippedCount, sellerName };

  } catch (err: any) {
    return { error: "Erro crítico ao ler o arquivo: " + err.message };
  }
}
