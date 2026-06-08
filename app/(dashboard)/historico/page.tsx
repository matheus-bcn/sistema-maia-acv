"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";

const DATE_INPUT_CLASS =
  "w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-all cursor-pointer " +
  "[color-scheme:dark] bg-white/5 border border-white/10 focus:border-violet-500/50 focus:bg-white/8";
import { createClient } from "@/lib/supabase/client";
import { listSales } from "@/lib/data/sales";
import { deleteSaleAction, deleteAllSalesAction } from "@/lib/actions/sales"; 
import type { Sale } from "@/types";

const SkeletonRow = () => (
  <tr className="animate-pulse border-b border-white/5 bg-white/[0.01]">
    <td className="px-6 py-4"><div className="h-4 w-16 bg-white/10 rounded" /></td>
    <td className="px-6 py-4"><div className="h-4 w-24 bg-white/10 rounded" /></td>
    <td className="px-6 py-4"><div className="h-4 w-32 bg-white/10 rounded" /></td>
    <td className="px-6 py-4 text-center"><div className="h-4 w-16 mx-auto bg-white/10 rounded" /></td>
    <td className="px-6 py-4 text-center"><div className="h-4 w-16 mx-auto bg-white/10 rounded" /></td>
    <td className="px-6 py-4 flex justify-end"><div className="h-4 w-20 bg-white/10 rounded" /></td>
    <td className="px-6 py-4"><div className="h-6 w-16 mx-auto bg-white/10 rounded-full" /></td>
    <td className="px-6 py-4 text-center"><div className="h-4 w-6 mx-auto bg-white/10 rounded" /></td>
  </tr>
);

