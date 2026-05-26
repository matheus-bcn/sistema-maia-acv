"use client"

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

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

  if (!mounted) return <div className="h-32 w-full mb-6 glass-card rounded-xl border border-white/10 bg-white/[0.02] animate-pulse" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-6 mb-6 border border-purple-500/10 relative overflow-hidden"
    >
      {isBatida && <div className="absolute inset-0 bg-purple-500/10 animate-pulse" />}

      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            Objetivo Global ({mesAtual})
            {isBatida && <span className="text-xl">🔥</span>}
          </h3>
          <p className="text-sm text-neutral-400 mt-1">
            Meta: R$ {meta.toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="text-left md:text-right">
          <p className={`text-4xl font-black tracking-tighter ${isBatida ? "text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]" : "text-white"}`}>
            {porcentagem.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="h-5 w-full bg-black/60 rounded-full overflow-hidden border border-white/5 relative z-10 shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${porcentagem}%` }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
          className={`h-full rounded-full relative ${isBatida ? "bg-gradient-to-r from-purple-600 to-fuchsia-400 shadow-[0_0_20px_rgba(217,70,239,0.8)]" : "bg-gradient-to-r from-indigo-600 to-purple-500"}`}
        >
          <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-white/40 rounded-full" />
        </motion.div>
      </div>

      {isBatida && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="text-sm text-fuchsia-400 font-bold mt-4 text-center z-10 relative drop-shadow-md">
          🎉 LEVEL UP! A META FOI SUPERADA!
        </motion.p>
      )}
    </motion.div>
  );
}