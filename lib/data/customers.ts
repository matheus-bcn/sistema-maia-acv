import type { SupabaseClient } from "@supabase/supabase-js";
import type { CustomerStats } from "@/types";

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
    if (!name) continue;
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
