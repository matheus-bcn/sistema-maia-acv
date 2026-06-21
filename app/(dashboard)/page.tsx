"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getDashboardStats, buildMaiaBriefing } from "@/lib/data/dashboard";
import { getDailyComparisonData } from "@/lib/data/sales";
import { getSellerRankings } from "@/lib/data/sellers";
import { obterBriefingIAAction } from "@/lib/actions/ai-actions";
import { ImportadorIA } from "@/components/ImportadorIA";
import { NovaVendaModal } from "@/components/NovaVendaModal";
import { dispararGritoDeGol } from "@/lib/utils";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import type { SellerRanking } from "@/types";

interface MaiaInsight {
  titulo: string;
  briefing: string;
  acao: string;
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #ec4899, #a855f7)",
  "linear-gradient(135deg, #14b8a6, #06b6d4)",
  "linear-gradient(135deg, #f97316, #eab308)",
  "linear-gradient(135deg, #3b82f6, #6366f1)",
  "linear-gradient(135deg, #8b5cf6, #ec4899)",
];

const BAR_GRADIENTS = [
  "linear-gradient(90deg, #facc15, #f97316)",
  "linear-gradient(90deg, #cbd5e1, #94a3b8)",
  "linear-gradient(90deg, #fb923c, #f97316)",
  "linear-gradient(90deg, #60a5fa, #3b82f6)",
  "linear-gradient(90deg, #a78bfa, #8b5cf6)",
];

const MEDAL_COLORS = ["#facc15", "#cbd5e1", "#fb923c", "rgba(255,255,255,0.35)", "rgba(255,255,255,0.35)"];

const PRESETS = [
  {
    label: "Hoje",
    getRange: () => {
      const d = new Date().toISOString().slice(0, 10);
      return { inicio: d, fim: d };
    },
  },
  {
    label: "Últimos 7 dias",
    getRange: () => {
      const e = new Date();
      const s = new Date();
      s.setDate(s.getDate() - 6);
      return { inicio: s.toISOString().slice(0, 10), fim: e.toISOString().slice(0, 10) };
    },
  },
  {
    label: "Este mês",
    getRange: () => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const last = new Date(y, d.getMonth() + 1, 0).getDate();
      return { inicio: `${y}-${m}-01`, fim: `${y}-${m}-${String(last).padStart(2, "0")}` };
    },
  },
  {
    label: "Mês anterior",
    getRange: () => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const last = new Date(y, d.getMonth() + 1, 0).getDate();
      return { inicio: `${y}-${m}-01`, fim: `${y}-${m}-${String(last).padStart(2, "0")}` };
    },
  },
];

