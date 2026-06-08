"use client"

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, X, Zap, TrendingUp, AlertTriangle, PartyPopper, Lightbulb } from "lucide-react";

type InsightTipo = "ALERTA" | "PARABENS" | "DICA" | "NEUTRO";

interface MaiaBriefingProps {
  show: boolean;
  message: {
    titulo: string;
    briefing: string;
    acao: string;
    tipo?: InsightTipo;
  } | null;
  onClose: () => void;
}

const CONFIG: Record<InsightTipo, { icon: React.ElementType; cor: string; badge: string; borderColor: string }> = {
  ALERTA:   { icon: AlertTriangle, cor: "#f97316", badge: "⚠️ Atenção",    borderColor: "rgba(249,115,22,0.35)" },
  PARABENS: { icon: PartyPopper,   cor: "#a855f7", badge: "🎉 Parabéns",   borderColor: "rgba(168,85,247,0.35)" },
  DICA:     { icon: Lightbulb,     cor: "#facc15", badge: "💡 Dica",        borderColor: "rgba(250,204,21,0.35)" },
  NEUTRO:   { icon: TrendingUp,    cor: "#60a5fa", badge: "📊 Análise",     borderColor: "rgba(96,165,250,0.35)" },
};

const AUTO_DISMISS_MS = 5000;

export function MaiaBriefing({ show, message, onClose }: MaiaBriefingProps) {
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!show) {
      setProgress(100);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    setProgress(100);
    const start = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100));
    }, 50);

    timerRef.current = setTimeout(() => onClose(), AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [show, message, onClose]);

  if (!message) return null;

  const tipo: InsightTipo = (message as any).tipo ?? "NEUTRO";
  const cfg = CONFIG[tipo];
  const Icon = cfg.icon;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9, transition: { duration: 0.2 } }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className="fixed bottom-24 left-3 right-3 md:bottom-10 md:left-auto md:right-10 md:w-96 z-[100]"
        >
          <div
            className="rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: "rgba(10,12,20,0.94)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: `1px solid ${cfg.borderColor}`,
              boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 4px 24px ${cfg.cor}22`,
            }}
          >
            {/* Barra countdown */}
            <div className="h-0.5 w-full bg-white/5 relative overflow-hidden">
              <div
                className="h-full absolute left-0 top-0 transition-none"
                style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${cfg.cor}, ${cfg.cor}66)` }}
              />
            </div>

            <div className="p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl flex-shrink-0"
                    style={{ background: `${cfg.cor}1a`, border: `1px solid ${cfg.cor}30` }}>
                    <Icon className="h-5 w-5" style={{ color: cfg.cor }} />
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest block mb-0.5"
                      style={{ color: cfg.cor }}>M.A.I.A · {cfg.badge}</span>
                    <p className="text-sm font-bold text-white leading-tight">{message.titulo}</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 ml-2">
                  <X className="h-3.5 w-3.5 text-white/40 hover:text-white" />
                </button>
              </div>

              {/* Briefing */}
              <p className="text-sm text-white/70 leading-relaxed mb-4">{message.briefing}</p>

              {/* Ação */}
              <div className="rounded-xl p-3 flex gap-3 items-start"
                style={{ background: `${cfg.cor}0d`, border: `1px solid ${cfg.cor}20` }}>
                <Zap className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: cfg.cor }} />
                <p className="text-xs text-white/60 leading-relaxed">
                  <strong className="block mb-0.5" style={{ color: cfg.cor }}>Ação Sugerida</strong>
                  {message.acao}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: cfg.cor }} />
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: `${cfg.cor}99` }}>
                    Análise em tempo real
                  </span>
                </div>
                <BrainCircuit className="h-3.5 w-3.5 text-white/20" />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
