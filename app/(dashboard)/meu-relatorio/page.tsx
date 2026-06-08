"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { MAIAChat } from "@/components/MAIAChat";
import { createClient } from "@/lib/supabase/client";
import { getSellerRankings } from "@/lib/data/sellers";
import { getIndividualBaseGoal } from "@/lib/data/goals";
import { analisarVendedorAction } from "@/lib/actions/ai-actions";
import type { ContextoMAIA } from "@/lib/actions/ai-actions";

type Aba = "analise" | "chat";

type Sale = {
  id: string;
  amount: number;
  status: string;
  sale_date: string;
  channel?: string;
};

const STATUS_COLOR: Record<string, string> = {
  Aprovado: "text-emerald-400",
  Concluída: "text-emerald-400",
  Pendente: "text-amber-400",
  Cancelado: "text-red-400",
};

const SkeletonCard = () => (
  <div className="glass-card rounded-2xl p-6 animate-pulse border border-white/5 bg-white/[0.02]">
    <div className="h-3 w-24 bg-white/10 rounded mb-4" />
    <div className="h-8 w-32 bg-white/15 rounded" />
  </div>
);

export default function MeuRelatorioPage() {
  const supabase = useMemo(() => createClient(), []);

  const [aba, setAba] = useState<Aba>("analise");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendedor, setVendedor] = useState<any>(null);
  const [vendas, setVendas] = useState<Sale[]>([]);
  const [metaIndividual, setMetaIndividual] = useState(0);
  const [rankings, setRankings] = useState<Awaited<ReturnType<typeof getSellerRankings>>>([]);
  const [insightIA, setInsightIA] = useState<string | null>(null);
  const [loadingIA, setLoadingIA] = useState(false);
  const [contextoChat, setContextoChat] = useState<ContextoMAIA | null>(null);

  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return {
      inicio: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
      fim: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
    };
  });

  const { diasUteisPassados, diasUteisTotais } = useMemo(() => {
    const hoje = new Date();
    const start = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const end = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    let passados = 0, totais = 0;
    let cur = new Date(start);
    while (cur <= end) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) { totais++; if (cur <= hoje) passados++; }
      cur.setDate(cur.getDate() + 1);
    }
    return { diasUteisPassados: passados || 1, diasUteisTotais: totais || 22 };
  }, []);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setError(null);
    setInsightIA(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Usuário não autenticado.");

      const { data: sellerData, error: sellerErr } = await supabase
        .from("sellers")
        .select("*")
        .eq("email", user.email)
        .single();

      if (sellerErr || !sellerData) throw new Error("Perfil não encontrado.");
      setVendedor(sellerData);

      const [salesResult, meta, rank] = await Promise.all([
        supabase
          .from("sales")
          .select("id, amount, status, sale_date, channel")
          .eq("seller_id", sellerData.id)
          .gte("sale_date", `${periodo.inicio}T00:00:00`)
          .lte("sale_date", `${periodo.fim}T23:59:59`)
          .order("sale_date", { ascending: false }),
        getIndividualBaseGoal(supabase),
        getSellerRankings(supabase, periodo.inicio, periodo.fim),
      ]);

      const minhasVendas: Sale[] = salesResult.data ?? [];
      setVendas(minhasVendas);
      setMetaIndividual(meta);
      setRankings(rank);

      const totalFaturado = minhasVendas
        .filter((v) => ["Aprovado", "Concluída"].includes(v.status))
        .reduce((acc, v) => acc + Number(v.amount), 0);
      const qtdVendas = minhasVendas.length;
      const ticketMedio = qtdVendas > 0 ? Math.round(totalFaturado / qtdVendas) : 0;
      const posicao = rank.findIndex((r) => r.seller.id === sellerData.id) + 1 || rank.length + 1;
      const projecao = Math.round((totalFaturado / diasUteisPassados) * diasUteisTotais);
      const metaStatus = meta > 0 && totalFaturado >= meta ? "acima" : meta > 0 && (totalFaturado / meta) >= 0.8 ? "no-ritmo" : "abaixo";

      const ctx: ContextoMAIA = {
        periodo,
        stats: { totalFaturado, metaGlobal: meta, qtdVendas },
        rankings: rank.map((r) => ({
          nome: r.seller.name,
          faturado: r.totalSales,
          vendas: r.salesCount,
          posicao: r.position,
        })),
        diagnosticos: [{ nome: sellerData.name, realizado: totalFaturado, meta, status: metaStatus }],
      };
      setContextoChat(ctx);

      setLoading(false);
      setLoadingIA(true);

      const resultIA = await analisarVendedorAction({
        nome: sellerData.name.split(" ")[0],
        periodo,
        faturamento: totalFaturado,
        meta,
        qtdVendas,
        ticketMedio,
        posicaoRanking: posicao,
        totalVendedores: rank.length,
        projecaoFechamento: projecao,
      });

      if (resultIA.success) setInsightIA(resultIA.insight || null);
    } catch (err: any) {
      console.error("Erro meu-relatorio:", err);
      setError(err.message || "Falha ao carregar os dados.");
    } finally {
      setLoading(false);
      setLoadingIA(false);
    }
  }, [supabase, periodo, diasUteisPassados, diasUteisTotais]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const vendasAprovadas = useMemo(
    () => vendas.filter((v) => ["Aprovado", "Concluída"].includes(v.status)),
    [vendas],
  );
  const totalFaturado = useMemo(
    () => vendasAprovadas.reduce((acc, v) => acc + Number(v.amount), 0),
    [vendasAprovadas],
  );
  const ticketMedio = useMemo(
    () => (vendasAprovadas.length > 0 ? Math.round(totalFaturado / vendasAprovadas.length) : 0),
    [totalFaturado, vendasAprovadas],
  );
  const progresso = useMemo(
    () => (metaIndividual > 0 ? Math.min((totalFaturado / metaIndividual) * 100, 100) : 0),
    [totalFaturado, metaIndividual],
  );
  const projecao = useMemo(
    () => Math.round((totalFaturado / diasUteisPassados) * diasUteisTotais),
    [totalFaturado, diasUteisPassados, diasUteisTotais],
  );
  const posicao = useMemo(
    () => (vendedor ? rankings.findIndex((r) => r.seller.id === vendedor.id) + 1 || rankings.length + 1 : 0),
    [rankings, vendedor],
  );

  if (loading && !vendedor) {
    return (
      <div className="max-w-5xl mx-auto pb-24">
        <div className="mb-8 h-10 w-56 bg-white/10 rounded-xl animate-pulse" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-8">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-24">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <Icon icon="mdi:chart-bar" className="h-8 w-8 text-violet-400" />
            Meu Relatório
          </h2>
          <p className="text-neutral-400 mt-1">
            {vendedor ? `Performance de ${vendedor.name.split(" ")[0]} · M.A.I.A` : "Carregando..."}
          </p>
        </div>
        <PeriodoFilter
          inicio={periodo.inicio}
          fim={periodo.fim}
          onChange={(inicio, fim) => setPeriodo({ inicio, fim })}
        />
      </header>

      {/* Erro */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-10 rounded-xl border border-red-500/20 bg-red-500/5 mb-8 text-center"
          >
            <Icon icon="line-md:alert-circle-loop" className="h-10 w-10 text-red-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Erro ao carregar dados</h3>
            <p className="text-sm text-neutral-400 mb-6">{error}</p>
            <button
              onClick={carregarDados}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white font-semibold rounded-md border border-white/10 hover:bg-white/20 transition-all text-sm"
            >
              <Icon icon="mdi:reload" className="h-4 w-4" /> Tentar Novamente
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cards de stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Meu Faturamento",
            value: `R$ ${totalFaturado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
            icon: "mdi:cash",
            cor: "#a78bfa",
            bg: "from-violet-500/10",
          },
          {
            label: "Minha Meta",
            value: `R$ ${metaIndividual.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
            icon: "mdi:target",
            cor: "#f472b6",
            bg: "from-pink-500/10",
          },
          {
            label: "Atingimento",
            value: `${progresso.toFixed(1)}%`,
            icon: progresso >= 100 ? "line-md:star-pulsating-loop" : "mdi:trending-up",
            cor: progresso >= 100 ? "#4ade80" : progresso >= 75 ? "#facc15" : "#f97316",
            bg: progresso >= 100 ? "from-emerald-500/10" : "from-orange-500/10",
          },
          {
            label: "Posição Ranking",
            value: posicao > 0 ? `${posicao}º` : "—",
            icon: "mdi:trophy",
            cor: "#facc15",
            bg: "from-yellow-500/10",
          },
        ].map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-card rounded-2xl p-5 border border-white/5 bg-gradient-to-br ${card.bg} to-transparent`}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg" style={{ background: `${card.cor}20` }}>
                <Icon icon={card.icon} className="h-4 w-4" style={{ color: card.cor }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                {card.label}
              </span>
            </div>
            <p className="text-2xl font-black text-white">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Barra de progresso da meta */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="glass-card rounded-2xl p-5 border border-white/5 bg-white/[0.02] mb-6"
      >
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:flag-checkered" className="h-4 w-4 text-violet-400" />
            <span className="text-sm font-bold text-white/60 uppercase tracking-wider">Corrida para a Meta</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-400">
            <span>
              Ticket médio:{" "}
              <strong className="text-white">R$ {ticketMedio.toLocaleString("pt-BR")}</strong>
            </span>
            <span>
              Projeção:{" "}
              <strong className={projecao >= metaIndividual ? "text-emerald-400" : "text-orange-400"}>
                R$ {projecao.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              </strong>
            </span>
          </div>
        </div>
        <div className="h-3 w-full bg-black/50 rounded-full overflow-hidden border border-white/5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progresso}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{
              background:
                progresso >= 100
                  ? "linear-gradient(90deg, #4ade80, #22c55e)"
                  : progresso >= 75
                  ? "linear-gradient(90deg, #facc15, #eab308)"
                  : "linear-gradient(90deg, #a78bfa, #7c3aed)",
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-neutral-500 font-bold">
          <span>R$ 0</span>
          <span>{progresso.toFixed(1)}% da meta</span>
          <span>R$ {metaIndividual.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] border border-white/10 rounded-xl p-1 w-fit">
        {(
          [
            { id: "analise" as Aba, label: "Análise M.A.I.A", icon: "mdi:brain" },
            { id: "chat" as Aba, label: "Chat M.A.I.A", icon: "mdi:chat" },
          ] as const
        ).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              aba === id
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Icon icon={icon} className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {aba === "chat" ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {loading || !contextoChat ? (
              <div className="flex items-center justify-center h-[600px] glass-card rounded-xl border border-violet-500/20">
                <div className="flex flex-col items-center gap-3 text-neutral-400">
                  <Icon icon="line-md:loading-loop" className="h-8 w-8 text-violet-400" />
                  <p className="text-sm">Carregando seus dados para M.A.I.A...</p>
                </div>
              </div>
            ) : (
              <MAIAChat contexto={contextoChat} />
            )}
          </motion.div>
        ) : (
          <motion.div
            key="analise"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* MAIA Analysis Card */}
            <div className="glass-card rounded-xl p-6 border border-violet-500/30 bg-violet-500/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <Icon icon="mdi:brain" className="h-5 w-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-white">
                      Análise Individual M.A.I.A
                    </h3>
                    {vendedor && (
                      <p className="text-[10px] text-violet-300/60 font-bold uppercase tracking-widest">
                        Performance de {vendedor.name.split(" ")[0]}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setAba("chat")}
                  className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 border border-violet-500/20 hover:border-violet-500/40 rounded-lg px-3 py-1.5 transition-all"
                >
                  <Icon icon="mdi:chat" className="h-3.5 w-3.5" />
                  Perguntar à M.A.I.A
                </button>
              </div>

              {loadingIA ? (
                <div className="flex items-center gap-3 text-neutral-400 py-2">
                  <Icon icon="line-md:loading-loop" className="h-5 w-5 text-violet-400" />
                  <p className="text-sm font-medium">
                    M.A.I.A está analisando sua performance...
                  </p>
                </div>
              ) : insightIA ? (
                <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-line font-medium">
                  {insightIA}
                </p>
              ) : (
                <p className="text-neutral-500 text-sm italic">
                  Não foi possível gerar a análise neste momento.
                </p>
              )}
            </div>

            {/* Vendas do período */}
            <div className="glass-card rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <Icon icon="line-md:watch-loop" className="h-5 w-5 text-neutral-400" />
                  <h3 className="text-base font-bold text-white">Minhas Vendas no Período</h3>
                </div>
                <span className="text-xs text-neutral-500 font-bold uppercase tracking-widest">
                  {vendas.length} {vendas.length === 1 ? "venda" : "vendas"}
                </span>
              </div>

              {vendas.length === 0 ? (
                <div className="py-16 text-center">
                  <Icon icon="mdi:cart-off" className="h-12 w-12 text-neutral-700 mx-auto mb-4" />
                  <p className="text-neutral-500 font-medium">Nenhuma venda no período selecionado.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {vendas.map((v, i) => (
                    <motion.div
                      key={v.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                          <Icon icon="mdi:currency-usd" className="h-4 w-4 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {v.channel || "Venda registrada"}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {new Date(v.sale_date).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-white">
                          R$ {Number(v.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className={`text-xs font-bold ${STATUS_COLOR[v.status] ?? "text-neutral-400"}`}>
                          {v.status}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Posição no ranking */}
            {rankings.length > 0 && (
              <div className="glass-card rounded-xl p-5 border border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-3 mb-4">
                  <Icon icon="mdi:trophy" className="h-5 w-5 text-yellow-500" />
                  <h3 className="text-base font-bold text-white">Ranking do Período</h3>
                </div>
                <div className="space-y-3">
                  {rankings.slice(0, 5).map((r) => {
                    const isMe = vendedor && r.seller.id === vendedor.id;
                    return (
                      <div
                        key={r.seller.id}
                        className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                          isMe
                            ? "border border-violet-500/30 bg-violet-500/10"
                            : "border border-transparent hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-sm font-black w-6 text-center ${
                              r.position === 1
                                ? "text-yellow-400"
                                : r.position === 2
                                ? "text-slate-300"
                                : r.position === 3
                                ? "text-amber-600"
                                : "text-neutral-500"
                            }`}
                          >
                            {r.position}º
                          </span>
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border"
                            style={{
                              background: isMe ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.05)",
                              borderColor: isMe ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.1)",
                            }}
                          >
                            {r.seller.name.charAt(0)}
                          </div>
                          <div>
                            <p className={`text-sm font-bold ${isMe ? "text-violet-300" : "text-white"}`}>
                              {r.seller.name.split(" ")[0]}
                              {isMe && <span className="ml-1.5 text-[9px] text-violet-400 uppercase tracking-wider font-black">você</span>}
                            </p>
                            <p className="text-xs text-neutral-500">{r.salesCount} vendas</p>
                          </div>
                        </div>
                        <p className={`text-sm font-black ${isMe ? "text-violet-300" : "text-neutral-300"}`}>
                          R$ {r.totalSales.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
