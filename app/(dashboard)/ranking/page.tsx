"use client";

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { BatalhaX1 } from "@/components/BatalhaX1";
import { VendedorPainelDrawer } from "@/components/VendedorPainelDrawer";
import { createClient } from "@/lib/supabase/client";
import { getSellerRankings } from "@/lib/data/sellers";
import type { SellerRanking, Seller } from "@/types";

const MEDAL_ICONS = ["mdi:trophy", "mdi:medal", "mdi:medal-outline"];
const MEDAL_COLORS = ["#f59e0b", "#94a3b8", "#b45309"];
const PODIUM_HEIGHTS = ["h-52", "h-36", "h-28"];
const PODIUM_ORDER = [1, 0, 2]; // 2º, 1º, 3º

const SkeletonPodium = () => (
  <div className="glass-card rounded-2xl p-8 flex flex-col justify-end min-h-[380px] border border-white/5 bg-white/[0.02] animate-pulse">
    <div className="flex justify-center items-end gap-6 h-full pb-4">
      {PODIUM_ORDER.map((i) => (
        <div key={i} className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/10" />
          <div className={`${PODIUM_HEIGHTS[i]} w-24 bg-white/5 rounded-t-xl`} />
        </div>
      ))}
    </div>
  </div>
);

const SkeletonList = () => (
  <div className="space-y-3">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="glass-card rounded-xl p-4 border border-white/5 bg-white/[0.02] animate-pulse flex items-center gap-4">
        <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
        <div className="w-10 h-10 rounded-full bg-white/10 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 bg-white/10 rounded" />
          <div className="h-2 w-full bg-white/5 rounded-full" />
        </div>
        <div className="h-5 w-24 bg-white/10 rounded" />
      </div>
    ))}
  </div>
);

