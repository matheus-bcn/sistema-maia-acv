"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

type InsightTipo = "ALERTA" | "PARABENS" | "DICA" | "NEUTRO";

function classificarTipo(stats: any): InsightTipo {
  const pct = stats.metaGlobal > 0 ? (stats.totalFaturado / stats.metaGlobal) * 100 : 0;
  if (pct >= 100) return "PARABENS";
  if (pct < 60)   return "ALERTA";
  // Alterna entre DICA e NEUTRO para mais variedade
  return Math.random() > 0.5 ? "DICA" : "NEUTRO";
}

const PROMPTS: Record<InsightTipo, (stats: any) => string> = {
  ALERTA: (s) => `
Você é M.A.I.A, IA de análise comercial. Tom: direto e motivador.
Dados: Faturado R$ ${s.totalFaturado.toLocaleString('pt-BR')}, Meta R$ ${s.metaGlobal.toLocaleString('pt-BR')}, ${s.qtdVendas} vendas.
A equipe está ABAIXO da meta (${s.metaGlobal > 0 ? ((s.totalFaturado/s.metaGlobal)*100).toFixed(1) : 0}%).
Gere um alerta motivador com diagnóstico e plano de ação urgente.
Retorne APENAS JSON: {"titulo":"...","mensagem":"...","acao":"...","tipo":"ALERTA"}
Titulo: máx 6 palavras. Mensagem: 2 frases. Ação: 1 frase imperativa curta.`,

  PARABENS: (s) => `
Você é M.A.I.A, IA de análise comercial. Tom: eufórico e celebratório.
Dados: Faturado R$ ${s.totalFaturado.toLocaleString('pt-BR')}, Meta R$ ${s.metaGlobal.toLocaleString('pt-BR')}, ${s.qtdVendas} vendas.
A equipe BATEU a meta (${s.metaGlobal > 0 ? ((s.totalFaturado/s.metaGlobal)*100).toFixed(1) : 0}%)!
Celebre o resultado e sugira como manter o ritmo.
Retorne APENAS JSON: {"titulo":"...","mensagem":"...","acao":"...","tipo":"PARABENS"}
Titulo: máx 6 palavras. Mensagem: 2 frases celebratórias. Ação: 1 frase para manter o momentum.`,

  DICA: (s) => `
Você é M.A.I.A, IA de análise comercial. Tom: consultivo e estratégico.
Dados: Faturado R$ ${s.totalFaturado.toLocaleString('pt-BR')}, Meta R$ ${s.metaGlobal.toLocaleString('pt-BR')}, ${s.qtdVendas} vendas, ticket médio R$ ${s.qtdVendas > 0 ? (s.totalFaturado/s.qtdVendas).toFixed(0) : 0}.
Gere uma dica estratégica de vendas (upsell, gestão de pipeline, horários de pico, abordagem de cliente) adaptada aos dados.
Retorne APENAS JSON: {"titulo":"...","mensagem":"...","acao":"...","tipo":"DICA"}
Titulo: máx 6 palavras. Mensagem: 2 frases com a dica. Ação: 1 tarefa prática para hoje.`,

  NEUTRO: (s) => `
Você é M.A.I.A, IA de análise comercial. Tom: analítico e informativo.
Dados: Faturado R$ ${s.totalFaturado.toLocaleString('pt-BR')}, Meta R$ ${s.metaGlobal.toLocaleString('pt-BR')}, ${s.qtdVendas} vendas.
Gere uma análise do momento atual da equipe com projeção e observação sobre o ritmo.
Retorne APENAS JSON: {"titulo":"...","mensagem":"...","acao":"...","tipo":"NEUTRO"}
Titulo: máx 6 palavras. Mensagem: 2 frases analíticas. Ação: 1 próximo passo claro.`,
};

export async function obterBriefingIAAction(stats: any) {
  if (!process.env.GEMINI_API_KEY) {
    return { success: false, error: "Chave da IA não configurada." };
  }

  const tipo = classificarTipo(stats);

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = PROMPTS[tipo](stats);
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();

    const cleanText = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const parsed = JSON.parse(cleanText);

    return {
      success: true,
      titulo: parsed.titulo,
      briefing: parsed.mensagem,
      acao: parsed.acao,
      tipo: (parsed.tipo ?? tipo) as InsightTipo,
    };
  } catch (error) {
    console.error("Erro na IA:", error);
    const pct = stats.metaGlobal > 0 ? ((stats.totalFaturado / stats.metaGlobal) * 100).toFixed(1) : "0";
    return {
      success: false,
      titulo: "Análise do Período",
      briefing: `A equipe está em ${pct}% da meta com ${stats.qtdVendas} vendas registradas. Continue acompanhando o ritmo diário.`,
      acao: "Acesse o ranking e identifique quem precisa de apoio hoje.",
      tipo: tipo,
    };
  }
}

export async function analisarRelatorioAction(dadosRelatorio: any) {
  if (!process.env.GEMINI_API_KEY) {
    return { success: false, error: "GEMINI_API_KEY não configurada." };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Você é M.A.I.A, assistente de inteligência comercial. Analise os dados abaixo e gere um relatório executivo em português brasileiro.

Dados: ${JSON.stringify(dadosRelatorio)}

Formato obrigatório (texto corrido, sem markdown, sem asteriscos):
- Parágrafo 1: situação geral da equipe vs meta (2 frases)
- Parágrafo 2: destaque positivo e ponto de atenção (2 frases)
- Parágrafo 3: recomendação estratégica para os próximos dias (1 frase)

Máximo 120 palavras no total. Tom: direto, analítico, motivador.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return { success: true, insight: text };
  } catch (error: any) {
    console.error("Erro analisarRelatorioAction:", error?.message ?? error);
    return { success: false, error: "Falha ao conectar com a IA." };
  }
}
