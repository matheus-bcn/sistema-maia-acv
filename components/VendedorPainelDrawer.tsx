"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { createClient } from "@/lib/supabase/client";
import { getDailyComparisonData } from "@/lib/data/sales";
import { getSellerGoal } from "@/lib/data/goals";
import { GraficoComparativoDiario } from "@/components/GraficoComparativoDiario";
import { TermometroDiasUteis } from "@/components/TermometroDiasUteis";
import { TermometroRitmo } from "@/components/TermometroRitmo";
import type { Seller } from "@/types";

function getInitialPeriodo() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return {
    inicio: `${hoje.getFullYear()}-${mes}-01`,
    fim: `${hoje.getFullYear()}-${mes}-${String(ultimo).padStart(2, "0")}`,
  };
}

interface Props {
  seller: Seller | null;
  onClose: () => void;
}

export function VendedorPainelDrawer({ seller, onClose }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [periodo, setPeriodo] = useState(getInitialPeriodo);
  const [periodoOpen, setPeriodoOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [totalVendido, setTotalVendido] = useState(0);
  const [vendas, setVendas] = useState<any[]>([]);
  const [meta, setMeta] = useState(0);
  const [chartData, setChartData] = useState<{ day: string; atual: number; anterior: number }[]>([]);

  const carregar = useCallback(async () => {
    if (!seller) return;
    setLoading(true);
    try {
      const [goalValue, { data: salesData }, comparativo] = await Promise.all([
        getSellerGoal(supabase, seller.id),
        supabase
          .from("sales")
          .select("amount, sale_date, channel")
          .eq("seller_id", seller.id)
          .gte("sale_date", `${periodo.inicio}T00:00:00`)
          .lte("sale_date", `${periodo.fim}T23:59:59`)
          .in("status", ["Aprovado", "Concluída"]),
        getDailyComparisonData(supabase, periodo.inicio, periodo.fim, seller.id),
      ]);

      setMeta(goalValue);
      setVendas(salesData ?? []);
      setTotalVendido((salesData ?? []).reduce((s, v) => s + Number(v.amount), 0));
      setChartData(comparativo);
    } finally {
      setLoading(false);
    }
  }, [seller?.id, periodo, supabase]);

  useEffect(() => {
    if (seller) carregar();
  }, [carregar]);

  const ticketMedio = useMemo(() =>
    vendas.length > 0 ? totalVendido / vendas.length : 0,
    [vendas.length, totalVendido]
  );
  const faltaParaMeta = meta - totalVendido;
  const progresso = meta > 0 ? Math.min((totalVendido / meta) * 100, 100) : 0;

  const periodoLabel = `${periodo.inicio.split("-").reverse().join("/")} – ${periodo.fim.split("-").reverse().join("/")}`;

  if (!seller) return null;

  return (
    <AnimatePresence>
      {seller && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 z-[90] w-full sm:w-[560px] flex flex-col overflow-hidden"
            style={{
              background: "rgba(8,10,18,0.98)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "-32px 0 80px rgba(0,0,0,0.6)",
            }}
          >
            {/* Header */}
            <div className="flex-shrink-0 p-6 border-b border-white/[0.06]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-violet-500/20 border border-violet-500/30 text-violet-400 flex items-center justify-center text-xl font-black flex-shrink-0">
                    {seller.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">{seller.name}</h2>
                    <p className="text-xs text-violet-400 font-bold uppercase tracking-wider">{seller.role || "Vendedor"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Seletor de período */}
                  <div className="relative">
                    <button
                      onClick={() => setPeriodoOpen((o) => !o)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-neutral-300"
                    >
                      <Icon icon="line-md:calendar" className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{periodoLabel}</span>
                      <Icon icon="mdi:chevron-down" className={`h-3.5 w-3.5 transition-transform ${periodoOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {periodoOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 6 }}
                          className="absolute right-0 top-full mt-2 w-64 bg-[#111] border border-white/10 rounded-xl p-4 shadow-2xl z-50 flex flex-col gap-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-neutral-400 uppercase font-semibold">Início</label>
                            <input type="date" value={periodo.inicio} onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))}
                              className="bg-black border border-white/10 rounded-md px-3 py-1.5 text-xs text-white outline-none focus:border-white/30" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-neutral-400 uppercase font-semibold">Fim</label>
                            <input type="date" value={periodo.fim} onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))}
                              className="bg-black border border-white/10 rounded-md px-3 py-1.5 text-xs text-white outline-none focus:border-white/30" />
                          </div>
                          <button onClick={() => { setPeriodo(getInitialPeriodo()); setPeriodoOpen(false); }}
                            className="text-[10px] text-neutral-500 hover:text-white transition-colors text-left">
                            Mês atual
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors border border-white/10">
                    <Icon icon="line-md:close" className="h-4 w-4 text-white/50 hover:text-white" />
                  </button>
                </div>
              </div>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Icon icon="line-md:loading-loop" className="icon-always h-8 w-8 text-violet-500" />
                </div>
              ) : (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-4 border border-purple-500/20 bg-purple-500/5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400/70 mb-1">Faturado</p>
                      <p className="text-xl font-black text-purple-400">
                        R$ {totalVendido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Meta</p>
                      <p className="text-xl font-black text-white">
                        R$ {meta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">Ticket Médio</p>
                      <p className="text-xl font-black text-white">
                        R$ {ticketMedio.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className={`rounded-xl p-4 border ${faltaParaMeta <= 0 ? "border-purple-500/30 bg-purple-500/5" : "border-white/[0.06] bg-white/[0.02]"}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${faltaParaMeta <= 0 ? "text-purple-400/70" : "text-neutral-500"}`}>
                        {faltaParaMeta <= 0 ? "Superou Meta" : "Falta para Meta"}
                      </p>
                      <p className={`text-xl font-black ${faltaParaMeta <= 0 ? "text-purple-400" : "text-white"}`}>
                        {faltaParaMeta <= 0 ? "+" : ""}R$ {Math.abs(faltaParaMeta).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]">
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-neutral-400">Progresso da Meta</span>
                      <span style={{ color: progresso >= 100 ? "#a855f7" : progresso >= 70 ? "#4ade80" : "#f97316" }}>
                        {progresso.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${progresso}%`,
                          background: progresso >= 100 ? "linear-gradient(90deg,#7c3aed,#a855f7)" : progresso >= 70 ? "linear-gradient(90deg,#16a34a,#4ade80)" : "linear-gradient(90deg,#ea580c,#f97316)",
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px] text-neutral-600">{vendas.length} venda{vendas.length !== 1 ? "s" : ""} no período</span>
                      <span className="text-[10px] text-neutral-600">Meta: R$ {meta.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>

                  {/* Termômetros */}
                  <div className="grid grid-cols-1 gap-4">
                    <TermometroDiasUteis meta={meta} faturado={totalVendido} inicio={periodo.inicio} fim={periodo.fim} />
                    <TermometroRitmo meta={meta} faturado={totalVendido} inicio={periodo.inicio} fim={periodo.fim} />
                  </div>

                  {/* Gráfico */}
                  <GraficoComparativoDiario data={chartData} startDate={periodo.inicio} />
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
