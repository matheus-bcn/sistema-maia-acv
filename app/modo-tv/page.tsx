"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { createClient } from "@/lib/supabase/client";
import { getDashboardStats } from "@/lib/data/dashboard";
import { getSellerRankings } from "@/lib/data/sellers";
import { getLatestSale, getDailyComparisonData } from "@/lib/data/sales";

interface SellerInfo {
  name: string;
  totalSales: number;
  salesCount: number;
}

interface UltimaVenda {
  nome: string;
  valor: number;
  quando: string;
}

const getLocalMonthRange = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const last = new Date(y, d.getMonth() + 1, 0).getDate();
  return { inicio: `${y}-${m}-01`, fim: `${y}-${m}-${String(last).padStart(2, "0")}` };
};

const countBizDays = (s: Date, e: Date) => {
  let c = 0;
  const cur = new Date(s);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(e);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) c++;
    cur.setDate(cur.getDate() + 1);
  }
  return c;
};

const getInitials = (name: string) =>
  name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export default function ModoTvPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const syncRef = useRef<NodeJS.Timeout | null>(null);

  const [mounted, setMounted] = useState(false);
  const [horaLocal, setHoraLocal] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const [totalFaturado, setTotalFaturado] = useState(0);
  const [metaGlobal, setMetaGlobal] = useState(0);
  const [qtdVendas, setQtdVendas] = useState(0);
  const [topSeller, setTopSeller] = useState<SellerInfo | null>(null);
  const [canalDominante, setCanalDominante] = useState({ nome: "—", pct: 0 });
  const [chartData, setChartData] = useState<{ day: string; atual: number; anterior: number }[]>([]);
  const [ultimaVenda, setUltimaVenda] = useState<UltimaVenda | null>(null);
  const [diasRestantes, setDiasRestantes] = useState(0);

  useEffect(() => {
    setMounted(true);
    const tick = () =>
      setHoraLocal(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  };

  const sair = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
    router.push("/");
  };

  const carregarDados = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { inicio, fim } = getLocalMonthRange();

      const [stats, ranks, latest, chart, { data: salesData }] = await Promise.all([
        getDashboardStats(supabase, inicio, fim),
        getSellerRankings(supabase, inicio, fim),
        getLatestSale(supabase),
        getDailyComparisonData(supabase, inicio, fim),
        supabase
          .from("sales")
          .select("amount, channel")
          .gte("sale_date", `${inicio}T00:00:00`)
          .lte("sale_date", `${fim}T23:59:59`),
      ]);

      setTotalFaturado(stats.totalFaturado);
      setMetaGlobal(stats.metaGlobal);
      setQtdVendas(stats.qtdVendas);
      setTopSeller(
        ranks[0]
          ? { name: ranks[0].seller.name, totalSales: ranks[0].totalSales, salesCount: ranks[0].salesCount }
          : null
      );
      setChartData(chart);

      const totaisCanais = (salesData || []).reduce(
        (acc, row) => {
          const v = Number(row.amount);
          if (row.channel === "atendimento") acc.a += v;
          else acc.c += v;
          return acc;
        },
        { c: 0, a: 0 }
      );
      const totalCanais = totaisCanais.c + totaisCanais.a;
      const pctC = totalCanais > 0 ? (totaisCanais.c / totalCanais) * 100 : 0;
      setCanalDominante(
        totaisCanais.c >= totaisCanais.a
          ? { nome: "Comercial", pct: pctC }
          : { nome: "Atendimento", pct: 100 - pctC }
      );

      // Dias úteis restantes no mês
      const hoje = new Date();
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      const amanha = new Date(hoje.getTime() + 86400000);
      setDiasRestantes(amanha <= fimMes ? countBizDays(amanha, fimMes) : 0);

      if (latest?.seller) {
        const mins = Math.floor((Date.now() - new Date(latest.created_at).getTime()) / 60000);
        setUltimaVenda({
          nome: latest.seller.name,
          valor: Number(latest.amount),
          quando: mins < 1 ? "Agora mesmo" : `Há ${mins} min`,
        });
      }
    } catch (err) {
      console.error("TV sync error:", err);
    } finally {
      setIsSyncing(false);
      if (syncRef.current) clearTimeout(syncRef.current);
      syncRef.current = setTimeout(carregarDados, 30000);
    }
  }, [supabase]);

  useEffect(() => {
    carregarDados();
    return () => {
      if (syncRef.current) clearTimeout(syncRef.current);
    };
  }, [carregarDados]);

  const pctEquipe = metaGlobal > 0 ? Math.min(100, (totalFaturado / metaGlobal) * 100) : 0;
  const ticketMedio = qtdVendas > 0 ? totalFaturado / qtdVendas : 0;

  const insight = useMemo(() => {
    if (!metaGlobal) return { acima: true, diffPct: 0, mediaDiaria: 0 };
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const firstDay = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const lastDay = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const totalBiz = Math.max(1, countBizDays(firstDay, lastDay));
    const passedBiz = Math.max(1, countBizDays(firstDay, hoje));
    const expectedVol = metaGlobal * (passedBiz / totalBiz);
    const pacing = expectedVol > 0 ? (totalFaturado / expectedVol) * 100 : 0;
    return {
      acima: pacing >= 100,
      diffPct: Math.abs(pacing - 100),
      mediaDiaria: passedBiz > 0 ? totalFaturado / passedBiz : 0,
    };
  }, [metaGlobal, totalFaturado]);

  const saudacao = useMemo(() => {
    if (!mounted) return "Olá";
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  }, [horaLocal, mounted]);

  const mesLabel = useMemo(() => {
    return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, []);

  // SVG chart path from chart data
  const { svgLine, svgPoly } = useMemo(() => {
    if (!chartData.length) return { svgLine: "", svgPoly: "" };
    const W = 640, H = 240, padTop = 30, padBottom = 20;
    const maxVal = Math.max(...chartData.map((d) => d.atual), 1);
    const pts = chartData.map((d, i) => {
      const x = chartData.length > 1 ? (i / (chartData.length - 1)) * W : W / 2;
      const y = H - padBottom - ((d.atual / maxVal) * (H - padTop - padBottom));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const line = pts.join(" ");
    const poly = `${pts[0].split(",")[0]},${H - padBottom} ${line} ${W},${H - padBottom}`;
    return { svgLine: line, svgPoly: poly };
  }, [chartData]);

  if (!mounted) return null;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#07070d",
        color: "#fff",
        fontFamily: "inherit",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Background orbs */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div
          style={{
            position: "absolute",
            top: 120,
            left: 300,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -60,
            right: 120,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(249,115,22,0.12), transparent 70%)",
            filter: "blur(36px)",
          }}
        />
      </div>

      {/* ─── Header ─── */}
      <div
        style={{
          flexShrink: 0,
          padding: "30px 40px 0",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "3px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.35)",
              marginBottom: 6,
            }}
          >
            {mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)} · Visão Geral
          </div>
          <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: "-1px", lineHeight: 1.1, color: "#fff" }}>
            {saudacao}, equipe{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #a78bfa, #ec4899)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              MAIA
            </span>
            .
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isSyncing && (
            <Icon icon="line-md:loading-loop" style={{ fontSize: 18, color: "rgba(255,255,255,0.4)" }} />
          )}
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#fff",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: "8px 18px",
              letterSpacing: 1,
            }}
          >
            {horaLocal}
          </div>
          <button
            onClick={toggleFullscreen}
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon icon="mdi:fullscreen" style={{ fontSize: 20 }} />
          </button>
          <button
            onClick={sair}
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon icon="mdi:arrow-left" style={{ fontSize: 20 }} />
          </button>
        </div>
      </div>

      {/* ─── Main content ─── */}
      <div
        style={{
          flex: 1,
          padding: "20px 40px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          position: "relative",
          zIndex: 1,
          minHeight: 0,
        }}
      >
        {/* Row 1: Faturamento hero + Chart */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.45fr", gap: 16, minHeight: 0 }}>
          {/* Faturamento hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: "linear-gradient(160deg, rgba(249,115,22,0.16), rgba(234,179,8,0.04) 60%, transparent)",
              border: "1px solid rgba(249,115,22,0.22)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
              borderRadius: 20,
              padding: "24px 28px",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                  color: "rgba(253,186,116,0.7)",
                }}
              >
                Total Faturado
              </span>
              <div
                style={{
                  fontSize: 58,
                  fontWeight: 900,
                  letterSpacing: "-3px",
                  lineHeight: 0.95,
                  margin: "10px 0 6px",
                  background: "linear-gradient(135deg, #fb923c, #fbbf24)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                R$ {(totalFaturado / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                <span style={{ fontSize: 28, WebkitTextFillColor: "rgba(251,146,60,0.7)" }}>k</span>
              </div>

              {/* Pacing badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 10px",
                    borderRadius: 7,
                    background: insight.acima ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                    color: insight.acima ? "#34d399" : "#f87171",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  <Icon
                    icon={insight.acima ? "mdi:arrow-up" : "mdi:arrow-down"}
                    style={{ fontSize: 13 }}
                  />
                  {insight.diffPct.toFixed(1)}%
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                  {insight.acima ? "acima" : "abaixo"} do ritmo
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 24,
                borderTop: "1px solid rgba(255,255,255,0.08)",
                paddingTop: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "rgba(255,255,255,0.35)",
                    marginBottom: 4,
                  }}
                >
                  Vendas
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>{qtdVendas}</div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "rgba(255,255,255,0.35)",
                    marginBottom: 4,
                  }}
                >
                  Ticket médio
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>
                  R$ {ticketMedio.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
              borderRadius: 20,
              padding: "22px 24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1.5px",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                Evolução no Mês
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  background: "linear-gradient(135deg, #a78bfa, #ec4899)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {pctEquipe.toFixed(1)}% da meta
              </span>
            </div>
            <svg
              viewBox="0 0 640 240"
              style={{ width: "100%", flex: 1, display: "block", minHeight: 0 }}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="tvPurpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(168,85,247,0.4)" />
                  <stop offset="100%" stopColor="rgba(168,85,247,0)" />
                </linearGradient>
                <linearGradient id="tvPurpLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
              <line x1="0" y1="60" x2="640" y2="60" stroke="rgba(255,255,255,0.05)" />
              <line x1="0" y1="120" x2="640" y2="120" stroke="rgba(255,255,255,0.05)" />
              <line x1="0" y1="180" x2="640" y2="180" stroke="rgba(255,255,255,0.05)" />
              {svgPoly && (
                <polygon fill="url(#tvPurpFill)" points={svgPoly} />
              )}
              {svgLine && (
                <>
                  <polyline
                    fill="none"
                    stroke="url(#tvPurpLine)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={svgLine}
                  />
                  {/* Last point dot */}
                  {(() => {
                    const last = svgLine.split(" ").pop()!;
                    const [lx, ly] = last.split(",");
                    return (
                      <circle cx={lx} cy={ly} r="5" fill="#ec4899" stroke="#07070d" strokeWidth="2.5" />
                    );
                  })()}
                </>
              )}
              {!svgLine && (
                <text x="320" y="120" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="14">
                  Sem dados
                </text>
              )}
            </svg>
          </motion.div>
        </div>

        {/* Row 2: MAIA Briefing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(236,72,153,0.05))",
            border: "1px solid rgba(139,92,246,0.22)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
            borderRadius: 20,
            padding: "20px 24px",
            display: "flex",
            gap: 18,
            alignItems: "flex-start",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 20px rgba(139,92,246,0.4)",
            }}
          >
            <Icon icon="mdi:robot-happy" style={{ fontSize: 24, color: "#fff" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>M.A.I.A.</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#a78bfa",
                  padding: "2px 7px",
                  borderRadius: 6,
                  background: "rgba(139,92,246,0.15)",
                }}
              >
                insight do dia
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.75)" }}>
              A equipe está{" "}
              <b style={{ color: insight.acima ? "#34d399" : "#f87171" }}>
                {insight.diffPct.toFixed(0)}% {insight.acima ? "acima" : "abaixo"}
              </b>{" "}
              do ritmo necessário. Mantendo a média diária de{" "}
              <b style={{ color: "#fff" }}>
                R$ {(insight.mediaDiaria / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k
              </b>
              , a meta de{" "}
              <b style={{ color: "#fff" }}>R$ {(metaGlobal / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k</b>{" "}
              {insight.acima ? "será alcançada antes do fim do mês" : "está em risco — reforce as vendas"}. O canal{" "}
              <b style={{ color: "#2dd4bf" }}>{canalDominante.nome}</b> puxa{" "}
              <b style={{ color: "#fff" }}>{canalDominante.pct.toFixed(1)}%</b> do faturamento.
              {ultimaVenda && (
                <>
                  {" "}
                  Última venda:{" "}
                  <b style={{ color: "#f472b6" }}>
                    {ultimaVenda.nome} · R$ {ultimaVenda.valor.toLocaleString("pt-BR")}
                  </b>{" "}
                  <span style={{ color: "rgba(255,255,255,0.45)" }}>({ultimaVenda.quando})</span>
                </>
              )}
            </p>
          </div>
        </motion.div>

        {/* Row 3: Metric strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, flexShrink: 0 }}
        >
          {/* META */}
          <div
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
              padding: "16px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <Icon icon="mdi:target" style={{ fontSize: 15, color: "#a78bfa" }} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                Meta
              </span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>{pctEquipe.toFixed(1)}%</div>
            <div
              style={{
                marginTop: 8,
                height: 5,
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pctEquipe}%`,
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #8b5cf6, #ec4899)",
                  transition: "width 1s ease",
                }}
              />
            </div>
          </div>

          {/* DESTAQUE */}
          <div
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
              padding: "16px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <Icon icon="line-md:star-pulsating-loop" style={{ fontSize: 15, color: "#f472b6" }} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                Destaque
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {topSeller && (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #ec4899, #a855f7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {getInitials(topSeller.name)}
                </div>
              )}
              <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>
                {topSeller?.name ?? "—"}
              </div>
            </div>
          </div>

          {/* CANAL FORTE */}
          <div
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
              padding: "16px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <Icon icon="mdi:trending-up" style={{ fontSize: 15, color: "#2dd4bf" }} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                Canal forte
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>
              {canalDominante.nome}{" "}
              <span style={{ fontSize: 14, color: "#2dd4bf" }}>{canalDominante.pct.toFixed(1)}%</span>
            </div>
          </div>

          {/* FECHAMENTO */}
          <div
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16,
              padding: "16px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <Icon icon="line-md:watch-loop" style={{ fontSize: 15, color: "#60a5fa" }} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                Fechamento
              </span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>
              {diasRestantes}{" "}
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>dias úteis</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
