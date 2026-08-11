"use client"

import { CalendarIcon } from "lucide-react";

interface PeriodoFilterProps {
  inicio: string;
  fim: string;
  onChange: (inicio: string, fim: string) => void;
  className?: string;
}

const INPUT_CLASS =
  "bg-transparent text-sm font-semibold outline-none text-white cursor-pointer " +
  "[color-scheme:dark] min-w-[120px]";

export function PeriodoFilter({ inicio, fim, onChange, className = "" }: PeriodoFilterProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-2 backdrop-blur-md ${className}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <CalendarIcon className="h-3.5 w-3.5 text-white/30 flex-shrink-0" />
      <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest flex-shrink-0 hidden sm:block">
        Período
      </span>
      <input
        type="date"
        value={inicio}
        onChange={(e) => onChange(e.target.value, fim)}
        className={INPUT_CLASS}
      />
      <span className="text-white/20 text-xs flex-shrink-0">—</span>
      <input
        type="date"
        value={fim}
        onChange={(e) => onChange(inicio, e.target.value)}
        className={INPUT_CLASS}
      />
    </div>
  );
}
