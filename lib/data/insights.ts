import type { InsightItem } from "@/types";
import type { SellerRanking } from "@/types";
import { getIndividualBaseGoal } from "@/lib/data/goals";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function generateInsights(
  supabase: SupabaseClient,
  rankings: SellerRanking[],
  totalFaturado: number,
  metaGlobal: number,
  startDate?: string, // Preparado para o período
  endDate?: string
): Promise<InsightItem[]> {
  const baseMeta = await getIndividualBaseGoal(supabase);
  const insights: InsightItem[] = [];
  let id = 1;

  const top = rankings[0];
  if (top && baseMeta > 0 && top.totalSales > baseMeta * 1.1) {
    const pct = (((top.totalSales - baseMeta) / baseMeta) * 100).toFixed(0);
    insights.push({
      id: id++,
      tipo: "sucesso",
      titulo: "Performance Excepcional",
      mensagem: `${top.seller.name} está performando ${pct}% acima da meta individual. Sugere-se reconhecimento público na próxima reunião.`,
      corTexto: "text-emerald-400",
      corIcone: "text-emerald-400",
    });
  }

  const pctMeta = metaGlobal > 0 ? (totalFaturado / metaGlobal) * 100 : 0;
  if (pctMeta > 0 && pctMeta < 70) {
    insights.push({
      id: id++,
      tipo: "alerta",
      titulo: "Ritmo abaixo da meta",
      mensagem: `Neste período, a equipe atingiu ${pctMeta.toFixed(1)}% da meta global estipulada. Considere uma campanha sprint para recuperar tração.`,
      corTexto: "text-yellow-400",
      corIcone: "text-yellow-400",
    });
  }

  if (rankings.length > 0) {
    const ticketMedio =
      rankings.reduce((s, r) => s + r.totalSales, 0) /
      Math.max(
        rankings.reduce((s, r) => s + r.salesCount, 0),
        1
      );
    insights.push({
      id: id++,
      tipo: "info",
      titulo: "Ticket médio da equipe",
      mensagem: `O ticket médio do período selecionado é de R$ ${ticketMedio.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.`,
      corTexto: "text-blue-400",
      corIcone: "text-blue-400",
    });
  }

  return insights;
}