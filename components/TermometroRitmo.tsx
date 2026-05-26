"use client"

import { useState, useEffect } from "react";
import { Target, Zap } from "lucide-react"

interface TermometroRitmoProps {
  meta: number
  faturado: number
}

export function TermometroRitmo({ meta, faturado }: TermometroRitmoProps) {
  const [mounted, setMounted] = useState(false);
  const [calculos, setCalculos] = useState({ projecao: 0, porcentagem: 0, atingimentoProjecao: 0 });

  useEffect(() => {
    const hoje = new Date().getDate();
    const ultimoDia = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const diasRestantes = ultimoDia - hoje;

    const projecao = hoje > 0 ? faturado + (faturado / hoje) * diasRestantes : faturado;
    const porcentagem = meta > 0 ? Math.min((faturado / meta) * 100, 100) : 0;
    const atingimentoProjecao = meta > 0 ? (projecao / meta) * 100 : 0;

    setCalculos({ projecao, porcentagem, atingimentoProjecao });
    setMounted(true);
  }, [faturado, meta]);

  if (!mounted) {
    return <div className="glass-card h-full min-h-[340px] rounded-xl border border-white/5 bg-white/[0.02] animate-pulse" />;
  }

  const { projecao, porcentagem, atingimentoProjecao } = calculos;

  return (
    <div className="glass-card flex h-full flex-col justify-between rounded-xl p-6 relative overflow-hidden">
      <div className="absolute -right-8 top-6 rotate-45 bg-purple-500 px-10 py-1 text-[10px] font-black uppercase text-black shadow-lg">
        IA Predictor
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Status da Meta</h3>
          <Target className="h-5 w-5 text-neutral-500" />
        </div>

        <p className="text-4xl font-black text-white">{porcentagem.toFixed(1)}%</p>
        <p className="text-xs text-neutral-400 uppercase tracking-tighter">Realizado até hoje</p>
      </div>

      <div className="mt-8 space-y-6">
        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="text-xs font-bold text-neutral-300">Tendência de Fechamento</span>
          </div>
          <p className="text-2xl font-black text-white">
            R$ {projecao.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </p>
          <p
            className={`text-xs font-bold mt-1 ${atingimentoProjecao >= 100 ? "text-purple-400" : "text-red-400"}`}
          >
            {atingimentoProjecao >= 100
              ? "✓ Meta será superada"
              : "⚠ Atenção: Tendência abaixo da meta"}
          </p>
        </div>

        <div className="h-3 w-full rounded-full bg-neutral-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.4)] transition-all duration-1000"
            style={{ width: `${porcentagem}%` }}
          />
        </div>
      </div>
    </div>
  )
}