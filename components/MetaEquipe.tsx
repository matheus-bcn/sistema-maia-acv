"use client"

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
  const porcentagem = meta > 0 ? Math.min((faturado / meta) * 100, 100) : 0;
  const isBatida = faturado >= meta;
  const mesAtual = MESES[new Date().getMonth()];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-6 mb-6 border border-white/10 relative overflow-hidden"
    >
      {isBatida && (
        <div className="absolute inset-0 bg-emerald-500/10 animate-pulse" />
      )}

      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            Objetivo Global ({mesAtual})
            {isBatida && <span className="text-xl">🏆</span>}
          </h3>
          <p className="text-sm text-neutral-400 mt-1">
            Meta: R$ {meta.toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="text-left md:text-right">
          <p
            className={`text-4xl font-black tracking-tighter ${
              isBatida
                ? "text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]"
                : "text-white"
            }`}
          >
            {porcentagem.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="h-5 w-full bg-black/50 rounded-full overflow-hidden border border-white/10 relative z-10 shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${porcentagem}%` }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
          className={`h-full rounded-full relative ${
            isBatida
              ? "bg-gradient-to-r from-emerald-500 to-emerald-300 shadow-[0_0_20px_rgba(52,211,153,1)]"
              : "bg-gradient-to-r from-blue-600 to-indigo-400"
          }`}
        >
          <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-white/30 rounded-full" />
        </motion.div>
      </div>

      {isBatida && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="text-sm text-emerald-400 font-bold mt-4 text-center z-10 relative"
        >
          🎉 META BATIDA! Vocês são imbatíveis!
        </motion.p>
      )}
    </motion.div>
  );
}
