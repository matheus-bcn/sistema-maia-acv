"use client"

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Target } from "lucide-react";

interface MetaEquipeProps {
  faturado: number;
  meta: number;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function MetaEquipe({ faturado, meta }: MetaEquipeProps) {
  const [mesAtual, setMesAtual] = useState("Mês Atual");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMesAtual(MESES[new Date().getMonth()]);
    setMounted(true);
  }, []);

  const porcentagem = meta > 0 ? Math.min((faturado / meta) * 100, 100) : 0;
  const isBatida = faturado >= meta && meta > 0;

  if (!mounted) return <div className="h-28 w-full mb-4 glass-card rounded-2xl animate-pulse" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-5 mb-4 relative overflow-hidden"
      style={{
        border: isBatida
          ? "1px solid rgba(168,85,247,0.4)"
          : "1px solid rgba(249,115,22,0.2)",
      }}
    >
      {/* Glow de fundo quando meta batida */}
      {isBatida && <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-pink-500/5 pointer-events-none" />}

      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl icon-badge-orange">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Objetivo Global — {mesAtual}
              {isBatida && <span>🔥</span>}
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              Meta: R$ {meta.toLocaleString("pt-BR")}
            </p>
          </div>
        </div>
        <p className={`text-3xl font-black tracking-tighter ${isBatida ? "text-gradient-purple" : "text-gradient-orange"}`}>
          {porcentagem.toFixed(1)}%
        </p>
      </div>

      <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 relative z-10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${porcentagem}%` }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.4 }}
          className="h-full rounded-full relative"
          style={{
            background: isBatida
              ? "linear-gradient(90deg, #7c3aed, #ec4899)"
              : "linear-gradient(90deg, #f97316, #eab308)",
            boxShadow: isBatida
              ? "0 0 20px rgba(168,85,247,0.6)"
              : "0 0 20px rgba(249,115,22,0.5)",
          }}
        >
          <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/30 rounded-full" />
        </motion.div>
      </div>

      {isBatida && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="text-xs text-violet-400 font-bold mt-3 text-center z-10 relative"
        >
          🎉 LEVEL UP! META SUPERADA!
        </motion.p>
      )}
    </motion.div>
  );
}
