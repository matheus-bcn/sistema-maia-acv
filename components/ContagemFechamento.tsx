"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Timer } from "lucide-react";

export function ContagemFechamento() {
  const { diasRestantes, pctPassado } = useMemo(() => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    
    // Calcula o total de dias do mês e o dia atual
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
    const diaAtual = hoje.getDate();
    
    const restante = totalDiasMes - diaAtual;
    const pct = (diaAtual / totalDiasMes) * 100;
    
    return { diasRestantes: restante, pctPassado: pct };
  }, []);

  return (
    <div className="glass-card relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-6 flex items-center justify-between h-full min-h-[114px]">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Timer className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Fechamento do Mês
          </span>
        </div>
        
        <div className="flex items-baseline gap-1.5 mt-2">
          <span className="text-3xl font-black text-white tabular-nums tracking-tight">
            {diasRestantes}
          </span>
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
            Dias Restantes
          </span>
        </div>
      </div>
      
      {/* Círculo de progresso na paleta correta da página */}
      <div className="relative h-16 w-16">
        <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 36 36">
          <circle
            className="text-neutral-800"
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
          />
          <motion.circle
            className="text-emerald-400"
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeDasharray="100, 100"
            initial={{ strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: 100 - pctPassado }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>
        <Timer className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 text-neutral-600" />
      </div>
    </div>
  );
}