"use client";

import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';

interface TermometroDiasUteisProps {
  meta: number;
  faturado: number;
  inicio: string;
  fim: string;
}

function parseLocalDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function countBusinessDays(start: Date, end: Date): number {
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endClean = new Date(end);
  endClean.setHours(0, 0, 0, 0);
  while (cur <= endClean) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function TermometroDiasUteis({ meta, faturado, inicio, fim }: TermometroDiasUteisProps) {
  const [mounted, setMounted] = useState(false);
  const [dados, setDados] = useState({ totalBusinessDays: 1, businessDaysPassed: 0 });

  useEffect(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const dataInicio = parseLocalDate(inicio);
    const dataFim = parseLocalDate(fim);

    const totalBusinessDays = countBusinessDays(dataInicio, dataFim);

    const limiteAtual = hoje <= dataFim ? hoje : dataFim;
    const businessDaysPassed = limiteAtual >= dataInicio
      ? countBusinessDays(dataInicio, limiteAtual)
      : 0;

    setDados({ totalBusinessDays: Math.max(totalBusinessDays, 1), businessDaysPassed });
    setTimeout(() => setMounted(true), 100);
  }, [inicio, fim]);

  if (!mounted) {
    return <div className="glass-card min-h-[340px] rounded-xl border border-white/5 animate-pulse" />;
  }

  const { totalBusinessDays, businessDaysPassed } = dados;

  const expectedPercentage = businessDaysPassed / Math.max(totalBusinessDays, 1);
  const expectedVolume = meta * expectedPercentage;
  const pacing = expectedVolume > 0 ? (faturado / expectedVolume) * 100 : 0;

  let status = "Calculando...";
  let colorClass = "text-neutral-500";
  let neonGlow = "";
  let activeZone = 0;

  if (pacing < 80) {
    status = "BAIXO";
    colorClass = "text-rose-500";
    neonGlow = "drop-shadow-[0_0_15px_rgba(244,63,94,0.6)]";
    activeZone = 1;
  } else if (pacing < 100) {
    status = "NORMAL";
    colorClass = "text-yellow-400";
    neonGlow = "drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]";
    activeZone = 2;
  } else if (pacing < 120) {
    status = "BEM";
    colorClass = "text-purple-400";
    neonGlow = "drop-shadow-[0_0_15px_rgba(52,211,153,0.6)]";
    activeZone = 3;
  } else {
    status = "ÓTIMO";
    colorClass = "text-sky-400";
    neonGlow = "drop-shadow-[0_0_15px_rgba(56,189,248,0.6)]";
    activeZone = 4;
  }

  let needleAngle = -90;
  if (pacing < 80) {
    needleAngle = -90 + (pacing / 80) * 45;
  } else if (pacing < 100) {
    needleAngle = -45 + ((pacing - 80) / 20) * 45;
  } else if (pacing < 120) {
    needleAngle = 0 + ((pacing - 100) / 20) * 45;
  } else {
    needleAngle = 45 + ((Math.min(pacing, 150) - 120) / 30) * 45;
  }

  const r = 80;
  const circ = Math.PI * r;
  const q = circ / 4;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl border border-white/5 p-6 shadow-xl flex flex-col justify-between h-full min-h-[340px] relative overflow-hidden"
    >
      <div className="flex justify-between items-start z-10 relative mb-2">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border border-white/10 bg-white/5 ${colorClass} ${mounted ? neonGlow : ''}`}>
            <Icon icon="mdi:gauge" className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Termômetro Útil</h3>
            <p className="font-bold text-white text-xs">Ritmo do Período</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center pt-6">
        <svg viewBox="0 0 200 120" className="w-full max-w-[240px] overflow-visible">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#f43f5e" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${q - 2} ${circ}`} strokeDashoffset={0} className={`transition-all duration-500 ${activeZone === 1 || activeZone === 0 ? 'opacity-100 drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]' : 'opacity-10'}`} />
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#facc15" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${q - 2} ${circ}`} strokeDashoffset={-q} className={`transition-all duration-500 ${activeZone === 2 ? 'opacity-100 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]' : 'opacity-10'}`} />
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#34d399" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${q - 2} ${circ}`} strokeDashoffset={-q * 2} className={`transition-all duration-500 ${activeZone === 3 ? 'opacity-100 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]' : 'opacity-10'}`} />
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#38bdf8" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${q - 2} ${circ}`} strokeDashoffset={-q * 3} className={`transition-all duration-500 ${activeZone === 4 ? 'opacity-100 drop-shadow-[0_0_12px_rgba(56,189,248,0.6)]' : 'opacity-10'}`} />

          <line
            x1="100" y1="100" x2="100" y2="35"
            stroke="#ffffff" strokeWidth="4" strokeLinecap="round"
            style={{ transformOrigin: '100px 100px', transform: `rotate(${needleAngle}deg)` }}
            className="transition-transform duration-[2000ms] ease-out drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          />
          <circle cx="100" cy="100" r="8" fill="#111" stroke="#ffffff" strokeWidth="3" className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
        </svg>

        <div className="mt-2 text-center h-10">
          <p className={`font-black text-3xl tracking-tighter uppercase ${colorClass} ${mounted ? neonGlow : ''} transition-all duration-1000`}>
            {mounted ? status : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4 border-t border-white/10 pt-4 z-10 relative">
        <div>
          <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1">Deveríamos ter</p>
          <p className="font-mono font-bold text-white text-sm tracking-tighter">{formatCurrency(expectedVolume)}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1">Dias Úteis</p>
          <p className="font-mono font-bold text-white text-sm">
            <span className="text-white font-black">{businessDaysPassed}</span>
            <span className="text-neutral-500"> / {totalBusinessDays}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
