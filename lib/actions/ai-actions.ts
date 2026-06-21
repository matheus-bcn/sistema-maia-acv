"use server";

import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

type InsightTipo = "ALERTA" | "PARABENS" | "DICA" | "NEUTRO";

interface StatsInput {
  totalFaturado: number;
  metaGlobal: number;
  qtdVendas: number;
}

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

function classificarTipo(stats: StatsInput): InsightTipo {
  const pct = stats.metaGlobal > 0 ? (stats.totalFaturado / stats.metaGlobal) * 100 : 0;
  if (pct >= 100) return "PARABENS";
  if (pct < 60) return "ALERTA";
  // Alterna entre DICA e NEUTRO com base no dia para ser determinístico
  return new Date().getDate() % 2 === 0 ? "DICA" : "NEUTRO";
}

const PROMPTS: Record<InsightTipo, (stats: StatsInput) => string> = {
  ALERTA: (s) => `
Você é M.A.I.A, IA de análise comercial. Tom: direto e motivador.
Dados: Faturado R$ ${s.totalFaturado.toLocaleString("pt-BR")}, Meta R$ ${s.metaGlobal.toLocaleString("pt-BR")}, ${s.qtdVendas} vendas.
A equipe está ABAIXO da meta (${s.metaGlobal > 0 ? ((s.totalFaturado / s.metaGlobal) * 100).toFixed(1) : 0}%).
Gere um alerta motivador com diagnóstico e plano de ação urgente.
Retorne APENAS JSON: {"titulo":"...","mensagem":"...","acao":"...","tipo":"ALERTA"}
Titulo: máx 6 palavras. Mensagem: 2 frases. Ação: 1 frase imperativa curta.`,

  PARABENS: (s) => `
Você é M.A.I.A, IA de análise comercial. Tom: eufórico e celebratório.
Dados: Faturado R$ ${s.totalFaturado.toLocaleString("pt-BR")}, Meta R$ ${s.metaGlobal.toLocaleString("pt-BR")}, ${s.qtdVendas} vendas.
A equipe BATEU a meta (${s.metaGlobal > 0 ? ((s.totalFaturado / s.metaGlobal) * 100).toFixed(1) : 0}%)!
Celebre o resultado e sugira como manter o ritmo.
Retorne APENAS JSON: {"titulo":"...","mensagem":"...","acao":"...","tipo":"PARABENS"}
Titulo: máx 6 palavras. Mensagem: 2 frases celebratórias. Ação: 1 frase para manter o momentum.`,

  DICA: (s) => `
Você é M.A.I.A, IA de análise comercial. Tom: consultivo e estratégico.
Dados: Faturado R$ ${s.totalFaturado.toLocaleString("pt-BR")}, Meta R$ ${s.metaGlobal.toLocaleString("pt-BR")}, ${s.qtdVendas} vendas, ticket médio R$ ${s.qtdVendas > 0 ? (s.totalFaturado / s.qtdVendas).toFixed(0) : 0}.
Gere uma dica estratégica de vendas (upsell, gestão de pipeline, horários de pico, abordagem de cliente) adaptada aos dados.
Retorne APENAS JSON: {"titulo":"...","mensagem":"...","acao":"...","tipo":"DICA"}
Titulo: máx 6 palavras. Mensagem: 2 frases com a dica. Ação: 1 tarefa prática para hoje.`,

  NEUTRO: (s) => `
Você é M.A.I.A, IA de análise comercial. Tom: analítico e informativo.
Dados: Faturado R$ ${s.totalFaturado.toLocaleString("pt-BR")}, Meta R$ ${s.metaGlobal.toLocaleString("pt-BR")}, ${s.qtdVendas} vendas.
Gere uma análise do momento atual da equipe com projeção e observação sobre o ritmo.
Retorne APENAS JSON: {"titulo":"...","mensagem":"...","acao":"...","tipo":"NEUTRO"}
Titulo: máx 6 palavras. Mensagem: 2 frases analíticas. Ação: 1 próximo passo claro.`,
};

export async function obterBriefingIAAction(stats: StatsInput) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Acesso negado." };

  if (!process.env.GROQ_API_KEY) {
    return { success: false, error: "Chave da IA não configurada." };
  }

  const tipo = classificarTipo(stats);

  try {
    const prompt = PROMPTS[tipo](stats);
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 300,
    });

    const rawText = completion.choices[0]?.message?.content ?? "";
    const cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanText);

    const result = {
      success: true,
      titulo: parsed.titulo,
      briefing: parsed.mensagem,
      acao: parsed.acao,
      tipo: (parsed.tipo ?? tipo) as InsightTipo,
    };

    // Persiste o insight no histórico
    try {
      const supabase = await createClient();
      await supabase.from("maia_insights").insert({
        tipo: result.tipo,
        titulo: result.titulo,
        briefing: result.briefing,
        acao: result.acao,
      });
    } catch { /* histórico é opcional */ }

    return result;
  } catch (error) {
    console.error("Erro na IA:", error);
    const pct =
      stats.metaGlobal > 0
        ? ((stats.totalFaturado / stats.metaGlobal) * 100).toFixed(1)
        : "0";
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Acesso negado." };

  if (!process.env.GROQ_API_KEY) {
    return { success: false, error: "GROQ_API_KEY não configurada." };
  }

  try {
    const d = dadosRelatorio;
    const pct =
      d.metaEquipe > 0 ? ((d.faturamentoTotal / d.metaEquipe) * 100).toFixed(1) : "0";
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

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    return { success: true, insight: text };
  } catch (error: any) {
    console.error("Erro analisarRelatorioAction:", error?.message ?? error);
    return { success: false, error: "Falha ao conectar com a IA." };
  }
}

