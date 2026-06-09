"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { ClienteDrawer } from "@/components/ClienteDrawer";
import { createClient } from "@/lib/supabase/client";
import { getCustomerStats, getHabitualBuyers, type HabitualBuyer } from "@/lib/data/customers";
import { analisarClientesAction } from "@/lib/actions/ai-actions";
import type { CustomerStats } from "@/types";

const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

type StatusFilter = "todos" | "vip" | "novo" | "regular" | "dormente";

const STATUS_CONFIG = {
  vip:      { label: "VIP",      cor: "#facc15", bg: "bg-yellow-500/10",  border: "border-yellow-500/20",  text: "text-yellow-400",  icon: "mdi:trophy"        },
  novo:     { label: "Novo",     cor: "#4ade80", bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", icon: "line-md:star-pulsating-loop" },
  regular:  { label: "Regular",  cor: "#60a5fa", bg: "bg-blue-500/10",    border: "border-blue-500/20",    text: "text-blue-400",    icon: "mdi:account-check"  },
  dormente: { label: "Dormente", cor: "#f97316", bg: "bg-orange-500/10",  border: "border-orange-500/20",  text: "text-orange-400",  icon: "mdi:sleep"          },
};

const INSIGHT_CONFIG: Record<string, { cor: string; icon: string }> = {
  retomar:     { cor: "#f97316", icon: "line-md:alert-circle-loop" },
  fidelizar:   { cor: "#4ade80", icon: "mdi:handshake"             },
  vip:         { cor: "#facc15", icon: "mdi:trophy"                },
  oportunidade:{ cor: "#a78bfa", icon: "mdi:lightning-bolt"        },
};

const SkeletonRow = () => (
  <tr className="animate-pulse border-b border-white/5">
    {[...Array(7)].map((_, i) => (
      <td key={i} className="px-5 py-4">
        <div className="h-4 bg-white/10 rounded" style={{ width: `${60 + (i * 13) % 40}%` }} />
      </td>
    ))}
  </tr>
);

export default function ClientesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [clientes, setClientes] = useState<CustomerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<StatusFilter>("todos");
  const [insights, setInsights] = useState<any[]>([]);
  const [loadingIA, setLoadingIA] = useState(false);
  const [insightsGerados, setInsightsGerados] = useState(false);
  const [insightErro, setInsightErro] = useState<string | null>(null);
  const [clienteSelecionado, setClienteSelecionado] = useState<CustomerStats | null>(null);
  const [habituais, setHabituais] = useState<HabitualBuyer[]>([]);
  const [loadingHabituais, setLoadingHabituais] = useState(true);
  const [modalHabituaisOpen, setModalHabituaisOpen] = useState(false);

  const mesAtual = new Date().getMonth() + 1;

  const carregarClientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInsights([]);
    setInsightsGerados(false);
    try {
      const data = await getCustomerStats(supabase);
      setClientes(data);
    } catch {
      setError("Falha ao carregar dados de clientes.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const carregarHabituais = useCallback(async () => {
    setLoadingHabituais(true);
    try {
      const data = await getHabitualBuyers(supabase, mesAtual);
      setHabituais(data);
    } finally {
      setLoadingHabituais(false);
    }
  }, [supabase, mesAtual]);

  useEffect(() => { carregarClientes(); }, [carregarClientes]);
  useEffect(() => { carregarHabituais(); }, [carregarHabituais]);

  const gerarInsights = async () => {
    if (clientes.length === 0) return;
    setLoadingIA(true);
    setInsightErro(null);
    try {
      const ticketMedioGeral =
        clientes.length > 0 ? clientes.reduce((s, c) => s + c.total_gasto, 0) / clientes.reduce((s, c) => s + c.total_compras, 0) : 0;

      const now = new Date();
      const periodo = {
        inicio: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
        fim: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
      };
      const result = await analisarClientesAction({
        periodo,
        totalClientes: clientes.length,
        ticketMedioGeral: Math.round(ticketMedioGeral),
        vips: clientes.filter((c) => c.status === "vip").map((c) => ({
          nome: c.customer_name, totalGasto: c.total_gasto,
          totalCompras: c.total_compras, diasSemComprar: c.dias_sem_comprar,
        })),
        dormentes: clientes.filter((c) => c.status === "dormente").map((c) => ({
          nome: c.customer_name, totalGasto: c.total_gasto, diasSemComprar: c.dias_sem_comprar,
        })),
        novos: clientes.filter((c) => c.status === "novo").map((c) => ({
          nome: c.customer_name, totalGasto: c.total_gasto, ticketMedio: c.ticket_medio,
        })),
      });

      if (result.success && Array.isArray(result.insights) && result.insights.length > 0) {
        setInsights(result.insights);
        setInsightsGerados(true);
      } else {
        setInsightErro((result as any).error || "A IA não retornou insights válidos. Tente novamente.");
      }
    } catch (err: any) {
      setInsightErro("Erro de conexão ao chamar a IA. Verifique sua conexão e tente novamente.");
    } finally {
      setLoadingIA(false);
    }
  };

  const clientesFiltrados = useMemo(() => {
    const termo = busca.toLowerCase();
    return clientes.filter((c) => {
      const matchBusca = !termo || c.customer_name.toLowerCase().includes(termo);
      const matchStatus = statusFiltro === "todos" || c.status === statusFiltro;
      return matchBusca && matchStatus;
    });
  }, [clientes, busca, statusFiltro]);

  const stats = useMemo(() => ({
    total: clientes.length,
    vips: clientes.filter((c) => c.status === "vip").length,
    dormentes: clientes.filter((c) => c.status === "dormente").length,
    novos: clientes.filter((c) => c.status === "novo").length,
    ticketMedio:
      clientes.length > 0
        ? Math.round(clientes.reduce((s, c) => s + c.total_gasto, 0) / clientes.reduce((s, c) => s + c.total_compras, 0))
        : 0,
  }), [clientes]);

  return (
    <div className="max-w-7xl mx-auto pb-24">
      {/* Header */}
      <header className="mb-8">
        <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
          <Icon icon="mdi:account-multiple" className="h-8 w-8 text-teal-400" />
          Clientes · CRM
        </h2>
        <p className="text-neutral-400 mt-1">Análise de comportamento baseada em todo o histórico de compras</p>
      </header>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Total Clientes",  value: stats.total,                            icon: "mdi:account-group",          cor: "#60a5fa" },
          { label: "VIPs",            value: stats.vips,                             icon: "mdi:trophy",                 cor: "#facc15" },
          { label: "Novos",           value: stats.novos,                            icon: "line-md:star-pulsating-loop",cor: "#4ade80" },
          { label: "Dormentes",       value: stats.dormentes,                        icon: "mdi:sleep",                  cor: "#f97316" },
          { label: "Ticket Médio",    value: `R$ ${stats.ticketMedio.toLocaleString("pt-BR")}`, icon: "mdi:cash", cor: "#a78bfa" },
        ].map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-5 border border-white/5 bg-white/[0.02]"
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon icon={card.icon} className="h-4 w-4" style={{ color: card.cor }} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{card.label}</span>
            </div>
            <p className="text-2xl font-black text-white">{loading ? "—" : card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Card: Compradores Habituais do Mês */}
      <motion.button
        type="button"
        onClick={() => !loadingHabituais && habituais.length > 0 && setModalHabituaisOpen(true)}
        whileHover={{ scale: habituais.length > 0 ? 1.01 : 1 }}
        className={`w-full text-left glass-card rounded-xl border border-violet-500/20 bg-violet-500/5 mb-6 p-5 transition-colors ${habituais.length > 0 ? "hover:border-violet-400/40 cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <Icon icon="mdi:calendar-star" className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Compradores Habituais de {MESES_PT[mesAtual - 1]}
              </h3>
              <p className="text-[10px] text-violet-300/60 font-bold uppercase tracking-widest">
                Clientes que historicamente compram neste mês
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loadingHabituais ? (
              <Icon icon="line-md:loading-loop" className="icon-always h-5 w-5 text-violet-400" />
            ) : (
              <>
                <div className="text-right">
                  <p className="text-2xl font-black text-violet-400">{habituais.length}</p>
                  <p className="text-[10px] text-neutral-500 uppercase font-bold">clientes</p>
                </div>
                {habituais.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-violet-400 border border-violet-500/30 bg-violet-500/10 rounded-lg px-3 py-2">
                    <Icon icon="mdi:eye" className="h-4 w-4" />
                    Ver lista
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.button>

      {/* Modal de Compradores Habituais */}
      <AnimatePresence>
        {modalHabituaisOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setModalHabituaisOpen(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-lg rounded-2xl border border-violet-500/30 bg-neutral-900 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <Icon icon="mdi:calendar-star" className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      Habituais de {MESES_PT[mesAtual - 1]}
                    </h3>
                    <p className="text-[10px] text-neutral-500">{habituais.length} clientes identificados</p>
                  </div>
                </div>
                <button type="button" onClick={() => setModalHabituaisOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-neutral-500 hover:text-white transition-colors">
                  <Icon icon="line-md:close" className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[60vh] p-3 space-y-2">
                {habituais.map((h, i) => (
                  <motion.button
                    key={h.customer_name}
                    type="button"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => {
                      const found = clientes.find(c => c.customer_name === h.customer_name);
                      if (found) { setClienteSelecionado(found); setModalHabituaisOpen(false); }
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-violet-500/20 transition-all text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-sm font-black text-violet-300 flex-shrink-0">
                      {h.customer_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{h.customer_name}</p>
                      <p className="text-[10px] text-neutral-500">
                        Última compra neste mês: {new Date(h.ultima_compra_neste_mes + "T12:00:00").toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${
                        h.anos_comprou >= 2
                          ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                          : "bg-white/5 text-neutral-400 border border-white/10"
                      }`}>
                        {h.anos_comprou} {h.anos_comprou === 1 ? "ano" : "anos"}
                      </span>
                      <span className="text-xs font-black text-teal-400">
                        R$ {h.total_gasto_historico.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Insights M.A.I.A */}
      <div className="glass-card rounded-xl border border-teal-500/20 bg-teal-500/5 mb-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-teal-500 via-cyan-500 to-teal-500 relative" />
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
                <Icon icon="mdi:brain" className="h-5 w-5 text-teal-400" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">
                  Insights de CRM · M.A.I.A
                </h3>
                <p className="text-[10px] text-teal-300/60 font-bold uppercase tracking-widest">
                  Ações recomendadas para clientes
                </p>
              </div>
            </div>
            {!insightsGerados && (
              <button
                onClick={gerarInsights}
                disabled={loadingIA || loading || clientes.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                style={{ background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.3)", color: "#2dd4bf" }}
              >
                {loadingIA ? (
                  <><Icon icon="line-md:loading-loop" className="icon-always h-3.5 w-3.5" /> Analisando...</>
                ) : (
                  <><Icon icon="mdi:brain" className="h-3.5 w-3.5" /> Gerar Insights</>
                )}
              </button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {insightErro ? (
              <motion.div key="erro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl border border-orange-500/20 bg-orange-500/5">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Icon icon="line-md:alert-circle-loop" className="icon-always h-4 w-4 text-orange-400 flex-shrink-0" />
                  <p className="text-xs text-orange-300/80 leading-relaxed">{insightErro}</p>
                </div>
                <button
                  onClick={() => { setInsightErro(null); gerarInsights(); }}
                  disabled={loadingIA}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-orange-400 border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 transition-all flex-shrink-0 disabled:opacity-50"
                >
                  <Icon icon="mdi:reload" className="h-3.5 w-3.5" /> Tentar novamente
                </button>
              </motion.div>
            ) : insights.length > 0 ? (
              <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-3 md:grid-cols-2">
                {insights.map((ins, i) => {
                  const cfg = INSIGHT_CONFIG[ins.tipo] ?? INSIGHT_CONFIG.oportunidade;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="rounded-xl p-4 border"
                      style={{ background: `${cfg.cor}08`, borderColor: `${cfg.cor}25` }}
                    >
                      <div className="flex items-start gap-3">
                        <Icon icon={cfg.icon} className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: cfg.cor }} />
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: cfg.cor }}>
                            {ins.titulo}
                          </p>
                          <p className="text-xs text-white/70 leading-relaxed mb-2">{ins.mensagem}</p>
                          <p className="text-[10px] font-bold" style={{ color: `${cfg.cor}99` }}>
                            → {ins.acao}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-neutral-500 italic">
                {loadingIA
                  ? "A M.A.I.A está analisando os dados dos clientes..."
                  : "Clique em \"Gerar Insights\" para a M.A.I.A analisar os clientes do período e sugerir ações de retomada, fidelização e oportunidades."}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Filtros */}
      <div className="glass-card rounded-xl p-4 mb-4 border border-white/5 bg-white/[0.02] flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Icon icon="line-md:search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-white/30 text-white placeholder:text-neutral-500"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(["todos", "vip", "novo", "regular", "dormente"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFiltro(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                statusFiltro === s
                  ? "bg-white/20 text-white border border-white/30"
                  : "text-neutral-400 hover:text-white border border-transparent hover:border-white/10"
              }`}
            >
              {s === "todos" ? "Todos" : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label}
              {s !== "todos" && !loading && (
                <span className="ml-1 opacity-50">
                  ({s === "vip" ? stats.vips : s === "novo" ? stats.novos : s === "dormente" ? stats.dormentes : clientes.filter((c) => c.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="glass-card rounded-xl overflow-hidden border border-white/5 bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/5 text-neutral-400 border-b border-white/10">
              <tr>
                <th className="px-5 py-4 font-semibold">Cliente</th>
                <th className="px-5 py-4 font-semibold text-right">Total Gasto</th>
                <th className="px-5 py-4 font-semibold text-center">Compras</th>
                <th className="px-5 py-4 font-semibold text-right">Ticket Médio</th>
                <th className="px-5 py-4 font-semibold">Última Compra</th>
                <th className="px-5 py-4 font-semibold">Atendente(s)</th>
                <th className="px-5 py-4 font-semibold text-center">Status</th>
              </tr>
            </thead>

            <AnimatePresence mode="wait">
              {error ? (
                <tbody>
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <Icon icon="line-md:alert-circle-loop" className="icon-always h-10 w-10 text-red-400 mx-auto mb-3" />
                      <p className="text-neutral-400 mb-4">{error}</p>
                      <button onClick={carregarClientes} className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white font-semibold rounded-md border border-white/10 hover:bg-white/20 transition-all text-sm mx-auto">
                        <Icon icon="mdi:reload" className="h-4 w-4" /> Tentar Novamente
                      </button>
                    </td>
                  </tr>
                </tbody>
              ) : loading ? (
                <tbody>
                  {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
                </tbody>
              ) : clientesFiltrados.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Icon icon="mdi:account-search" className="h-12 w-12 text-neutral-700 mx-auto mb-3" />
                      <p className="text-neutral-500 font-medium">
                        {clientes.length === 0
                          ? "Nenhum cliente com nome identificado no histórico. Importe relatórios do PDV para popular o CRM."
                          : "Nenhum cliente encontrado com esses filtros."}
                      </p>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <motion.tbody
                  key="content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="divide-y divide-white/[0.04]"
                >
                  {clientesFiltrados.map((c, i) => {
                    const st = STATUS_CONFIG[c.status];
                    return (
                      <motion.tr
                        key={c.customer_name}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="hover:bg-white/[0.05] transition-colors cursor-pointer"
                        onClick={() => setClienteSelecionado(c)}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                              style={{ background: `${st.cor}20`, border: `1px solid ${st.cor}40`, color: st.cor }}
                            >
                              {c.customer_name.charAt(0)}
                            </div>
                            <span className="font-semibold text-white max-w-[200px] truncate" title={c.customer_name}>
                              {c.customer_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right font-black text-teal-400">
                          R$ {c.total_gasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-4 text-center font-bold text-white">
                          {c.total_compras}
                        </td>
                        <td className="px-5 py-4 text-right text-neutral-300">
                          R$ {c.ticket_medio.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-white text-xs font-medium">
                              {c.ultima_compra
                                ? new Date(c.ultima_compra + "T12:00:00").toLocaleDateString("pt-BR")
                                : "—"}
                            </p>
                            {c.dias_sem_comprar < 999 && (
                              <p className={`text-[10px] font-bold ${c.dias_sem_comprar > 30 ? "text-orange-400" : "text-neutral-500"}`}>
                                {c.dias_sem_comprar === 0 ? "Hoje" : `${c.dias_sem_comprar} dia(s) atrás`}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs text-neutral-400 max-w-[140px] truncate" title={c.atendentes.join(", ")}>
                          {c.atendentes.join(", ") || "—"}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-lg tracking-wider ${st.bg} ${st.text} border ${st.border}`}>
                            <Icon icon={st.icon} className="h-3 w-3" />
                            {st.label}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              )}
            </AnimatePresence>
          </table>
        </div>
      </div>

      {/* Footer count */}
      {!loading && clientesFiltrados.length > 0 && (
        <p className="text-xs text-neutral-600 text-center mt-4">
          Mostrando {clientesFiltrados.length} de {clientes.length} clientes · clique em uma linha para ver o perfil completo
        </p>
      )}

      {/* Drawer de perfil */}
      <ClienteDrawer
        cliente={clienteSelecionado}
        onClose={() => setClienteSelecionado(null)}
      />
    </div>
  );
}
