"use client"

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ChartPoint } from "@/types"

interface FaturamentoChartProps {
  data: ChartPoint[]
  totalAtual?: number
}

export function FaturamentoChart({ data, totalAtual }: FaturamentoChartProps) {
  const lastAtual = data.length ? data[data.length - 1].atual : 0
  const lastAnterior = data.length ? data[data.length - 1].anterior : 0
  const displayTotal = totalAtual ?? lastAtual
  const growth = lastAnterior > 0 ? (((lastAtual - lastAnterior) / lastAnterior) * 100).toFixed(1) : "0"

  return (
    <div className="glass-card flex h-[350px] w-full flex-col rounded-2xl p-6 border border-white/5">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400">Faturamento</h3>
          <p className="text-2xl font-black text-white mt-1">
            R$ {displayTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black uppercase text-purple-400 bg-purple-400/10 px-3 py-1 rounded-full border border-purple-500/20">
            {Number(growth) >= 0 ? "+" : ""}{growth}% vs Mês Anterior
          </span>
        </div>
      </div>

      <div className="h-full w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAtual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="dia" stroke="#404040" fontSize={11} axisLine={false} tickLine={false} />
            <YAxis stroke="#404040" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v/1000}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#110b1a", borderColor: "#3f2c5e", borderRadius: "12px", color: "#fff" }}
              itemStyle={{ color: "#d946ef", fontWeight: "bold" }}
            />
            <Area type="monotone" dataKey="atual" stroke="#d946ef" strokeWidth={3} fill="url(#colorAtual)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}