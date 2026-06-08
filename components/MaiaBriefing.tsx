"use client"

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";

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

const CONFIG: Record<InsightTipo, { icon: string; cor: string; badge: string; borderColor: string }> = {
  ALERTA:   { icon: "line-md:alert-circle-loop", cor: "#f97316", badge: "⚠️ Atenção",   borderColor: "rgba(249,115,22,0.35)" },
  PARABENS: { icon: "mdi:party-popper",          cor: "#a855f7", badge: "🎉 Parabéns",  borderColor: "rgba(168,85,247,0.35)" },
  DICA:     { icon: "mdi:lightbulb",             cor: "#facc15", badge: "💡 Dica",       borderColor: "rgba(250,204,21,0.35)" },
  NEUTRO:   { icon: "mdi:trending-up",           cor: "#60a5fa", badge: "📊 Análise",    borderColor: "rgba(96,165,250,0.35)" },
};

const AUTO_DISMISS_MS = 5000;

export function MaiaBriefing({ show, message, onClose }: MaiaBriefingProps) {
  const [progress, setProgress] = useState(100);
  const [modalOpen, setModalOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => {
    if (!show || modalOpen) {
      if (!modalOpen) setProgress(100);
      clearTimers();
      return;
    }

    setProgress(100);
    const start = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100));
    }, 50);

    timerRef.current = setTimeout(() => onClose(), AUTO_DISMISS_MS);

    return clearTimers;
  }, [show, message, onClose, modalOpen]);

  const handleCardClick = () => {
    clearTimers();
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    onClose();
  };

  if (!message) return null;

  const tipo: InsightTipo = (message as any).tipo ?? "NEUTRO";
  const cfg = CONFIG[tipo];

  return (
    <>
      {/* Toast de 5 segundos */}
      <AnimatePresence>
        {show && !modalOpen && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="fixed bottom-24 left-3 right-3 md:bottom-10 md:left-auto md:right-10 md:w-96 z-[100] cursor-pointer"
            onClick={handleCardClick}
          >
            <div
              className="rounded-2xl overflow-hidden shadow-2xl hover:scale-[1.02] transition-transform"
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
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl flex-shrink-0"
                    style={{ background: `${cfg.cor}1a`, border: `1px solid ${cfg.cor}30` }}>
                    <Icon icon={cfg.icon} className="h-5 w-5" style={{ color: cfg.cor }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-black uppercase tracking-widest block mb-0.5"
                      style={{ color: cfg.cor }}>M.A.I.A · {cfg.badge}</span>
                    <p className="text-sm font-bold text-white leading-tight truncate">{message.titulo}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[9px] text-white/30 hidden sm:block">clique para ler</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onClose(); }}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <Icon icon="line-md:close" className="h-3.5 w-3.5 text-white/40 hover:text-white" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal expandido */}
      <AnimatePresence>
        {modalOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
              onClick={handleModalClose}
            />

            {/* Card modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[480px] z-[120]"
            >
              <div
                className="rounded-3xl overflow-hidden shadow-2xl"
                style={{
                  background: "rgba(8,10,18,0.97)",
                  backdropFilter: "blur(32px)",
                  WebkitBackdropFilter: "blur(32px)",
                  border: `1px solid ${cfg.borderColor}`,
                  boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 8px 32px ${cfg.cor}30`,
                }}
              >
                {/* Linha de cor no topo */}
                <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${cfg.cor}, ${cfg.cor}44)` }} />

                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl flex-shrink-0"
                        style={{ background: `${cfg.cor}18`, border: `1px solid ${cfg.cor}35` }}>
                        <Icon icon={cfg.icon} className="h-6 w-6" style={{ color: cfg.cor }} />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest block mb-1"
                          style={{ color: cfg.cor }}>M.A.I.A · {cfg.badge}</span>
                        <p className="text-base font-black text-white leading-tight">{message.titulo}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleModalClose}
                      className="p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0 ml-3 border border-white/10"
                    >
                      <Icon icon="line-md:close" className="h-4 w-4 text-white/50 hover:text-white" />
                    </button>
                  </div>

                  {/* Separador */}
                  <div className="h-px mb-5" style={{ background: `linear-gradient(90deg, ${cfg.cor}30, transparent)` }} />

                  {/* Briefing */}
                  <p className="text-sm text-white/75 leading-relaxed mb-5">{message.briefing}</p>

                  {/* Ação */}
                  <div className="rounded-2xl p-4 flex gap-3 items-start mb-5"
                    style={{ background: `${cfg.cor}10`, border: `1px solid ${cfg.cor}25` }}>
                    <Icon icon="mdi:lightning-bolt" className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: cfg.cor }} />
                    <div>
                      <strong className="text-xs font-black uppercase tracking-wider block mb-1" style={{ color: cfg.cor }}>
                        Ação Sugerida
                      </strong>
                      <p className="text-sm text-white/70 leading-relaxed">{message.acao}</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: cfg.cor }} />
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${cfg.cor}80` }}>
                        Análise em tempo real · M.A.I.A
                      </span>
                    </div>
                    <button
                      onClick={handleModalClose}
                      className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                      style={{ background: `${cfg.cor}20`, border: `1px solid ${cfg.cor}35`, color: cfg.cor }}
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
