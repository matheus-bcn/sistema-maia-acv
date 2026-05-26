// lib/actions/ai-actions.ts
"use server";

import { gerarBriefingIA, analisarRelatorioIA } from "@/lib/ai";

export async function obterBriefingIAAction(stats: any) {
  try {
    const briefing = await gerarBriefingIA({
      total: stats.totalFaturado,
      meta: stats.metaGlobal,
      vendas: stats.qtdVendas,
      topVendedor: stats.topSeller?.seller.name || "Nenhum"
    });
    return { success: true, briefing };
  } catch (error) {
    return { success: false, error: "Erro ao processar IA" };
  }
}

export async function analisarRelatorioAction(dadosRelatorio: any) {
  try {
    const insight = await analisarRelatorioIA(dadosRelatorio);
    return { success: true, insight };
  } catch (error) {
    return { success: false, error: "Erro ao gerar análise" };
  }
}