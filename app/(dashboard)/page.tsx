"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation"; 
import { createClient } from "@/lib/supabase/client";
import { getDashboardStats, buildMaiaBriefing } from "@/lib/data/dashboard";
import { getMonthlyChartData } from "@/lib/data/sales";
import { obterBriefingIAAction } from "@/lib/actions/ai-actions"; 
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
import { Users, Upload, Plus, AlertCircle, RefreshCw, Calendar as CalendarIcon, X, Target, Banknote, PieChart, TrendingUp, LayoutDashboard, DollarSign, Star, ShoppingCart, Clock } from "lucide-react";
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

// Interface estruturada para o payload da Inteligência Artificial
interface MaiaInsight {
  titulo: string;
  briefing: string;
  acao: string;
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
  // Estado tipado para o novo formato de payload da IA
  const [mensagemIA, setMensagemIA] = useState<MaiaInsight | null>(null);

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

      // =================================================================
      // INTEGRAÇÃO DA IA COM CACHE DE 2 HORAS (PERFORMANCE BOOST)
      // =================================================================
      const CACHE_KEY = "maia_insight_cache";
      const cachedIA = localStorage.getItem(CACHE_KEY);
      let shouldFetchAI = true;

      if (cachedIA) {
        const { timestamp, data: cachedData } = JSON.parse(cachedIA);
        // Calcula quantas horas se passaram desde o último insight
        const hoursPassed = (Date.now() - timestamp) / (1000 * 60 * 60);
        
        // Se passou MENOS de 2 horas, usa o insight guardado no Cache do Navegador
        if (hoursPassed < 2) {
          setMensagemIA(cachedData);
          shouldFetchAI = false;
        }
      }

