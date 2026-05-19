"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Trash2, Loader2 } from "lucide-react";

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sellerName: string;
  loading?: boolean;
}

export function ConfirmDeleteModal({ isOpen, onClose, onConfirm, sellerName, loading }: ConfirmDeleteModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="glass-card relative w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-950 p-8 shadow-2xl overflow-hidden"
          >
            {/* Efeito de Gradiente no fundo */}
            <div className="absolute -top-24 -right-24 h-48 w-48 bg-red-500/10 blur-[80px]" />
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20">
                <AlertTriangle className="h-8 w-8" />
              </div>

              <h3 className="mb-2 text-xl font-black text-white">Excluir Vendedor?</h3>
              
              <p className="mb-8 text-sm leading-relaxed text-neutral-400">
                Tem certeza que deseja remover <strong className="text-white">{sellerName}</strong>? 
                O login será excluído, mas o histórico de vendas permanecerá intacto nas estatísticas.
              </p>

              <div className="flex w-full gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 rounded-xl border border-white/5 bg-white/5 py-3 text-sm font-bold text-neutral-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={loading}
                  className="flex-[1.5] flex items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-black text-white shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all hover:bg-red-600 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Confirmar Exclusão
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}