export async function analisarClientesAction(dados: {
  periodo: { inicio: string; fim: string };
  totalClientes: number;
  ticketMedioGeral: number;
  vips: { nome: string; totalGasto: number; totalCompras: number; diasSemComprar: number }[];
  dormentes: { nome: string; totalGasto: number; diasSemComprar: number }[];
  novos: { nome: string; totalGasto: number; ticketMedio: number }[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Acesso negado." };

  if (!process.env.GROQ_API_KEY) {
    return { success: false, error: "Chave GROQ_API_KEY não configurada no servidor. Adicione-a nas variáveis de ambiente do projeto." };
  }

  try {
    const d = dados;
    const prompt = `Você é M.A.I.A, analista comercial e CRM especializado. Analise os dados de clientes e gere insights acionáveis para a equipe de vendas em português brasileiro.

DADOS DO CRM — Período: ${d.periodo.inicio} a ${d.periodo.fim}
- Total de clientes únicos: ${d.totalClientes}
- Ticket médio geral: R$ ${d.ticketMedioGeral.toLocaleString("pt-BR")}

CLIENTES VIP (top por valor):
${d.vips.slice(0, 5).map((c) => `• ${c.nome}: R$ ${c.totalGasto.toLocaleString("pt-BR")} em ${c.totalCompras} compra(s) — ${c.diasSemComprar} dia(s) sem comprar`).join("\n") || "Nenhum"}

CLIENTES DORMENTES (sem comprar há mais de 30 dias):
${d.dormentes.slice(0, 5).map((c) => `• ${c.nome}: último gasto R$ ${c.totalGasto.toLocaleString("pt-BR")} — ${c.diasSemComprar} dias sem comprar`).join("\n") || "Nenhum"}

NOVOS CLIENTES (primeira compra no período):
${d.novos.slice(0, 5).map((c) => `• ${c.nome}: R$ ${c.totalGasto.toLocaleString("pt-BR")} (ticket médio R$ ${c.ticketMedio.toLocaleString("pt-BR")})`).join("\n") || "Nenhum"}

Gere EXATAMENTE 4 insights acionáveis, retornando APENAS JSON válido:
[
  {"tipo":"retomar","titulo":"...","mensagem":"...","cliente":"...","acao":"..."},
  {"tipo":"fidelizar","titulo":"...","mensagem":"...","cliente":"...","acao":"..."},
  {"tipo":"vip","titulo":"...","mensagem":"...","cliente":"...","acao":"..."},
  {"tipo":"oportunidade","titulo":"...","mensagem":"...","cliente":"...","acao":"..."}
]
Regras: titulo máx 6 palavras, mensagem 1-2 frases com dados reais, acao 1 frase imperativa específica. Sempre use nomes reais dos clientes quando disponíveis.`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 600,
    });

    const rawText = completion.choices[0]?.message?.content ?? "";
    const cleaned = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*?\]/);
      if (!match) throw new Error("Resposta da IA não continha JSON. Tente novamente.");
      parsed = JSON.parse(match[0]);
    }

    // Aceita array direto ou objeto com chave "insights"
    const insights: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.insights)
      ? parsed.insights
      : null;

    if (!insights || insights.length === 0) {
      throw new Error("A IA retornou uma estrutura inesperada. Tente novamente.");
    }

    return { success: true, insights };
  } catch (error: any) {
    console.error("Erro analisarClientesAction:", error?.message ?? error);
    return { success: false, error: error?.message ?? "Falha ao gerar insights de clientes." };
  }
}

