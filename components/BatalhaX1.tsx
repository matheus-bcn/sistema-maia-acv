"use client"

import { motion } from "framer-motion";
import { Swords, Zap } from "lucide-react";
import type { SellerRanking } from "@/types";

interface BatalhaX1Props {
  rankings: SellerRanking[];
}

export function BatalhaX1({ rankings }: BatalhaX1Props) {
  const player1 = rankings[0];
  const player2 = rankings[1];

  if (!player1 || !player2) {
    return (
      <div className="glass-card rounded-2xl p-6 border-white/10 text-neutral-500 text-sm">
        Cadastre ao menos dois vendedores com vendas para ativar a Batalha X1.
      </div>
    );
  }

  const v1 = player1.totalSales;
  const v2 = player2.totalSales;
  const total = v1 + v2;
  const pct1 = total > 0 ? (v1 / total) * 100 : 50;

  return (
    <div className="glass-card rounded-2xl p-6 border-purple-500/20 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 bg-purple-500/10 blur-3xl" />

      <div className="flex items-center justify-between mb-8">
        <h3 className="text-lg font-black uppercase tracking-widest text-purple-400 flex items-center gap-2">
          <Swords className="h-5 w-5" /> Batalha X1 Ativa
        </h3>
        <span className="text-xs font-bold text-neutral-500 bg-white/5 px-3 py-1 rounded-full border border-white/10">
          Mês atual
        </span>
      </div>

      <div className="flex items-center justify-between gap-8 relative">
        {/* PLAYER 1: Purple Palette */}
        <div className="text-left flex-1">
          <div className="h-16 w-16 rounded-full bg-purple-500/20 border-2 border-purple-400 flex items-center justify-center text-xl font-black mb-2">
            {player1.seller.avatar ?? player1.seller.name.charAt(0)}
          </div>
          <p className="font-bold text-lg truncate text-white">{player1.seller.name}</p>
          <p className="text-purple-400 font-black text-xl">R$ {v1.toLocaleString("pt-BR")}</p>
        </div>

        {/* VS CENTRAL */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="h-12 w-12 bg-white text-black rounded-full flex items-center justify-center font-black italic">
            VS
          </div>
        </div>

        {/* PLAYER 2: Fuchsia Palette */}
        <div className="text-right flex-1">
          <div className="h-16 w-16 rounded-full bg-fuchsia-500/20 border-2 border-fuchsia-400 flex items-center justify-center text-xl font-black mb-2 ml-auto">
            {player2.seller.avatar ?? player2.seller.name.charAt(0)}
          </div>
          <p className="font-bold text-lg truncate text-white">{player2.seller.name}</p>
          <p className="text-fuchsia-400 font-black text-xl">R$ {v2.toLocaleString("pt-BR")}</p>
        </div>
      </div>

      <div className="mt-8 relative h-4 w-full bg-neutral-900 rounded-full overflow-hidden flex">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct1}%` }}
          transition={{ duration: 1.5, type: "spring" }}
          className="h-full bg-purple-500"
        />
        <div className="h-full flex-1 bg-fuchsia-500" />
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-neutral-400">
        <Zap className="h-4 w-4 text-purple-400" />
        Líder do mês: <span className="text-white">{player1.seller.name}</span>
      </div>
    </div>
  );
}