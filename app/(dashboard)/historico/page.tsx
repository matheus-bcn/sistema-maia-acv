"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { createClient } from "@/lib/supabase/client";
import { listSales } from "@/lib/data/sales";
import { deleteSaleAction, deleteAllSalesAction } from "@/lib/actions/sales";
import type { Sale } from "@/types";

const MESES_CURTOS = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const MESES_LONGOS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const CHIP_FILTROS = [
  { label: "Tudo",       value: "tudo",    icon: "mdi:view-list" },
  { label: "Vendas",     value: "venda",   icon: "mdi:cash-multiple" },
  { label: "Clientes",   value: "cliente", icon: "mdi:account-plus" },
  { label: "Metas",      value: "meta",    icon: "mdi:flag-checkered" },
  { label: "Premiações", value: "premio",  icon: "mdi:trophy" },
];

export default function HistoricoPage() {
  const supabase = useMemo(() => createClient(), []);

  const [vendas, setVendas] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipoSelecionado, setTipoSelecionado] = useState("tudo");

  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const now = new Date();
  const [deleteMonth, setDeleteMonth] = useState(now.getMonth() + 1);
  const [deleteYear, setDeleteYear] = useState(now.getFullYear());

  const periodo = useMemo(() => {
    const n = new Date();
    return {
      inicio: new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split("T")[0],
      fim: new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().split("T")[0],
    };
  }, []);

  const carregarVendas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSales(supabase, {
        limit: 500,
        startDate: periodo.inicio,
        endDate: periodo.fim,
      });
      setVendas(data);
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
      setError("Falha ao carregar o histórico de vendas. Verifique sua conexão ou permissões.");
    } finally {
      setLoading(false);
    }
  }, [supabase, periodo]);

  useEffect(() => {
    carregarVendas();
  }, [carregarVendas]);

  const confirmDelete = async (id: string) => {
    try {
      const result = await deleteSaleAction(id);
      if (result?.error) alert(`Erro ao excluir: ${result.error}`);
      else setVendas((prev) => prev.filter((v) => v.id !== id));
    } catch {
      alert("Não foi possível deletar a venda selecionada.");
    } finally {
      setSaleToDelete(null);
    }
  };

  const confirmDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      const m = String(deleteMonth).padStart(2, "0");
      const lastDay = new Date(deleteYear, deleteMonth, 0).getDate();
      const start = `${deleteYear}-${m}-01`;
      const end = `${deleteYear}-${m}-${String(lastDay).padStart(2, "0")}`;
      const result = await deleteAllSalesAction(start, end);
      if (result?.error) alert(`Erro ao limpar mês: ${result.error}`);
      else await carregarVendas();
    } catch {
      alert("Falha de conexão ao limpar o histórico.");
    } finally {
      setIsDeletingAll(false);
      setIsDeleteAllModalOpen(false);
    }
  };

  const exportCsv = () => {
    if (vendasFiltradas.length === 0) return;
    const header = "ID,Data,Vendedor,OS/PDV,Cliente,Canal,Valor,Status\n";
    const rows = vendasFiltradas
      .map((v) => {
        const dataStr = new Date((v as any).sale_date || v.created_at).toLocaleDateString("pt-BR");
        const vendedor = v.seller?.name ?? "Sem Vendedor";
        const pdv = (v as any).pdv_number ?? "";
        const cliente = (v as any).customer_name ?? "";
        const canal = (v as any).channel ?? "comercial";
        const valor = Number(v.amount).toFixed(2);
        return `${v.id},${dataStr},"${vendedor}","${pdv}","${cliente}","${canal}",${valor},${v.status}`;
      })
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico-vendas-${periodo.inicio}-a-${periodo.fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stat computations
  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const ontem = useMemo(() => {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - 1);
    return d;
  }, [hoje]);
  const seteAtras = useMemo(() => {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - 6);
    return d;
  }, [hoje]);

  const vendasHoje = useMemo(() =>
    vendas.filter((v) => {
      const d = new Date((v as any).sale_date || v.created_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === hoje.getTime();
    }), [vendas, hoje]);

  const vendasSemana = useMemo(() =>
    vendas.filter((v) => {
      const d = new Date((v as any).sale_date || v.created_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime() >= seteAtras.getTime() && d.getTime() <= hoje.getTime();
    }), [vendas, hoje, seteAtras]);

  const volumeSemana = useMemo(() =>
    vendasSemana.reduce((acc, v) => acc + Number(v.amount), 0), [vendasSemana]);

  const alertasMaia = useMemo(() =>
    vendas.filter((v) => (v as any).status === "Pendente"), [vendas]);

  // All our data is "venda" type; only "tudo" and "venda" produce results
  const vendasFiltradas = useMemo(() =>
    vendas.filter(() => tipoSelecionado === "tudo" || tipoSelecionado === "venda"),
    [vendas, tipoSelecionado]);

  const grupos = useMemo(() => {
    const map = vendasFiltradas.reduce(
      (acc, v) => {
        const d = new Date((v as any).sale_date || v.created_at);
        d.setHours(0, 0, 0, 0);
        const key = d.toISOString();
        if (!acc[key]) acc[key] = { data: d, vendas: [] };
        acc[key].vendas.push(v);
        return acc;
      },
      {} as Record<string, { data: Date; vendas: Sale[] }>
    );
    return Object.values(map).sort((a, b) => b.data.getTime() - a.data.getTime());
  }, [vendasFiltradas]);

  function labelDia(d: Date) {
    if (d.getTime() === hoje.getTime())
      return `Hoje · ${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
    if (d.getTime() === ontem.getTime())
      return `Ontem · ${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
    return `${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
  }

  const statCards = [
    { label: "Eventos hoje",     value: vendasHoje.length, icon: "mdi:pulse",       cor: "#2dd4bf" },
    { label: "Vendas na semana", value: vendasSemana.length, icon: "mdi:cash-multiple", cor: "#4ade80" },
    {
      label: "Volume 7 dias",
      value: volumeSemana >= 1000
        ? `R$ ${(volumeSemana / 1000).toFixed(1)}k`
        : `R$ ${volumeSemana.toFixed(0)}`,
      icon: "mdi:chart-line",
      cor: "#60a5fa",
    },
    { label: "Alertas MAIA", value: alertasMaia.length, icon: "mdi:bell-alert", cor: "#fb923c" },
  ];

  return (
    <>
      {/* Header — matches design exactly */}
      <header style={{ marginBottom: 22, display: "flex", alignItems: "center", gap: 13 }}>
        <div
          style={{
            width: 46, height: 46, borderRadius: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, rgba(96,165,250,0.25), rgba(59,130,246,0.12))",
            border: "1px solid rgba(96,165,250,0.3)",
            color: "#60a5fa", flexShrink: 0,
          }}
        >
          <Icon icon="line-md:watch-loop" style={{ fontSize: 24 }} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-0.8px", color: "#fff" }}>
            Histórico · Atividade
          </h1>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
            Linha do tempo de tudo que aconteceu na operação
          </p>
        </div>
      </header>

      {/* Action buttons (admin tools, secondary row) */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 18 }}>
        <button
          type="button"
          onClick={exportCsv}
          disabled={loading || vendasFiltradas.length === 0}
          className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon icon="mdi:download" style={{ fontSize: 15 }} /> Exportar CSV
        </button>
        <button
          type="button"
          onClick={() => setIsDeleteAllModalOpen(true)}
          disabled={loading || vendas.length === 0}
          className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon icon="mdi:trash-can" style={{ fontSize: 15 }} /> Limpar Mês
        </button>
      </div>

      {/* Stat cards — matches design grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        {statCards.map((card) => (
          <div
            key={card.label}
            style={{
              borderRadius: 16, padding: 18,
              background: "rgba(255,255,255,0.03)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Icon icon={card.icon} style={{ fontSize: 16, color: card.cor }} />
              <span
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "1.5px",
                  textTransform: "uppercase", color: "rgba(255,255,255,0.4)",
                }}
              >
                {card.label}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
              {loading
                ? <span style={{ display: "block", height: 28, width: 60, borderRadius: 6, background: "rgba(255,255,255,0.08)" }} />
                : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter chips — type-based, matches design exactly */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {CHIP_FILTROS.map((chip) => {
          const ativo = tipoSelecionado === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setTipoSelecionado(chip.value)}
              style={{
                padding: "8px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 700,
                cursor: "pointer", transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: 6,
                background: ativo ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.03)",
                color: ativo ? "#fff" : "rgba(255,255,255,0.45)",
                border: ativo ? "1px solid rgba(255,255,255,0.28)" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <Icon icon={chip.icon} style={{ fontSize: 14, verticalAlign: "-2px" }} />
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div style={{ maxWidth: 760 }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                style={{
                  height: 72, borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center p-8 rounded-xl border border-red-500/20 bg-red-500/5"
          >
            <Icon icon="line-md:alert-circle-loop" className="h-8 w-8 text-red-400 mb-3" />
            <p className="text-sm text-neutral-300 mb-4 text-center">{error}</p>
            <button
              type="button"
              onClick={carregarVendas}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white font-semibold rounded-md border border-white/10 hover:bg-white/20 transition-all text-sm"
            >
              <Icon icon="mdi:reload" className="h-4 w-4" /> Tentar Novamente
            </button>
          </motion.div>
        ) : grupos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-neutral-500"
          >
            <Icon icon="mdi:file-spreadsheet" className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-lg font-semibold text-neutral-400">Nenhum registro encontrado</p>
            <p className="text-sm mt-1">
              {tipoSelecionado !== "tudo" && tipoSelecionado !== "venda"
                ? "Sem eventos deste tipo no período atual."
                : "Ajuste os filtros ou aguarde novos registros."}
            </p>
          </motion.div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {grupos.map((grupo) => (
              <div key={grupo.data.toISOString()} style={{ marginBottom: 22 }}>
                {/* Day header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span
                    style={{
                      fontSize: 12, fontWeight: 800, letterSpacing: "1px",
                      textTransform: "uppercase", color: "#fff", whiteSpace: "nowrap",
                    }}
                  >
                    {labelDia(grupo.data)}
                  </span>
                  <span style={{ height: 1, flex: 1, background: "rgba(255,255,255,0.08)" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>
                    {grupo.vendas.length}{" "}{grupo.vendas.length === 1 ? "evento" : "eventos"}
                  </span>
                </div>

                {/* Events */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {grupo.vendas.map((venda, idx) => {
                    const horario = new Date((venda as any).sale_date
                      ? venda.created_at
                      : venda.created_at
                    ).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                    const pdv = (venda as any).pdv_number ?? "—";
                    const cliente = (venda as any).customer_name ?? "—";
                    const vendedorNome = venda.seller?.name ?? "—";
                    const isLast = idx === grupo.vendas.length - 1;
                    const valorFmt = `+ R$ ${Number(venda.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

                    return (
                      <div
                        key={venda.id}
                        style={{
                          display: "flex", gap: 14,
                          animation: "rowIn 0.4s ease both",
                          animationDelay: `${idx * 0.04}s`,
                        }}
                      >
                        {/* Icon tile + connector */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                          <div
                            style={{
                              width: 38, height: 38, borderRadius: 11,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: "rgba(45,212,191,0.1)",
                              border: "1px solid rgba(45,212,191,0.22)",
                              color: "#2dd4bf",
                            }}
                          >
                            <Icon icon="mdi:cash-multiple" style={{ fontSize: 18 }} />
                          </div>
                          {!isLast && (
                            <span
                              style={{
                                flex: 1, width: 2,
                                background: "rgba(255,255,255,0.07)",
                                margin: "4px 0",
                              }}
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 16 }}>
                          <div
                            style={{
                              display: "flex", alignItems: "baseline",
                              justifyContent: "space-between", gap: 10,
                            }}
                          >
                            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#fff" }}>
                              {vendedorNome} fechou venda
                            </p>
                            <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)" }}>
                              {horario}
                            </span>
                          </div>
                          <p style={{ margin: "3px 0 0", fontSize: 12.5, lineHeight: 1.45, color: "rgba(255,255,255,0.5)" }}>
                            {cliente} · PDV {pdv}
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: 12, fontWeight: 800, color: "#2dd4bf",
                                padding: "3px 10px", borderRadius: 8,
                                background: "rgba(45,212,191,0.08)",
                                border: "1px solid rgba(45,212,191,0.18)",
                              }}
                            >
                              {valorFmt}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSaleToDelete(venda.id)}
                              title="Excluir venda"
                              style={{
                                padding: "3px 5px", borderRadius: 6,
                                background: "transparent", border: "none",
                                cursor: "pointer", color: "rgba(255,255,255,0.2)",
                                transition: "color 0.15s, background 0.15s",
                                display: "flex", alignItems: "center",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
                                (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.2)";
                                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                              }}
                            >
                              <Icon icon="mdi:delete" style={{ fontSize: 14 }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Limpar Mês */}
      <AnimatePresence>
        {isDeleteAllModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl p-6 border border-red-500/30 bg-neutral-900 text-white space-y-5 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <Icon icon="line-md:alert-circle-loop" className="h-6 w-6 flex-shrink-0 text-red-400" />
                <h3 className="text-lg font-black text-white">Limpar Histórico por Mês</h3>
              </div>
              <p className="text-sm text-neutral-400">Selecione o mês que deseja apagar permanentemente:</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-neutral-500">Mês</label>
                  <select
                    value={deleteMonth}
                    onChange={(e) => setDeleteMonth(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2.5 text-sm text-white outline-none focus:border-red-500/50"
                  >
                    {MESES_LONGOS.map((m, i) => (
                      <option key={i} value={i + 1} className="bg-neutral-900">{m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-neutral-500">Ano</label>
                  <select
                    value={deleteYear}
                    onChange={(e) => setDeleteYear(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2.5 text-sm text-white outline-none focus:border-red-500/50"
                  >
                    {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map((y) => (
                      <option key={y} value={y} className="bg-neutral-900">{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <Icon icon="mdi:information-outline" className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-300 leading-relaxed">
                  Todas as vendas de{" "}
                  <strong className="text-white">{MESES_LONGOS[deleteMonth - 1]}/{deleteYear}</strong>{" "}
                  serão excluídas <strong>permanentemente</strong> e não poderão ser recuperadas.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteAllModalOpen(false)}
                  disabled={isDeletingAll}
                  className="px-4 py-2 rounded-lg border border-white/10 text-sm font-semibold hover:bg-white/5 transition-colors text-neutral-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteAll}
                  disabled={isDeletingAll}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-bold text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeletingAll ? (
                    <><Icon icon="line-md:loading-loop" className="h-4 w-4" /> Excluindo...</>
                  ) : (
                    <><Icon icon="mdi:trash-can" className="h-4 w-4" /> Apagar mês</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Delete individual */}
      <AnimatePresence>
        {saleToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl p-6 border border-white/20 bg-neutral-900 text-white space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <Icon icon="line-md:alert-circle-loop" className="h-6 w-6 flex-shrink-0 text-amber-400" />
                <h3 className="text-lg font-black text-white">Excluir Venda?</h3>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Tem certeza que deseja excluir permanentemente esta venda? Essa ação recalculará as metas da Home imediatamente.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSaleToDelete(null)}
                  className="px-4 py-2 rounded-lg border border-white/10 text-sm font-semibold hover:bg-white/5 transition-colors text-neutral-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => confirmDelete(saleToDelete)}
                  className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-sm font-bold text-white transition-colors flex items-center gap-1.5 shadow-lg shadow-red-500/10"
                >
                  <Icon icon="mdi:delete" className="h-4 w-4" /> Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
