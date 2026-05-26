"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Trophy, Flame, Zap, ArrowLeft, Clock, RefreshCw, Maximize } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDashboardStats } from "@/lib/data/dashboard";
import { getSellerRankings } from "@/lib/data/sellers";
import { getLatestSale } from "@/lib/data/sales";

export default function ModoTvPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  // Estados
  const [mounted, setMounted] = useState(false);
  const [horaLocal, setHoraLocal] = useState("");
  const [pctEquipe, setPctEquipe] = useState(0);
  const [faturadoEquipe, setFaturadoEquipe] = useState(0);
  const [metaEquipe, setMetaEquipe] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ranking, setRanking] = useState<{ pos: number; nome: string; valor: string; pct: number; cor: string }[]>([]);
  const [ultimaVenda, setUltimaVenda] = useState<{ nome: string; valor: number; quando: string; } | null>(null);

  // Ref para controlar o timeout e evitar Memory Leaks
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Evitar Hydration Mismatch e controlar relógio
  useEffect(() => {
    setMounted(true);
    const tick = () => setHoraLocal(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    tick(); // Inicialização imediata
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Fullscreen seguro acionado pelo usuário
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen API falhou: ", err);
    }
  };

  const sairDoModoTV = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch (err) {}
    router.push("/");
  };

  // 3. Data Fetching seguro contra engasgos de rede
  const carregarDados = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [stats, ranks, latest] = await Promise.all([
        getDashboardStats(supabase),
        getSellerRankings(supabase),
        getLatestSale(supabase),
      ]);
      
      setFaturadoEquipe(stats.totalFaturado);
      setMetaEquipe(stats.metaGlobal);
      setPctEquipe(stats.metaGlobal > 0 ? (stats.totalFaturado / stats.metaGlobal) * 100 : 0);
      
      const max = ranks[0]?.totalSales ?? 1;
      const cores = [
        "from-yellow-600 to-yellow-400",
        "from-neutral-600 to-neutral-400",
        "from-amber-800 to-amber-600",
        "from-white/10 to-white/30",
      ];
      
      setRanking(
        ranks.slice(0, 4).map((r, i) => ({
          pos: r.position,
          nome: r.seller.name,
          valor: `R$ ${r.totalSales.toLocaleString("pt-BR")}`,
          pct: max > 0 ? (r.totalSales / max) * 100 : 0,
          cor: cores[i] ?? cores[3],
        }))
      );
      
      if (latest?.seller) {
        const mins = Math.floor((Date.now() - new Date(latest.created_at).getTime()) / 60000);
        setUltimaVenda({
          nome: latest.seller.name,
          valor: Number(latest.amount),
          quando: mins < 1 ? "Agora mesmo" : `Há ${mins} min`,
        });
      }
    } catch (err) {
      console.error("Erro ao sincronizar dados da TV:", err);
    } finally {
      setIsSyncing(false);
      
      // Engenharia de Confiabilidade: Só agenda a próxima chamada DEPOIS que esta terminar
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(carregarDados, 30000);
    }
  }, [supabase]);

  // Boot Inicial
  useEffect(() => {
    carregarDados();
    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [carregarDados]);

  if (!mounted) return null; // Previne flashes de renderização no SSR

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-black text-white antialiased relative">
      <div className="fixed inset-0 -z-10 bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05)_0%,transparent_50%)]" />
      </div>

      <header className="flex items-center justify-between px-12 py-8 relative z-10">
        <div className="flex items-center gap-6">
          <button
            onClick={sairDoModoTV}
            title="Voltar ao Dashboard"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-6 w-6 text-neutral-400" />
          </button>
          
          {/* Botão sutil para forçar Fullscreen caso o navegador bloqueie o auto-fullscreen */}
          <button
            onClick={toggleFullscreen}
            title="Alternar Tela Cheia"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/20 transition-colors cursor-pointer"
          >
            <Maximize className="h-5 w-5 text-neutral-400" />
          </button>

          <h1 className="text-5xl font-black tracking-tighter ml-4">
            M<span className="text-neutral-500">A</span>I
            <span className="text-neutral-500">A</span>
            <span className="ml-4 text-2xl font-medium text-neutral-500 uppercase flex items-center gap-3 inline-flex">
              Live Dashboard
              {isSyncing && (
                <RefreshCw className="h-5 w-5 text-purple-400 animate-spin" />
              )}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-4 glass-card px-6 py-3 rounded-full border border-white/10 bg-white/[0.02]">
          <Clock className="h-6 w-6 text-purple-400 animate-pulse" />
          <span className="text-3xl font-black tabular-nums">{horaLocal}</span>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-8 px-12 pb-12 relative z-10">
        <div className="col-span-7 flex flex-col justify-between h-full">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card flex-1 rounded-3xl p-12 flex flex-col justify-center border border-white/5 bg-white/[0.02]"
          >
            <h2 className="text-4xl font-bold text-neutral-400 uppercase tracking-widest mb-4 flex items-center gap-3">
              <Target className="h-8 w-8 text-neutral-500" />
              Progresso do Mês
            </h2>
            <div className="flex items-baseline gap-4 mb-8">
              <span className="text-9xl font-black tabular-nums">{pctEquipe.toFixed(1)}%</span>
              <span className="text-3xl font-bold text-purple-400 flex items-center gap-2">
                <Flame className="h-8 w-8" /> On Fire!
              </span>
            </div>
            <div className="h-12 w-full rounded-full bg-neutral-900 overflow-hidden border border-white/5 relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(pctEquipe, 100)}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-gradient-to-r from-purple-600 to-purple-400 relative"
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250px_250px] animate-[shimmer_2s_infinite]" />
              </motion.div>
            </div>
            <div className="flex justify-between mt-6 text-3xl font-medium">
              <span>R$ {faturadoEquipe.toLocaleString("pt-BR")}</span>
              <span className="text-neutral-500">
                Meta: R$ {metaEquipe.toLocaleString("pt-BR")}
              </span>
            </div>
          </motion.div>

          {/* Wrapper fixo para impedir que a última venda mude o layout da tela toda ao aparecer */}
          <div className="min-h-[160px] mt-8">
            <AnimatePresence mode="wait">
              {ultimaVenda && (
                <motion.div
                  key={`${ultimaVenda.nome}-${ultimaVenda.quando}`}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="glass-card h-full rounded-3xl p-8 border border-purple-500/30 bg-gradient-to-r from-purple-500/10 to-transparent flex items-center justify-between"
                >
                  <div className="flex items-center gap-6">
                    <div className="h-16 w-16 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                      <Zap className="h-8 w-8 text-purple-400 fill-purple-400/50" />
                    </div>
                    <div>
                      <p className="text-purple-400 font-bold uppercase tracking-wider text-sm mb-1">
                        Última venda registrada
                      </p>
                      <p className="text-3xl font-black text-white">{ultimaVenda.nome} fechou negócio!</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-5xl font-black text-purple-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                      + R$ {ultimaVenda.valor.toLocaleString("pt-BR")}
                    </p>
                    <p className="text-neutral-400 mt-2 font-medium text-lg flex items-center justify-end gap-2">
                      <Clock className="h-4 w-4" /> {ultimaVenda.quando}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="col-span-5 glass-card rounded-3xl p-10 border border-white/5 bg-white/[0.02] h-full flex flex-col"
        >
          <div className="flex items-center gap-4 mb-10 pb-6 border-b border-white/10">
            <Trophy className="h-12 w-12 text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]" />
            <h2 className="text-4xl font-black uppercase">Top Ranking</h2>
          </div>
          <div className="flex flex-col gap-10 flex-1 justify-center">
            {ranking.map((v, i) => (
              <div key={v.pos} className="group">
                <div className="flex justify-between items-end mb-4">
                  <div className="flex items-center gap-5">
                    <span className={`text-5xl font-black ${i === 0 ? "text-yellow-500 drop-shadow-md" : "text-neutral-600"}`}>
                      {v.pos}º
                    </span>
                    <span className="text-4xl font-bold text-white tracking-tight">{v.nome}</span>
                  </div>
                  <span className="text-3xl font-black text-purple-400 tabular-nums">{v.valor}</span>
                </div>
                <div className="h-5 w-full bg-neutral-900 rounded-full overflow-hidden border border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${v.pct}%` }}
                    transition={{ duration: 1.5, delay: 0.2 + i * 0.1, ease: "easeOut" }}
                    className={`h-full bg-gradient-to-r ${v.cor}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}