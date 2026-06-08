"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

interface DayPoint {
  day: string;
  atual: number;
  anterior: number;
}

interface Props {
  data: DayPoint[];
  startDate: string; // YYYY-MM-DD do início do período atual
  loading?: boolean;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatK(v: number) {
  if (v === 0) return "0";
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const atual = payload.find((p: any) => p.dataKey === "atual");
  const anterior = payload.find((p: any) => p.dataKey === "anterior");
  return (
    <div className="bg-[#0d1117] border border-white/10 rounded-xl p-3 shadow-2xl text-xs min-w-[170px]">
      <p className="font-bold text-white/50 mb-2.5 uppercase tracking-widest text-[10px]">Dia {label}</p>
      {atual && (
        <div className="flex justify-between items-center gap-6 mb-1.5">
          <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            {atual.name}
          </span>
          <span className="font-black text-white">
            R$ {Number(atual.value).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
      {anterior && (
        <div className="flex justify-between items-center gap-6">
          <span className="flex items-center gap-1.5 text-neutral-400 font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
            {anterior.name}
          </span>
          <span className="font-bold text-neutral-300">
            R$ {Number(anterior.value).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  );
}

export function GraficoComparativoDiario({ data, startDate, loading }: Props) {
  const { mesAtual, mesAnterior } = useMemo(() => {
    const d = new Date(`${startDate}T12:00:00`);
    const curr = MESES[d.getMonth()];
    const prevIdx = d.getMonth() === 0 ? 11 : d.getMonth() - 1;
    return { mesAtual: curr, mesAnterior: MESES[prevIdx] };
  }, [startDate]);

  if (loading) {
    return <div className="glass-card rounded-2xl border border-white/5 animate-pulse h-[320px]" />;
  }

  const temDados = data.some((d) => d.atual > 0 || d.anterior > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl border border-white/5 p-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
          <Icon icon="mdi:chart-areaspline" className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">Comparativo Diário</h3>
          <p className="text-xs text-neutral-500">{mesAtual} vs {mesAnterior}</p>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-3 rounded-sm bg-purple-500 opacity-80" />
            <span className="text-neutral-400 font-semibold">{mesAtual}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-px w-3 border-t-2 border-dashed border-neutral-500" />
            <span className="text-neutral-400 font-semibold">{mesAnterior}</span>
          </span>
        </div>
      </div>

      {!temDados ? (
        <div className="flex flex-col items-center justify-center h-[200px] text-neutral-600">
          <Icon icon="mdi:chart-timeline-variant" className="h-10 w-10 mb-2" />
          <p className="text-sm">Nenhum dado no período</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={data} margin={{ top: 5, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gradAtual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradAnterior" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6b7280" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6b7280" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={formatK}
              tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "rgba(255,255,255,0.06)", strokeWidth: 1 }}
            />
            {/* Mês anterior — linha tracejada atrás */}
            <Area
              type="monotone"
              dataKey="anterior"
              name={mesAnterior}
              stroke="#6b7280"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              fill="url(#gradAnterior)"
              dot={false}
              activeDot={{ r: 3, fill: "#9ca3af", stroke: "none" }}
            />
            {/* Mês atual — área sólida na frente */}
            <Area
              type="monotone"
              dataKey="atual"
              name={mesAtual}
              stroke="#a855f7"
              strokeWidth={2.5}
              fill="url(#gradAtual)"
              dot={false}
              activeDot={{ r: 4, fill: "#a855f7", stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}
