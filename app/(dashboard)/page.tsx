"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation"; 
import { createClient } from "@/lib/supabase/client";
import { getDashboardStats, buildMaiaBriefing } from "@/lib/data/dashboard";
import { getMonthlyChartData } from "@/lib/data/sales";
import { obterBriefingIAAction } from "@/lib/actions/ai-actions"; // Nova importação
import { TermometroRitmo } from "@/components/TermometroRitmo";
import { TermometroDiasUteis } from "@/components/TermometroDiasUteis";
import { ContagemFechamento } from "@/components/ContagemFechamento";
import { ImportadorIA } from "@/components/ImportadorIA";
import { SkeletonCard, SkeletonChart } from "@/components/SkeletonCard";
import { PerfilVendedorModal } from "@/components/PerfilVendedorModal";
import { MaiaBriefing } from "@/components/MaiaBriefing";
import { MetaEquipe } from "@/components/MetaEquipe";
import { NovaVendaModal } from "@/components/NovaVendaModal";
import { dispararGritoDeGol } from "@/lib/utils";
import { Users, Upload, Plus, AlertCircle, RefreshCw, Calendar as CalendarIcon, X, Target, Banknote, PieChart, TrendingUp, LayoutDashboard } from "lucide-react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import type { ChartPoint, SellerRanking } from "@/types";

interface DashboardData {
  totalFaturado: number;
  qtdVendas: number;
  metaGlobal: number;
  topSeller: SellerRanking | null;
  chartData: ChartPoint[];
}