export async function analisarVendedorAction(dadosVendedor: {
  nome: string;
  periodo: { inicio: string; fim: string };
  faturamento: number;
  meta: number;
  qtdVendas: number;
  ticketMedio: number;
  posicaoRanking: number;
  totalVendedores: number;
  projecaoFechamento: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Acesso negado." };

  if (!process.env.GROQ_API_KEY) {
    return { success: false, error: "GROQ_API_KEY não configurada." };
  }

  try {
    const d = dadosVendedor;
    const pct = d.meta > 0 ? ((d.faturamento / d.meta) * 100).toFixed(1) : "0";
    const restante = Math.max(0, d.meta - d.faturamento);
    const status = Number(pct) >= 100 ? "BATEU" : Number(pct) >= 75 ? "PRÓXIMO" : "ABAIXO";

    const prompt = `Você é M.A.I.A, analista comercial inteligente. Analise a performance INDIVIDUAL deste vendedor e gere um relatório pessoal e motivador em português brasileiro.

DADOS DO VENDEDOR — ${d.nome} (${d.periodo.inicio} a ${d.periodo.fim}):
- Faturamento realizado: R$ ${d.faturamento.toLocaleString("pt-BR")}
- Meta individual: R$ ${d.meta.toLocaleString("pt-BR")}
- Atingimento: ${pct}%
- Status: ${status === "BATEU" ? "META BATIDA!" : status === "PRÓXIMO" ? "Próximo da meta" : "Abaixo da meta"}
- Falta para bater a meta: R$ ${restante.toLocaleString("pt-BR")}
- Total de vendas fechadas: ${d.qtdVendas}
- Ticket médio: R$ ${d.ticketMedio.toLocaleString("pt-BR")}
- Posição no ranking: ${d.posicaoRanking}º de ${d.totalVendedores} vendedores
- Projeção de fechamento do mês: R$ ${d.projecaoFechamento.toLocaleString("pt-BR")}

Gere um relatório em 3 parágrafos curtos (texto corrido, sem markdown, sem asteriscos, sem listas), SEMPRE chamando o vendedor pelo nome:
1. Situação atual: performance dele vs meta com tom ${status === "BATEU" ? "celebratório" : status === "PRÓXIMO" ? "motivador" : "urgente e encorajador"}
2. Análise do ritmo: ticket médio, projeção de fechamento e posição no ranking
3. Recomendação pessoal e específica para os próximos dias

Máximo 160 palavras. Tom: direto, analítico e ${status === "BATEU" ? "eufórico" : "motivador"}.`;

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 450,
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    return { success: true, insight: text };
  } catch (error: any) {
    console.error("Erro analisarVendedorAction:", error?.message ?? error);
    return { success: false, error: "Falha ao conectar com a IA." };
  }
}

export async function chatComMAIAAction(
  mensagem: string,
  contexto: ContextoMAIA,
  historico: MensagemHistorico[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Acesso negado." };

  if (!process.env.GROQ_API_KEY) {
    return { success: false, error: "GROQ_API_KEY não configurada." };
  }

  try {
    const { periodo, stats, rankings, diagnosticos } = contexto;
    const pct =
      stats.metaGlobal > 0
        ? ((stats.totalFaturado / stats.metaGlobal) * 100).toFixed(1)
        : "0";
    const ticketMedio =
      stats.qtdVendas > 0 ? Math.round(stats.totalFaturado / stats.qtdVendas) : 0;

    const systemPrompt = `Você é M.A.I.A (Módulo de Análise e Inteligência Artificial), a analista comercial inteligente da equipe de vendas. Você tem acesso aos dados em tempo real da equipe.

DADOS ATUAIS — Período: ${periodo.inicio} a ${periodo.fim}
• Faturamento: R$ ${stats.totalFaturado.toLocaleString("pt-BR")}
• Meta da equipe: R$ ${stats.metaGlobal.toLocaleString("pt-BR")}
• Atingimento da meta: ${pct}%
• Total de vendas: ${stats.qtdVendas}
• Ticket médio: R$ ${ticketMedio.toLocaleString("pt-BR")}

RANKING DE VENDEDORES:
${rankings.map((r) => `${r.posicao}º ${r.nome}: R$ ${r.faturado.toLocaleString("pt-BR")} (${r.vendas} vendas)`).join("\n")}

DIAGNÓSTICO INDIVIDUAL:
${diagnosticos
  .map((d) => {
    const p = d.meta > 0 ? Math.round((d.realizado / d.meta) * 100) : 0;
    return `• ${d.nome}: ${p}% da meta — ${d.status === "acima" ? "acima da meta" : d.status === "abaixo" ? "abaixo da meta" : "no ritmo"}`;
  })
  .join("\n")}

REGRAS:
1. Responda APENAS perguntas sobre vendas, estratégias comerciais, performance de vendedores, metas e temas relacionados ao negócio.
2. Para temas fora do escopo comercial, recuse educadamente e redirecione.
3. Use os dados reais acima nas respostas. Compare vendedores quando relevante.
4. Tom: direto, analítico, motivador e profissional.
5. Máximo 180 palavras por resposta. Texto corrido, sem markdown excessivo.`;

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...historico.map((m) => ({
        role: (m.role === "model" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: mensagem },
    ];

    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 400,
    });

    const resposta = completion.choices[0]?.message?.content?.trim() ?? "";
    return { success: true, resposta };
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    console.error("Erro chatComMAIAAction:", msg);
    return { success: false, error: `Erro da IA: ${msg}` };
  }
}
