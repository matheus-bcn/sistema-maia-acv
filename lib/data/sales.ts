import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChartPoint, Sale, SaleStatus } from "@/types";

export async function listSales(
  supabase: SupabaseClient,
  options?: { limit?: number; status?: SaleStatus; startDate?: string; endDate?: string }
): Promise<Sale[]> {
  let query = supabase
    .from("sales")
    .select("*, seller:sellers(*)")
    .order("sale_date", { ascending: false }); // Ordena pela data real da venda

  if (options?.status) query = query.eq("status", options.status);
  if (options?.limit) query = query.limit(options.limit);
  
  // Alterado para filtrar pela coluna sale_date escolhida no modal
  if (options?.startDate) query = query.gte("sale_date", `${options.startDate}T00:00:00.000Z`);
  if (options?.endDate) query = query.lte("sale_date", `${options.endDate}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Sale[];
}

export async function getApprovedSalesTotals(supabase: SupabaseClient): Promise<{
  total: number;
  count: number;
}> {
  // Aceita tanto "Aprovado" quanto "Concluída" para não quebrar o dashboard
  const { data, error } = await supabase
    .from("sales")
    .select("amount")
    .in("status", ["Aprovado", "Concluída"]);

  if (error || !data) return { total: 0, count: 0 };

  const total = data.reduce((acc, row) => acc + Number(row.amount), 0);
  return { total, count: data.length };
}

export async function getApprovedSalesTotalsForMonth(
  supabase: SupabaseClient,
  startDate?: string,
  endDate?: string
): Promise<{ total: number; count: number }> {
  let startStr, endStr;
  
  if (startDate && endDate) {
    startStr = `${startDate}T00:00:00.000Z`;
    endStr = `${endDate}T23:59:59.999Z`;
  } else {
    const now = new Date();
    startStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    endStr = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  }

  // Filtragem e status sincronizados com a coluna sale_date
  const { data, error } = await supabase
    .from("sales")
    .select("amount")
    .in("status", ["Aprovado", "Concluída"])
    .gte("sale_date", startStr)
    .lte("sale_date", endStr);

  if (error || !data) return { total: 0, count: 0 };

  const total = data.reduce((acc, row) => acc + Number(row.amount), 0);
  return { total, count: data.length };
}

export async function getSalesBySeller(
  supabase: SupabaseClient,
  startDate?: string,
  endDate?: string
): Promise<Map<string, { total: number; count: number }>> {
  let startStr, endStr;
  
  if (startDate && endDate) {
    startStr = `${startDate}T00:00:00.000Z`;
    endStr = `${endDate}T23:59:59.999Z`;
  } else {
    const now = new Date();
    startStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    endStr = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  }

  // Sincronizado para buscar vendas com base na data do calendário do modal
  const { data, error } = await supabase
    .from("sales")
    .select("seller_id, amount")
    .in("status", ["Aprovado", "Concluída"])
    .gte("sale_date", startStr)
    .lte("sale_date", endStr);

  const map = new Map<string, { total: number; count: number }>();
  if (error || !data) return map;

  for (const row of data) {
    const key = row.seller_id ?? "unknown";
    const cur = map.get(key) ?? { total: 0, count: 0 };
    cur.total += Number(row.amount);
    cur.count += 1;
    map.set(key, cur);
  }
  return map;
}

export async function getMonthlyChartData(
  supabase: SupabaseClient,
  startDate?: string,
  endDate?: string
): Promise<ChartPoint[]> {
  const now = new Date();
  
  const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(`${endDate}T23:59:59`) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  const totalDays = Math.min(diffDays, 31); 
  
  const prevStart = new Date(start.getTime() - diffTime);
  const prevEnd = new Date(end.getTime() - diffTime);

  // Queries atualizadas para ler da coluna sale_date
  const [curRes, prevRes] = await Promise.all([
    supabase
      .from("sales")
      .select("amount, sale_date")
      .in("status", ["Aprovado", "Concluída"])
      .gte("sale_date", start.toISOString())
      .lte("sale_date", end.toISOString()),
    supabase
      .from("sales")
      .select("amount, sale_date")
      .in("status", ["Aprovado", "Concluída"])
      .gte("sale_date", prevStart.toISOString())
      .lte("sale_date", prevEnd.toISOString()),
  ]);

  const buckets = (rows: { amount: number; sale_date: string }[] | null, baseDate: Date) => {
    const acc = new Array(totalDays).fill(0);
    for (const row of rows ?? []) {
      const rowDate = new Date(row.sale_date);
      const dayOffset = Math.floor((rowDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
      if (dayOffset >= 0 && dayOffset < totalDays) {
        acc[dayOffset] += Number(row.amount);
      }
    }
    let running = 0;
    return acc.map((v) => {
      running += v;
      return running;
    });
  };

  const atual = buckets(curRes.data as any, start);
  const anterior = buckets(prevRes.data as any, prevStart);

  const result: ChartPoint[] = [];
  for(let i = 0; i < totalDays; i++) {
    const labelDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const diaFormatado = `${String(labelDate.getDate()).padStart(2, "0")}/${String(labelDate.getMonth() + 1).padStart(2, "0")}`;
    result.push({
      dia: diaFormatado,
      atual: atual[i] ?? 0,
      anterior: anterior[i] ?? 0,
    });
  }

  if (totalDays > 15) {
    return result.filter((_, idx) => idx % Math.ceil(totalDays / 7) === 0 || idx === totalDays - 1);
  }
  
  return result;
}

export async function getDailySalesForMonth(
  supabase: SupabaseClient,
  month: number,
  year: number
): Promise<Map<number, number>> {
  const start = new Date(year, month - 1, 1).toISOString();
  const end = new Date(year, month, 0, 23, 59, 59).toISOString();

  const { data } = await supabase
    .from("sales")
    .select("amount, sale_date")
    .in("status", ["Aprovado", "Concluída"])
    .gte("sale_date", start)
    .lte("sale_date", end);

  const map = new Map<number, number>();
  for (const row of data ?? []) {
    const day = new Date(row.sale_date).getDate();
    map.set(day, (map.get(day) ?? 0) + Number(row.amount));
  }
  return map;
}

// CORREÇÃO CRUCIAL: Adicionado mapeamento de channel e sale_date no insert
export async function createSale(
  supabase: SupabaseClient,
  input: {
    seller_id: string;
    amount: number;
    status?: SaleStatus;
    sale_date: string; // Adicionado na assinatura
    channel: string;   // Adicionado na assinatura
  }
): Promise<{ sale: Sale | null; error: string | null }> {
  const { data, error } = await supabase
    .from("sales")
    .insert({
      seller_id: input.seller_id,
      amount: input.amount,
      status: input.status ?? "Concluída",
      sale_date: input.sale_date, // Envia para a coluna certa no banco
      channel: input.channel,     // Envia para a coluna certa no banco
    })
    .select("*, seller:sellers(*)")
    .single();

  return { sale: (data as Sale) ?? null, error: error?.message ?? null };
}

export async function importSalesFromRows(
  supabase: SupabaseClient,
  rows: { seller_id: string; amount: number; channel?: string; sale_date?: string }[]
): Promise<{ inserted: number; error: string | null }> {
  if (rows.length === 0) return { inserted: 0, error: null };

  const payload = rows.map((r) => ({
    seller_id: r.seller_id,
    amount: r.amount,
    status: "Concluída" as const,
    channel: r.channel ?? "comercial",
    sale_date: r.sale_date ?? new Date().toISOString()
  }));

  const { data, error } = await supabase
    .from("sales")
    .insert(payload)
    .select("id");

  return {
    inserted: data?.length ?? 0,
    error: error?.message ?? null,
  };
}

export async function getLatestSale(
  supabase: SupabaseClient
): Promise<Sale | null> {
  const { data } = await supabase
    .from("sales")
    .select("*, seller:sellers(*)")
    .in("status", ["Aprovado", "Concluída"])
    .order("sale_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as Sale) ?? null;
}