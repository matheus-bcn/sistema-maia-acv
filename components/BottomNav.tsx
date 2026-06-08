"use client"

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

const ADMIN_PRIMARY = [
  { nome: "Home",      caminho: "/",          icone: "line-md:home-md",    cor: "#f97316" },
  { nome: "Ranking",   caminho: "/ranking",   icone: "mdi:trophy",         cor: "#facc15" },
  { nome: "Histórico", caminho: "/historico", icone: "line-md:watch-loop", cor: "#60a5fa" },
  { nome: "Relatório", caminho: "/relatorio", icone: "mdi:chart-bar",      cor: "#a78bfa" },
  { nome: "Mais",      caminho: "__mais__",   icone: "line-md:grid-3",     cor: "#94a3b8" },
];

const ADMIN_MAIS = [
  { nome: "Calendário",   caminho: "/calendario",   icone: "line-md:calendar",            cor: "#2dd4bf" },
  { nome: "Premiações",   caminho: "/premiacoes",   icone: "line-md:star-pulsating-loop", cor: "#f472b6" },
  { nome: "Equipe",       caminho: "/equipe",        icone: "mdi:account-group",           cor: "#34d399" },
  { nome: "Configuração", caminho: "/configuracao",  icone: "line-md:cog-loop",            cor: "#fb7185" },
];

const USER_TABS = [
  { nome: "Painel",      caminho: "/meu-painel", icone: "line-md:account",             cor: "#f97316" },
  { nome: "Ranking",     caminho: "/ranking",    icone: "mdi:trophy",                  cor: "#facc15" },
  { nome: "Calendário",  caminho: "/calendario", icone: "line-md:calendar",            cor: "#2dd4bf" },
  { nome: "Premiações",  caminho: "/premiacoes", icone: "line-md:star-pulsating-loop", cor: "#f472b6" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [maisOpen, setMaisOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const masterAdmin = (process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL || "admin@onlinegrafica.com").toLowerCase();
      if (user.email?.toLowerCase() === masterAdmin) { setIsAdmin(true); return; }
      supabase.from("sellers").select("is_admin").eq("email", user.email).maybeSingle()
        .then(({ data }) => setIsAdmin(!!data?.is_admin));
    });
  }, []);

  const tabs = isAdmin ? ADMIN_PRIMARY : USER_TABS;

  return (
    <>
      {/* Overlay do "Mais" */}
      <AnimatePresence>
        {maisOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMaisOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Drawer "Mais" */}
      <AnimatePresence>
        {maisOpen && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-20 left-3 right-3 z-50 md:hidden rounded-2xl overflow-hidden"
            style={{ background: "rgba(13,17,23,0.97)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="p-2 grid grid-cols-4 gap-1">
              {ADMIN_MAIS.map((item) => {
                const ativo = pathname === item.caminho;
                return (
                  <Link
                    key={item.caminho}
                    href={item.caminho}
                    onClick={() => setMaisOpen(false)}
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all active:scale-95"
                    style={{ background: ativo ? `${item.cor}18` : "transparent" }}
                  >
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center"
                      style={{
                        background: ativo
                          ? `linear-gradient(135deg, ${item.cor}40, ${item.cor}20)`
                          : "rgba(255,255,255,0.05)",
                        border: `1px solid ${ativo ? item.cor + "40" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <Icon icon={item.icone} className="h-5 w-5" style={{ color: ativo ? item.cor : "#6b7280" }} />
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: ativo ? item.cor : "#6b7280" }}>
                      {item.nome}
                    </span>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden safe-area-bottom">
        <div
          className="mx-0 flex items-center justify-around px-2 py-2"
          style={{
            background: "rgba(8,11,20,0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {tabs.map((tab) => {
            const isMais = tab.caminho === "__mais__";
            const ativo = isMais ? maisOpen : pathname === tab.caminho;

            if (isMais) {
              return (
                <button
                  key="mais"
                  onClick={() => setMaisOpen(!maisOpen)}
                  className="flex flex-col items-center gap-1 py-1 px-3 transition-all active:scale-90"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
                    style={{
                      background: maisOpen
                        ? "linear-gradient(135deg, rgba(148,163,184,0.25), rgba(148,163,184,0.1))"
                        : "transparent",
                      border: `1px solid ${maisOpen ? "rgba(148,163,184,0.3)" : "transparent"}`,
                    }}
                  >
                    <Icon icon="line-md:grid-3" className="h-5 w-5 transition-colors" style={{ color: maisOpen ? "#94a3b8" : "#4b5563" }} />
                  </div>
                  <span className="text-[10px] font-semibold transition-colors" style={{ color: maisOpen ? "#94a3b8" : "#4b5563" }}>
                    Mais
                  </span>
                </button>
              );
            }

            return (
              <Link
                key={tab.caminho}
                href={tab.caminho}
                onClick={() => setMaisOpen(false)}
                className="flex flex-col items-center gap-1 py-1 px-3 transition-all active:scale-90 relative"
              >
                {/* Indicador ativo */}
                {ativo && (
                  <motion.div
                    layoutId="bottomNavActive"
                    className="absolute -top-1 w-8 h-1 rounded-full"
                    style={{ background: `linear-gradient(90deg, ${tab.cor}, ${tab.cor}88)` }}
                    transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  />
                )}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all"
                  style={{
                    background: ativo
                      ? `linear-gradient(135deg, ${tab.cor}30, ${tab.cor}12)`
                      : "transparent",
                    border: `1px solid ${ativo ? tab.cor + "35" : "transparent"}`,
                  }}
                >
                  <Icon
                    icon={tab.icone}
                    className="h-5 w-5 transition-all"
                    style={{ color: ativo ? tab.cor : "#4b5563" }}
                  />
                </div>
                <span
                  className="text-[10px] font-semibold transition-colors"
                  style={{ color: ativo ? tab.cor : "#4b5563" }}
                >
                  {tab.nome}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
