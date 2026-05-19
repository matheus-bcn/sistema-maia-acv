"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, DollarSign, ShoppingBag, TrendingUp } from "lucide-react";

interface PerfilVendedorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellerStats: {
    name: string;
    totalSales: number;
    salesCount: number;
  } | null;
}

export function PerfilVendedorModal({ isOpen, onClose, sellerStats }: PerfilVendedorModalProps) {
  // Proteção contra o erro 'charAt' (se não houver dados, não renderiza)
  if (!isOpen || !sellerStats) return null;

  // Cálculo automático do Ticket Médio
  const ticketMedio = sellerStats.salesCount > 0 
    ? sellerStats.totalSales / sellerStats.salesCount 
    : 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="glass-card w-full max-w-md rounded-2xl p-6 border border-white/20 bg-neutral-900 text-white shadow-2xl relative overflow-hidden"
        >
          {/* Efeito de brilho de fundo */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-emerald-500/20 to-transparent -z-10" />

          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white bg-black/20 hover:bg-white/10 rounded-full transition-all"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col items-center mt-2 mb-6">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-3xl font-black text-black border-4 border-neutral-900 shadow-[0_0_20px_rgba(52,211,153,0.3)] mb-4 uppercase">
              {sellerStats.name?.charAt(0) || "V"}
            </div>
            <h3 className="text-2xl font-black tracking-tight">{sellerStats.name}</h3>
            <div className="flex items-center gap-1.5 text-emerald-400 mt-2 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
              <Trophy className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Vendedor Destaque</span>
            </div>
          </div>

          {/* CARDS DE MÉTRICAS */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/50 border border-white/5 rounded-xl p-4 flex flex-col items-center text-center hover:bg-white/5 transition-colors">
              <DollarSign className="h-5 w-5 text-emerald-400 mb-2" />
              <span className="text-[10px] text-neutral-400 font-bold uppercase mb-1">Total Faturado</span>
              <span className="text-lg font-black text-white">
                R$ {sellerStats.totalSales.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            
            <div className="bg-black/50 border border-white/5 rounded-xl p-4 flex flex-col items-center text-center hover:bg-white/5 transition-colors">
              <ShoppingBag className="h-5 w-5 text-blue-400 mb-2" />
              <span className="text-[10px] text-neutral-400 font-bold uppercase mb-1">Qtd. Vendas</span>
              <span className="text-lg font-black text-white">
                {sellerStats.salesCount} <span className="text-xs text-neutral-500 font-medium">un.</span>
              </span>
            </div>

            <div className="col-span-2 bg-black/50 border border-white/5 rounded-xl p-4 flex items-center justify-between hover:bg-white/5 transition-colors mt-1">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <TrendingUp className="h-5 w-5 text-purple-400" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Ticket Médio por Venda</span>
                  <span className="text-xl font-black text-white">
                    R$ {ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}