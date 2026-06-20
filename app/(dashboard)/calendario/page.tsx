"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { createClient } from "@/lib/supabase/client";
import { getDailySalesForMonth } from "@/lib/data/sales";
import { getTeamGoal } from "@/lib/data/goals";
import { listCalendarEvents } from "@/lib/data/calendar";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEventColor(tipo?: string): string {
  if (tipo === "reuniao") return "#a78bfa";
  if (tipo === "treinamento") return "#facc15";
  if (tipo === "meta") return "#fb923c";
  return "#60a5fa";
}

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
  const [isAdmin, setIsAdmin] = useState(false);

  const [showEventForm, setShowEventForm] = useState(false);
  const [novoEvento, setNovoEvento] = useState<{ dia: string; titulo: string; tipo: "reuniao" | "treinamento" | "meta" }>({ dia: "", titulo: "", tipo: "reuniao" });
  const [savingEvent, setSavingEvent] = useState(false);

  const [diaSelecionado, setDiaSelecionado] = useState<number | null>(null);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const isMasterAdmin = user.email === "admin@onlinegrafica.com";
        const { data: seller } = await supabase
          .from("sellers")
          .select("is_admin")
          .eq("email", user.email)
          .maybeSingle();
        setIsAdmin(!!seller?.is_admin || isMasterAdmin);
      }

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
    if (!isAdmin) return;

    setSavingEvent(true);
    try {
      const novoEv = {
        id: Date.now().toString(),
        event_day: Number(novoEvento.dia),
        title: novoEvento.titulo,
        type: novoEvento.tipo,
      };
      setEventos([...eventos, novoEv]);
      setShowEventForm(false);
      setNovoEvento({ dia: "", titulo: "", tipo: "reuniao" });
    } catch (err) {
      console.error(err);
      alert("Erro ao criar evento.");
    } finally {
      setSavingEvent(false);
    }
  };

  const removerEvento = async (id: string) => {
    if (!isAdmin) return;
    setEventos(eventos.filter((e) => e.id !== id));
    try {
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

  const isCurrentMonth = today.getMonth() + 1 === month && today.getFullYear() === year;
  const todayDay = today.getDate();

  const statHoje = eventos.filter((e) => e.event_day === todayDay && isCurrentMonth).length;

  const statVisitasSemana = useMemo(() => {
    const now = new Date();
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(now.getDate() + 7);
    return eventos.filter((e) => {
      const evDate = new Date(year, month - 1, e.event_day);
      return evDate >= now && evDate <= sevenDaysLater;
    }).length;
  }, [eventos, month, year]);

  const statMetasVencendo = dias.filter((d) => d.status === "danger").length;
  const statReunioes = eventos.length;

  const compromissosFuturos = useMemo(() => {
    const now = isCurrentMonth ? todayDay : 1;
    return eventos
      .filter((e) => e.event_day >= now)
      .sort((a, b) => a.event_day - b.event_day);
  }, [eventos, isCurrentMonth, todayDay]);

  const statCards = [
    { label: "Hoje", value: statHoje, icon: "mdi:calendar-today", color: "#2dd4bf" },
    { label: "Visitas na semana", value: statVisitasSemana, icon: "mdi:handshake", color: "#60a5fa" },
    { label: "Metas vencendo", value: statMetasVencendo, icon: "mdi:flag-checkered", color: "#fb923c" },
    { label: "Reuniões", value: statReunioes, icon: "mdi:account-group", color: "#a78bfa" },
  ];

  return (
    <>
      {/* Header */}
      <header className="mb-8 flex items-center gap-4">
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(20,184,166,0.25), rgba(6,182,212,0.15))",
            border: "1px solid rgba(20,184,166,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon icon="line-md:calendar" width={22} height={22} color="#2dd4bf" />
        </div>
        <div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: "-0.8px",
              lineHeight: 1.1,
              color: "#fff",
              margin: 0,
            }}
          >
            Calendário · Agenda
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
            Visitas, metas e compromissos da equipe
          </p>
        </div>
      </header>

      {/* Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {statCards.map((card) => (
          <div
            key={card.label}
            style={{
              borderRadius: 16,
              padding: 18,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Icon icon={card.icon} width={16} height={16} color={card.color} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "1.5px",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                {card.label}
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>
              {loading ? "—" : card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Error state */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error-alert"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 40,
              borderRadius: 18,
              border: "1px solid rgba(239,68,68,0.2)",
              background: "rgba(239,68,68,0.05)",
              textAlign: "center",
              maxWidth: 600,
              margin: "32px auto",
            }}
          >
            <Icon icon="mdi:alert-circle" width={40} height={40} color="#f87171" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Erro ao processar calendário</h3>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>{error}</p>
            <button
              type="button"
              onClick={carregarDados}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                fontWeight: 600,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.1)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              <Icon icon="mdi:refresh" width={16} height={16} />
              Tentar Novamente
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main grid */}
      {!error && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: 18,
          }}
          className="calendar-main-grid"
        >
          {/* LEFT — Calendar */}
          <div
            style={{
              borderRadius: 18,
              padding: "20px 22px",
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {/* Calendar header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0 }}>
                  {MESES[month - 1]} {year}
                </h2>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "rgba(45,212,191,0.6)",
                    letterSpacing: "0.5px",
                    margin: "4px 0 0",
                  }}
                >
                  {loading ? "—" : eventos.length} compromissos no mês
                </p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <Icon icon="mdi:chevron-left" width={18} height={18} />
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <Icon icon="mdi:chevron-right" width={18} height={18} />
                </button>
              </div>
            </div>

            {/* Weekday labels */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 8 }}>
              {DIAS_SEMANA.map((d) => (
                <div
                  key={d}
                  style={{
                    textAlign: "center",
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.35)",
                    padding: "6px 0",
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {Array.from({ length: 35 }).map((_, i) => (
                  <div
                    key={`skel-${i}`}
                    style={{
                      minHeight: 84,
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
                    }}
                  />
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {Array.from({ length: leadingEmptyCells }, (_, i) => (
                  <div
                    key={`empty-${i}`}
                    style={{
                      minHeight: 84,
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.01)",
                    }}
                    aria-hidden
                  />
                ))}

                {dias.map((d) => {
                  const eventosDoDia = eventos.filter((e) => e.event_day === d.dia);
                  const isToday = isCurrentMonth && d.dia === todayDay;

                  return (
                    <motion.div
                      key={d.dia}
                      whileHover={{ scale: 1.03 }}
                      onClick={() => setDiaSelecionado(d.dia)}
                      style={{
                        minHeight: 84,
                        borderRadius: 10,
                        padding: 8,
                        cursor: "pointer",
                        position: "relative",
                        background: isToday
                          ? "rgba(20,184,166,0.08)"
                          : "rgba(255,255,255,0.02)",
                        border: isToday
                          ? "1px solid rgba(20,184,166,0.4)"
                          : "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: isToday
                            ? "#2dd4bf"
                            : "rgba(255,255,255,0.6)",
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        {d.dia}
                      </span>

                      {d.valor && (
                        <p
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "rgba(255,255,255,0.85)",
                            margin: "0 0 4px",
                          }}
                        >
                          {d.valor}
                        </p>
                      )}

                      {eventosDoDia.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {eventosDoDia.slice(0, 3).map((ev) => {
                            const color = getEventColor(ev.type);
                            return (
                              <div
                                key={ev.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <span
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: "50%",
                                    background: color,
                                    flexShrink: 0,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    color: color,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    maxWidth: "100%",
                                  }}
                                >
                                  {ev.title}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT — Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Próximos compromissos */}
            <div
              style={{
                borderRadius: 18,
                padding: "18px 20px",
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                flex: 1,
                minHeight: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>
                  Próximos compromissos
                </h3>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowEventForm(!showEventForm)}
                    title="Adicionar Evento"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.08)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <Icon icon="mdi:plus" width={16} height={16} />
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
                    style={{
                      marginBottom: 16,
                      background: "rgba(0,0,0,0.4)",
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.1)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input
                        type="number"
                        placeholder="Dia (ex: 15)"
                        min="1"
                        max={daysInMonth}
                        required
                        value={novoEvento.dia}
                        onChange={(e) => setNovoEvento({ ...novoEvento, dia: e.target.value })}
                        style={{
                          width: "100%",
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6,
                          padding: "6px 10px",
                          fontSize: 12,
                          color: "#fff",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Título do evento"
                        required
                        value={novoEvento.titulo}
                        onChange={(e) => setNovoEvento({ ...novoEvento, titulo: e.target.value })}
                        style={{
                          width: "100%",
                          background: "rgba(0,0,0,0.5)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6,
                          padding: "6px 10px",
                          fontSize: 12,
                          color: "#fff",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                        {(["reuniao", "treinamento", "meta"] as const).map((tipo) => {
                          const labels: Record<string, string> = { reuniao: "Reunião", treinamento: "Treino", meta: "Meta" };
                          const colors: Record<string, string> = { reuniao: "#a78bfa", treinamento: "#facc15", meta: "#fb923c" };
                          const active = novoEvento.tipo === tipo;
                          return (
                            <button
                              key={tipo}
                              type="button"
                              onClick={() => setNovoEvento({ ...novoEvento, tipo })}
                              style={{
                                padding: "6px 0",
                                borderRadius: 6,
                                fontSize: 10,
                                fontWeight: 700,
                                border: `1px solid ${active ? colors[tipo] : "rgba(255,255,255,0.1)"}`,
                                background: active ? `${colors[tipo]}22` : "transparent",
                                color: active ? colors[tipo] : "rgba(255,255,255,0.4)",
                                cursor: "pointer",
                              }}
                            >
                              {labels[tipo]}
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setShowEventForm(false)}
                          style={{
                            flex: 1,
                            padding: "6px 0",
                            fontSize: 12,
                            fontWeight: 600,
                            background: "rgba(255,255,255,0.05)",
                            border: "none",
                            borderRadius: 6,
                            color: "rgba(255,255,255,0.6)",
                            cursor: "pointer",
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={savingEvent}
                          style={{
                            flex: 1,
                            padding: "6px 0",
                            fontSize: 12,
                            fontWeight: 700,
                            background: "#fff",
                            border: "none",
                            borderRadius: 6,
                            color: "#000",
                            cursor: savingEvent ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                          }}
                        >
                          {savingEvent ? <Icon icon="mdi:loading" width={14} height={14} style={{ animation: "spin 1s linear infinite" }} /> : "Salvar"}
                        </button>
                      </div>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto" }}>
                {loading ? (
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                    Carregando...
                  </div>
                ) : compromissosFuturos.length === 0 ? (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "20px 0", fontStyle: "italic" }}>
                    Nenhum compromisso programado.
                  </p>
                ) : (
                  compromissosFuturos.map((ev) => {
                    const color = getEventColor(ev.type);
                    const mesLabel = MESES[month - 1].slice(0, 3).toUpperCase();
                    return (
                      <div
                        key={ev.id}
                        style={{ display: "flex", alignItems: "center", gap: 12 }}
                      >
                        <div
                          style={{
                            width: 46,
                            height: 46,
                            borderRadius: 12,
                            background: `${color}22`,
                            border: `1px solid ${color}44`,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <span style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>
                            {ev.event_day}
                          </span>
                          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: `${color}99`, letterSpacing: "0.5px" }}>
                            {mesLabel}
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {ev.title}
                          </p>
                          {(ev.event_time || ev.responsible) && (
                            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>
                              {[ev.event_time, ev.responsible].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* M.A.I.A sugere */}
            <div
              style={{
                borderRadius: 18,
                padding: "18px 20px",
                background: "rgba(20,184,166,0.05)",
                border: "1px solid rgba(20,184,166,0.22)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: "linear-gradient(90deg, rgba(20,184,166,0.8), rgba(6,182,212,0.4), transparent)",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Icon icon="mdi:brain" width={18} height={18} color="#2dd4bf" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#2dd4bf" }}>M.A.I.A sugere</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  style={{
                    background: "rgba(20,184,166,0.07)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    border: "1px solid rgba(20,184,166,0.12)",
                  }}
                >
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.5 }}>
                    Agende visitas de retenção nos dias sem compromissos da semana para maximizar contatos em {MESES[month - 1]}.
                  </p>
                </div>
                <div
                  style={{
                    background: "rgba(20,184,166,0.07)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    border: "1px solid rgba(20,184,166,0.12)",
                  }}
                >
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, lineHeight: 1.5 }}>
                    Concentre metas de fechamento na primeira quinzena para garantir folga no final do mês.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Responsive style for the main grid */}
      <style>{`
        @media (max-width: 1100px) {
          .calendar-main-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Modal — Detalhes do dia selecionado */}
      <AnimatePresence>
        {diaSelecionado !== null && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              background: "rgba(0,0,0,0.8)",
              backdropFilter: "blur(12px)",
            }}
            onClick={() => setDiaSelecionado(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "rgb(15,15,18)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 20,
                padding: 24,
                width: "100%",
                maxWidth: 460,
                position: "relative",
                boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
              }}
            >
              <button
                onClick={() => setDiaSelecionado(null)}
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Icon icon="mdi:close" width={16} height={16} />
              </button>

              <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <h3 style={{ fontSize: 24, fontWeight: 900, color: "#fff", margin: "0 0 4px" }}>
                  Dia {diaSelecionado}
                </h3>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
                  Total faturado:{" "}
                  <strong style={{ color: "#a78bfa", fontSize: 16 }}>
                    R$ {(dailyMap.get(diaSelecionado) ?? 0).toLocaleString("pt-BR")}
                  </strong>
                </p>
              </div>

              {/* Vendas do dia */}
              <div style={{ marginBottom: 20 }}>
                <h4
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "rgba(255,255,255,0.35)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    margin: "0 0 10px",
                  }}
                >
                  <Icon icon="mdi:currency-usd" width={14} height={14} color="#a78bfa" />
                  Vendas Realizadas
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
                  {vendasRaw.filter((v) => {
                    const dv = new Date(v.sale_date);
                    return dv.getDate() === diaSelecionado && dv.getMonth() + 1 === month;
                  }).length > 0 ? (
                    vendasRaw
                      .filter((v) => {
                        const dv = new Date(v.sale_date);
                        return dv.getDate() === diaSelecionado && dv.getMonth() + 1 === month;
                      })
                      .map((v) => (
                        <div
                          key={v.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "rgba(0,0,0,0.4)",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>
                            {v.seller?.name || "Desconhecido"}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa" }}>
                            R$ {Number(v.amount).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      ))
                  ) : (
                    <p
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.3)",
                        fontStyle: "italic",
                        background: "rgba(0,0,0,0.2)",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.05)",
                        margin: 0,
                      }}
                    >
                      Nenhuma venda registrada neste dia.
                    </p>
                  )}
                </div>
              </div>

              {/* Eventos do dia */}
              <div>
                <h4
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "rgba(255,255,255,0.35)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    margin: "0 0 10px",
                  }}
                >
                  <Icon icon="mdi:account-group" width={14} height={14} color="#60a5fa" />
                  Agenda / Eventos
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {eventos.filter((e) => e.event_day === diaSelecionado).length > 0 ? (
                    eventos
                      .filter((e) => e.event_day === diaSelecionado)
                      .map((ev) => {
                        const color = getEventColor(ev.type);
                        return (
                          <div
                            key={ev.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              background: `${color}12`,
                              border: `1px solid ${color}30`,
                              padding: "10px 12px",
                              borderRadius: 10,
                            }}
                          >
                            <div>
                              <span
                                style={{
                                  display: "inline-block",
                                  fontSize: 10,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                  color,
                                  background: "rgba(0,0,0,0.2)",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  marginBottom: 4,
                                }}
                              >
                                Dia {ev.event_day}
                              </span>
                              <p style={{ fontSize: 13, fontWeight: 500, color: "#fff", margin: 0 }}>{ev.title}</p>
                            </div>
                            {isAdmin && (
                              <button
                                onClick={() => removerEvento(ev.id)}
                                title="Excluir Evento"
                                style={{
                                  padding: 8,
                                  borderRadius: 8,
                                  background: "transparent",
                                  border: "none",
                                  color: "rgba(255,255,255,0.3)",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
                              >
                                <Icon icon="mdi:trash-can-outline" width={16} height={16} />
                              </button>
                            )}
                          </div>
                        );
                      })
                  ) : (
                    <p
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.3)",
                        fontStyle: "italic",
                        background: "rgba(0,0,0,0.2)",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.05)",
                        margin: 0,
                      }}
                    >
                      Nenhum evento agendado.
                    </p>
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
