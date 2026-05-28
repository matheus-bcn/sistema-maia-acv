"use client"

import { motion, AnimatePresence, Variants } from "framer-motion";
import { BrainCircuit, X, Zap } from "lucide-react";

interface MaiaBriefingProps {
  show: boolean;
  message: {
    titulo: string;
    briefing: string;
    acao: string;
  } | null;
  onClose: () => void;
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 50, scale: 0.8 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: "spring", stiffness: 400, damping: 25 } 
  },
  exit: { 
    opacity: 0, 
    scale: 0.8, 
    y: 20,
    transition: { duration: 0.2 } 
  },
};

export function MaiaBriefing({ show, message, onClose }: MaiaBriefingProps) {
  if (!message) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed bottom-10 right-10 z-[100] w-96 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        >
          <div className="bg-neutral-900/90 backdrop-blur-2xl border border-primary/30 rounded-3xl p-6 relative overflow-hidden group">
            
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

            <div className="flex items-start justify-between mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="bg-primary p-2 rounded-xl shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                  <BrainCircuit className="h-5 w-5 text-white"/>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary block">
                    M.A.I.A Intelligence
                  </span>
                  <span className="text-sm font-bold text-white leading-none mt-1 block">
                    {message.titulo}
                  </span>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-1 hover:bg-white/10 rounded-full transition-colors group/btn active:scale-90"
              >
                <X className="h-4 w-4 text-neutral-400 group-hover/btn:text-white"/>
              </button>
            </div>
            
            <div className="space-y-4 relative z-10">
              <p className="text-sm text-neutral-300 leading-relaxed font-medium">
                {message.briefing}
              </p>

              <div className="bg-black/50 border border-white/5 rounded-xl p-3 flex gap-3 items-start">
                <Zap className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0"/>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  <strong className="text-white block mb-0.5">Ação Sugerida:</strong>
                  {message.acao}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 relative z-10">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></div>
              <span className="text-[9px] font-bold text-primary/80 uppercase tracking-wider">
                Análise em tempo real
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}