      // Só bate na API do Gemini se o cache expirou (passou de 2h) ou se for a primeira vez
      if (shouldFetchAI) {
        const briefingIA = await obterBriefingIAAction(stats);

        if (briefingIA.success) {
          const aiPayload: MaiaInsight = {
            titulo: briefingIA.titulo,
            briefing: briefingIA.briefing,
            acao: briefingIA.acao
          };
          
          setMensagemIA(aiPayload);
          
          // Grava no Local Storage com a data de agora para segurar as próximas requisições
          localStorage.setItem(CACHE_KEY, JSON.stringify({ 
            timestamp: Date.now(), 
            data: aiPayload 
          }));
        } else {
          // Fallback seguro caso a IA falhe por instabilidade na rede
          setMensagemIA({
            titulo: "Análise Estática",
            briefing: buildMaiaBriefing(stats.totalFaturado, stats.metaGlobal),
            acao: "Verifique o ranking e atualize suas vendas."
          });
        }
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
    // Override temporário do Cache para comemorar a venda imediatamente
    if (valorVenda >= 5000) {
      dispararGritoDeGol();
      setMensagemIA({
        titulo: "🚀 GOLAÇO!",
        briefing: `Uma venda estrondosa de R$ ${valorVenda.toLocaleString('pt-BR')} foi registrada no sistema.`,
        acao: "Aproveite a adrenalina e feche mais um negócio hoje!"
      });
    } else {
      setMensagemIA({
        titulo: "✅ Venda Confirmada",
        briefing: `Negócio de R$ ${valorVenda.toLocaleString('pt-BR')} validado e adicionado à meta.`,
        acao: "Atualize o pipeline e busque o próximo cliente."
      });
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
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-xl icon-badge-orange">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <span className="text-white">Dashboard</span>
          </h2>
          <p className="text-white/40 mt-1 text-sm">Acompanhamento de Vendas da Equipe</p>
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

          <div className="flex gap-3 ml-auto sm:ml-0">
            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold transition-all hover:bg-white/10 hover:border-white/20 backdrop-blur-md">
              <Upload className="h-4 w-4 text-white/60" /> Importar Relatório
            </button>
            <button onClick={() => setIsNovaVendaOpen(true)} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold btn-gradient-orange">
              <Plus className="h-4 w-4" /> Nova Venda
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
            
            <div className="grid gap-4 md:grid-cols-4">
              {/* Card 1 — Faturamento (laranja) */}
              <motion.div variants={itemVariants} className="kpi-orange rounded-2xl p-5 flex flex-col gap-3 transition-all cursor-default">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-orange-300/70">Total Faturado</span>
                  <div className="p-2 rounded-lg icon-badge-orange">
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-3xl font-black tracking-tight text-gradient-orange">
                  R$ {data.totalFaturado.toLocaleString("pt-BR")}
                </p>
                <div className="h-px bg-gradient-to-r from-orange-500/30 to-transparent" />
                <span className="text-xs text-orange-300/50 font-medium">Período selecionado</span>
              </motion.div>

              {/* Card 2 — Top Seller (pink) */}
              <motion.div
                variants={itemVariants}
                role={data.topSeller ? "button" : undefined}
                onClick={() => data.topSeller && setVendedorSelecionado(data.topSeller)}
                className={`kpi-pink rounded-2xl p-5 flex flex-col gap-3 transition-all ${data.topSeller ? "cursor-pointer" : "cursor-default"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-pink-300/70">Destaque</span>
                  <div className="p-2 rounded-lg icon-badge-pink">
                    <Star className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex items-center gap-2.5 mt-1">
                  <div className="h-9 w-9 rounded-full flex items-center justify-center icon-badge-pink flex-shrink-0">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-base font-black leading-tight text-white">{data.topSeller?.seller.name ?? "—"}</p>
                    {data.topSeller && <span className="text-xs text-pink-400 font-semibold">Ver detalhes →</span>}
                  </div>
                </div>
                <div className="h-px bg-gradient-to-r from-pink-500/30 to-transparent" />
                <span className="text-xs text-pink-300/50 font-medium">Melhor vendedor</span>
              </motion.div>

              {/* Card 3 — Qtd Vendas (teal) */}
              <motion.div variants={itemVariants} className="kpi-teal rounded-2xl p-5 flex flex-col gap-3 transition-all cursor-default">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-teal-300/70">Qtd. Vendas</span>
                  <div className="p-2 rounded-lg icon-badge-teal">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-3xl font-black tracking-tight text-gradient-teal">
                  {data.qtdVendas}
                  <span className="text-sm font-bold ml-2 text-teal-300/60">unid.</span>
                </p>
                <div className="h-px bg-gradient-to-r from-teal-500/30 to-transparent" />
                <span className="text-xs text-teal-300/50 font-medium">No período</span>
              </motion.div>

              {/* Card 4 — Fechamento (azul) */}
              <motion.div variants={itemVariants}><ContagemFechamento /></motion.div>
            </div>

            <MetaEquipe faturado={data.totalFaturado} meta={data.metaGlobal} />

            <div className="grid gap-6 lg:grid-cols-3">
              <motion.div variants={itemVariants}><TermometroDiasUteis meta={data.metaGlobal} faturado={data.totalFaturado} inicio={periodo.inicio} fim={periodo.fim} /></motion.div>

              <motion.div variants={itemVariants} className="h-full">
                <div className="glass-card rounded-2xl border border-white/5 p-6 h-full min-h-[340px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 rounded-xl icon-badge-teal"><Banknote className="h-5 w-5" /></div>
                      <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Inteligência de Vendas</h3>
                    </div>
                    <div className="mb-6">
                      <p className="text-white/30 text-xs mb-2 font-bold uppercase tracking-wider">Ticket Médio</p>
                      <span className="text-4xl font-black tracking-tighter text-gradient-teal">
                        R$ {metricasQualidade.ticketMedio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl p-4 border border-violet-500/15 bg-violet-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-4 w-4 text-violet-400" />
                      <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Média Diária</span>
                    </div>
                    <span className="text-2xl font-black text-gradient-purple tracking-tight">
                      R$ {metricasQualidade.mediaDiaria.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    </span>
                    <p className="text-[10px] text-white/25 mt-2 font-medium">Com base nos dias úteis trabalhados até agora.</p>
                  </div>
                </div>
              </motion.div>
              
              <motion.div variants={itemVariants}><TermometroRitmo meta={data.metaGlobal} faturado={data.totalFaturado} inicio={periodo.inicio} fim={periodo.fim} /></motion.div>
            </div>

            <motion.div variants={itemVariants} className="grid gap-4 lg:grid-cols-3 mt-2">
              <div className="glass-card rounded-2xl border border-violet-500/15 bg-gradient-to-br from-violet-500/10 to-pink-500/5 p-6 lg:col-span-1 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/10 -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />
                <div className="flex items-center gap-3 mb-5 relative z-10">
                  <div className="p-2.5 rounded-xl icon-badge-purple">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Canal Dominante</h3>
                </div>
                <p className="text-4xl font-black text-white mb-2 relative z-10">{canais.dominante}</p>
                <p className="text-xs text-white/30 font-medium relative z-10">Maior fatia do faturamento no período.</p>
              </div>

              <div className="glass-card rounded-2xl border border-white/5 p-6 lg:col-span-2 flex flex-col sm:flex-row items-center gap-8">
                <div className="relative w-44 h-44 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={radius} fill="transparent" stroke="rgba(99,102,241,0.15)" strokeWidth="10" />
                    <circle cx="50" cy="50" r={radius} fill="transparent" stroke="url(#tealGrad)" strokeWidth="10" strokeDasharray={circumference} strokeDashoffset={comercialOffset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                    <defs>
                      <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#14b8a6" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <PieChart className="h-5 w-5 text-white/30 mb-1" />
                    <span className="text-[10px] font-bold text-white/30 uppercase">Canais</span>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400"></div>
                        <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Comercial</span>
                      </div>
                      <span className="text-xl font-black text-white">R$ {canais.comercial.toLocaleString('pt-BR')}</span>
                    </div>
                    <span className="text-3xl font-black text-gradient-teal">{canais.pctComercial.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-px bg-white/8"></div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-400 to-blue-400"></div>
                        <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Atendimento</span>
                      </div>
                      <span className="text-xl font-black text-white">R$ {canais.atendimento.toLocaleString('pt-BR')}</span>
                    </div>
                    <span className="text-3xl font-black text-gradient-blue">{canais.pctAtendimento.toFixed(1)}%</span>
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
      
      <MaiaBriefing show={maiaAtiva} message={mensagemIA as any} onClose={() => setMaiaAtiva(false)} />
    </>
  );
}