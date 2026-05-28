"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import build from "next/dist/build";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function obterBriefingIAAction(stats: any) {
  if (!process.env.GEMINI_API_KEY) {
    return { success: false, error: "Chave da IA não configurada." };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Analise os dados de vendas: Faturamento R$ ${stats.totalFaturado}, Meta R$ ${stats.metaGlobal}, Vendas ${stats.qtdVendas}. Retorne APENAS um JSON puro (sem markdown) no formato: {"titulo": "...", "mensagem": "...", "acao": "..."}`;
    
    const result = await model.generateContent(prompt);
    const rawText = result.response.text();
    
    // Regex corrigida para segurança de build
    const cleanText = rawText
      .replace(new RegExp("```json", "g"), "")
      .replace(new RegExp("```", "g"), "")
      .trim();

    const parsed = JSON.parse(cleanText);

    return { 
      success: true, 
      titulo: parsed.titulo, 
      briefing: parsed.mensagem, 
      acao: parsed.acao 
    };
  } catch (error) {
    console.error("Erro na IA:", error);
    return { 
      success: false, 
      error: "Falha ao gerar insight",
      titulo: "Análise Indisponível",
      briefing: "Não foi possível conectar com a inteligência artificial agora.",
      acao: "Tente novamente mais tarde."
    };
  }
}

export async function analisarRelatorioAction(dadosRelatorio: any) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Analise este relatório: " + JSON.stringify(dadosRelatorio));
    return { success: true, insight: result.response.text() };
  } catch (error) {
    return { success: false, error: "Erro ao gerar análise" };
  }
}