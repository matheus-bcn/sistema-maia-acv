"use client"

import { useState, useEffect } from "react";
import { Target, Zap } from "lucide-react"

interface TermometroRitmoProps {
  meta: number
  faturado: number
  inicio: string
  fim: string
}

function parseLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function TermometroRitmo({ meta, faturado, inicio, fim }: TermometroRitmoProps) {
  const [mounted, setMounted] = useState(false);
  const [calculos, setCalculos] = useState({ projecao: 0, porcentagem: 0, atingimentoProjecao: 0, periodoEncerrado: false });

  useEffect(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dataInicio = parseLocalDate(inicio);
    const dataFim = parseLocalDate(fim);

    // Dias totais do período selecionado
    const totalDias = Math.max(1, Math.round((dataFim.getTime() - dataInicio.getTime()) / 86400000) + 1);

    // Dias decorridos dentro do período (até hoje ou até o fim, o que vier primeiro)
    const limiteAtual = hoje <= dataFim ? hoje : dataFim;
    const diasDecorridos = Math.max(1, Math.round((limiteAtual.getTime() - dataInicio.getTime()) / 86400000) + 1);

    // Dias restantes no período (0 se o período já terminou)
    const diasRestantes = hoje < dataFim
      ? Math.round((dataFim.getTime() - hoje.getTime()) / 86400000)
      : 0;

    const periodoEncerrado = hoje > dataFim;

    const projecao = periodoEncerrado
      ? faturado
      : diasDecorridos > 0
        ? faturado + (faturado / diasDecorridos) * diasRestantes
        : faturado;

    const porcentagem = meta > 0 ? Math.min((faturado / meta) * 100, 100) : 0;
    const atingimentoProjecao = meta > 0 ? (projecao / meta) * 100 : 0;

    setCalculos({ projecao, porcentagem, atingimentoProjecao, periodoEncerrado });
    setMounted(true);
  }, [faturado, meta, inicio, fim]);

  if (!mounted) {
    return <div className="glass-card h-full min-h-[340px] rounded-xl border border-white/5 animate-pulse" />;
  }

  const { projecao, porcentagem, atingimentoProjecao, periodoEncerrado } = calculos;

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
        <p className="text-xs text-neutral-400 uppercase tracking-tighter">
          {periodoEncerrado ? "Realizado no período" : "Realizado até hoje"}
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <div className="p-4 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="text-xs font-bold text-neutral-300">
              {periodoEncerrado ? "Resultado Final" : "Tendência de Fechamento"}
            </span>
          </div>
          <p className="text-2xl font-black text-white">
            R$ {projecao.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </p>
          <p className={`text-xs font-bold mt-1 ${atingimentoProjecao >= 100 ? "text-purple-400" : "text-red-400"}`}>
            {periodoEncerrado
              ? (atingimentoProjecao >= 100 ? "✓ Meta foi atingida" : "✗ Meta não foi atingida")
              : (atingimentoProjecao >= 100 ? "✓ Meta será superada" : "⚠ Tendência abaixo da meta")}
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
