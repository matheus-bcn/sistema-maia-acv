import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardStats } from "@/types";
import { getTeamGoal } from "@/lib/data/goals";
import { getApprovedSalesTotalsForMonth } from "@/lib/data/sales";
import { getSellerRankings } from "@/lib/data/sellers";

export async function getDashboardStats(
  supabase: SupabaseClient, startDate?: string, endDate?: string
): Promise<DashboardStats> {
  const [totals, metaGlobal, rankings] = await Promise.all([
    getApprovedSalesTotalsForMonth(supabase, startDate, endDate),
    getTeamGoal(supabase),
    getSellerRankings(supabase, startDate, endDate),
  ]);

  return { totalFaturado: totals.total, qtdVendas: totals.count, metaGlobal, topSeller: rankings[0] ?? null };
}

export function buildMaiaBriefing(total: number, meta: number): string {
  const porcentagem = meta > 0 ? ((total / meta) * 100).toFixed(1) : "0";
  return `Tudo sincronizado! Faturamos R$ ${total.toLocaleString("pt-BR")}. Já alcançamos ${porcentagem}% da nossa meta global.`;
}