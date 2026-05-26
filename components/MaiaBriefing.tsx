"use client"

import { motion, AnimatePresence, Variants } from "framer-motion";
import { BrainCircuit, X } from "lucide-react";

interface MaiaBriefingProps {
  show: boolean;
  message: string;
  onClose: () => void;
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 50, scale: 0.8 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    // FÍSICA APPLE/SPRING: Deixa a entrada orgânica e "elástica"
    transition: { type: "spring", stiffness: 400, damping: 25 } 
  },
  exit: { 
    opacity: 0, 
    scale: 0.8, 
    y: 20,
    transition: { duration: 0.2 } 
  },
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
          <div className="bg-neutral-900/80 backdrop-blur-2xl border border-primary/30 rounded-3xl p-5 relative overflow-hidden group">
            
            {/* Efeito Hover do Pop-up (Aumenta o brilho roxo) */}
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="flex items-center justify-between mb-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="bg-primary p-1.5 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                  <BrainCircuit className="h-4 w-4 text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                  {TEXTS.intelligence}
                </span>
              </div>
              <button 
                onClick={onClose} 
                aria-label={TEXTS.close}
                className="p-1 hover:bg-white/10 rounded-full transition-colors group/btn active:scale-90"
              >
                <X className="h-4 w-4 text-neutral-400 group-hover/btn:text-white" />
              </button>
            </div>
            
            <div className="space-y-1 relative z-10">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                {TEXTS.title}
              </h4>
              <p className="text-xs text-neutral-300 leading-relaxed font-medium">
                {message}
              </p>
            </div>

            <div className="mt-4 flex items-center gap-1 relative z-10">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></div>
              <span className="text-[8px] font-bold text-primary/80 uppercase tracking-wider">{TEXTS.status}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}