"use client"

import { motion, AnimatePresence, Variants } from "framer-motion";
import { BrainCircuit, X } from "lucide-react";

interface MaiaBriefingProps {
  show: boolean;
  message: string;
  onClose: () => void;
}

const cardVariants: Variants = {
  hidden: { opacity: 0, x: 100, scale: 0.9 },
  visible: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 50, scale: 0.9 },
};

const TEXTS = {
  intelligence: "M.A.I.A Intelligence",
  title: "Insight em Tempo Real",
  status: "Análise Concluída",
  close: "Fechar",
};

export function MaiaBriefing({ show, message, onClose }: MaiaBriefingProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed bottom-10 right-10 z-[100] w-85 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        >
          {/* Card com Glassmorphism Pesado */}
          <div className="bg-neutral-900/80 backdrop-blur-2xl border border-white/20 rounded-3xl p-5 relative overflow-hidden">
            
            {/* Efeito de brilho sutil no topo */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="bg-white p-1.5 rounded-xl shadow-[0_0_15px_rgba(255,255,255,0.4)]">
                  <BrainCircuit className="h-4 w-4 text-black" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
                  {TEXTS.intelligence}
                </span>
              </div>
              <button 
                onClick={onClose} 
                aria-label={TEXTS.close}
                className="p-1 hover:bg-white/10 rounded-full transition-colors group"
              >
                <X className="h-4 w-4 text-white/30 group-hover:text-white" />
              </button>
            </div>
            
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                {TEXTS.title}
              </h4>
              <p className="text-xs text-neutral-300 leading-relaxed font-medium">
                {message}
              </p>
            </div>

            {/* Indicador de "Lida" na parte inferior */}
            <div className="mt-4 flex items-center gap-1">
              <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[8px] font-bold text-emerald-500/80 uppercase">{TEXTS.status}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}