const getLocalFirstAndLastDay = () => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const firstDay = `${y}-${m}-01`;
  const lastDayObj = new Date(y, date.getMonth() + 1, 0);
  const lastDay = `${y}-${m}-${String(lastDayObj.getDate()).padStart(2, "0")}`;
  return { firstDay, lastDay };
};

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isNovaVendaOpen, setIsNovaVendaOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [totalFaturado, setTotalFaturado] = useState(0);
  const [qtdVendas, setQtdVendas] = useState(0);
  const [metaGlobal, setMetaGlobal] = useState(0);
  const [topSeller, setTopSeller] = useState<SellerRanking | null>(null);
  const [rankingVendedores, setRankingVendedores] = useState<SellerRanking[]>([]);
  const [canais, setCanais] = useState({ comercial: 0, atendimento: 0, pctComercial: 0, pctAtendimento: 0, dominante: "Empate" });
  const [chartDiario, setChartDiario] = useState<{ day: string; atual: number; anterior: number }[]>([]);
  const [mensagemIA, setMensagemIA] = useState<MaiaInsight | null>(null);
  const [maiaTimestamp, setMaiaTimestamp] = useState<number | null>(null);
  const [vendedorSelecionado, setVendedorSelecionado] = useState<SellerRanking | null>(null);
  const [hoverCard, setHoverCard] = useState<string | null>(null);

  const initialDates = getLocalFirstAndLastDay();
  const [periodo, setPeriodo] = useState<{ inicio: string; fim: string }>({
    inicio: initialDates.firstDay,
    fim: initialDates.lastDay,
  });

  const projecao = useMemo(() => {
    const startP = new Date(periodo.inicio).getTime();
    const endP = new Date(periodo.fim).getTime();
    const hoje = Date.now();
    const diasTotais = Math.max(1, Math.ceil((endP - startP) / 86400000) + 1);
    const diasDecorridos = Math.max(1, Math.min(Math.ceil((hoje - startP) / 86400000) + 1, diasTotais));
    return Math.round((totalFaturado / diasDecorridos) * diasTotais);
  }, [totalFaturado, periodo]);

  const metaPct = useMemo(
    () => (metaGlobal > 0 ? Math.min(100, (totalFaturado / metaGlobal) * 100) : 0),
    [totalFaturado, metaGlobal]
  );

  const metricasQualidade = useMemo(() => {
    const hoje = new Date();
    const startOfMonth = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    let diasUteisPassados = 0;
    const cur = new Date(startOfMonth.getTime());
    while (cur <= hoje) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) diasUteisPassados++;
      cur.setDate(cur.getDate() + 1);
    }
    return {
      ticketMedio: qtdVendas > 0 ? totalFaturado / qtdVendas : 0,
      mediaDiaria: diasUteisPassados > 0 ? totalFaturado / diasUteisPassados : 0,
    };
  }, [totalFaturado, qtdVendas]);

  const ritmoGauge = useMemo(() => {
    if (!metaGlobal) return { status: "—", diff: 0, fillFraction: 0 };

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataInicio = new Date(`${periodo.inicio}T00:00:00`);
    const dataFim = new Date(`${periodo.fim}T00:00:00`);

    const countBiz = (s: Date, e: Date) => {
      let count = 0;
      const cur = new Date(s);
      while (cur <= e) {
        const d = cur.getDay();
        if (d !== 0 && d !== 6) count++;
        cur.setDate(cur.getDate() + 1);
      }
      return count;
    };

    const totalBiz = Math.max(1, countBiz(dataInicio, dataFim));
    const limite = hoje <= dataFim ? hoje : dataFim;
    const passedBiz = limite >= dataInicio ? countBiz(dataInicio, limite) : 0;

    const expectedVol = metaGlobal * (passedBiz / totalBiz);
    const pacing = expectedVol > 0 ? (totalFaturado / expectedVol) * 100 : 0;
    const diff = pacing - 100;

    let status = "Abaixo";
    if (pacing >= 105) status = "Acima";
    else if (pacing >= 90) status = "No ritmo";

    return { status, diff, fillFraction: Math.min(Math.max(pacing / 150, 0), 1) };
  }, [metaGlobal, totalFaturado, periodo]);

  const maiaUpdatedAt = useMemo(() => {
    if (!maiaTimestamp) return "—";
    const mins = Math.floor((Date.now() - maiaTimestamp) / 60000);
    if (mins < 1) return "agora";
    if (mins < 60) return `há ${mins} min`;
    return `há ${Math.floor(mins / 60)}h`;
  }, [maiaTimestamp]);

  const mesAtual = useMemo(() => {
    const m = new Date().toLocaleDateString("pt-BR", { month: "long" });
    return m.charAt(0).toUpperCase() + m.slice(1);
  }, []);

  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  const chartMax = useMemo(() => {
    if (!chartDiario.length) return 1;
    return Math.max(...chartDiario.flatMap((d) => [d.atual, d.anterior]), 1);
  }, [chartDiario]);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

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

      const [stats, comparativo, rankingTop5, { data: salesData }] = await Promise.all([
        getDashboardStats(supabase, periodo.inicio, periodo.fim),
        getDailyComparisonData(supabase, periodo.inicio, periodo.fim),
        getSellerRankings(supabase, periodo.inicio, periodo.fim),
        supabase
          .from("sales")
          .select("amount, channel")
          .gte("sale_date", `${periodo.inicio}T00:00:00`)
          .lte("sale_date", `${periodo.fim}T23:59:59`),
      ]);

      setTotalFaturado(stats.totalFaturado);
      setQtdVendas(stats.qtdVendas);
      setMetaGlobal(stats.metaGlobal);
      setTopSeller(stats.topSeller);
      setRankingVendedores(rankingTop5.slice(0, 5));
      setChartDiario(comparativo);

      const totaisCanais = (salesData || []).reduce(
        (acc, row) => {
          const val = Number(row.amount);
          if (row.channel === "atendimento") acc.a += val;
          else acc.c += val;
          return acc;
        },
        { c: 0, a: 0 }
      );

      const totalGeral = totaisCanais.c + totaisCanais.a;
      setCanais({
        comercial: totaisCanais.c,
        atendimento: totaisCanais.a,
        pctComercial: totalGeral > 0 ? (totaisCanais.c / totalGeral) * 100 : 0,
        pctAtendimento: totalGeral > 0 ? (totaisCanais.a / totalGeral) * 100 : 0,
        dominante:
          totaisCanais.c > totaisCanais.a
            ? "Comercial"
            : totaisCanais.a > totaisCanais.c
            ? "Atendimento"
            : "Empate",
      });

      const CACHE_KEY = "maia_insight_cache";
      const cachedIA = localStorage.getItem(CACHE_KEY);
      let shouldFetchAI = true;

      if (cachedIA) {
        const { timestamp, data: cachedData } = JSON.parse(cachedIA);
        if ((Date.now() - timestamp) / (1000 * 60 * 60) < 2) {
          setMensagemIA(cachedData);
          setMaiaTimestamp(timestamp);
          shouldFetchAI = false;
        }
      }

      if (shouldFetchAI) {
        const briefingIA = await obterBriefingIAAction(stats);
        const now = Date.now();
        const r = briefingIA as any;
        const aiPayload: MaiaInsight = briefingIA.success
          ? { titulo: r.titulo, briefing: r.briefing, acao: r.acao }
          : {
              titulo: "Análise Estática",
              briefing: buildMaiaBriefing(stats.totalFaturado, stats.metaGlobal),
              acao: "Verifique o ranking e atualize suas vendas.",
            };

        setMensagemIA(aiPayload);
        setMaiaTimestamp(now);
        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, data: aiPayload }));
      }

      setLoading(false);
    } catch {
      setError("Não foi possível atualizar os dados do painel.");
      setLoading(false);
    }
  }, [supabase, periodo, router]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleNovaVendaSuccess = (valorVenda: number) => {
    if (valorVenda >= 5000) {
      dispararGritoDeGol();
      setMensagemIA({
        titulo: "🚀 GOLAÇO!",
        briefing: `Uma venda estrondosa de R$ ${valorVenda.toLocaleString("pt-BR")} foi registrada no sistema.`,
        acao: "Aproveite a adrenalina e feche mais um negócio hoje!",
      });
    } else {
      setMensagemIA({
        titulo: "✅ Venda Confirmada",
        briefing: `Negócio de R$ ${valorVenda.toLocaleString("pt-BR")} validado e adicionado à meta.`,
        acao: "Atualize o pipeline e busque o próximo cliente.",
      });
    }
    setMaiaTimestamp(Date.now());
    carregarDados();
  };

  return (
    <>
      <style>{`
        @keyframes barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes rowIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <header
        style={{
          marginBottom: 26,
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, rgba(249,115,22,0.25), rgba(234,179,8,0.15))",
              border: "1px solid rgba(249,115,22,0.3)",
              color: "#fb923c",
            }}
          >
            <Icon icon="mdi:view-dashboard" style={{ fontSize: 24 }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-0.8px", color: "#fff" }}>
              Dashboard
            </h1>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
              Acompanhamento de vendas da equipe
            </p>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 11, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                borderRadius: 11,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.4)",
                padding: "11px 15px",
                fontSize: 13,
                fontWeight: 600,
                color: "#d4d4d4",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
              }}
            >
              <Icon icon="line-md:calendar" style={{ fontSize: 16, color: "#a3a3a3" }} />
              <span>
                {periodo.inicio.split("-").reverse().join("/")} — {periodo.fim.split("-").reverse().join("/")}
              </span>
              <Icon icon="mdi:chevron-down" style={{ fontSize: 16, color: "#737373" }} />
            </button>
            <AnimatePresence>
              {isDatePickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    width: 260,
                    background: "#0d111c",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 14,
                    padding: 16,
                    boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
                    zIndex: 50,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Selecionar período</span>
                    <button
                      onClick={() => setIsDatePickerOpen(false)}
                      style={{ background: "none", border: "none", color: "#737373", cursor: "pointer", display: "flex" }}
                    >
                      <Icon icon="line-md:close" style={{ fontSize: 16 }} />
                    </button>
                  </div>
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => {
                        setPeriodo(p.getRange());
                        setIsDatePickerOpen(false);
                      }}
                      style={{
                        textAlign: "left",
                        padding: "9px 12px",
                        borderRadius: 9,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "#d4d4d4",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => setIsImportModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              padding: "11px 16px",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            <Icon icon="mdi:cloud-upload" style={{ fontSize: 17, color: "rgba(255,255,255,0.6)" }} /> Importar
          </button>
          <button
            onClick={() => setIsNovaVendaOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 12,
              border: "none",
              background: "linear-gradient(135deg, #7c3aed, #ec4899)",
              padding: "11px 18px",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
            }}
          >
            <Icon icon="mdi:plus" style={{ fontSize: 18 }} /> Nova Venda
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 48,
              borderRadius: 18,
              border: "1px solid rgba(239,68,68,0.2)",
              background: "rgba(239,68,68,0.05)",
              backdropFilter: "blur(12px)",
              textAlign: "center",
              maxWidth: 560,
              margin: "40px auto",
            }}
          >
            <Icon
              icon="line-md:alert-circle-loop"
              className="icon-always"
              style={{ fontSize: 48, color: "#f87171", marginBottom: 16 }}
            />
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#fff" }}>
              Ops! Problema de Permissão
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "rgba(255,255,255,0.5)" }}>{error}</p>
            <button
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
                fontSize: 14,
              }}
            >
              <Icon icon="mdi:reload" style={{ fontSize: 16 }} /> Tentar Novamente
            </button>
          </motion.div>
        ) : loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ display: "grid", gap: 16 }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(228px, 1fr))", gap: 16 }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 140,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                />
              ))}
            </div>
            <div
              style={{
                height: 80,
                borderRadius: 18,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            />
            <div
              style={{
                height: 260,
                borderRadius: 18,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* ─── KPI Row ─── */}
            <div
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(228px, 1fr))", gap: 16 }}
            >
              {/* Total Faturado */}
              <div
                onMouseEnter={() => setHoverCard("fat")}
                onMouseLeave={() => setHoverCard(null)}
                style={{
                  borderRadius: 18,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,179,8,0.08))",
                  border: `1px solid ${hoverCard === "fat" ? "rgba(249,115,22,0.5)" : "rgba(249,115,22,0.25)"}`,
                  boxShadow:
                    hoverCard === "fat"
                      ? "0 14px 44px rgba(249,115,22,0.22)"
                      : "0 8px 32px rgba(249,115,22,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
                  transform: hoverCard === "fat" ? "translateY(-3px)" : "none",
                  transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
                  cursor: "default",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                      color: "rgba(253,186,116,0.75)",
                    }}
                  >
                    Total Faturado
                  </span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, rgba(249,115,22,0.25), rgba(234,179,8,0.15))",
                      border: "1px solid rgba(249,115,22,0.3)",
                      color: "#fb923c",
                    }}
                  >
                    <Icon icon="mdi:currency-usd" style={{ fontSize: 17 }} />
                  </div>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 30,
                    fontWeight: 800,
                    letterSpacing: "-1px",
                    background: "linear-gradient(135deg, #f97316, #fbbf24)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  R$ {totalFaturado.toLocaleString("pt-BR")}
                </p>
                <div
                  style={{ height: 1, background: "linear-gradient(to right, rgba(249,115,22,0.3), transparent)" }}
                />
                <span style={{ fontSize: 11, color: "rgba(253,186,116,0.5)" }}>Período selecionado</span>
              </div>

              {/* Destaque */}
              <div
                onMouseEnter={() => setHoverCard("top")}
                onMouseLeave={() => setHoverCard(null)}
                onClick={() => topSeller && setVendedorSelecionado(topSeller)}
                style={{
                  borderRadius: 18,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  background: "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.08))",
                  border: `1px solid ${hoverCard === "top" ? "rgba(236,72,153,0.5)" : "rgba(236,72,153,0.25)"}`,
                  boxShadow:
                    hoverCard === "top"
                      ? "0 14px 44px rgba(236,72,153,0.22)"
                      : "0 8px 32px rgba(236,72,153,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
                  transform: hoverCard === "top" ? "translateY(-3px)" : "none",
                  transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
                  cursor: topSeller ? "pointer" : "default",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                      color: "rgba(244,114,182,0.75)",
                    }}
                  >
                    Destaque
                  </span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, rgba(236,72,153,0.25), rgba(168,85,247,0.15))",
                      border: "1px solid rgba(236,72,153,0.3)",
                      color: "#f472b6",
                    }}
                  >
                    <Icon icon="line-md:star-pulsating-loop" style={{ fontSize: 17 }} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 800,
                      color: "#fff",
                      background: "linear-gradient(135deg, #ec4899, #a855f7)",
                    }}
                  >
                    {topSeller ? getInitials(topSeller.seller.name) : "—"}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
                      {topSeller?.seller.name ?? "—"}
                    </p>
                    {topSeller && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#f472b6" }}>Ver detalhes →</span>
                    )}
                  </div>
                </div>
                <div
                  style={{ height: 1, background: "linear-gradient(to right, rgba(236,72,153,0.3), transparent)" }}
                />
                <span style={{ fontSize: 11, color: "rgba(244,114,182,0.5)" }}>Melhor vendedor do período</span>
              </div>

              {/* Qtd. Vendas */}
              <div
                onMouseEnter={() => setHoverCard("qtd")}
                onMouseLeave={() => setHoverCard(null)}
                style={{
                  borderRadius: 18,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  background: "linear-gradient(135deg, rgba(20,184,166,0.15), rgba(6,182,212,0.08))",
                  border: `1px solid ${hoverCard === "qtd" ? "rgba(20,184,166,0.5)" : "rgba(20,184,166,0.25)"}`,
                  boxShadow:
                    hoverCard === "qtd"
                      ? "0 14px 44px rgba(20,184,166,0.22)"
                      : "0 8px 32px rgba(20,184,166,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
                  transform: hoverCard === "qtd" ? "translateY(-3px)" : "none",
                  transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
                  cursor: "default",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                      color: "rgba(94,234,212,0.75)",
                    }}
                  >
                    Qtd. Vendas
                  </span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, rgba(20,184,166,0.25), rgba(6,182,212,0.15))",
                      border: "1px solid rgba(20,184,166,0.3)",
                      color: "#2dd4bf",
                    }}
                  >
                    <Icon icon="mdi:cart-outline" style={{ fontSize: 17 }} />
                  </div>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 30,
                    fontWeight: 800,
                    letterSpacing: "-1px",
                    background: "linear-gradient(135deg, #14b8a6, #06b6d4)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {qtdVendas}
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      marginLeft: 7,
                      color: "rgba(94,234,212,0.6)",
                      WebkitTextFillColor: "rgba(94,234,212,0.6)",
                    }}
                  >
                    {" "}
                    unid.
                  </span>
                </p>
                <div
                  style={{ height: 1, background: "linear-gradient(to right, rgba(20,184,166,0.3), transparent)" }}
                />
                <span style={{ fontSize: 11, color: "rgba(94,234,212,0.5)" }}>Negócios fechados no período</span>
              </div>

              {/* Projeção de Fechamento */}
              <div
                onMouseEnter={() => setHoverCard("proj")}
                onMouseLeave={() => setHoverCard(null)}
                style={{
                  borderRadius: 18,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.08))",
                  border: `1px solid ${hoverCard === "proj" ? "rgba(59,130,246,0.5)" : "rgba(59,130,246,0.25)"}`,
                  boxShadow:
                    hoverCard === "proj"
                      ? "0 14px 44px rgba(59,130,246,0.22)"
                      : "0 8px 32px rgba(59,130,246,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
                  transform: hoverCard === "proj" ? "translateY(-3px)" : "none",
                  transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
                  cursor: "default",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                      color: "rgba(147,197,253,0.75)",
                    }}
                  >
                    Projeção de Fechamento
                  </span>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(99,102,241,0.15))",
                      border: "1px solid rgba(59,130,246,0.3)",
                      color: "#60a5fa",
                    }}
                  >
                    <Icon icon="mdi:lightning-bolt-outline" style={{ fontSize: 17 }} />
                  </div>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 30,
                    fontWeight: 800,
                    letterSpacing: "-1px",
                    background: "linear-gradient(135deg, #3b82f6, #818cf8)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  R$ {projecao.toLocaleString("pt-BR")}
                </p>
                <div
                  style={{ height: 1, background: "linear-gradient(to right, rgba(59,130,246,0.3), transparent)" }}
                />
                <span style={{ fontSize: 11, color: "rgba(147,197,253,0.5)" }}>Tendência da IA p/ fim do mês</span>
              </div>
            </div>

            {/* ─── Meta Global ─── */}
            <div
              style={{
                borderRadius: 18,
                padding: "20px 22px",
                position: "relative",
                overflow: "hidden",
                background: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(249,115,22,0.2)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, rgba(249,115,22,0.25), rgba(234,179,8,0.15))",
                      border: "1px solid rgba(249,115,22,0.3)",
                      color: "#fb923c",
                    }}
                  >
                    <Icon icon="mdi:target" style={{ fontSize: 19 }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>
                      Objetivo Global — {mesAtual}
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                      Meta: R$ {metaGlobal.toLocaleString("pt-BR")} · faltam R${" "}
                      {Math.max(0, metaGlobal - totalFaturado).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 30,
                    fontWeight: 800,
                    letterSpacing: "-1px",
                    background: "linear-gradient(135deg, #f97316, #fbbf24)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {metaPct.toFixed(1)}%
                </p>
              </div>
              <div
                style={{
                  height: 13,
                  width: "100%",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    width: `${Math.min(100, metaPct)}%`,
                    background: "linear-gradient(90deg, #f97316, #eab308)",
                    boxShadow: "0 0 20px rgba(249,115,22,0.5)",
                    position: "relative",
                    transition: "width 0.4s ease",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      right: 0,
                      width: 36,
                      background: "linear-gradient(to right, transparent, rgba(255,255,255,0.35))",
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ─── Chart + MAIA Insight ─── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              {/* Daily Comparison Chart */}
              <div
                style={{
                  gridColumn: "span 2",
                  minWidth: 320,
                  borderRadius: 18,
                  padding: 22,
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 22,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "linear-gradient(135deg, rgba(20,184,166,0.25), rgba(6,182,212,0.15))",
                        border: "1px solid rgba(20,184,166,0.3)",
                        color: "#2dd4bf",
                      }}
                    >
                      <Icon icon="mdi:chart-bar" style={{ fontSize: 18 }} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>
                        Comparativo Diário
                      </h3>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                        Faturamento por dia útil — R$ mil
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: "linear-gradient(135deg, #14b8a6, #06b6d4)",
                          display: "inline-block",
                        }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>Atual</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: "rgba(255,255,255,0.18)",
                          display: "inline-block",
                        }}
                      />
                      <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>Anterior</span>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 8,
                    height: 180,
                    paddingBottom: 22,
                    position: "relative",
                  }}
                >
                  {chartDiario.length === 0 ? (
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "rgba(255,255,255,0.2)",
                        fontSize: 13,
                      }}
                    >
                      Sem dados no período
                    </div>
                  ) : (
                    chartDiario.map((d, i) => {
                      const atualH = `${Math.max(2, Math.round((d.atual / chartMax) * 100))}%`;
                      const anteriorH = `${Math.max(2, Math.round((d.anterior / chartMax) * 100))}%`;
                      return (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            height: "100%",
                            justifyContent: "flex-end",
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-end",
                              gap: 3,
                              height: "100%",
                              width: "100%",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              style={{
                                width: "42%",
                                maxWidth: 14,
                                height: anteriorH,
                                borderRadius: "4px 4px 0 0",
                                background: "rgba(255,255,255,0.14)",
                                transformOrigin: "bottom",
                                animation: "barGrow 0.7s cubic-bezier(0.16,1,0.3,1) both",
                              }}
                            />
                            <div
                              style={{
                                width: "42%",
                                maxWidth: 14,
                                height: atualH,
                                borderRadius: "4px 4px 0 0",
                                background: "linear-gradient(to top, #0d9488, #2dd4bf)",
                                boxShadow: "0 0 12px rgba(45,212,191,0.35)",
                                transformOrigin: "bottom",
                                animation: "barGrow 0.7s cubic-bezier(0.16,1,0.3,1) both",
                              }}
                            />
                          </div>
                          <span
                            style={{
                              position: "absolute",
                              bottom: -20,
                              fontSize: 9,
                              fontWeight: 600,
                              color: "rgba(255,255,255,0.3)",
                            }}
                          >
                            {d.day}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* MAIA Insight */}
              <div
                style={{
                  minWidth: 300,
                  borderRadius: 18,
                  padding: 22,
                  position: "relative",
                  overflow: "hidden",
                  background: "linear-gradient(160deg, rgba(124,58,237,0.16), rgba(236,72,153,0.06))",
                  border: "1px solid rgba(139,92,246,0.25)",
                  boxShadow: "0 8px 32px rgba(124,58,237,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -40,
                    right: -40,
                    width: 150,
                    height: 150,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(168,85,247,0.3), transparent 70%)",
                    filter: "blur(20px)",
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18, position: "relative" }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                      boxShadow: "0 4px 16px rgba(124,58,237,0.5)",
                    }}
                  >
                    <Icon icon="mdi:robot-happy-outline" style={{ fontSize: 20, color: "#fff" }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#fff" }}>M.A.I.A · Insight</h3>
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 10,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        color: "rgba(196,181,253,0.7)",
                      }}
                    >
                      Atualizado {maiaUpdatedAt}
                    </p>
                  </div>
                </div>
                {mensagemIA ? (
                  <>
                    <p
                      style={{
                        margin: "0 0 12px",
                        fontSize: 18,
                        fontWeight: 800,
                        lineHeight: 1.3,
                        color: "#fff",
                        position: "relative",
                      }}
                    >
                      {mensagemIA.titulo}
                    </p>
                    <p
                      style={{
                        margin: "0 0 18px",
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: "rgba(255,255,255,0.55)",
                        position: "relative",
                      }}
                    >
                      {mensagemIA.briefing}
                    </p>
                    <div
                      style={{
                        marginTop: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "12px 14px",
                        borderRadius: 12,
                        background: "rgba(139,92,246,0.12)",
                        border: "1px solid rgba(139,92,246,0.25)",
                        position: "relative",
                      }}
                    >
                      <Icon icon="mdi:target" style={{ fontSize: 16, color: "#c4b5fd" }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
                        Ação: {mensagemIA.acao}
                      </span>
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(255,255,255,0.2)",
                      fontSize: 13,
                    }}
                  >
                    Carregando análise...
                  </div>
                )}
              </div>
            </div>

            {/* ─── Ranking + Intelligence + IA Predictor ─── */}
            <div
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}
            >
              {/* Ritmo da Meta gauge */}
              <div
                style={{
                  borderRadius: 18,
                  padding: 20,
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1.5px",
                    color: "rgba(255,255,255,0.4)",
                    alignSelf: "flex-start",
                    marginBottom: 6,
                  }}
                >
                  Ritmo da Meta
                </span>
                <svg viewBox="0 0 200 120" style={{ width: 170, height: 102 }}>
                  <defs>
                    <linearGradient id="ritmoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop
                        offset="0%"
                        stopColor={
                          ritmoGauge.status === "Abaixo"
                            ? "#f87171"
                            : ritmoGauge.status === "No ritmo"
                            ? "#fbbf24"
                            : "#14b8a6"
                        }
                      />
                      <stop
                        offset="100%"
                        stopColor={
                          ritmoGauge.status === "Abaixo"
                            ? "#ef4444"
                            : ritmoGauge.status === "No ritmo"
                            ? "#f97316"
                            : "#06b6d4"
                        }
                      />
                    </linearGradient>
                  </defs>
                  <path
                    d="M20,100 A80,80 0 0 1 180,100"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="14"
                    strokeLinecap="round"
                  />
                  <path
                    d="M20,100 A80,80 0 0 1 180,100"
                    fill="none"
                    stroke="url(#ritmoGrad)"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray="251.3"
                    strokeDashoffset={251.3 * (1 - ritmoGauge.fillFraction)}
                    style={{ transition: "stroke-dashoffset 1s ease" }}
                  />
                </svg>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    marginTop: -8,
                    background:
                      ritmoGauge.status === "Abaixo"
                        ? "linear-gradient(135deg, #f87171, #ef4444)"
                        : ritmoGauge.status === "No ritmo"
                        ? "linear-gradient(135deg, #fbbf24, #f97316)"
                        : "linear-gradient(135deg, #14b8a6, #06b6d4)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {ritmoGauge.status}
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {ritmoGauge.diff >= 0 ? "+" : ""}
                  {ritmoGauge.diff.toFixed(0)}% vs necessário
                </span>
              </div>

              {/* Ranking */}
              <div
                style={{
                  borderRadius: 18,
                  padding: 22,
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 18,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "linear-gradient(135deg, rgba(234,179,8,0.25), rgba(249,115,22,0.15))",
                        border: "1px solid rgba(234,179,8,0.3)",
                        color: "#fbbf24",
                      }}
                    >
                      <Icon icon="mdi:trophy" style={{ fontSize: 18 }} />
                    </div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>Ranking</h3>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>Top 5</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {rankingVendedores.length === 0 ? (
                    <p
                      style={{
                        fontSize: 13,
                        color: "rgba(255,255,255,0.25)",
                        textAlign: "center",
                        padding: "20px 0",
                        margin: 0,
                      }}
                    >
                      Nenhuma venda no período
                    </p>
                  ) : (
                    rankingVendedores.map((r, idx) => {
                      const maxSales = rankingVendedores[0]?.totalSales || 1;
                      const barW = `${Math.round((r.totalSales / maxSales) * 100)}%`;
                      return (
                        <div
                          key={r.seller.id}
                          onClick={() => setVendedorSelecionado(r)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "9px 10px",
                            borderRadius: 12,
                            cursor: "pointer",
                            transition: "background 0.2s",
                            animation: `rowIn 0.5s ease ${idx * 0.08}s both`,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: MEDAL_COLORS[idx],
                              minWidth: 18,
                              textAlign: "center",
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: "50%",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 800,
                              color: "#fff",
                              background: AVATAR_GRADIENTS[idx],
                            }}
                          >
                            {getInitials(r.seller.name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: "#fff",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {r.seller.name}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "rgba(255,255,255,0.85)",
                                  flexShrink: 0,
                                }}
                              >
                                R$ {r.totalSales.toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <div
                              style={{
                                height: 5,
                                marginTop: 6,
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.06)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: barW,
                                  borderRadius: 999,
                                  background: BAR_GRADIENTS[idx],
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Intelligence */}
              <div
                style={{
                  borderRadius: 18,
                  padding: 22,
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "linear-gradient(135deg, rgba(20,184,166,0.25), rgba(6,182,212,0.15))",
                        border: "1px solid rgba(20,184,166,0.3)",
                        color: "#2dd4bf",
                      }}
                    >
                      <Icon icon="mdi:cash-multiple" style={{ fontSize: 18 }} />
                    </div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.45)",
                      }}
                    >
                      Inteligência de Vendas
                    </h3>
                  </div>
                  <p
                    style={{
                      margin: "0 0 6px",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.3)",
                    }}
                  >
                    Ticket Médio
                  </p>
                  <span
                    style={{
                      fontSize: 38,
                      fontWeight: 800,
                      letterSpacing: "-1.5px",
                      background: "linear-gradient(135deg, #14b8a6, #06b6d4)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    R$ {metricasQualidade.ticketMedio.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div
                  style={{
                    borderRadius: 14,
                    padding: 16,
                    border: "1px solid rgba(139,92,246,0.15)",
                    background: "rgba(139,92,246,0.05)",
                    marginTop: 18,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Icon icon="mdi:calendar-clock" style={{ fontSize: 15, color: "#a78bfa" }} />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.4)",
                      }}
                    >
                      Média Diária
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      letterSpacing: "-0.5px",
                      background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    R$ {metricasQualidade.mediaDiaria.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </span>
                  <p style={{ margin: "8px 0 0", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                    Com base nos dias úteis trabalhados até agora.
                  </p>
                </div>
              </div>

              {/* Projeção de Fechamento */}
              <div
                style={{
                  borderRadius: 18,
                  padding: 22,
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    Projeção de Fechamento
                  </p>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: "rgba(99,102,241,0.15)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon icon="mdi:lightning-bolt" style={{ fontSize: 18, color: "#818cf8" }} />
                  </div>
                </div>

                <div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 36,
                      fontWeight: 800,
                      letterSpacing: "-1px",
                      color: "#60a5fa",
                      lineHeight: 1,
                    }}
                  >
                    R$ {projecao.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                  </p>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 11,
                      fontWeight: 500,
                      color: "rgba(255,255,255,0.35)",
                    }}
                  >
                    Tendência da IA p/ fim do mês
                  </p>
                </div>

                <div
                  style={{
                    marginTop: 20,
                    borderTop: "1px solid rgba(255,255,255,0.07)",
                    paddingTop: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Icon
                    icon={projecao >= metaGlobal ? "mdi:check-circle" : "mdi:alert-circle"}
                    style={{ fontSize: 16, color: projecao >= metaGlobal ? "#4ade80" : "#fb923c", flexShrink: 0 }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      color: projecao >= metaGlobal ? "#4ade80" : "#fb923c",
                    }}
                  >
                    {projecao >= metaGlobal
                      ? "No ritmo para bater a meta"
                      : "Projeção abaixo do esperado"}
                  </p>
                </div>
              </div>
            </div>

            {/* ─── Channels ─── */}
            <div
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}
            >
              {/* Canal Dominante */}
              <div
                style={{
                  borderRadius: 18,
                  padding: 24,
                  position: "relative",
                  overflow: "hidden",
                  background: "linear-gradient(150deg, rgba(124,58,237,0.12), rgba(236,72,153,0.05))",
                  border: "1px solid rgba(139,92,246,0.18)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -40,
                    right: -40,
                    width: 150,
                    height: 150,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(168,85,247,0.25), transparent 70%)",
                    filter: "blur(20px)",
                    pointerEvents: "none",
                  }}
                />
                <div
                  style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16, position: "relative" }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(236,72,153,0.15))",
                      border: "1px solid rgba(139,92,246,0.3)",
                      color: "#a78bfa",
                    }}
                  >
                    <Icon icon="mdi:trending-up" style={{ fontSize: 18 }} />
                  </div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.45)",
                    }}
                  >
                    Canal Dominante
                  </h3>
                </div>
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: 38,
                    fontWeight: 800,
                    letterSpacing: "-1px",
                    color: "#fff",
                    position: "relative",
                  }}
                >
                  {canais.dominante}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", position: "relative" }}>
                  Maior fatia do faturamento no período.
                </p>
              </div>

              {/* Donut Chart */}
              <div
                style={{
                  gridColumn: "span 2",
                  minWidth: 300,
                  borderRadius: 18,
                  padding: 24,
                  background: "rgba(255,255,255,0.03)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 32,
                }}
              >
                <div style={{ position: "relative", width: 168, height: 168, flexShrink: 0 }}>
                  <svg
                    viewBox="0 0 120 120"
                    style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}
                  >
                    <defs>
                      <linearGradient id="tealGradDB" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#14b8a6" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                    {/* Track */}
                    <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="13" />
                    {/* Comercial arc (teal) */}
                    <circle
                      cx="60" cy="60" r={radius} fill="none"
                      stroke="url(#tealGradDB)" strokeWidth="13" strokeLinecap="round"
                      strokeDasharray={`${Math.max(0, (canais.pctComercial / 100) * circumference - 4)} ${circumference}`}
                      strokeDashoffset={0}
                      style={{ transition: "stroke-dasharray 1s ease" }}
                    />
                    {/* Atendimento arc (indigo) */}
                    <circle
                      cx="60" cy="60" r={radius} fill="none"
                      stroke="#6366f1" strokeWidth="13" strokeLinecap="round"
                      strokeDasharray={`${Math.max(0, (canais.pctAtendimento / 100) * circumference - 4)} ${circumference}`}
                      strokeDashoffset={-((canais.pctComercial / 100) * circumference)}
                      style={{ transition: "stroke-dasharray 1s ease" }}
                    />
                  </svg>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon icon="mdi:chart-donut" style={{ fontSize: 20, color: "rgba(255,255,255,0.3)" }} />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.3)",
                        marginTop: 4,
                      }}
                    >
                      Canais
                    </span>
                  </div>
                </div>
                <div
                  style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 18 }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #2dd4bf, #06b6d4)",
                            display: "inline-block",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                            color: "rgba(255,255,255,0.6)",
                          }}
                        >
                          Comercial
                        </span>
                      </div>
                      <span style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>
                        R$ {canais.comercial.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 30,
                        fontWeight: 800,
                        background: "linear-gradient(135deg, #14b8a6, #06b6d4)",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {canais.pctComercial.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #818cf8, #3b82f6)",
                            display: "inline-block",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.5px",
                            textTransform: "uppercase",
                            color: "rgba(255,255,255,0.6)",
                          }}
                        >
                          Atendimento
                        </span>
                      </div>
                      <span style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>
                        R$ {canais.atendimento.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 30,
                        fontWeight: 800,
                        background: "linear-gradient(135deg, #3b82f6, #818cf8)",
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {canais.pctAtendimento.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {isImportModalOpen && (
          <ImportadorIA
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImported={() => carregarDados()}
          />
        )}
      </AnimatePresence>

      <NovaVendaModal
        isOpen={isNovaVendaOpen}
        onClose={() => setIsNovaVendaOpen(false)}
        onSuccess={handleNovaVendaSuccess}
      />

      {/* Seller Modal */}
      <AnimatePresence>
        {vendedorSelecionado && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVendedorSelecionado(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(6px)",
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 400,
                borderRadius: 22,
                padding: 28,
                position: "relative",
                overflow: "hidden",
                background: "#0d111c",
                border: "1px solid rgba(236,72,153,0.25)",
                boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -50,
                  right: -50,
                  width: 170,
                  height: 170,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(236,72,153,0.25), transparent 70%)",
                  filter: "blur(24px)",
                  pointerEvents: "none",
                }}
              />
              <button
                onClick={() => setVendedorSelecionado(null)}
                style={{
                  position: "absolute",
                  top: 18,
                  right: 18,
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 2,
                }}
              >
                <Icon icon="line-md:close" style={{ fontSize: 16 }} />
              </button>
              <div
                style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, position: "relative" }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#fff",
                    background: AVATAR_GRADIENTS[(vendedorSelecionado.position - 1) % AVATAR_GRADIENTS.length],
                  }}
                >
                  {getInitials(vendedorSelecionado.seller.name)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff" }}>
                    {vendedorSelecionado.seller.name}
                  </h3>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#f472b6" }}>
                    #{vendedorSelecionado.position}º no ranking
                  </span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div
                  style={{
                    borderRadius: 14,
                    padding: 16,
                    background: "rgba(20,184,166,0.08)",
                    border: "1px solid rgba(20,184,166,0.2)",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 6px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      color: "rgba(94,234,212,0.7)",
                    }}
                  >
                    Faturado
                  </p>
                  <span
                    style={{
                      fontSize: 21,
                      fontWeight: 800,
                      background: "linear-gradient(135deg, #14b8a6, #06b6d4)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    R$ {vendedorSelecionado.totalSales.toLocaleString("pt-BR")}
                  </span>
                </div>
                <div
                  style={{
                    borderRadius: 14,
                    padding: 16,
                    background: "rgba(236,72,153,0.08)",
                    border: "1px solid rgba(236,72,153,0.2)",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 6px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      color: "rgba(244,114,182,0.7)",
                    }}
                  >
                    Vendas
                  </p>
                  <span style={{ fontSize: 21, fontWeight: 800, color: "#fff" }}>
                    {vendedorSelecionado.salesCount}
                  </span>
                </div>
              </div>
              <div
                style={{
                  marginTop: 14,
                  borderRadius: 14,
                  padding: 16,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  Ticket Médio
                </p>
                <span style={{ fontSize: 21, fontWeight: 800, color: "#fff" }}>
                  R${" "}
                  {(vendedorSelecionado.salesCount > 0
                    ? vendedorSelecionado.totalSales / vendedorSelecionado.salesCount
                    : 0
                  ).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
