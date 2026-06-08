import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerStats } from "@/types";

export interface CustomerPurchase {
  id: string;
  amount: number;
  sale_date: string;
  channel: string | null;
  pdv_number: string | null;
  seller_name: string;
}

export interface CustomerDetail {
  compras: CustomerPurchase[];
  canalPreferido: string | null;
  nota: string;
}

export async function getCustomerDetail(
  supabase: SupabaseClient,
  customerName: string
): Promise<CustomerDetail> {
  const [salesResult, noteResult] = await Promise.all([
    supabase
      .from("sales")
      .select("id, amount, sale_date, channel, pdv_number, seller:sellers(name)")
      .eq("customer_name", customerName)
      .in("status", ["Aprovado", "Concluída"])
      .order("sale_date", { ascending: false }),
    supabase
      .from("customer_notes")
      .select("note")
      .eq("customer_name", customerName)
      .maybeSingle(),
  ]);

  const compras: CustomerPurchase[] = (salesResult.data ?? []).map((row: any) => ({
    id: row.id,
    amount: Number(row.amount),
    sale_date: (row.sale_date as string)?.slice(0, 10) ?? "",
    channel: row.channel ?? null,
    pdv_number: row.pdv_number ?? null,
    seller_name: row.seller?.name ?? "—",
  }));

  // Canal preferido: o que aparece mais nas compras
  const channelCount: Record<string, number> = {};
  for (const c of compras) {
    const ch = c.channel ?? "sem canal";
    channelCount[ch] = (channelCount[ch] ?? 0) + 1;
  }
  const canalPreferido =
    Object.keys(channelCount).length > 0
      ? Object.entries(channelCount).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  return {
    compras,
    canalPreferido,
    nota: noteResult.data?.note ?? "",
  };
}

export async function saveCustomerNote(
  supabase: SupabaseClient,
  customerName: string,
  note: string,
  updatedBy?: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("customer_notes").upsert(
    { customer_name: customerName, note, updated_by: updatedBy ?? null, updated_at: new Date().toISOString() },
    { onConflict: "customer_name" }
  );
  return { error: error?.message ?? null };
}

// Clientes genéricos de balcão presencial — excluídos da análise de CRM
// mas as vendas continuam contabilizadas normalmente nos totais
const CLIENTES_IGNORADOS = /^cliente\s+balc[aã]o$/i;

export async function getCustomerStats(
  supabase: SupabaseClient,
  startDate?: string,
  endDate?: string
): Promise<CustomerStats[]> {
  let query = supabase
    .from("sales")
    .select("customer_name, amount, sale_date, pdv_number, seller:sellers(name)")
    .not("customer_name", "is", null)
    .neq("customer_name", "")
    .in("status", ["Aprovado", "Concluída"]);

  if (startDate) query = query.gte("sale_date", `${startDate}T00:00:00`);
  if (endDate) query = query.lte("sale_date", `${endDate}T23:59:59`);

  const { data, error } = await query;
  if (error || !data) return [];

  const map = new Map<
    string,
    {
      total_gasto: number;
      total_compras: number;
      ultima_compra: string;
      atendentes: Set<string>;
    }
  >();

  for (const row of data) {
    const name = (row.customer_name as string).trim();
    if (!name || CLIENTES_IGNORADOS.test(name)) continue;
    const entry = map.get(name) ?? {
      total_gasto: 0,
      total_compras: 0,
      ultima_compra: "",
      atendentes: new Set<string>(),
    };
    entry.total_gasto += Number(row.amount);
    entry.total_compras += 1;
    const saleDate = (row.sale_date as string | null) ?? "";
    if (saleDate && (!entry.ultima_compra || saleDate > entry.ultima_compra)) {
      entry.ultima_compra = saleDate;
    }
    const sellerName = (row.seller as any)?.name as string | undefined;
    if (sellerName) entry.atendentes.add(sellerName);
    map.set(name, entry);
  }

  const allTotals = [...map.values()].map((e) => e.total_gasto).sort((a, b) => b - a);
  const vipThreshold = allTotals.length > 0 ? allTotals[Math.floor(allTotals.length * 0.2)] ?? 0 : 0;

  const hoje = new Date().toISOString().split("T")[0];

  return [...map.entries()]
    .map(([name, e]) => {
      const ultimaDate = e.ultima_compra ? e.ultima_compra.slice(0, 10) : "";
      const dias =
        ultimaDate
          ? Math.floor(
              (new Date(hoje).getTime() - new Date(ultimaDate).getTime()) / 86_400_000
            )
          : 999;
      const ticket_medio = e.total_compras > 0 ? e.total_gasto / e.total_compras : 0;

      let status: CustomerStats["status"] = "regular";
      if (dias > 30) status = "dormente";
      else if (e.total_compras === 1) status = "novo";
      else if (e.total_gasto >= vipThreshold && e.total_compras >= 2) status = "vip";

      return {
        customer_name: name,
        total_gasto: e.total_gasto,
        total_compras: e.total_compras,
        ultima_compra: ultimaDate,
        ticket_medio,
        atendentes: [...e.atendentes],
        dias_sem_comprar: dias,
        status,
      };
    })
    .sort((a, b) => b.total_gasto - a.total_gasto);
}
