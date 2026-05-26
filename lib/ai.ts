// lib/ai.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || "");

export async function gerarBriefingIA(dados: { total: number, meta: number, vendas: number, topVendedor: string }) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Você é a M.A.I.A, uma assistente comercial. Analise estes dados:
      - Total Faturado: R$ ${dados.total}
      - Meta Global: R$ ${dados.meta}
      - Total de Vendas: ${dados.vendas}
      - Vendedor Destaque: ${dados.topVendedor}
      
      Responda com uma frase curta, direta e motivacional.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Erro na IA:", error);
    return "Continue focado nas metas, o time está avançando!";
  }
}

export async function analisarRelatorioIA(dadosRelatorio: any) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      Você é a M.A.I.A, uma analista de dados especialista em performance comercial.
      Analise estes dados de relatório da equipe: ${JSON.stringify(dadosRelatorio)}
      
      Por favor, forneça um insight de alto nível (máximo 4 linhas) focando em:
      1. Identificação de padrão do faturamento vs meta.
      2. Uma recomendação prática para a equipe baseada em quem está acima ou abaixo da meta.
      Seja profissional, analítica e motivadora. Não use formatação complexa (como asteriscos), apenas texto limpo.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Erro na IA de Relatórios:", error);
    return "Não foi possível gerar insights avançados agora, mas continue acompanhando os números de perto.";
  }
}