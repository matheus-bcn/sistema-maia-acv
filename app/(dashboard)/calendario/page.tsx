"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  TrendingUp,
  AlertCircle,
  Plus,
  RefreshCw,
  X,
  Loader2,
  DollarSign,
  Users,
  Trash2 
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDailySalesForMonth } from "@/lib/data/sales";
import { getTeamGoal } from "@/lib/data/goals";
import { listCalendarEvents } from "@/lib/data/calendar";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const SkeletonCalendar = () => (
  <div className="animate-pulse">
    <div className="grid grid-cols-7 gap-2 mb-4">
      {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
        <div key={`skel-header-${d}`} className="h-4 w-8 mx-auto bg-white/10 rounded" />
      ))}
    </div>
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 35 }).map((_, i) => (
        <div key={`skel-day-${i}`} className="min-h-[80px] rounded-lg bg-white/5 border border-white/5" />
      ))}
    </div>
  </div>
);

const SkeletonSidebar = () => (
  <div className="animate-pulse space-y-6">
    <div className="glass-card rounded-xl p-6 h-32 bg-white/[0.02] border border-white/5" />
    <div className="glass-card rounded-xl p-6 h-64 bg-white/[0.02] border border-white/5" />
  </div>
);

export default function CalendarioPage() {
  const supabase = useMemo(() => createClient(), []);

  const [today] = useState(startOfToday);
  const [month, setMonth] = useState(() => today.getMonth() + 1);
  const [year, setYear] = useState(() => today.getFullYear());
  
  const [dailyMap, setDailyMap] = useState<Map<number, number>>(new Map());
  const [metaDiaria, setMetaDiaria] = useState(0);
  const [eventos, setEventos] = useState<any[]>([]); 
  
  const [vendasRaw, setVendasRaw] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // NOVO: Estado para controlar se o utilizador atual tem permissões de administrador
  const [isAdmin, setIsAdmin] = useState(false);

  const [showEventForm, setShowEventForm] = useState(false);
  const [novoEvento, setNovoEvento] = useState<{ dia: string; titulo: string; tipo: "reuniao" | "treinamento" | "meta" }>({ dia: "", titulo: "", tipo: "reuniao" });
  const [savingEvent, setSavingEvent] = useState(false);

  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ========================================================
      // TRAVA DE SEGURANÇA: Verifica o nível de acesso do utilizador
      // ========================================================
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const isMasterAdmin = user.email === 'admin@onlinegrafica.com';
        const { data: seller } = await supabase
          .from("sellers")
          .select("is_admin")
          .eq("email", user.email)
          .maybeSingle();
        
        setIsAdmin(!!seller?.is_admin || isMasterAdmin);
      }
      // ========================================================

      const [daily, meta, ev] = await Promise.all([
        getDailySalesForMonth(supabase, month, year),
        getTeamGoal(supabase),
        listCalendarEvents(supabase, month, year),
      ]);

      const inicioMes = new Date(year, month - 1, 1).toISOString();
      const fimMes = new Date(year, month, 0, 23, 59, 59).toISOString();
      const { data: salesData } = await supabase
        .from("sales")
        .select("*, seller:sellers(name)")
        .gte("sale_date", inicioMes)
        .lte("sale_date", fimMes);

      setVendasRaw(salesData || []);
      setDailyMap(daily);
      setMetaDiaria(meta / 22); 
      setEventos(ev);
    } catch (err) {
      console.error("Erro ao carregar calendário:", err);
      setError("Não foi possível carregar os dados do calendário. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  }, [supabase, month, year]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleCriarEvento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return; // Bloqueio direto na função por segurança
    
    setSavingEvent(true);
    try {
      const novoEv = { 
        id: Date.now().toString(), 
        event_day: Number(novoEvento.dia), 
        title: novoEvento.titulo, 
        type: novoEvento.tipo 
      };
      
      setEventos([...eventos, novoEv]);
      setShowEventForm(false);
      setNovoEvento({ dia: "", titulo: "", tipo: "reuniao" });

      // Se quiser inserir no banco descomente a linha abaixo:
      // await supabase.from('calendar_events').insert({ event_day: novoEv.event_day, month, year, title: novoEv.title, type: novoEv.type });

    } catch (err) {
      console.error(err);
      alert("Erro ao criar evento.");
    } finally {
      setSavingEvent(false);
    }
  };

  const removerEvento = async (id: string) => {
    if (!isAdmin) return; // Bloqueio direto na função por segurança
    
    setEventos(eventos.filter(e => e.id !== id));

    try {
      // Se você já tiver a tabela de eventos no Supabase, descomente essa linha:
      // await supabase.from('calendar_events').delete().eq('id', id);
    } catch (err) {
      console.error("Erro ao excluir o evento:", err);
    }
  };

  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingEmptyCells = new Date(year, month - 1, 1).getDay();

  const dias = useMemo(() => {
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const todayDay = today.getDate();
    
    const isPastMonth = year < currentYear || (year === currentYear && month < currentMonth);
    const isFutureMonth = year > currentYear || (year === currentYear && month > currentMonth);

    return Array.from({ length: daysInMonth }, (_, i) => {
      const dia = i + 1;
      const valor = dailyMap.get(dia) ?? 0;
      
      const dayOfWeek = new Date(year, month - 1, dia).getDay();
      const isFimDeSemana = dayOfWeek === 0 || dayOfWeek === 6;
      
      const shouldEvaluateMissed = isPastMonth || (!isFutureMonth && dia < todayDay);

      let status: "success" | "danger" | "neutral" = "neutral";
      
      if (isFimDeSemana) {
        status = "neutral";
      } else if (valor > 0) {
        status = valor >= metaDiaria ? "success" : "danger";
      } else if (shouldEvaluateMissed) {
        status = "danger";
      }

      return {
        dia,
        status,
        isFimDeSemana,
        valorReal: valor,
        valor: valor > 0 ? `R$ ${(valor / 1000).toFixed(1)}k` : "",
      };
    });
  }, [daysInMonth, dailyMap, metaDiaria, month, year, today]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setMonth(d.getMonth() + 1);
    setYear(d.getFullYear());
  };

  let diasNaMeta = 0;
  let diasAbaixo = 0;
  dias.forEach((d) => {
    if (d.status === "success") diasNaMeta++;
    if (d.status === "danger") diasAbaixo++;
  });

  const getEventColorInfo = (tipo?: string) => {
    if (tipo === "treinamento") return { bg: "bg-yellow-500/20", border: "border-yellow-500/30", text: "text-yellow-400", dot: "bg-yellow-400" };
    if (tipo === "meta") return { bg: "bg-purple-500/20", border: "border-purple-500/30", text: "text-purple-400", dot: "bg-purple-400" };
    return { bg: "bg-blue-500/20", border: "border-blue-500/30", text: "text-blue-400", dot: "bg-blue-400" }; 
  };

  return (
    <>
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <CalendarIcon className="h-8 w-8 text-neutral-400" />
            Calendário Tático
          </h2>
          <p className="text-neutral-400 mt-1">Visão diária de faturamento e eventos</p>
        </div>
        
        <div className="flex items-center gap-4 bg-black/40 border border-white/10 px-4 py-2 rounded-lg backdrop-blur-md w-max">
          <button 
            type="button" 
            onClick={() => shiftMonth(-1)} 
            className="p-1 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm uppercase tracking-wider w-32 text-center">
            {MESES[month - 1]} {year}
          </span>
          <button 
            type="button" 
            onClick={() => shiftMonth(1)} 
            className="p-1 hover:bg-white/10 rounded transition-colors text-neutral-400 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error-alert"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-10 rounded-xl border border-red-500/20 bg-red-500/5 backdrop-blur-md text-center max-w-2xl mx-auto my-8"
          >
            <AlertCircle className="h-10 w-10 text-red-400 mb-4 animate-bounce" />
            <h3 className="text-lg font-bold text-white mb-2">Erro ao processar calendário</h3>
            <p className="text-sm text-neutral-400 mb-6">{error}</p>
            <button
              type="button"
              onClick={carregarDados}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white font-semibold rounded-md border border-white/10 hover:bg-white/20 transition-all text-sm"
            >
              <RefreshCw className="h-4 w-4" /> Tentar Novamente
            </button>
          </motion.div>
        ) : (
          <motion.div 
            key="calendar-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-6 lg:grid-cols-4"
          >
            <div className="glass-card rounded-xl p-6 lg:col-span-3 border border-white/5 bg-white/[0.02]">
              {loading ? (
                <SkeletonCalendar />
              ) : (
                <>
                  <div className="grid grid-cols-7 gap-2 mb-4">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                      <div key={d} className="text-center text-xs uppercase tracking-wider font-bold text-neutral-500 py-2">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: leadingEmptyCells }, (_, i) => (
                      <div key={`empty-${i}`} className="min-h-[80px] rounded-lg bg-black/20 border border-transparent" aria-hidden />
                    ))}
                    
                    {dias.map((d) => {
                      const eventosDoDia = eventos.filter((e) => e.event_day === d.dia);
                      
                      return (
                        <motion.div
                          key={d.dia}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setDiaSelecionado(d.dia)}
                          className={`min-h-[80px] rounded-lg border p-2 relative transition-colors cursor-pointer ${
                            d.status === "success"
                              ? "border-purple-500/30 bg-purple-500/10 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]"
                              : d.status === "danger"
                                ? "border-red-500/30 bg-red-500/10 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className={`text-sm font-bold ${d.isFimDeSemana ? 'text-neutral-500' : d.status === 'neutral' ? 'text-neutral-300' : 'text-white'}`}>
                              {d.dia}
                            </span>
                            {eventosDoDia.length > 0 && (
                              <div className="flex gap-1">
                                {eventosDoDia.map(ev => (
                                  <span key={ev.id} className={`h-1.5 w-1.5 rounded-full shadow-sm ${getEventColorInfo(ev.type).dot}`} />
                                ))}
                              </div>
                            )}
                          </div>
                          {d.valor && (
                            <p className="text-xs mt-2 font-bold tracking-tight text-white/90">{d.valor}</p>
                          )}
                          {d.status !== "neutral" && (
                            <div className="absolute bottom-2 right-2">
                              {d.status === "success" ? (
                                <CheckCircle2 className="h-4 w-4 text-purple-400 drop-shadow-md" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-400 drop-shadow-md" />
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {loading ? (
              <SkeletonSidebar />
            ) : (
              <div className="space-y-6">
                <div className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02]">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-neutral-400" />
                    Resumo do Mês
                  </h3>
                  <div className="space-y-3">
                    <p className="text-sm flex justify-between items-center bg-black/30 p-3 rounded-lg border border-white/5">
                      <span className="text-neutral-400 font-medium">Dias na meta</span>
                      <span className="text-purple-400 font-black text-lg">{diasNaMeta}</span>
                    </p>
                    <p className="text-sm flex justify-between items-center bg-black/30 p-3 rounded-lg border border-white/5">
                      <span className="text-neutral-400 font-medium">Dias abaixo</span>
                      <span className="text-red-400 font-black text-lg">{diasAbaixo}</span>
                    </p>
                  </div>
                </div>

                <div className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <CalendarIcon className="h-5 w-5 text-neutral-400" />
                      Eventos
                    </h3>
                    {/* SOLUÇÃO DO PONTO 3: O botão de "+" só aparece para quem for Admin */}
                    {isAdmin && (
                      <button 
                        onClick={() => setShowEventForm(!showEventForm)}
                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
                        title="Adicionar Evento"
                      >
                        <Plus className="h-4 w-4 text-white" />
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {showEventForm && isAdmin && (
                      <motion.form 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleCriarEvento}
                        className="mb-4 bg-black/40 p-3 rounded-lg border border-white/10 overflow-hidden"
                      >
                        <div className="space-y-2">
                          <input 
                            type="number" 
                            placeholder="Dia (ex: 15)" 
                            min="1" 
                            max={daysInMonth}
                            required
                            value={novoEvento.dia}
                            onChange={(e) => setNovoEvento({ ...novoEvento, dia: e.target.value })}
                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                          />
                          <input 
                            type="text" 
                            placeholder="Título do evento" 
                            required
                            value={novoEvento.titulo}
                            onChange={(e) => setNovoEvento({ ...novoEvento, titulo: e.target.value })}
                            className="w-full bg-black/50 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                          />
                          
                          <div className="grid grid-cols-3 gap-1 pt-1">
                            <button 
                              type="button" 
                              onClick={() => setNovoEvento({...novoEvento, tipo: "reuniao"})} 
                              className={`py-1.5 rounded text-[10px] font-bold border transition-colors ${novoEvento.tipo === 'reuniao' ? 'bg-blue-500 text-white border-blue-500' : 'bg-transparent text-neutral-500 border-white/10 hover:bg-white/5'}`}
                            >
                              Reunião
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setNovoEvento({...novoEvento, tipo: "treinamento"})} 
                              className={`py-1.5 rounded text-[10px] font-bold border transition-colors ${novoEvento.tipo === 'treinamento' ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-transparent text-neutral-500 border-white/10 hover:bg-white/5'}`}
                            >
                              Treino
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setNovoEvento({...novoEvento, tipo: "meta"})} 
                              className={`py-1.5 rounded text-[10px] font-bold border transition-colors ${novoEvento.tipo === 'meta' ? 'bg-purple-500 text-black border-purple-500' : 'bg-transparent text-neutral-500 border-white/10 hover:bg-white/5'}`}
                            >
                              Meta
                            </button>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button 
                              type="button"
                              onClick={() => setShowEventForm(false)}
                              className="flex-1 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/10 rounded text-neutral-300 transition-colors"
                            >
                              Cancelar
                            </button>
                            <button 
                              type="submit"
                              disabled={savingEvent}
                              className="flex-1 py-1.5 text-xs font-bold bg-white text-black hover:bg-neutral-200 rounded flex items-center justify-center gap-1 transition-colors"
                            >
                              {savingEvent ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
                            </button>
                          </div>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                  <div className="max-h-[300px] overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
                    {eventos.length === 0 ? (
                      <p className="text-xs text-neutral-500 italic text-center py-4">Nenhum evento programado.</p>
                    ) : (
                      eventos.map((e) => {
                        const style = getEventColorInfo(e.type);
                        return (
                          <div key={e.id} className={`p-3 rounded-lg border text-sm transition-colors ${style.bg} ${style.border}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${style.text} bg-black/20`}>
                                Dia {e.event_day}
                              </span>
                            </div>
                            <p className="text-white font-medium leading-tight">{e.title}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* POP-UP DETALHES DO DIA SELECIONADO */}
      <AnimatePresence>
        {diaSelecionado && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="glass-card p-6 rounded-2xl border border-white/20 w-full max-w-md bg-neutral-900 shadow-2xl relative"
            >
              <button 
                onClick={() => setDiaSelecionado(null)} 
                className="absolute top-4 right-4 p-1 text-neutral-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              
              <div className="mb-6 border-b border-white/10 pb-4">
                <h3 className="text-2xl font-black text-white mb-1">Dia {diaSelecionado}</h3>
                <p className="text-sm text-neutral-400">
                  Total faturado: <strong className="text-purple-400 text-lg">R$ {(dailyMap.get(diaSelecionado) ?? 0).toLocaleString('pt-BR')}</strong>
                </p>
              </div>

              {/* LISTA DE VENDAS DO DIA */}
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase text-neutral-500 mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-purple-500" /> Vendas Realizadas
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {vendasRaw.filter(v => {
                    const dataVenda = new Date(v.sale_date);
                    return dataVenda.getDate() === diaSelecionado && dataVenda.getMonth() + 1 === month;
                  }).length > 0 ? (
                    vendasRaw.filter(v => {
                      const dataVenda = new Date(v.sale_date);
                      return dataVenda.getDate() === diaSelecionado && dataVenda.getMonth() + 1 === month;
                    }).map(v => (
                      <div key={v.id} className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
                        <span className="text-sm text-neutral-300 font-medium">{v.seller?.name || "Desconhecido"}</span>
                        <span className="text-sm font-bold text-purple-400">R$ {Number(v.amount).toLocaleString('pt-BR')}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-neutral-500 italic bg-black/20 p-3 rounded-lg border border-white/5">Nenhuma venda registrada neste dia.</p>
                  )}
                </div>
              </div>

              {/* LISTA DE EVENTOS DO DIA */}
              <div>
                <h4 className="text-xs font-bold uppercase text-neutral-500 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" /> Agenda / Eventos
                </h4>
                <div className="space-y-2">
                  {eventos.filter(e => e.event_day === diaSelecionado).length > 0 ? (
                    eventos.filter(e => e.event_day === diaSelecionado).map(ev => {
                      const style = getEventColorInfo(ev.type);
                      return (
                        <div key={ev.id} className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${style.bg} ${style.border}`}>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${style.text} bg-black/20`}>
                                Dia {ev.event_day}
                              </span>
                            </div>
                            <p className="text-white font-medium leading-tight">{ev.title}</p>
                          </div>
                          
                          {/* SOLUÇÃO DO PONTO 3: O botão de excluir evento dentro do dia só aparece para o Admin */}
                          {isAdmin && (
                            <button 
                              onClick={() => removerEvento(ev.id)}
                              className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                              title="Excluir Evento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-neutral-500 italic bg-black/20 p-3 rounded-lg border border-white/5">Nenhum evento agendado.</p>
                  )}
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}