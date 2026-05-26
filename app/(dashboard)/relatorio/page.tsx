"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart2,
  TrendingUp,
  BrainCircuit,
  AlertTriangle,
  Zap,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDashboardStats } from "@/lib/data/dashboard";
import { getSellerRankings, getSellerDiagnostics } from "@/lib/data/sellers";
import { generateInsights } from "@/lib/data/insights";
import { analisarRelatorioAction } from "@/lib/actions/ai-actions";
import type { InsightItem } from "@/types";

const iconMap = {
  sucesso: Zap,
  alerta: AlertTriangle,
  info: TrendingUp,
};

// P1 - Skeletons para evitar Layout Shift
const SkeletonStatCard = () => (
  <div className="glass-card rounded-xl p-6 animate-pulse bg-white/[0.02] border border-white/5">
    <div className="h-4 w-32 bg-white/10 rounded mb-4" />
    <div className="h-8 w-24 bg-white/10 rounded" />
  </div>
);

const SkeletonInsight = () => (
  <div className="flex gap-4 p-4 rounded-lg bg-black/40 border border-white/5 animate-pulse">
    <div className="h-5 w-5 rounded-full bg-white/10 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-1/3 bg-white/10 rounded" />
      <div className="h-3 w-full bg-white/5 rounded" />
      <div className="h-3 w-5/6 bg-white/5 rounded" />
    </div>
  </div>
);

const SkeletonDiagnostic = () => (
  <div className="animate-pulse">
    <div className="flex justify-between mb-2">
      <div className="h-4 w-24 bg-white/10 rounded" />
      <div className="h-4 w-8 bg-white/10 rounded" />
    </div>
    <div className="h-2 w-full bg-white/5 rounded-full" />
  </div>
);

