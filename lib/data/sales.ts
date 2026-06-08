import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChartPoint, Sale, SaleStatus } from "@/types";

export async function listSales(
  supabase: SupabaseClient,
  options?: { limit?: number; status?: SaleStatus; startDate?: string; endDate?: string }
): Promise<Sale[]> {
  let query = supabase.from("sales").select("*, seller:sellers(*)").order("sale_date", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.limit) query = query.limit(options.limit);
  
  if (options?.startDate) query = query.gte("sale_date", options.startDate);
  if (options?.endDate) query = query.lte("sale_date", options.endDate);

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Sale[];
}

export async function getApprovedSalesTotals(supabase: SupabaseClient): Promise<{ total: number; count: number }> {
  const { data, error } = await supabase.from("sales").select("amount").in("status", ["Aprovado", "Concluída"]);
  if (error || !data) return { total: 0, count: 0 };
  return { total: data.reduce((acc, row) => acc + Number(row.amount), 0), count: data.length };
}

export async function getApprovedSalesTotalsForMonth(
  supabase: SupabaseClient, startDate?: string, endDate?: string
): Promise<{ total: number; count: number }> {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, date.getMonth() + 1, 0).getDate();
  
  const start = startDate || `${y}-${m}-01`;
  const end = endDate || `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from("sales")
    .select("amount")
    .in("status", ["Aprovado", "Concluída"])
    .gte("sale_date", start)
    .lte("sale_date", end);

  if (error || !data) return { total: 0, count: 0 };
  return { total: data.reduce((acc, row) => acc + Number(row.amount), 0), count: data.length };
}

export async function getSalesBySeller(
  supabase: SupabaseClient, startDate?: string, endDate?: string
): Promise<Map<string, { total: number; count: number }>> {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, date.getMonth() + 1, 0).getDate();
  
  const start = startDate || `${y}-${m}-01`;
  const end = endDate || `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from("sales")
    .select("seller_id, amount")
    .in("status", ["Aprovado", "Concluída"])
    .gte("sale_date", start)
    .lte("sale_date", end);

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
  supabase: SupabaseClient, startDate?: string, endDate?: string
): Promise<ChartPoint[]> {
  const now = new Date();
  const start = startDate ? new Date(`${startDate}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = endDate ? new Date(`${endDate}T23:59:59`) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const diffTime = end.getTime() - start.getTime();
  const totalDays = Math.min(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1, 31); 
  
  const prevStart = new Date(start.getTime() - diffTime);
  const prevEnd = new Date(end.getTime() - diffTime);

  const formatDB = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const [curRes, prevRes] = await Promise.all([
    supabase.from("sales").select("amount, sale_date").in("status", ["Aprovado", "Concluída"]).gte("sale_date", formatDB(start)).lte("sale_date", formatDB(end)),
    supabase.from("sales").select("amount, sale_date").in("status", ["Aprovado", "Concluída"]).gte("sale_date", formatDB(prevStart)).lte("sale_date", formatDB(prevEnd)),
  ]);

  const buckets = (rows: { amount: number; sale_date: string }[] | null, baseDate: Date) => {
    const acc = new Array(totalDays).fill(0);
    for (const row of rows ?? []) {
      const rowDate = new Date(`${row.sale_date}T12:00:00`);
      const baseMid = new Date(baseDate);
      baseMid.setHours(12, 0, 0, 0);
      
      const dayOffset = Math.floor((rowDate.getTime() - baseMid.getTime()) / (1000 * 60 * 60 * 24));
      if (dayOffset >= 0 && dayOffset < totalDays) acc[dayOffset] += Number(row.amount);
    }
    let running = 0;
    return acc.map((v) => { running += v; return running; });
  };

  const atual = buckets(curRes.data as any, start);
  const anterior = buckets(prevRes.data as any, prevStart);

  const result: ChartPoint[] = [];
  for(let i = 0; i < totalDays; i++) {
    const labelDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    result.push({
      dia: `${String(labelDate.getDate()).padStart(2, "0")}/${String(labelDate.getMonth() + 1).padStart(2, "0")}`,
      atual: atual[i] ?? 0,
      anterior: anterior[i] ?? 0,
    });
  }

  if (totalDays > 15) {
    return result.filter((_, idx) => idx % Math.ceil(totalDays / 7) === 0 || idx === totalDays - 1);
  }
  return result;
}

// Dados diários para comparativo mês atual vs mês anterior
// Cada ponto representa as vendas daquele dia (não acumulado)
export async function getDailyComparisonData(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
  sellerId?: string
): Promise<{ day: string; atual: number; anterior: number }[]> {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);

  // Período anterior: mesmas datas um mês antes
  const prevStart = new Date(start);
  prevStart.setMonth(prevStart.getMonth() - 1);
  const prevEnd = new Date(end);
  prevEnd.setMonth(prevEnd.getMonth() - 1);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  let curQ = supabase.from("sales").select("amount, sale_date")
    .in("status", ["Aprovado", "Concluída"])
    .gte("sale_date", fmt(start)).lte("sale_date", fmt(end));
  let prevQ = supabase.from("sales").select("amount, sale_date")
    .in("status", ["Aprovado", "Concluída"])
    .gte("sale_date", fmt(prevStart)).lte("sale_date", fmt(prevEnd));

  if (sellerId) {
    curQ = curQ.eq("seller_id", sellerId);
    prevQ = prevQ.eq("seller_id", sellerId);
  }

  const [curRes, prevRes] = await Promise.all([curQ, prevQ]);

  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const curBuckets = new Array(totalDays).fill(0);
  const prevBuckets = new Array(totalDays).fill(0);

  for (const row of curRes.data ?? []) {
    const d = new Date(`${row.sale_date}T12:00:00`);
    const idx = Math.round((d.getTime() - start.getTime()) / 86400000);
    if (idx >= 0 && idx < totalDays) curBuckets[idx] += Number(row.amount);
  }
  for (const row of prevRes.data ?? []) {
    const d = new Date(`${row.sale_date}T12:00:00`);
    const idx = Math.round((d.getTime() - prevStart.getTime()) / 86400000);
    if (idx >= 0 && idx < totalDays) prevBuckets[idx] += Number(row.amount);
  }

  return Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(start.getTime() + i * 86400000);
    return {
      day: String(d.getDate()).padStart(2, "0"),
      atual: curBuckets[i],
      anterior: prevBuckets[i],
    };
  });
}

// RESTAURAÇÃO DA FUNÇÃO DO CALENDÁRIO COM BLINDAGEM DE FUSO HORÁRIO
export async function getDailySalesForMonth(
  supabase: SupabaseClient,
  month: number,
  year: number
): Promise<Map<number, number>> {
  const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data } = await supabase
    .from("sales")
    .select("amount, sale_date")
    .in("status", ["Aprovado", "Concluída"])
    .gte("sale_date", startStr)
    .lte("sale_date", endStr);

  const map = new Map<number, number>();
  for (const row of data ?? []) {
    const day = parseInt(row.sale_date.split('-')[2], 10);
    map.set(day, (map.get(day) ?? 0) + Number(row.amount));
  }
  return map;
}

export async function createSale(
  supabase: SupabaseClient,
  input: {
    seller_id: string;
    amount: number;
    status?: SaleStatus;
    sale_date: string;
    channel: string;
    customer_name?: string;
    pdv_number?: string;
  }
): Promise<{ sale: Sale | null; error: string | null }> {
  const { data, error } = await supabase.from("sales").insert({
    seller_id: input.seller_id,
    amount: input.amount,
    status: input.status ?? "Concluída",
    sale_date: input.sale_date,
    channel: input.channel,
    customer_name: input.customer_name || null,
    pdv_number: input.pdv_number || null,
  }).select("*, seller:sellers(*)").single();

  return { sale: (data as Sale) ?? null, error: error?.message ?? null };
}

export async function importSalesFromRows(
  supabase: SupabaseClient,
  rows: {
    seller_id: string;
    amount: number;
    channel?: string;
    sale_date?: string;
    customer_name?: string;
    pdv_number?: string;
  }[]
): Promise<{ inserted: number; error: string | null }> {
  if (rows.length === 0) return { inserted: 0, error: null };

  const date = new Date();
  const safeDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

  const payload = rows.map((r) => ({
    seller_id: r.seller_id,
    amount: r.amount,
    status: "Concluída" as const,
    channel: r.channel ?? "comercial",
    sale_date: r.sale_date ?? safeDate,
    customer_name: r.customer_name || null,
    pdv_number: r.pdv_number || null,
  }));

  const { data, error } = await supabase.from("sales").insert(payload).select("id");
  return { inserted: data?.length ?? 0, error: error?.message ?? null };
}

export async function getLatestSale(supabase: SupabaseClient): Promise<Sale | null> {
  const { data } = await supabase.from("sales").select("*, seller:sellers(*)").in("status", ["Aprovado", "Concluída"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as Sale) ?? null;
}