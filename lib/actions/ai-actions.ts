"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

type InsightTipo = "ALERTA" | "PARABENS" | "DICA" | "NEUTRO";

export type MensagemHistorico = {
  role: "user" | "model";
  content: string;
};

export type ContextoMAIA = {
  periodo: { inicio: string; fim: string };
  stats: { totalFaturado: number; metaGlobal: number; qtdVendas: number };
  rankings: { nome: string; faturado: number; vendas: number; posicao: number }[];
  diagnosticos: { nome: string; realizado: number; meta: number; status: string }[];
};

function classificarTipo(stats: any): InsightTipo {
  const pct = stats.metaGlobal > 0 ? (stats.totalFaturado / stats.metaGlobal) * 100 : 0;
  if (pct >= 100) return "PARABENS";
  if (pct < 60)   return "ALERTA";
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const d = dadosRelatorio;
    const pct = d.metaEquipe > 0 ? ((d.faturamentoTotal / d.metaEquipe) * 100).toFixed(1) : "0";
    const abaixo = (d.vendedores ?? []).filter((v: any) => v.status === "abaixo");
    const acima = (d.vendedores ?? []).filter((v: any) => v.status === "acima");

    const prompt = `Você é M.A.I.A, analista comercial inteligente. Analise estes dados e gere um relatório executivo conciso em português brasileiro.

DADOS DO PERÍODO (${d.periodo?.inicio ?? ""} a ${d.periodo?.fim ?? ""}):
- Faturamento: R$ ${d.faturamentoTotal?.toLocaleString("pt-BR") ?? 0}
- Meta da equipe: R$ ${d.metaEquipe?.toLocaleString("pt-BR") ?? 0}
- Atingimento: ${pct}%
- Total de vendas: ${d.totalVendas ?? 0}
- Ticket médio: R$ ${d.ticketMedio?.toLocaleString("pt-BR") ?? 0}
- Vendedores acima da meta: ${acima.map((v: any) => `${v.nome} (${v.percentualMeta}%)`).join(", ") || "nenhum"}
- Vendedores abaixo da meta: ${abaixo.map((v: any) => `${v.nome} (${v.percentualMeta}%)`).join(", ") || "nenhum"}
- Top 3 ranking: ${(d.rankingTop3 ?? []).map((r: any) => `${r.nome}: R$ ${r.faturado?.toLocaleString("pt-BR")}`).join(", ")}

Gere um relatório em 3 parágrafos curtos (texto corrido, sem markdown, sem asteriscos, sem listas):
1. Situação geral da equipe vs meta
2. Destaque de quem está performando bem e quem precisa de atenção com comparativo
3. Recomendação estratégica específica para os próximos dias

Máximo 150 palavras. Tom: direto, analítico e motivador.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return { success: true, insight: text };
  } catch (error: any) {
    console.error("Erro analisarRelatorioAction:", error?.message ?? error);
    return { success: false, error: "Falha ao conectar com a IA." };
  }
}

export async function chatComMAIAAction(
  mensagem: string,
  contexto: ContextoMAIA,
  historico: MensagemHistorico[]
) {
  if (!process.env.GEMINI_API_KEY) {
    return { success: false, error: "GEMINI_API_KEY não configurada." };
  }

  try {
    const { periodo, stats, rankings, diagnosticos } = contexto;
    const pct = stats.metaGlobal > 0
      ? ((stats.totalFaturado / stats.metaGlobal) * 100).toFixed(1)
      : "0";
    const ticketMedio = stats.qtdVendas > 0
      ? Math.round(stats.totalFaturado / stats.qtdVendas)
      : 0;

    const systemInstruction = `Você é M.A.I.A (Módulo de Análise e Inteligência Artificial), a analista comercial inteligente da equipe de vendas. Você tem acesso aos dados em tempo real da equipe.

DADOS ATUAIS — Período: ${periodo.inicio} a ${periodo.fim}
• Faturamento: R$ ${stats.totalFaturado.toLocaleString("pt-BR")}
• Meta da equipe: R$ ${stats.metaGlobal.toLocaleString("pt-BR")}
• Atingimento da meta: ${pct}%
• Total de vendas: ${stats.qtdVendas}
• Ticket médio: R$ ${ticketMedio.toLocaleString("pt-BR")}

RANKING DE VENDEDORES:
${rankings.map((r) => `${r.posicao}º ${r.nome}: R$ ${r.faturado.toLocaleString("pt-BR")} (${r.vendas} vendas)`).join("\n")}

DIAGNÓSTICO INDIVIDUAL:
${diagnosticos.map((d) => {
  const p = d.meta > 0 ? Math.round((d.realizado / d.meta) * 100) : 0;
  return `• ${d.nome}: ${p}% da meta — status: ${d.status === "acima" ? "acima da meta" : d.status === "abaixo" ? "abaixo da meta" : "no ritmo"}`;
}).join("\n")}

REGRAS DE COMPORTAMENTO:
1. Responda APENAS perguntas sobre vendas, estratégias comerciais, performance de vendedores, metas, técnicas de negociação, gestão de equipes de vendas e temas diretamente relacionados ao negócio.
2. Se perguntarem sobre temas não relacionados a vendas/comercial (política, entretenimento, culinária, etc.), recuse educadamente: "Minha especialidade é análise comercial. Posso ajudar com dados de vendas, estratégias e performance da equipe."
3. Use sempre os dados reais fornecidos acima nas respostas.
4. Compare vendedores quando relevante. Identifique padrões. Sugira ações concretas.
5. Tom: direto, analítico, motivador e profissional.
6. Respostas concisas (máximo 180 palavras), sem markdown excessivo — apenas texto corrido com ênfase natural.`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction,
    });

    const chat = model.startChat({
      history: historico.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
    });

    const result = await chat.sendMessage(mensagem);
    const resposta = result.response.text().trim();

    return { success: true, resposta };
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    console.error("Erro chatComMAIAAction:", msg);
    return { success: false, error: `Erro da IA: ${msg}` };
  }
}