interface CanaisData {
  comercial: number;
  atendimento: number;
  pctComercial: number;
  pctAtendimento: number;
  dominante: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

const getLocalFirstAndLastDay = () => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  
  const firstDay = `${y}-${m}-01`;
  const lastDayObj = new Date(y, date.getMonth() + 1, 0);
  const lastDay = `${y}-${m}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
  
  return { firstDay, lastDay };
};

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter(); 
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isNovaVendaOpen, setIsNovaVendaOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  const [vendedorSelecionado, setVendedorSelecionado] = useState<SellerRanking | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [canais, setCanais] = useState<CanaisData>({ comercial: 0, atendimento: 0, pctComercial: 0, pctAtendimento: 0, dominante: "Empate" });
  const [maiaAtiva, setMaiaAtiva] = useState(false);
  const [mensagemIA, setMensagemIA] = useState("");

  const initialDates = getLocalFirstAndLastDay();
  const [periodo, setPeriodo] = useState<{ inicio: string; fim: string }>({
    inicio: initialDates.firstDay,
    fim: initialDates.lastDay
  });

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.email) {
        const masterAdminEmail = process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL || "admin@onlinegrafica.com";
        const isMasterAdmin = user.email === masterAdminEmail;

        const { data: seller } = await supabase
          .from("sellers")
          .select("is_admin")
          .eq("email", user.email)
          .maybeSingle(); 
        
        if (!seller && !isMasterAdmin) {
          setError(`Acesso Negado: O e-mail (${user.email}) não está registrado na tabela de equipe.`);
          setLoading(false);
          return;
        }

        if (seller && !seller.is_admin && !isMasterAdmin) {
          router.push("/meu-painel");
          return; 
        }
      }

      const [stats, chart, { data: salesData }] = await Promise.all([
        getDashboardStats(supabase, periodo.inicio, periodo.fim),
        getMonthlyChartData(supabase, periodo.inicio, periodo.fim),
        supabase.from('sales').select('amount, channel').gte('sale_date', `${periodo.inicio}T00:00:00`).lte('sale_date', `${periodo.fim}T23:59:59`)
      ]);

      setData({
        totalFaturado: stats.totalFaturado,
        qtdVendas: stats.qtdVendas,
        metaGlobal: stats.metaGlobal,
        topSeller: stats.topSeller,
        chartData: chart,
      });

      const totaisCanais = (salesData || []).reduce((acc, row) => {
        const val = Number(row.amount);
        if (row.channel === 'atendimento') acc.a += val;
        else acc.c += val;
        return acc;
      }, { c: 0, a: 0 });

      const totalGeral = totaisCanais.c + totaisCanais.a;

      setCanais({
        comercial: totaisCanais.c,
        atendimento: totaisCanais.a,
        pctComercial: totalGeral > 0 ? (totaisCanais.c / totalGeral) * 100 : 0,
        pctAtendimento: totalGeral > 0 ? (totaisCanais.a / totalGeral) * 100 : 0,
        dominante: totaisCanais.c > totaisCanais.a ? "Comercial" : totaisCanais.a > totaisCanais.c ? "Atendimento" : "Empate"
      });

      // INTEGRAÇÃO DA IA (Erro corrigido aqui)
      const briefingIA = await obterBriefingIAAction(stats);

      if (briefingIA.success) {
        setMensagemIA(briefingIA.briefing || "Análise concluída com sucesso.");
      } else {
        setMensagemIA(buildMaiaBriefing(stats.totalFaturado, stats.metaGlobal));
      }
      
      setLoading(false);
      setMaiaAtiva(true);
    } catch (err: any) {
      setError("Não foi possível atualizar os dados do painel.");
      setLoading(false);
    }
  }, [supabase, periodo, router]); 

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const handleNovaVendaSuccess = (valorVenda: number) => {
    if (valorVenda >= 5000) {
      dispararGritoDeGol();
      setMensagemIA(`🚀 GOLAÇO! Uma venda de R$ ${valorVenda.toLocaleString('pt-BR')} foi registrada.`);
    } else {
      setMensagemIA(`✅ Venda de R$ ${valorVenda.toLocaleString('pt-BR')} registrada com sucesso.`);
    }
    setMaiaAtiva(true);
    carregarDados();
  };

  const metricasQualidade = useMemo(() => {
    if (!data) return { ticketMedio: 0, mediaDiaria: 0 };
    const hoje = new Date();
    const startOfMonth = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    let diasUteisPassados = 0;
    let curDate = new Date(startOfMonth.getTime());
    
    while (curDate <= hoje) {
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) diasUteisPassados++; 
      curDate.setDate(curDate.getDate() + 1);
    }
    
    return {
      ticketMedio: data.qtdVendas > 0 ? data.totalFaturado / data.qtdVendas : 0,
      mediaDiaria: diasUteisPassados > 0 ? data.totalFaturado / diasUteisPassados : 0
    };
  }, [data]);

  const radius = 40;
  const circumference = 2 * Math.PI * radius; 
  const comercialOffset = circumference - (canais.pctComercial / 100) * circumference;

  return (
    <>
      <header className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between relative z-50">
        <div>
          <h2 className="text-4xl font-black tracking-tight flex items-center gap-3 text-white">
            <LayoutDashboard className="h-8 w-8 text-purple-500" />
            Dashboard
          </h2>
          <p className="text-neutral-400 mt-1">Acompanhamento de Vendas da Equipe</p>
        </div>

        <div className="flex flex-wrap gap-4 items-center w-full sm:w-auto">
          <div className="relative">
            <button onClick={() => setIsDatePickerOpen(!isDatePickerOpen)} className={`flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors backdrop-blur-md ${isDatePickerOpen ? "bg-white/10 border-white/30 text-white" : "bg-black/40 border-white/10 text-neutral-300 hover:bg-white/10"}`}>
              <CalendarIcon className="h-4 w-4 text-neutral-400" />
              <span>{periodo.inicio.split('-').reverse().join('/')} - {periodo.fim.split('-').reverse().join('/')}</span>
            </button>
            <AnimatePresence>
              {isDatePickerOpen && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute right-0 top-full mt-2 w-72 bg-[#111] border border-white/10 rounded-xl p-4 shadow-2xl z-50 flex flex-col gap-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-bold text-white">Selecionar Período</span>
                    <button onClick={() => setIsDatePickerOpen(false)} className="text-neutral-500 hover:text-white"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-400 uppercase font-semibold">Data Inicial</label>
                    <input type="date" value={periodo.inicio} onChange={(e) => setPeriodo(prev => ({ ...prev, inicio: e.target.value }))} className="bg-black border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 invert-[0.8] brightness-200" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-neutral-400 uppercase font-semibold">Data Final</label>
                    <input type="date" value={periodo.fim} onChange={(e) => setPeriodo(prev => ({ ...prev, fim: e.target.value }))} className="bg-black border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 invert-[0.8] brightness-200" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-4 ml-auto sm:ml-0">
            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10 backdrop-blur-md">
              <Upload className="h-4 w-4" /> Importar Relatório
            </button>
            <button onClick={() => setIsNovaVendaOpen(true)} className="flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-bold text-black shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all hover:bg-neutral-200 hover:scale-105">
              <Plus className="h-4 w-4 font-bold" /> Nova Venda
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div key="error" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center p-12 rounded-xl border border-red-500/20 bg-red-500/5 backdrop-blur-md text-center max-w-2xl mx-auto my-10 relative z-10">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4 animate-pulse" />
            <h3 className="text-lg font-bold text-white mb-2">Ops! Problema de Permissão</h3>
            <p className="text-sm text-neutral-400 mb-6">{error}</p>
            <button onClick={carregarDados} className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white font-semibold rounded-md border border-white/10 hover:bg-white/20 transition-all text-sm"><RefreshCw className="h-4 w-4" /> Tentar Novamente</button>
          </motion.div>
        ) : loading || !data ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-6 relative z-10">
            <div className="grid gap-6 md:grid-cols-4"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
            <div className="grid gap-6 lg:grid-cols-3"><SkeletonChart /><SkeletonChart /><SkeletonChart /></div>
          </motion.div>
        ) : (
          <motion.div key="content" variants={containerVariants} initial="hidden" animate="show" className="grid gap-6 relative z-10">
            
            <div className="grid gap-6 md:grid-cols-4">
              <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02]">
                <span className="text-sm font-medium text-neutral-400">Total Faturado</span>
                <p className="text-3xl font-bold mt-2 text-purple-400">R$ {data.totalFaturado.toLocaleString("pt-BR")}</p>
              </motion.div>

              <motion.div 
                variants={itemVariants} 
                role={data.topSeller ? "button" : undefined} 
                onClick={() => data.topSeller && setVendedorSelecionado(data.topSeller)} 
                className={`glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02] flex flex-col justify-center ${data.topSeller ? "cursor-pointer group hover:border-purple-500/40 hover:bg-white/[0.04] transition-all" : ""}`}
              >
                <span className="text-sm font-medium text-neutral-400 group-hover:text-white transition-colors">Vendedor Destaque</span>
                <div className="flex items-center gap-3 mt-2">
                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-lg font-bold leading-tight">{data.topSeller?.seller.name ?? "—"}</p>
                    {data.topSeller && <span className="text-xs text-purple-400 font-medium">Ver detalhes</span>}
                  </div>
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02]">
                <span className="text-sm font-medium text-neutral-400">Quantidade de Vendas</span>
                <p className="text-3xl font-bold mt-2">{data.qtdVendas} <span className="text-sm text-neutral-500 uppercase font-black">Unidades</span></p>
              </motion.div>

              <motion.div variants={itemVariants}><ContagemFechamento /></motion.div>
            </div>

            <MetaEquipe faturado={data.totalFaturado} meta={data.metaGlobal} />

            <div className="grid gap-6 lg:grid-cols-3">
              <motion.div variants={itemVariants}><TermometroDiasUteis meta={data.metaGlobal} faturado={data.totalFaturado} /></motion.div>

              <motion.div variants={itemVariants} className="h-full">
                <div className="glass-card rounded-xl border border-white/5 bg-white/[0.02] p-6 h-full min-h-[340px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 rounded-lg border border-white/10 bg-white/5 text-blue-400"><Banknote className="h-5 w-5" /></div>
                      <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400">Inteligência de Vendas</h3>
                    </div>
                    <div className="mb-6">
                      <p className="text-neutral-500 text-sm mb-1 font-bold uppercase tracking-wider">Ticket Médio (Por Venda)</p>
                      <span className="text-4xl font-black text-white tracking-tighter">R$ {metricasQualidade.ticketMedio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                  <div className="bg-black/40 rounded-xl p-5 border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-neutral-400" />
                      <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Média Diária Faturada</span>
                    </div>
                    <span className="text-2xl font-black text-purple-400 tracking-tight">R$ {metricasQualidade.mediaDiaria.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                    <p className="text-[10px] text-neutral-500 mt-2 font-medium">Calculado com base nos dias úteis trabalhados até o momento.</p>
                  </div>
                </div>
              </motion.div>
              
              <motion.div variants={itemVariants}><TermometroRitmo meta={data.metaGlobal} faturado={data.totalFaturado} /></motion.div>
            </div>

            <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-3 mt-2">
              <div className="glass-card rounded-xl border border-white/5 bg-gradient-to-br from-white/[0.05] to-transparent p-8 lg:col-span-1 flex flex-col justify-center relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-400">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400">Canal Dominante</h3>
                </div>
                <p className="text-5xl font-black text-white mb-2">{canais.dominante}</p>
                <p className="text-sm text-neutral-500 font-medium">Responsável pela maior fatia do faturamento no período selecionado.</p>
              </div>

              <div className="glass-card rounded-xl border border-white/5 bg-white/[0.02] p-8 lg:col-span-2 flex flex-col sm:flex-row items-center gap-8">
                <div className="relative w-48 h-48 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#3b82f6" strokeWidth="12" />
                    <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#10b981" strokeWidth="12" strokeDasharray={circumference} strokeDashoffset={comercialOffset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <PieChart className="h-6 w-6 text-neutral-500 mb-1" />
                    <span className="text-xs font-bold text-neutral-400 uppercase">Divisão</span>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                        <span className="text-sm font-bold text-white uppercase tracking-wider">Comercial</span>
                      </div>
                      <span className="text-2xl font-black text-white">R$ {canais.comercial.toLocaleString('pt-BR')}</span>
                    </div>
                    <span className="text-3xl font-black text-purple-500">{canais.pctComercial.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-[1px] bg-white/10"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-sm font-bold text-white uppercase tracking-wider">Atendimento</span>
                      </div>
                      <span className="text-2xl font-black text-white">R$ {canais.atendimento.toLocaleString('pt-BR')}</span>
                    </div>
                    <span className="text-3xl font-black text-blue-500">{canais.pctAtendimento.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isImportModalOpen && <ImportadorIA isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onImported={() => carregarDados()} />}
        
        {vendedorSelecionado && (
          <PerfilVendedorModal 
            isOpen={!!vendedorSelecionado} 
            onClose={() => setVendedorSelecionado(null)}
            sellerStats={{
              name: vendedorSelecionado.seller.name,
              totalSales: vendedorSelecionado.totalSales,
              salesCount: vendedorSelecionado.salesCount
            }}
          />
        )}
      </AnimatePresence>

      <NovaVendaModal isOpen={isNovaVendaOpen} onClose={() => setIsNovaVendaOpen(false)} onSuccess={handleNovaVendaSuccess} />
      <MaiaBriefing show={maiaAtiva} message={mensagemIA} onClose={() => setMaiaAtiva(false)} />
    </>
  );
}