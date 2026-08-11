import type { SupabaseClient } from "@supabase/supabase-js";
import type { Seller, SellerRanking, SellerStatus } from "@/types";
import { getSalesBySeller } from "@/lib/data/sales";
import { getIndividualBaseGoal } from "@/lib/data/goals";

export async function listSellers(supabase: SupabaseClient, status?: SellerStatus | "Todos"): Promise<Seller[]> {
  let query = supabase.from("sellers").select("*").order("name");
  if (status && status !== "Todos") query = query.eq("status", status);

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Seller[];
}

export async function getSellerRankings(supabase: SupabaseClient, startDate?: string, endDate?: string): Promise<SellerRanking[]> {
  const [sellers, salesMap] = await Promise.all([
    listSellers(supabase, "Ativo"),
    getSalesBySeller(supabase, startDate, endDate),
  ]);

  return sellers
    .map((seller) => {
      const stats = salesMap.get(seller.id) ?? { total: 0, count: 0 };
      return { seller, totalSales: stats.total, salesCount: stats.count, position: 0 };
    })
    .sort((a, b) => b.totalSales - a.totalSales)
    .map((r, i) => ({ ...r, position: i + 1 }));
}

export async function updateSellerStatus(supabase: SupabaseClient, id: string, status: SellerStatus): Promise<{ error: string | null }> {
  const { error } = await supabase.from("sellers").update({ status }).eq("id", id);
  return { error: error?.message ?? null };
}

export async function getSellerDiagnostics(supabase: SupabaseClient, startDate?: string, endDate?: string) {
  const [rankings, baseMeta] = await Promise.all([
    getSellerRankings(supabase, startDate, endDate),
    getIndividualBaseGoal(supabase),
  ]);

  return rankings.map((r) => {
    const pct = baseMeta > 0 ? r.totalSales / baseMeta : 0;
    const status: "acima" | "no-ritmo" | "abaixo" = pct >= 1 ? "acima" : pct < 0.7 ? "abaixo" : "no-ritmo";
    return { nome: r.seller.name, meta: baseMeta, realizado: r.totalSales, status };
  });
}

// CORREÇÃO: "any" removido do parâmetro supabase
export async function updateSeller(
  supabase: SupabaseClient,
  id: string,
  input: { name: string; email: string; role: string; password?: string }
) {
  const payload = {
    name: input.name,
    email: input.email,
    role: input.role, 
  };

  const { data, error } = await supabase.from("sellers").update(payload).eq("id", id).select().single();
  return { data, error: error ? error.message : null };
}