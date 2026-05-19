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
  const growth =
    lastAnterior > 0
      ? (((lastAtual - lastAnterior) / lastAnterior) * 100).toFixed(1)
      : "0"

  return (
    <div className="glass-card flex h-[350px] w-full flex-col rounded-xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Faturamento (Mês Atual)</h3>
          <p className="text-sm text-neutral-400">Comparativo com mês anterior</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">
            R$ {displayTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
          <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
            {Number(growth) >= 0 ? "+" : ""}
            {growth}%
          </span>
        </div>
      </div>

      <div className="h-full w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAtual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffffff" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="dia" stroke="#525252" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#525252" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value/1000}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#0a0a0a", borderColor: "#262626", borderRadius: "8px", color: "#fff" }}
              itemStyle={{ color: "#fff" }}
            />
            <Area type="monotone" dataKey="anterior" stroke="#525252" strokeWidth={2} fill="none" />
            <Area type="monotone" dataKey="atual" stroke="#ffffff" strokeWidth={3} fillOpacity={1} fill="url(#colorAtual)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
