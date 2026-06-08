"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Timer } from "lucide-react";

export function ContagemFechamento() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { diasRestantes, pctPassado } = useMemo(() => {
    if (!mounted) return { diasRestantes: 0, pctPassado: 0 };

    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
    const diaAtual = hoje.getDate();

    return {
      diasRestantes: totalDiasMes - diaAtual,
      pctPassado: (diaAtual / totalDiasMes) * 100,
    };
  }, [mounted]);

  if (!mounted) return <div className="kpi-blue rounded-2xl p-5 h-full min-h-[130px] animate-pulse" />;

  return (
    <div className="kpi-blue rounded-2xl p-5 flex flex-col gap-3 transition-all cursor-default h-full">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-blue-300/70">Fechamento</span>
        <div className="p-2 rounded-lg icon-badge-blue">
          <Timer className="h-4 w-4" />
        </div>
      </div>

      <div className="flex items-center justify-between flex-1">
        <div>
          <p className="text-3xl font-black tracking-tight text-gradient-blue">
            {diasRestantes}
            <span className="text-sm font-bold ml-1 text-blue-300/60">dias</span>
          </p>
          <span className="text-xs text-blue-300/50 font-medium">Restantes no mês</span>
        </div>

        <div className="relative h-14 w-14 flex-shrink-0">
          <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth="3.5" />
            <motion.circle
              cx="18" cy="18" r="16"
              fill="none"
              stroke="url(#blueGrad)"
              strokeWidth="3.5"
              strokeDasharray="100, 100"
              initial={{ strokeDashoffset: 100 }}
              animate={{ strokeDashoffset: 100 - pctPassado }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#818cf8" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-blue-500/30 to-transparent" />
    </div>
  );
}