export default function HistoricoPage() {
  const supabase = useMemo(() => createClient(), []);

  const [busca, setBusca] = useState("");
  const [vendas, setVendas] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados dos Modais
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Estados dos Dropdowns
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);

  // Filtros funcionais
  const [statusSelecionado, setStatusSelecionado] = useState<string>("Todos");
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date();
    return {
      inicio: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      fim: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    };
  });

  const carregarVendas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSales(supabase, { 
        limit: 500,
        startDate: periodo.inicio,
        endDate: periodo.fim
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
      const result = await deleteAllSalesAction(periodo.inicio, periodo.fim);
      if (result?.error) {
        alert(`Erro ao limpar mês: ${result.error}`);
      } else {
        setVendas([]);
      }
    } catch (err) {
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

    const atendeBusca = !termo || nome.includes(termo) || idStr.includes(termo) || cliente.includes(termo) || pdv.includes(termo);
    const atendeStatus = statusSelecionado === "Todos" || (v as any).status === statusSelecionado;

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

  return (
    <>
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <Icon icon="line-md:watch-loop" className="h-8 w-8 text-neutral-400" />
            Histórico de Vendas
          </h2>
          <p className="text-neutral-400 mt-1">Auditoria e registro de faturamento da equipe</p>
        </div>
        
        <div className="flex gap-2">
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
            className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon icon="mdi:download" className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </header>

      <div className="glass-card rounded-xl p-4 mb-6 border border-white/5 flex flex-col md:flex-row gap-3 md:items-center bg-white/[0.02] relative z-20">
        <div className="relative flex-1 min-w-0">
          <Icon icon="line-md:search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Buscar por vendedor, cliente, OS/PDV ou ID..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-white/30 text-white placeholder:text-neutral-500 transition-all"
          />
        </div>
        
        <div className="relative">
          <button 
            type="button" 
            onClick={() => {
              setShowDateFilter(!showDateFilter);
              setShowStatusFilter(false);
            }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
              showDateFilter ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-neutral-300 hover:bg-white/5"
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
                  <button onClick={() => setShowDateFilter(false)} className="text-neutral-500 hover:text-white">
                    <Icon icon="line-md:close" className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-400 uppercase font-semibold">Início</label>
                  <input 
                    type="date" 
                    value={periodo.inicio}
                    onChange={(e) => setPeriodo(prev => ({ ...prev, inicio: e.target.value }))}
                    className="bg-black border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer invert-[0.8] brightness-200"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-neutral-400 uppercase font-semibold">Fim</label>
                  <input 
                    type="date" 
                    value={periodo.fim}
                    onChange={(e) => setPeriodo(prev => ({ ...prev, fim: e.target.value }))}
                    className="bg-black border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 cursor-pointer invert-[0.8] brightness-200"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <button 
            type="button" 
            onClick={() => {
              setShowStatusFilter(!showStatusFilter);
              setShowDateFilter(false);
            }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
              showStatusFilter || statusSelecionado !== "Todos" ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-neutral-300 hover:bg-white/5"
            }`}
          >
            <Icon icon="mdi:filter" className="h-4 w-4 text-neutral-400" />
            {statusSelecionado !== "Todos" ? statusSelecionado : "Mais Filtros"}
          </button>

          <AnimatePresence>
            {showStatusFilter && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute right-0 top-full mt-2 w-48 bg-[#111] border border-white/10 rounded-xl p-2 shadow-2xl z-50 flex flex-col gap-1"
              >
                <div className="flex justify-between items-center px-2 py-1 mb-1">
                  <span className="text-xs font-bold text-neutral-400 uppercase">Status da Venda</span>
                  <button onClick={() => setShowStatusFilter(false)} className="text-neutral-500 hover:text-white">
                    <Icon icon="line-md:close" className="h-3 w-3" />
                  </button>
                </div>
                {["Todos", "Aprovado", "Concluída", "Pendente", "Cancelado"].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setStatusSelecionado(status);
                      setShowStatusFilter(false);
                    }}
                    className={`text-left px-3 py-2 text-sm rounded-md transition-colors ${
                      statusSelecionado === status ? "bg-white/10 text-white font-bold" : "text-neutral-300 hover:bg-white/5"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden border border-white/5 bg-white/[0.02] relative z-10">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-white/5 text-neutral-400 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 font-semibold">Data</th>
                <th className="px-6 py-4 font-semibold">Vendedor</th>
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold text-center">OS/PDV</th>
                <th className="px-6 py-4 font-semibold text-center">Canal</th>
                <th className="px-6 py-4 font-semibold text-right">Valor</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Ações</th>
              </tr>
            </thead>
            
            <AnimatePresence mode="wait">
              {error ? (
                <tbody>
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center p-6 rounded-xl border border-red-500/20 bg-red-500/5 max-w-lg mx-auto"
                      >
                        <Icon icon="line-md:alert-circle-loop" className="icon-always h-8 w-8 text-red-400 mb-3" />
                        <p className="text-sm text-neutral-300 mb-4">{error}</p>
                        <button
                          type="button"
                          onClick={carregarVendas}
                          className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white font-semibold rounded-md border border-white/10 hover:bg-white/20 transition-all text-sm"
                        >
                          <Icon icon="mdi:reload" className="h-4 w-4" /> Tentar Novamente
                        </button>
                      </motion.div>
                    </td>
                  </tr>
                </tbody>
              ) : loading ? (
                <motion.tbody
                  key="loading-tbody"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="divide-y divide-white/5"
                >
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </motion.tbody>
              ) : vendasFiltradas.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={8} className="p-16 text-center">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center text-neutral-500"
                      >
                        <Icon icon="mdi:file-spreadsheet" className="h-12 w-12 mb-3 opacity-20" />
                        <p className="text-lg font-semibold text-neutral-400">Nenhum registro encontrado</p>
                        <p className="text-sm mt-1">Ajuste os filtros ou os termos de busca.</p>
                      </motion.div>
                    </td>
                  </tr>
                </tbody>
              ) : (
                <motion.tbody
                  key="content-tbody"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="divide-y divide-white/5"
                >
                  {vendasFiltradas.map((venda) => (
                    <tr key={venda.id} className="hover:bg-white/[0.04] transition-colors">
                      <td className="px-6 py-4 text-neutral-300 font-medium">
                        {new Date((venda as any).sale_date || venda.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 font-bold text-white">
                        {venda.seller?.name ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-neutral-300 max-w-[180px]">
                        <span className="truncate block" title={(venda as any).customer_name ?? ""}>
                          {(venda as any).customer_name || <span className="text-neutral-600 italic text-xs">—</span>}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-xs text-neutral-400">
                        {(venda as any).pdv_number || "—"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-sm tracking-wider ${
                          (venda as any).channel === "atendimento"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        }`}>
                          {(venda as any).channel ?? "Comercial"}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-purple-400 text-right tracking-tight">
                        R$ {Number(venda.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-sm tracking-wider ${
                          (venda.status as string) === "Aprovado" || (venda.status as string) === "Concluída"
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" 
                            : (venda.status as string) === "Cancelado"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                        }`}>
                          {venda.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSaleToDelete(venda.id)} 
                          className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                          title="Excluir Venda"
                        >
                          <Icon icon="mdi:delete" className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </motion.tbody>
              )}
            </AnimatePresence>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isDeleteAllModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-sm rounded-2xl p-6 border border-red-500/30 bg-neutral-900 text-white space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-red-400">
                <Icon icon="line-md:alert-circle-loop" className="icon-always h-6 w-6 flex-shrink-0 text-red-400" />
                <h3 className="text-lg font-black text-white">Limpar Mês Inteiro?</h3>
              </div>
              
              <p className="text-sm text-neutral-400 leading-relaxed">
                Tem certeza? Você está prestes a apagar <strong>permanentemente</strong> todas as {vendas.length} vendas cadastradas entre <span className="text-white">{periodo.inicio.split('-').reverse().join('/')}</span> e <span className="text-white">{periodo.fim.split('-').reverse().join('/')}</span>.
              </p>
              
              <div className="flex justify-end gap-3 pt-2">
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
                  {isDeletingAll ? <Icon icon="line-md:loading-loop" className="icon-always h-4 w-4" /> : <Icon icon="mdi:trash-can" className="h-4 w-4" />}
                  {isDeletingAll ? "Excluindo..." : "Sim, apagar tudo"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {saleToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-sm rounded-2xl p-6 border border-white/20 bg-neutral-900 text-white space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-amber-400">
                <Icon icon="line-md:alert-circle-loop" className="icon-always h-6 w-6 flex-shrink-0 text-amber-400" />
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