export default function RelatorioPage() {
  const supabase = useMemo(() => createClient(), []);

  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [diagnosticos, setDiagnosticos] = useState<
    Awaited<ReturnType<typeof getSellerDiagnostics>>
  >([]);
  const [total, setTotal] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para a IA do Gemini
  const [insightIA, setInsightIA] = useState<string | null>(null);
  const [loadingIA, setLoadingIA] = useState(false);

  // P0 - Filtro de período (Padrão: Mês Corrente)
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return {
      inicio: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      fim: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    };
  });

  const carregarRelatorios = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInsightIA(null);

    try {
      // P0 - Injetando as datas nas funções de busca
      const [stats, rankings, diag] = await Promise.all([
        getDashboardStats(supabase, periodo.inicio, periodo.fim),
        getSellerRankings(supabase, periodo.inicio, periodo.fim),
        getSellerDiagnostics(supabase, periodo.inicio, periodo.fim),
      ]);
      
      setTotal(stats.totalFaturado);
      setDiagnosticos(diag);
      
      const ins = await generateInsights(
        supabase,
        rankings,
        stats.totalFaturado,
        stats.metaGlobal,
        periodo.inicio,
        periodo.fim
      );
      
      setInsights(ins);
      setLoading(false); // Libera o carregamento principal

      // Dispara a IA em background para não travar a tela
      setLoadingIA(true);
      
      // Criamos um payload leve para a IA não gastar muitos tokens
      const payloadIA = {
        faturamentoTotal: stats.totalFaturado,
        metaEquipe: stats.metaGlobal,
        vendedores: diag.map(d => ({
          nome: d.nome,
          percentual: Math.round((d.realizado / d.meta) * 100) || 0,
          status: d.status
        }))
      };

      const resultadoIA = await analisarRelatorioAction(payloadIA);
      if (resultadoIA.success) {
        // CORREÇÃO APLICADA AQUI: Adicionado "|| null" para resolver o erro do TypeScript
        setInsightIA(resultadoIA.insight || null);
      }
    } catch (err) {
      console.error("Erro ao gerar relatórios:", err);
      setError("Falha ao gerar a inteligência e os relatórios. Tente novamente mais tarde.");
    } finally {
      setLoading(false);
      setLoadingIA(false);
    }
  }, [supabase, periodo]);

  useEffect(() => {
    carregarRelatorios();
  }, [carregarRelatorios]);

  return (
    <>
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <BarChart2 className="h-8 w-8 text-neutral-400" />
            Inteligência & Relatórios
          </h2>
          <p className="text-neutral-400 mt-1">Insights baseados em dados reais da equipe</p>
        </div>

        {/* P0 - Componente de Filtro de Data */}
        <div className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-md backdrop-blur-md w-max">
          <span className="text-xs text-neutral-400 font-medium uppercase">Período:</span>
          <input 
            type="date" 
            value={periodo.inicio}
            onChange={(e) => setPeriodo(prev => ({ ...prev, inicio: e.target.value }))}
            className="bg-transparent text-sm font-semibold outline-none text-white cursor-pointer invert-[0.8] brightness-200"
          />
          <span className="text-neutral-600">até</span>
          <input 
            type="date" 
            value={periodo.fim}
            onChange={(e) => setPeriodo(prev => ({ ...prev, fim: e.target.value }))}
            className="bg-transparent text-sm font-semibold outline-none text-white cursor-pointer invert-[0.8] brightness-200"
          />
        </div>
      </header>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-12 rounded-xl border border-red-500/20 bg-red-500/5 backdrop-blur-md text-center max-w-2xl mx-auto my-10"
          >
            <AlertCircle className="h-12 w-12 text-red-400 mb-4 animate-pulse" />
            <h3 className="text-lg font-bold text-white mb-2">Erro ao processar insights</h3>
            <p className="text-sm text-neutral-400 mb-6">{error}</p>
            <button
              type="button"
              onClick={carregarRelatorios}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white font-semibold rounded-md border border-white/10 hover:bg-white/20 transition-all text-sm"
            >
              <RefreshCw className="h-4 w-4" /> Tentar Novamente
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="grid gap-6 md:grid-cols-3 mb-6">
              {loading ? (
                <>
                  <SkeletonStatCard />
                  <SkeletonStatCard />
                  <SkeletonStatCard />
                </>
              ) : (
                <>
                  <div className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02]">
                    <p className="text-sm text-neutral-400">Faturamento no período</p>
                    <h3 className="text-3xl font-bold mt-2 text-purple-400">
                      R$ {total.toLocaleString("pt-BR")}
                    </h3>
                  </div>
                  <div className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02]">
                    <p className="text-sm text-neutral-400">Vendedores avaliados</p>
                    <h3 className="text-3xl font-bold mt-2">{diagnosticos.length}</h3>
                  </div>
                  <div className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02]">
                    <p className="text-sm text-neutral-400">Insights gerados</p>
                    <h3 className="text-3xl font-bold mt-2">{insights.length}</h3>
                  </div>
                </>
              )}
            </div>

            {/* BLOCO DA INTELIGÊNCIA GEMINI AQUI */}
            {!loading && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-6 mb-6 border border-fuchsia-500/30 bg-purple-500/5 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500"></div>
                
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20">
                    <Sparkles className="h-5 w-5 text-fuchsia-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-wider">Análise de Dados M.A.I.A</h3>
                </div>
                
                {loadingIA ? (
                  <div className="flex items-center gap-3 text-neutral-400 py-2">
                    <Loader2 className="h-5 w-5 animate-spin text-fuchsia-400" />
                    <p className="text-sm font-medium">A Gemini está processando a performance da equipe...</p>
                  </div>
                ) : insightIA ? (
                  <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-line font-medium">
                    {insightIA}
                  </p>
                ) : (
                  <p className="text-neutral-500 text-sm italic">
                    Não foi possível gerar a análise da inteligência artificial neste momento.
                  </p>
                )}
              </motion.div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
                  <BrainCircuit className="h-6 w-6 text-purple-400" />
                  <h3 className="text-xl font-bold">Insights do Banco</h3>
                </div>
                <div className="space-y-4">
                  {loading ? (
                    <>
                      <SkeletonInsight />
                      <SkeletonInsight />
                      <SkeletonInsight />
                    </>
                  ) : insights.length === 0 ? (
                    <p className="text-neutral-500 text-sm italic text-center py-6 border border-dashed border-white/10 rounded-lg">
                      Não há dados suficientes no período para gerar insights.
                    </p>
                  ) : (
                    insights.map((insight) => {
                      const Icon = iconMap[insight.tipo] || BrainCircuit;
                      return (
                        <motion.div
                          key={insight.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex gap-4 p-4 rounded-lg bg-black/40 border border-white/5 hover:bg-white/[0.03] transition-colors"
                        >
                          <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${insight.corIcone}`} />
                          <div>
                            <h4 className={`text-sm font-bold ${insight.corTexto}`}>{insight.titulo}</h4>
                            <p className="text-sm text-neutral-300 mt-1 leading-relaxed">{insight.mensagem}</p>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02]">
                <h3 className="text-xl font-bold mb-6 border-b border-white/10 pb-4">
                  Diagnóstico da Equipe
                </h3>
                <div className="space-y-6">
                  {loading ? (
                    <>
                      <SkeletonDiagnostic />
                      <SkeletonDiagnostic />
                      <SkeletonDiagnostic />
                      <SkeletonDiagnostic />
                    </>
                  ) : diagnosticos.length === 0 ? (
                    <p className="text-neutral-500 text-sm italic text-center py-6 border border-dashed border-white/10 rounded-lg">
                      Nenhum diagnóstico disponível para o período selecionado.
                    </p>
                  ) : (
                    diagnosticos.map((vend) => {
                      const percentual = Math.round((vend.realizado / vend.meta) * 100) || 0;
                      const corBarra =
                        vend.status === "acima"
                          ? "bg-purple-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                          : vend.status === "abaixo"
                            ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                            : "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]";
                      const corTexto =
                        vend.status === "acima"
                          ? "text-purple-400"
                          : vend.status === "abaixo"
                            ? "text-red-400"
                            : "text-blue-400";
                      
                      return (
                        <div key={vend.nome} className="group">
                          <div className="flex justify-between mb-2">
                            <span className="font-semibold text-neutral-200 group-hover:text-white transition-colors">{vend.nome}</span>
                            <span className={`text-sm font-bold ${corTexto}`}>{percentual}%</span>
                          </div>
                          <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden border border-white/5">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(percentual, 100)}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className={`h-full rounded-full ${corBarra}`}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}