function RankingContent() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();

  const isBatalhaAtiva = searchParams.get("batalha") === "true";

  const [rankings, setRankings] = useState<SellerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [painelSeller, setPainelSeller] = useState<Seller | null>(null);

  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return {
      inicio: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
      fim: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
    };
  });

  const loadRankings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSellerRankings(supabase, periodo.inicio, periodo.fim);
      setRankings(data);
    } catch {
      setError("Não foi possível carregar o ranking de vendedores.");
    } finally {
      setLoading(false);
    }
  }, [supabase, periodo]);

  useEffect(() => { loadRankings(); }, [loadRankings]);

  const top3 = rankings.slice(0, 3);
  const totalFaturado = useMemo(() => rankings.reduce((s, r) => s + r.totalSales, 0), [rankings]);
  const totalVendas = useMemo(() => rankings.reduce((s, r) => s + r.salesCount, 0), [rankings]);
  const lider = rankings[0];

  return (
    <>
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <Icon icon="mdi:trophy" className="h-8 w-8 text-yellow-500 drop-shadow-[0_0_12px_rgba(234,179,8,0.6)]" />
            Ranking da Equipe
          </h2>
          <p className="text-neutral-400 mt-1">Performance dos vendedores no período selecionado</p>
        </div>
        <PeriodoFilter inicio={periodo.inicio} fim={periodo.fim} onChange={(inicio, fim) => setPeriodo({ inicio, fim })} />
      </header>

      {/* Batalha X1 */}
      <AnimatePresence>
        {isBatalhaAtiva && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 relative"
          >
            <button
              onClick={() => router.push("/ranking")}
              className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-red-500/80 rounded-full text-white transition-colors"
            >
              <Icon icon="line-md:close" className="h-4 w-4" />
            </button>
            <BatalhaX1 rankings={rankings} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-10 rounded-xl border border-red-500/20 bg-red-500/5 text-center max-w-2xl mx-auto my-8">
            <Icon icon="line-md:alert-circle-loop" className="icon-always h-10 w-10 text-red-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Erro ao carregar ranking</h3>
            <p className="text-sm text-neutral-400 mb-6">{error}</p>
            <button onClick={loadRankings} className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white font-semibold rounded-md border border-white/10 hover:bg-white/20 transition-all text-sm">
              <Icon icon="mdi:reload" className="h-4 w-4" /> Tentar Novamente
            </button>
          </motion.div>
        ) : loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
            <SkeletonPodium />
            <SkeletonList />
          </motion.div>
        ) : rankings.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-24 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
            <Icon icon="mdi:trophy" className="h-14 w-14 text-neutral-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white">Nenhum dado encontrado</h3>
            <p className="text-neutral-500 text-sm mt-1">Não houve vendas registradas no período selecionado.</p>
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

            {/* Stats rápidos */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Vendedores", value: rankings.length, icon: "mdi:account-group", color: "#a855f7" },
                { label: "Total Vendas", value: totalVendas, icon: "mdi:cart", color: "#60a5fa" },
                { label: "Faturamento Total", value: `R$ ${totalFaturado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, icon: "mdi:currency-usd", color: "#4ade80" },
              ].map((s) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-2xl p-5 border border-white/5 bg-white/[0.02] flex items-center gap-4">
                  <div className="p-3 rounded-xl flex-shrink-0" style={{ background: `${s.color}18`, border: `1px solid ${s.color}30` }}>
                    <Icon icon={s.icon} className="h-5 w-5" style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{s.label}</p>
                    <p className="text-xl font-black text-white">{s.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pódio */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-2xl border border-white/5 overflow-hidden"
              style={{ background: "linear-gradient(160deg, rgba(15,12,30,1) 0%, rgba(8,10,18,1) 100%)" }}
            >
              <div className="h-px w-full bg-gradient-to-r from-transparent via-yellow-500/40 to-transparent" />
              <div className="px-8 pt-8 pb-10 flex justify-center items-end gap-4 sm:gap-10 min-h-[360px]">
                {PODIUM_ORDER.map((idx) => {
                  const r = top3[idx];
                  if (!r) return <div key={`empty-${idx}`} className="w-24 sm:w-32" />;
                  const isFirst = r.position === 1;
                  const medalColor = MEDAL_COLORS[idx];
                  const heightClass = PODIUM_HEIGHTS[idx];

                  return (
                    <motion.div
                      key={r.seller.id}
                      initial={{ opacity: 0, y: 60 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", stiffness: 120, damping: 18, delay: idx * 0.1 }}
                      className="flex flex-col items-center group cursor-pointer"
                      onClick={() => setPainelSeller(r.seller)}
                    >
                      {isFirst && (
                        <Icon icon="mdi:trophy" className="h-8 w-8 mb-2 drop-shadow-[0_0_16px_rgba(234,179,8,0.7)]" style={{ color: medalColor }} />
                      )}
                      <div
                        className={`rounded-full flex items-center justify-center font-black border-2 bg-black z-10 shadow-2xl transition-transform group-hover:scale-110 mb-3 ${isFirst ? "w-16 h-16 text-xl" : "w-12 h-12 text-sm"}`}
                        style={{ borderColor: medalColor, boxShadow: `0 0 20px ${medalColor}40` }}
                      >
                        {r.seller.name.charAt(0)}
                      </div>
                      <div
                        className={`${heightClass} w-24 sm:w-32 rounded-t-xl relative flex flex-col justify-start pt-4 items-center border-t-2 border-l border-r transition-transform group-hover:-translate-y-2`}
                        style={{
                          background: isFirst
                            ? "linear-gradient(to top, rgba(120,53,15,0.6), rgba(234,179,8,0.5))"
                            : `linear-gradient(to top, rgba(15,15,20,0.8), ${medalColor}25)`,
                          borderColor: `${medalColor}60`,
                          boxShadow: isFirst ? `0 -8px 40px ${medalColor}20` : "none",
                        }}
                      >
                        <span className="font-black text-3xl drop-shadow-lg" style={{ color: medalColor }}>
                          {r.position}º
                        </span>
                      </div>
                      <div className="text-center mt-4 space-y-0.5">
                        <p className="font-black text-white text-sm truncate max-w-[110px] group-hover:text-yellow-300 transition-colors">
                          {r.seller.name.split(" ")[0]}
                        </p>
                        <p className="text-xs text-neutral-500">{r.salesCount} venda{r.salesCount !== 1 ? "s" : ""}</p>
                        <p className="text-sm font-black" style={{ color: medalColor }}>
                          R$ {r.totalSales.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Lista completa com barras */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-500 px-1">
                Classificação Completa
              </h3>
              {rankings.map((r, i) => {
                const pctLider = lider && lider.totalSales > 0 ? (r.totalSales / lider.totalSales) * 100 : 0;
                const isTopThree = r.position <= 3;
                const barColor = r.position === 1 ? "#f59e0b" : r.position === 2 ? "#94a3b8" : r.position === 3 ? "#b45309" : "#a855f7";

                return (
                  <motion.div
                    key={r.seller.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setPainelSeller(r.seller)}
                    className="glass-card rounded-2xl p-4 border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-8 text-center font-black text-sm flex-shrink-0"
                        style={isTopThree ? { color: barColor } : { color: "#525252" }}
                      >
                        {isTopThree ? (
                          <Icon icon={MEDAL_ICONS[r.position - 1]} className="h-5 w-5 mx-auto" style={{ color: barColor }} />
                        ) : (
                          `${r.position}º`
                        )}
                      </div>

                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 transition-transform group-hover:scale-110"
                        style={{ background: `${barColor}18`, border: `1px solid ${barColor}40`, color: barColor }}
                      >
                        {r.seller.name.charAt(0)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="font-bold text-sm text-white truncate">{r.seller.name}</p>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                            <span className="text-xs text-neutral-500">{r.salesCount} venda{r.salesCount !== 1 ? "s" : ""}</span>
                            <span className="text-sm font-black" style={{ color: barColor }}>
                              R$ {r.totalSales.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pctLider}%` }}
                            transition={{ duration: 0.8, delay: i * 0.06, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ background: `linear-gradient(90deg, ${barColor}80, ${barColor})` }}
                          />
                        </div>
                        <p className="text-[10px] text-neutral-600 mt-1">{pctLider.toFixed(0)}% do líder</p>
                      </div>

                      <Icon icon="mdi:chevron-right" className="h-4 w-4 text-neutral-700 group-hover:text-neutral-400 transition-colors flex-shrink-0" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <VendedorPainelDrawer seller={painelSeller} onClose={() => setPainelSeller(null)} />
    </>
  );
}

export default function RankingPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center text-white/50 animate-pulse">
        Montando Ranking...
      </div>
    }>
      <RankingContent />
    </Suspense>
  );
}
