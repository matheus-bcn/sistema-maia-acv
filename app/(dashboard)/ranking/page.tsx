"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Target, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import { BatalhaX1 } from "@/components/BatalhaX1";
import { createClient } from "@/lib/supabase/client";
import { getSellerRankings } from "@/lib/data/sellers";
import type { SellerRanking } from "@/types";

const podiumVariants = {
  hidden: { opacity: 0, y: 100 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 15 } },
};

const PODIUM_HEIGHT = ["h-48", "h-64", "h-40"] as const;
const PODIUM_ORDER = [1, 0, 2];

// Skeleton do Pódio para evitar Layout Shift (P1)
const SkeletonPodium = () => (
  <div className="glass-card rounded-xl p-8 lg:col-span-2 flex flex-col justify-end min-h-[450px] relative animate-pulse border border-white/5 bg-white/[0.02]">
    <div className="flex justify-center items-end gap-4 sm:gap-8 h-full pb-4">
      {PODIUM_ORDER.map((idx) => (
        <div key={`skel-podium-${idx}`} className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-full mb-3 bg-white/10" />
          <div className={`${PODIUM_HEIGHT[idx]} w-20 sm:w-28 bg-white/5 rounded-t-lg`} />
          <div className="mt-4 space-y-2 flex flex-col items-center">
            <div className="h-4 w-20 bg-white/10 rounded" />
            <div className="h-3 w-12 bg-white/5 rounded" />
            <div className="h-3 w-16 bg-white/10 rounded" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Skeleton da Lista de Perseguição (P1)
const SkeletonList = () => (
  <div className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02] animate-pulse">
    <div className="h-6 w-1/2 bg-white/10 rounded mb-6" />
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={`skel-list-${i}`} className="flex items-center justify-between p-3 rounded-lg border border-transparent">
          <div className="flex items-center gap-3 w-full">
            <div className="w-4 h-4 bg-white/5 rounded" />
            <div className="w-8 h-8 rounded-full bg-white/10" />
            <div className="flex flex-col gap-1 w-full">
              <div className="h-4 w-2/3 bg-white/10 rounded" />
              <div className="h-3 w-1/3 bg-white/5 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function RankingPage() {
  const supabase = useMemo(() => createClient(), []);
  
  const [rankings, setRankings] = useState<SellerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // P0 — Filtro temporal (padrão: Mês Corrente)
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return {
      inicio: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      fim: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    };
  });

  const loadRankings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Passando as datas para garantir que o ranking reflita o período selecionado (P0)
      const data = await getSellerRankings(supabase, periodo.inicio, periodo.fim);
      setRankings(data);
    } catch (err) {
      console.error("Erro ao carregar o ranking:", err);
      setError("Não foi possível carregar o ranking de vendedores. Verifique sua conexão ou permissões.");
    } finally {
      setLoading(false);
    }
  }, [supabase, periodo]);

  useEffect(() => {
    loadRankings();
  }, [loadRankings]);

  const top3 = rankings.slice(0, 3);
  const rest = rankings.slice(3, 6);

  return (
    <>
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Ranking da Equipe
          </h2>
          <p className="text-neutral-400 mt-1">Os melhores performers do período selecionado</p>
        </div>

        {/* P0 — Controle de período selecionável */}
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

      <div className="mb-10">
        <BatalhaX1 rankings={rankings} />
      </div>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error-state"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-10 rounded-xl border border-red-500/20 bg-red-500/5 backdrop-blur-md text-center max-w-2xl mx-auto my-8"
          >
            <AlertCircle className="h-10 w-10 text-red-400 mb-4 animate-bounce" />
            <h3 className="text-lg font-bold text-white mb-2">Erro ao processar ranking</h3>
            <p className="text-sm text-neutral-400 mb-6">{error}</p>
            <button
              type="button"
              onClick={loadRankings}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white font-semibold rounded-md border border-white/10 hover:bg-white/20 transition-all text-sm"
            >
              <RefreshCw className="h-4 w-4" /> Tentar Novamente
            </button>
          </motion.div>
        ) : loading ? (
          <motion.div
            key="loading-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-8 lg:grid-cols-3"
          >
            <SkeletonPodium />
            <SkeletonList />
          </motion.div>
        ) : rankings.length === 0 ? (
          <motion.div
            key="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 border border-dashed border-white/10 rounded-xl bg-white/[0.02]"
          >
            <Trophy className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white">Nenhum dado encontrado</h3>
            <p className="text-neutral-400 text-sm mt-1">Não houve vendas registradas no período selecionado.</p>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-8 lg:grid-cols-3"
          >
            <motion.div
              className="glass-card rounded-xl p-8 lg:col-span-2 flex flex-col justify-end min-h-[450px] relative border border-white/5 bg-white/[0.02]"
            >
              <div className="flex justify-center items-end gap-4 sm:gap-8 h-full pb-4">
                {PODIUM_ORDER.map((idx) => {
                  const r = top3[idx];
                  if (!r) return <div key={idx} className="w-20 sm:w-28" />;
                  const pos = r.position;
                  const height = PODIUM_HEIGHT[idx];
                  return (
                    <motion.div
                      key={r.seller.id}
                      variants={podiumVariants}
                      initial="hidden"
                      animate="show"
                      className="flex flex-col items-center group cursor-pointer"
                    >
                      {pos === 1 && <Trophy className="h-8 w-8 text-yellow-500 mb-2 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />}
                      <div
                        className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center border-2 bg-black z-10 shadow-xl ${
                          pos === 1 ? "border-yellow-500 w-16 h-16" : "border-white/20"
                        }`}
                      >
                        <span className="font-bold text-sm">{r.seller.name.charAt(0)}</span>
                      </div>
                      <div
                        className={`${height} w-20 sm:w-28 ${
                          pos === 1
                            ? "bg-gradient-to-t from-yellow-900/50 to-yellow-500 border-yellow-500/50 shadow-[0_0_30px_rgba(234,179,8,0.15)]"
                            : "bg-gradient-to-t from-white/5 to-white/20 border-white/10"
                        } border-t-2 border-l border-r rounded-t-lg relative flex justify-center pt-4 transition-transform group-hover:-translate-y-2`}
                      >
                        <span className="font-black text-2xl drop-shadow-md">{pos}º</span>
                      </div>
                      <div className="text-center mt-4">
                        <p className="font-bold whitespace-nowrap group-hover:text-white transition-colors">
                          {r.seller.name}
                        </p>
                        <p className="text-xs text-neutral-400">{r.salesCount} Vendas</p>
                        <p className="text-sm font-semibold text-purple-400 mt-1">
                          R$ {r.totalSales.toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div
              className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02]"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <Target className="h-5 w-5 text-neutral-400" />
                Na Perseguição
              </h3>
              <div className="space-y-4">
                {rest.length > 0 ? (
                  rest.map((r) => (
                    <div
                      key={r.seller.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-neutral-500 font-bold w-4 text-center">{r.position}º</span>
                        <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold border border-white/10">
                          {r.seller.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{r.seller.name}</p>
                          <p className="text-xs text-neutral-400">
                            R$ {r.totalSales.toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <TrendingUp className="h-4 w-4 text-purple-400" />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-neutral-500 italic text-center py-4">Nenhum outro vendedor no período.</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}