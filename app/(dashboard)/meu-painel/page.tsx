"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { createClient } from "@/lib/supabase/client";
import { TermometroDiasUteis } from "@/components/TermometroDiasUteis";
import { TermometroRitmo } from "@/components/TermometroRitmo";
import { GraficoComparativoDiario } from "@/components/GraficoComparativoDiario";
import { getDailyComparisonData } from "@/lib/data/sales";
import { getSellerGoal } from "@/lib/data/goals";

function getInitialPeriodo() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return {
    inicio: `${ano}-${mes}-01`,
    fim: `${ano}-${mes}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

export default function MeuPainelPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [vendedor, setVendedor] = useState<any>(null);
  const [vendas, setVendas] = useState<any[]>([]);
  const [metaIndividual, setMetaIndividual] = useState(0);
  const [chartData, setChartData] = useState<{ day: string; atual: number; anterior: number }[]>([]);

  const [periodo, setPeriodo] = useState(getInitialPeriodo);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Estados da Batalha X1
  const [colegas, setColegas] = useState<any[]>([]);
  const [colegaSelecionado, setColegaSelecionado] = useState("");
  const [batalha, setBatalha] = useState<any>(null);
  const [oponente, setOponente] = useState<any>(null);
  const [oponenteTotal, setOponenteTotal] = useState(0);
  const [loadingBatalha, setLoadingBatalha] = useState(false);

  const { diasUteisPassados, diasUteisTotais } = useMemo(() => {
    const hoje = new Date();
    const startOfMonth = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const endOfMonth = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    let passados = 0;
    let totais = 0;
    let curDate = new Date(startOfMonth.getTime());
    while (curDate <= endOfMonth) {
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        totais++;
        if (curDate <= hoje) passados++;
      }
      curDate.setDate(curDate.getDate() + 1);
    }
    return { diasUteisPassados: passados || 1, diasUteisTotais: totais || 22 };
  }, []);

  const carregarMeuPainel = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: sellerData } = await supabase
        .from("sellers")
        .select("*")
        .eq("email", user.email)
        .single();

      if (sellerData) {
        setVendedor(sellerData);

        const meta = await getSellerGoal(supabase, sellerData.id);
        setMetaIndividual(meta);

        // Vendas do período selecionado
        const { data: salesData } = await supabase
          .from("sales")
          .select("*")
          .eq("seller_id", sellerData.id)
          .gte("sale_date", `${periodo.inicio}T00:00:00`)
          .lte("sale_date", `${periodo.fim}T23:59:59`);

        setVendas(salesData || []);

        // Gráfico comparativo diário (seller específico)
        const comparativo = await getDailyComparisonData(supabase, periodo.inicio, periodo.fim, sellerData.id);
        setChartData(comparativo);

        // Batalha X1 usa sempre o mês atual
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const { data: battleData } = await supabase
          .from("x1_battles")
          .select("*")
          .or(`challenger_id.eq.${sellerData.id},challenged_id.eq.${sellerData.id}`)
          .in("status", ["pendente", "ativo"])
          .maybeSingle();

        if (battleData) {
          setBatalha(battleData);
          const oppId = battleData.challenger_id === sellerData.id ? battleData.challenged_id : battleData.challenger_id;
          const { data: oppData } = await supabase.from("sellers").select("*").eq("id", oppId).single();
          setOponente(oppData);

          if (battleData.status === "ativo" && oppData) {
            const { data: oppSales } = await supabase
              .from("sales")
              .select("amount")
              .eq("seller_id", oppData.id)
              .gte("sale_date", inicioMes)
              .lte("sale_date", fimMes);
            setOponenteTotal(oppSales?.reduce((acc, v) => acc + Number(v.amount), 0) || 0);
          }
        } else {
          const { data: colegasData } = await supabase
            .from("sellers")
            .select("*")
            .eq("status", "Ativo")
            .eq("is_deleted", false)
            .eq("is_admin", false)
            .neq("id", sellerData.id);
          setColegas(colegasData || []);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar painel:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase, periodo]);

  useEffect(() => {
    carregarMeuPainel();
  }, [carregarMeuPainel]);

  const enviarDesafio = async () => {
    if (!colegaSelecionado) return;
    setLoadingBatalha(true);
    await supabase.from("x1_battles").insert({
      challenger_id: vendedor.id,
      challenged_id: colegaSelecionado,
      status: "pendente",
    });
    await carregarMeuPainel();
    setLoadingBatalha(false);
  };

  const responderDesafio = async (novoStatus: "ativo" | "recusado") => {
    if (!batalha) return;
    setLoadingBatalha(true);
    await supabase.from("x1_battles").update({ status: novoStatus }).eq("id", batalha.id);
    await carregarMeuPainel();
    setLoadingBatalha(false);
  };

  const totalVendido = useMemo(() => vendas.reduce((acc, v) => acc + Number(v.amount), 0), [vendas]);
  const progresso = useMemo(() => metaIndividual > 0 ? Math.min((totalVendido / metaIndividual) * 100, 100) : 0, [totalVendido, metaIndividual]);
  const faltaParaMeta = useMemo(() => metaIndividual - totalVendido, [metaIndividual, totalVendido]);
  const ticketMedio = useMemo(() => vendas.length > 0 ? totalVendido / vendas.length : 0, [vendas.length, totalVendido]);

  const tendenciaFechamento = useMemo(
    () => (totalVendido / diasUteisPassados) * diasUteisTotais,
    [totalVendido, diasUteisPassados, diasUteisTotais]
  );
  const estaAbaixoDaMeta = useMemo(
    () => tendenciaFechamento < metaIndividual,
    [tendenciaFechamento, metaIndividual]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Icon icon="line-md:loading-loop" className="icon-always h-10 w-10 text-purple-500" />
      </div>
    );
  }

  if (!vendedor) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-white">Perfil não encontrado</h2>
        <p className="text-neutral-400">O seu email de login não está vinculado a nenhum vendedor ativo.</p>
      </div>
    );
  }

  const periodoLabel = `${periodo.inicio.split("-").reverse().join("/")} - ${periodo.fim.split("-").reverse().join("/")}`;

  return (
    <div className="max-w-6xl mx-auto pb-20">
      {/* HEADER */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight">Olá, {vendedor.name.split(" ")[0]}</h2>
          <p className="text-purple-400 font-bold mt-1 uppercase tracking-wider text-sm">
            Nível: {vendedor.category || vendedor.role || "Vendedor"}
          </p>
        </div>

        {/* SELETOR DE PERÍODO */}
        <div className="relative">
          <button
            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors backdrop-blur-md ${
              isDatePickerOpen
                ? "bg-white/10 border-white/30 text-white"
                : "bg-black/40 border-white/10 text-neutral-300 hover:bg-white/10"
            }`}
          >
            <Icon icon="line-md:calendar" className="h-4 w-4 text-neutral-400" />
            <span>{periodoLabel}</span>
            <Icon icon="mdi:chevron-down" className={`h-4 w-4 text-neutral-500 transition-transform ${isDatePickerOpen ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {isDatePickerOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute right-0 top-full mt-2 w-72 bg-[#111] border border-white/10 rounded-xl p-4 shadow-2xl z-50 flex flex-col gap-4"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold text-white">Selecionar Período</span>
                  <button onClick={() => setIsDatePickerOpen(false)} className="text-neutral-500 hover:text-white">
                    <Icon icon="line-md:close" className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-400 uppercase font-semibold">Data Inicial</label>
                  <input
                    type="date"
                    value={periodo.inicio}
                    onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))}
                    className="bg-black border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 invert-[0.8] brightness-200"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-400 uppercase font-semibold">Data Final</label>
                  <input
                    type="date"
                    value={periodo.fim}
                    onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))}
                    className="bg-black border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 invert-[0.8] brightness-200"
                  />
                </div>
                <button
                  onClick={() => { setPeriodo(getInitialPeriodo()); setIsDatePickerOpen(false); }}
                  className="text-xs text-neutral-400 hover:text-white transition-colors text-left"
                >
                  Mês atual
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* CARDS DE STATS */}
      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-6 border border-white/10 bg-gradient-to-br from-purple-500/10 to-transparent flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-purple-500/20 rounded-lg text-purple-400"><Icon icon="mdi:currency-usd" className="h-5 w-5" /></div>
            <h3 className="text-xs font-bold text-neutral-400 uppercase">Meu Faturamento</h3>
          </div>
          <p className="text-3xl font-black text-purple-400">R$ {totalVendido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-2xl p-6 border border-white/5 bg-white/[0.02] flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-blue-500/10 rounded-lg text-blue-400"><Icon icon="mdi:trending-up" className="h-5 w-5" /></div>
            <h3 className="text-xs font-bold text-neutral-400 uppercase">Ticket Médio</h3>
          </div>
          <p className="text-3xl font-black text-white">R$ {ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-2xl p-6 border border-white/5 bg-white/[0.02] flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-yellow-500/10 rounded-lg text-yellow-400"><Icon icon="mdi:star-circle" className="h-5 w-5" /></div>
            <h3 className="text-xs font-bold text-neutral-400 uppercase">Minha Meta</h3>
          </div>
          <p className="text-3xl font-black text-white">R$ {metaIndividual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className={`glass-card rounded-2xl p-6 border flex flex-col justify-between ${faltaParaMeta <= 0 ? "border-purple-500/30 bg-purple-500/5" : "border-white/5 bg-white/[0.02]"}`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2.5 rounded-lg ${faltaParaMeta <= 0 ? "bg-purple-500/20 text-purple-400" : "bg-orange-500/10 text-orange-400"}`}>
              <Icon icon={faltaParaMeta <= 0 ? "mdi:check-circle" : "mdi:flag-checkered"} className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-neutral-400 uppercase">{faltaParaMeta <= 0 ? "Meta Batida!" : "Falta para Meta"}</h3>
          </div>
          {faltaParaMeta > 0 ? (
            <p className="text-3xl font-black text-white">R$ {faltaParaMeta.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
          ) : (
            <p className="text-3xl font-black text-purple-400">+R$ {Math.abs(faltaParaMeta).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
          )}
        </motion.div>
      </div>

      {/* TERMÔMETROS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <TermometroDiasUteis
          meta={metaIndividual}
          faturado={totalVendido}
          inicio={periodo.inicio}
          fim={periodo.fim}
        />
        <TermometroRitmo
          meta={metaIndividual}
          faturado={totalVendido}
          inicio={periodo.inicio}
          fim={periodo.fim}
        />
      </div>

      {/* GRÁFICO COMPARATIVO */}
      <div className="mb-8">
        <GraficoComparativoDiario data={chartData} startDate={periodo.inicio} />
      </div>

      {/* ARENA DE BATALHA X1 */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-red-500/10 rounded-xl text-red-500 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <Icon icon="mdi:sword-cross" className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Arena X1</h2>
            <p className="text-sm text-neutral-400">Desafie um colega e veja quem fatura mais no mês!</p>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-1 border border-white/10 bg-white/[0.02] overflow-hidden">
          {!batalha && (
            <div className="p-8 text-center bg-gradient-to-b from-black/0 to-black/40">
              <Icon icon="mdi:shield-alert" className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-white mb-2">Nenhum desafio ativo</h3>
              <p className="text-neutral-400 text-sm mb-6 max-w-md mx-auto">Selecione um vendedor da equipe abaixo e envie um convite para o combate X1.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-lg mx-auto">
                <select
                  value={colegaSelecionado}
                  onChange={(e) => setColegaSelecionado(e.target.value)}
                  className="w-full sm:w-2/3 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-red-500 transition-all appearance-none"
                >
                  <option value="" disabled>Escolha um oponente...</option>
                  {colegas.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.role || "Vendedor"})</option>
                  ))}
                </select>
                <button
                  onClick={enviarDesafio}
                  disabled={!colegaSelecionado || loadingBatalha}
                  className="w-full sm:w-1/3 bg-red-500 hover:bg-red-600 text-white font-black py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loadingBatalha ? <Icon icon="line-md:loading-loop" className="icon-always h-5 w-5" /> : "Desafiar!"}
                </button>
              </div>
            </div>
          )}

          {batalha && batalha.status === "pendente" && oponente && (
            <div className="p-8 text-center bg-gradient-to-b from-red-500/5 to-transparent">
              {batalha.challenger_id === vendedor.id ? (
                <>
                  <Icon icon="line-md:loading-loop" className="icon-always h-12 w-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white mb-2">Desafio Enviado!</h3>
                  <p className="text-neutral-400">Aguardando <strong className="text-white">{oponente.name}</strong> aceitar...</p>
                </>
              ) : (
                <>
                  <Icon icon="mdi:sword-cross" className="h-16 w-16 text-red-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-black text-white mb-2">Você foi desafiado!</h3>
                  <p className="text-neutral-400 mb-8"><strong className="text-white">{oponente.name}</strong> te chamou para a Arena X1. Vai encarar?</p>
                  <div className="flex items-center justify-center gap-4">
                    <button onClick={() => responderDesafio("recusado")} disabled={loadingBatalha} className="px-6 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300 font-bold transition-all flex items-center gap-2">
                      <Icon icon="line-md:close" className="h-5 w-5" /> Arregar
                    </button>
                    <button onClick={() => responderDesafio("ativo")} disabled={loadingBatalha} className="px-8 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-black shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all flex items-center gap-2 hover:scale-105">
                      <Icon icon="mdi:check-bold" className="h-5 w-5" /> Aceitar Combate
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {batalha && batalha.status === "ativo" && oponente && (
            <div className="p-6 sm:p-10 relative overflow-hidden bg-gradient-to-b from-black/0 to-red-500/5">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[150px] font-black text-white/[0.02] pointer-events-none select-none">VS</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-20 relative z-10">
                <div className="text-center md:text-right flex flex-col items-center md:items-end">
                  <div className="h-20 w-20 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-3xl font-black border-2 border-purple-500 mb-4">
                    {vendedor.name.charAt(0)}
                  </div>
                  <h4 className="text-2xl font-black text-white">{vendedor.name.split(" ")[0]}</h4>
                  <p className="text-purple-400 font-bold uppercase text-xs tracking-widest mb-4">Você</p>
                  <p className="text-5xl font-black text-white tracking-tighter">R$ {totalVendido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
                  {totalVendido > oponenteTotal && <span className="mt-4 px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-black uppercase rounded-full border border-purple-500/50 animate-pulse">Ganhando 🔥</span>}
                </div>
                <div className="text-center md:text-left flex flex-col items-center md:items-start">
                  <div className="h-20 w-20 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-3xl font-black border-2 border-purple-500 mb-4">
                    {oponente.name.charAt(0)}
                  </div>
                  <h4 className="text-2xl font-black text-white">{oponente.name.split(" ")[0]}</h4>
                  <p className="text-purple-400 font-bold uppercase text-xs tracking-widest mb-4">Oponente</p>
                  <p className="text-5xl font-black text-white tracking-tighter">R$ {oponenteTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</p>
                  {oponenteTotal > totalVendido && <span className="mt-4 px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-black uppercase rounded-full border border-purple-500/50 animate-pulse">Ganhando 🔥</span>}
                </div>
              </div>
              <div className="mt-10 h-4 w-full bg-neutral-900 rounded-full flex overflow-hidden border border-white/10 relative">
                {totalVendido === 0 && oponenteTotal === 0 ? (
                  <div className="w-full h-full bg-neutral-800" />
                ) : (
                  <>
                    <div className="h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-1000" style={{ width: `${(totalVendido / (totalVendido + oponenteTotal)) * 100}%` }} />
                    <div className="h-full bg-gradient-to-l from-purple-600 to-purple-400 transition-all duration-1000" style={{ width: `${(oponenteTotal / (totalVendido + oponenteTotal)) * 100}%` }} />
                  </>
                )}
                <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-white/20 -translate-x-1/2 z-10" />
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* HISTÓRICO DE VENDAS */}
      <div className="glass-card rounded-2xl p-6 border border-white/5 bg-white/[0.02]">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Icon icon="line-md:calendar" className="h-5 w-5 text-neutral-400" /> Minhas Últimas Vendas
        </h3>
        {vendas.length > 0 ? (
          <div className="space-y-3">
            {vendas.slice(0, 5).reverse().map((venda) => (
              <div key={venda.id} className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-white/5 hover:bg-white/[0.02] transition-colors">
                <div>
                  <p className="font-bold text-white text-sm">Venda registrada</p>
                  <p className="text-xs text-neutral-500">{new Date(venda.sale_date).toLocaleDateString("pt-BR")}</p>
                </div>
                <span className="font-black text-purple-400">R$ {Number(venda.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500 italic text-center py-6">Você ainda não registrou vendas neste período. Bora fechar negócio!</p>
        )}
      </div>
    </div>
  );
}
