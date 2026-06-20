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

export default function HistoricoPage() {
  const supabase = useMemo(() => createClient(), []);

  const [busca, setBusca] = useState("");
  const [vendas, setVendas] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const now = new Date();
  const [deleteMonth, setDeleteMonth] = useState(now.getMonth() + 1);
  const [deleteYear, setDeleteYear] = useState(now.getFullYear());

  const [showDateFilter, setShowDateFilter] = useState(false);
  const [statusSelecionado, setStatusSelecionado] = useState<string>("Todos");
  const [periodo, setPeriodo] = useState(() => {
    const n = new Date();
    return {
      inicio: new Date(n.getFullYear(), n.getMonth(), 1).toISOString().split("T")[0],
      fim: new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().split("T")[0],
    };
  });

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
      if (result?.error) {
        alert(`Erro ao excluir: ${result.error}`);
      } else {
        setVendas((prev) => prev.filter((v) => v.id !== id));
      }
    } catch (err) {
      console.error("Falha ao deletar:", err);
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
      if (result?.error) {
        alert(`Erro ao limpar mês: ${result.error}`);
      } else {
        if (start <= periodo.fim && end >= periodo.inicio) {
          await carregarVendas();
        }
      }
    } catch {
      alert("Falha de conexão ao limpar o histórico.");
    } finally {
      setIsDeletingAll(false);
      setIsDeleteAllModalOpen(false);
    }
  };

  const vendasFiltradas = vendas.filter((v) => {
    const nome = v.seller?.name?.toLowerCase() ?? "";
    const idStr = v.id.toLowerCase();
    const cliente = ((v as any).customer_name ?? "").toLowerCase();
    const pdv = ((v as any).pdv_number ?? "").toLowerCase();
    const termo = busca.toLowerCase();

    const atendeBusca =
      !termo ||
      nome.includes(termo) ||
      idStr.includes(termo) ||
      cliente.includes(termo) ||
      pdv.includes(termo);

    const atendeStatus =
      statusSelecionado === "Todos" || (v as any).status === statusSelecionado;

    return atendeBusca && atendeStatus;
  });

  const exportCsv = () => {
    if (vendasFiltradas.length === 0) return;
    const header = "ID,Data,Vendedor,OS/PDV,Cliente,Canal,Valor,Status\n";
    const rows = vendasFiltradas
      .map((v) => {
        const id = v.id;
        const dataStr = new Date((v as any).sale_date || v.created_at).toLocaleDateString("pt-BR");
        const vendedor = v.seller?.name ?? "Sem Vendedor";
        const pdv = (v as any).pdv_number ?? "";
        const cliente = (v as any).customer_name ?? "";
        const canal = (v as any).channel ?? "comercial";
        const valor = Number(v.amount).toFixed(2);
        const status = v.status;
        return `${id},${dataStr},"${vendedor}","${pdv}","${cliente}","${canal}",${valor},${status}`;
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
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const seteAtras = new Date(hoje);
  seteAtras.setDate(hoje.getDate() - 6);

  const vendasHoje = vendas.filter((v) => {
    const d = new Date((v as any).sale_date || v.created_at);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === hoje.getTime();
  });

  const vendasSemana = vendas.filter((v) => {
    const d = new Date((v as any).sale_date || v.created_at);
    d.setHours(0, 0, 0, 0);
    return d.getTime() >= seteAtras.getTime() && d.getTime() <= hoje.getTime();
  });

  const volumeSemana = vendasSemana.reduce((acc, v) => acc + Number(v.amount), 0);
  const pendentes = vendas.filter((v) => (v as any).status === "Pendente");

  // Agrupamento por dia
  const gruposPorDia = vendasFiltradas.reduce(
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

  const grupos = Object.values(gruposPorDia).sort(
    (a, b) => b.data.getTime() - a.data.getTime()
  );

  function labelDia(d: Date) {
    if (d.getTime() === hoje.getTime())
      return `Hoje · ${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
    if (d.getTime() === ontem.getTime())
      return `Ontem · ${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
    return `${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`;
  }

  const statCards = [
    {
      label: "Vendas hoje",
      value: vendasHoje.length,
      icon: "mdi:pulse",
      cor: "#2dd4bf",
    },
    {
      label: "Vendas na semana",
      value: vendasSemana.length,
      icon: "mdi:cash-multiple",
      cor: "#4ade80",
    },
    {
      label: "Volume 7 dias",
      value:
        volumeSemana >= 1000
          ? `R$ ${(volumeSemana / 1000).toFixed(1)}k`
          : `R$ ${volumeSemana.toFixed(0)}`,
      icon: "mdi:chart-line",
      cor: "#60a5fa",
    },
    {
      label: "Pendentes",
      value: pendentes.length,
      icon: "mdi:bell-alert",
      cor: "#fb923c",
    },
  ];

  const chipsFiltro = [
    { label: "Tudo", value: "Todos", icon: "mdi:view-list" },
    { label: "Aprovado", value: "Aprovado", icon: "mdi:check-circle" },
    { label: "Pendente", value: "Pendente", icon: "mdi:clock-outline" },
    { label: "Cancelado", value: "Cancelado", icon: "mdi:close-circle" },
  ];

  return (
    <>
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background:
                "linear-gradient(135deg, rgba(96,165,250,0.25), rgba(59,130,246,0.12))",
              border: "1px solid rgba(96,165,250,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Icon icon="line-md:watch-loop" style={{ color: "#60a5fa", fontSize: 22 }} />
          </div>
          <div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.8px",
                color: "#fff",
                lineHeight: 1.1,
              }}
            >
              Histórico · Atividade
            </h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 3 }}>
              Linha do tempo de tudo que aconteceu na operação
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setIsDeleteAllModalOpen(true)}
            disabled={loading || vendas.length === 0}
            className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon icon="mdi:trash-can" className="h-4 w-4" />
            Limpar Mês
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={loading || vendasFiltradas.length === 0}
            className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon icon="mdi:download" className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </header>

      {/* Stat Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 14,
          marginBottom: 28,
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
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div className="flex items-center gap-2">
              <Icon icon={card.icon} style={{ color: card.cor, fontSize: 16 }} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "1.5px",
                  color: "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                }}
              >
                {card.label}
              </span>
            </div>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
              {loading ? (
                <span
                  style={{
                    display: "block",
                    height: 28,
                    width: 60,
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.08)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
              ) : (
                card.value
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-col md:flex-row gap-3 md:items-center relative z-20">
        {/* Busca */}
        <div className="relative flex-1 min-w-0">
          <Icon
            icon="line-md:search"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500"
          />
          <input
            type="text"
            placeholder="Buscar por vendedor, cliente, OS/PDV ou ID..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-white/25 text-white placeholder:text-neutral-500 transition-all"
          />
        </div>

        {/* Filtro Data */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-colors ${
              showDateFilter
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/10 bg-white/5 text-neutral-300 hover:bg-white/8"
            }`}
          >
            <Icon icon="line-md:calendar" className="h-4 w-4 text-neutral-400" />
            Filtrar Data
          </button>

          <AnimatePresence>
            {showDateFilter && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 sm:left-0 top-full mt-2 w-64 bg-[#111] border border-white/10 rounded-xl p-4 shadow-2xl z-50 flex flex-col gap-3"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold text-white">Período</span>
                  <button
                    onClick={() => setShowDateFilter(false)}
                    className="text-neutral-500 hover:text-white"
                  >
                    <Icon icon="line-md:close" className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-400 uppercase font-semibold">Início</label>
                  <input
                    type="date"
                    value={periodo.inicio}
                    onChange={(e) => setPeriodo((prev) => ({ ...prev, inicio: e.target.value }))}
                    className="bg-black border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer [color-scheme:dark]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-400 uppercase font-semibold">Fim</label>
                  <input
                    type="date"
                    value={periodo.fim}
                    onChange={(e) => setPeriodo((prev) => ({ ...prev, fim: e.target.value }))}
                    className="bg-black border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer [color-scheme:dark]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chips de status */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {chipsFiltro.map((chip) => {
          const ativo = statusSelecionado === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setStatusSelecionado(chip.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
                background: ativo ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.03)",
                border: ativo
                  ? "1px solid rgba(255,255,255,0.28)"
                  : "1px solid rgba(255,255,255,0.07)",
                color: ativo ? "#fff" : "rgba(255,255,255,0.45)",
              }}
            >
              <Icon icon={chip.icon} style={{ fontSize: 14 }} />
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
                  height: 72,
                  borderRadius: 14,
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
            <p className="text-sm mt-1">Ajuste os filtros ou os termos de busca.</p>
          </motion.div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {grupos.map((grupo) => (
              <div key={grupo.data.toISOString()}>
                {/* Cabeçalho de grupo */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#fff",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {labelDia(grupo.data)}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: "rgba(255,255,255,0.08)",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.35)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {grupo.vendas.length} {grupo.vendas.length === 1 ? "venda" : "vendas"}
                  </span>
                </div>

                {/* Eventos */}
                <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
                  {grupo.vendas.map((venda, idx) => {
                    const horario = new Date(venda.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const canal = (venda as any).channel ?? "comercial";
                    const pdv = (venda as any).pdv_number ?? "—";
                    const cliente = (venda as any).customer_name ?? "—";
                    const vendedorNome = venda.seller?.name ?? "—";
                    const isLast = idx === grupo.vendas.length - 1;

                    return (
                      <motion.div
                        key={venda.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut", delay: idx * 0.04 }}
                        style={{ display: "flex", gap: 14, position: "relative" }}
                      >
                        {/* Ícone + conector */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 11,
                              background: "rgba(45,212,191,0.12)",
                              border: "1px solid rgba(45,212,191,0.22)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Icon
                              icon="mdi:cash-multiple"
                              style={{ color: "#2dd4bf", fontSize: 17 }}
                            />
                          </div>
                          {!isLast && (
                            <div
                              style={{
                                width: 2,
                                flex: 1,
                                minHeight: 20,
                                background: "rgba(255,255,255,0.07)",
                                marginTop: 4,
                                marginBottom: 4,
                              }}
                            />
                          )}
                        </div>

                        {/* Conteúdo */}
                        <div
                          style={{
                            flex: 1,
                            paddingBottom: isLast ? 0 : 16,
                            paddingTop: 2,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <span
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: 700,
                                  color: "#fff",
                                  lineHeight: 1.2,
                                }}
                              >
                                {vendedorNome} · {cliente}
                              </span>
                              <span
                                style={{
                                  fontSize: 12.5,
                                  color: "rgba(255,255,255,0.5)",
                                }}
                              >
                                {canal} · PDV {pdv}
                              </span>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexShrink: 0,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: "#2dd4bf",
                                  background: "rgba(45,212,191,0.08)",
                                  border: "1px solid rgba(45,212,191,0.18)",
                                  padding: "3px 10px",
                                  borderRadius: 8,
                                }}
                              >
                                + R${" "}
                                {Number(venda.amount).toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: "rgba(255,255,255,0.35)",
                                }}
                              >
                                {horario}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSaleToDelete(venda.id)}
                                style={{
                                  padding: "4px 6px",
                                  borderRadius: 6,
                                  background: "transparent",
                                  border: "none",
                                  cursor: "pointer",
                                  color: "rgba(255,255,255,0.25)",
                                  transition: "color 0.15s, background 0.15s",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                                title="Excluir Venda"
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
                                  (e.currentTarget as HTMLButtonElement).style.background =
                                    "rgba(239,68,68,0.1)";
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLButtonElement).style.color =
                                    "rgba(255,255,255,0.25)";
                                  (e.currentTarget as HTMLButtonElement).style.background =
                                    "transparent";
                                }}
                              >
                                <Icon icon="mdi:delete" style={{ fontSize: 15 }} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
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
                <Icon
                  icon="line-md:alert-circle-loop"
                  className="h-6 w-6 flex-shrink-0 text-red-400"
                />
                <h3 className="text-lg font-black text-white">Limpar Histórico por Mês</h3>
              </div>

              <p className="text-sm text-neutral-400">
                Selecione o mês que deseja apagar permanentemente:
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase text-neutral-500">Mês</label>
                  <select
                    value={deleteMonth}
                    onChange={(e) => setDeleteMonth(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2.5 text-sm text-white outline-none focus:border-red-500/50"
                  >
                    {MESES_LONGOS.map((m, i) => (
                      <option key={i} value={i + 1} className="bg-neutral-900">
                        {m}
                      </option>
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
                      <option key={y} value={y} className="bg-neutral-900">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <Icon
                  icon="mdi:information-outline"
                  className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0"
                />
                <p className="text-xs text-red-300 leading-relaxed">
                  Todas as vendas de{" "}
                  <strong className="text-white">
                    {MESES_LONGOS[deleteMonth - 1]}/{deleteYear}
                  </strong>{" "}
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
                    <>
                      <Icon icon="line-md:loading-loop" className="h-4 w-4" /> Excluindo...
                    </>
                  ) : (
                    <>
                      <Icon icon="mdi:trash-can" className="h-4 w-4" /> Apagar mês
                    </>
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
                <Icon
                  icon="line-md:alert-circle-loop"
                  className="h-6 w-6 flex-shrink-0 text-amber-400"
                />
                <h3 className="text-lg font-black text-white">Excluir Venda?</h3>
              </div>

              <p className="text-sm text-neutral-400 leading-relaxed">
                Tem certeza que deseja excluir permanentemente esta venda? Essa ação recalculará as
                metas da Home imediatamente.
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
