"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { createClient } from "@/lib/supabase/client";

type InsightTipo = "ALERTA" | "PARABENS" | "DICA" | "NEUTRO";

const CONFIG: Record<InsightTipo, { icon: string; cor: string; badge: string }> = {
  ALERTA:   { icon: "line-md:alert-circle-loop", cor: "#f97316", badge: "⚠️ Atenção"  },
  PARABENS: { icon: "mdi:party-popper",          cor: "#a855f7", badge: "🎉 Parabéns" },
  DICA:     { icon: "mdi:lightbulb",             cor: "#facc15", badge: "💡 Dica"      },
  NEUTRO:   { icon: "mdi:trending-up",           cor: "#60a5fa", badge: "📊 Análise"   },
};

interface Insight {
  id: string;
  tipo: InsightTipo;
  titulo: string;
  briefing: string;
  acao: string;
  created_at: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function HistoricoInsights() {
  const supabase = createClient();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    supabase
      .from("maia_insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setInsights((data ?? []) as Insight[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="glass-card rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
      {/* Header clicável */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Icon icon="mdi:brain" className="h-5 w-5 text-violet-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-black uppercase tracking-wider text-white">Histórico M.A.I.A</h3>
            <p className="text-[10px] text-neutral-500 font-medium">Últimos insights gerados</p>
          </div>
          {!loading && insights.length > 0 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20">
              {insights.length}
            </span>
          )}
        </div>
        <Icon
          icon="mdi:chevron-down"
          className={`h-4 w-4 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-0">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-white/[0.03] rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : insights.length === 0 ? (
                <div className="text-center py-8">
                  <Icon icon="mdi:brain" className="h-10 w-10 text-neutral-700 mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">Nenhum insight gerado ainda.</p>
                  <p className="text-xs text-neutral-600 mt-1">Os insights aparecem aqui automaticamente quando a M.A.I.A analisa o dashboard.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {insights.map((ins) => {
                    const cfg = CONFIG[ins.tipo] ?? CONFIG.NEUTRO;
                    const isExpanded = expanded === ins.id;
                    return (
                      <motion.div
                        key={ins.id}
                        layout
                        className="rounded-xl overflow-hidden cursor-pointer"
                        style={{ border: `1px solid ${cfg.cor}25`, background: `${cfg.cor}08` }}
                        onClick={() => setExpanded(isExpanded ? null : ins.id)}
                      >
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div
                            className="p-1.5 rounded-lg flex-shrink-0"
                            style={{ background: `${cfg.cor}18`, border: `1px solid ${cfg.cor}30` }}
                          >
                            <Icon icon={cfg.icon} className="h-4 w-4" style={{ color: cfg.cor }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: cfg.cor }}>
                                {cfg.badge}
                              </span>
                              <span className="text-[9px] text-neutral-600">·</span>
                              <span className="text-[9px] text-neutral-600">{relativeTime(ins.created_at)}</span>
                            </div>
                            <p className="text-xs font-bold text-white truncate">{ins.titulo}</p>
                          </div>
                          <Icon
                            icon="mdi:chevron-down"
                            className={`h-3.5 w-3.5 flex-shrink-0 transition-transform text-neutral-600 ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 pt-0 space-y-2 border-t" style={{ borderColor: `${cfg.cor}20` }}>
                                <p className="text-xs text-white/70 leading-relaxed pt-3">{ins.briefing}</p>
                                <div
                                  className="rounded-xl p-3 flex gap-2 items-start mt-2"
                                  style={{ background: `${cfg.cor}10`, border: `1px solid ${cfg.cor}25` }}
                                >
                                  <Icon icon="mdi:lightning-bolt" className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: cfg.cor }} />
                                  <p className="text-xs text-white/70 leading-relaxed">{ins.acao}</p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
