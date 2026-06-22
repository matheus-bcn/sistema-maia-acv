"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  AlertCircle,
  RefreshCw,
  X 
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listSellers } from "@/lib/data/sellers";
import { updateSellerStatusAction } from "@/lib/actions/sellers";
import { deletarVendedorAction } from "@/lib/actions/equipe"; 
import { SellerCard } from "@/components/SellerCard";
import { VendedorModal } from "@/components/VendedorModal";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { VendedorPainelDrawer } from "@/components/VendedorPainelDrawer";
import type { Seller, SellerStatus } from "@/types";

const SkeletonSeller = () => (
  <div className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02] flex flex-col gap-4 animate-pulse">
    <div className="flex items-center gap-4">
      <div className="h-12 w-12 rounded-full bg-white/10" />
      <div className="space-y-2 flex-1">
        <div className="h-4 w-3/4 bg-white/10 rounded" />
        <div className="h-3 w-1/2 bg-white/10 rounded" />
      </div>
    </div>
    <div className="space-y-2 mt-2">
      <div className="h-8 w-full bg-white/10 rounded-md" />
    </div>
  </div>
);

export default function EquipePage() {
  const supabase = useMemo(() => createClient(), []);

  const [filtroStatus, setFiltroStatus] = useState<"Todos" | SellerStatus>("Todos");
  const [equipe, setEquipe] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado para o modal de Edição/Criação
  const [modalOpen, setModalOpen] = useState(false);
  const [sellerToEdit, setSellerToEdit] = useState<Seller | null>(null);

  const [deleteModal, setDeleteModal] = useState<{ open: boolean; seller: Seller | null }>({
    open: false,
    seller: null,
  });
  const [painelSeller, setPainelSeller] = useState<Seller | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await listSellers(supabase, filtroStatus);
      // RESOLVIDO: O "(s as any)" avisa o TypeScript para ignorar o alerta
      setEquipe(data.filter(s => !(s as any).is_deleted));
    } catch (err) {
      console.error("Falha ao carregar equipe:", err);
      setError("Não foi possível carregar a equipa. Verifique a sua conexão ou permissões.");
    } finally {
      setLoading(false);
    }
  }, [supabase, filtroStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleStatus = async (id: string, current: SellerStatus) => {
    const originalEquipe = [...equipe];
    const next = current === "Ativo" ? "Inativo" : "Ativo";

    setEquipe(equipe.map(s => s.id === id ? { ...s, status: next } : s));
    setError(null);

    try {
      await updateSellerStatusAction(id, next);
    } catch (err) {
      setError("Não foi possível atualizar o status do vendedor. A alteração foi revertida.");
      setEquipe(originalEquipe);
    }
  };

  // NOVO: Função que é chamada quando o utilizador clica em "Confirmar" no Modal
  const confirmDelete = async () => {
    if (!deleteModal.seller) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await deletarVendedorAction(deleteModal.seller.id);
      if (res.success) {
        setDeleteModal({ open: false, seller: null }); // Fecha o modal após o sucesso
        load(); // Atualiza a lista
      } else {
        setError(res.error || "Erro desconhecido ao tentar excluir.");
        setDeleteModal({ open: false, seller: null });
        setLoading(false);
      }
    } catch (err: any) {
      setError("Erro Crítico: " + (err.message || "Falha ao comunicar com o servidor."));
      setDeleteModal({ open: false, seller: null });
      setLoading(false);
    }
  };

  const handleEdit = (seller: Seller) => {
    setSellerToEdit(seller);
    setModalOpen(true);
  };

  const handleNewSeller = () => {
    setSellerToEdit(null);
    setModalOpen(true);
  };

  return (
    <>
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-neutral-400" />
            Gestão de Equipa
          </h2>
          <p className="text-neutral-400 mt-1">Administre os acessos e perfis dos vendedores</p>
        </div>
        <button
          type="button"
          onClick={handleNewSeller}
          className="flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-bold text-black shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all hover:bg-neutral-200 hover:scale-105"
        >
          <UserPlus className="h-5 w-5" />
          Novo Vendedor
        </button>
      </header>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error-alert"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center p-6 rounded-xl border border-red-500/20 bg-red-500/5 backdrop-blur-md text-center max-w-3xl mx-auto mb-8"
          >
            <AlertCircle className="h-8 w-8 text-red-400 mb-3 animate-pulse" />
            <p className="text-sm text-neutral-300 mb-4">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white font-semibold rounded-md border border-white/10 hover:bg-white/20 transition-all text-sm"
            >
              <X className="h-4 w-4" /> Fechar Aviso
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 mb-8 bg-white/5 p-1 rounded-lg w-max border border-white/10">
        {(["Todos", "Ativo", "Inativo"] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFiltroStatus(status)}
            className={`px-5 py-2 text-sm font-semibold rounded-md transition-all ${
              filtroStatus === status
                ? "bg-white text-black shadow-sm"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {loading && equipe.length === 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <SkeletonSeller />
          <SkeletonSeller />
          <SkeletonSeller />
        </div>
      ) : equipe.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
          <Users className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white">Nenhum vendedor encontrado</h3>
          <p className="text-neutral-400 text-sm mt-1">Ajuste os filtros ou cadastre um novo membro na equipa.</p>
        </div>
      ) : (
        <motion.div layout className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {equipe.map((membro) => (
              <motion.div
                key={membro.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <SellerCard
                  seller={membro}
                  onToggleStatus={toggleStatus}
                  onEdit={() => handleEdit(membro)}
                  onDelete={() => setDeleteModal({ open: true, seller: membro })}
                  onViewPanel={() => setPainelSeller(membro)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      <VendedorModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        sellerToEdit={sellerToEdit}
        onSuccess={load} 
      />

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <ConfirmDeleteModal
        isOpen={deleteModal.open}
        sellerName={deleteModal.seller?.name || ""}
        loading={loading}
        onClose={() => setDeleteModal({ open: false, seller: null })}
        onConfirm={confirmDelete}
      />

      {/* PAINEL DO VENDEDOR (admin view) */}
      <VendedorPainelDrawer
        seller={painelSeller}
        onClose={() => setPainelSeller(null)}
      />
    </>
  );
}