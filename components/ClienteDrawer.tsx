"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { createClient } from "@/lib/supabase/client";
import { getCustomerDetail, saveCustomerNote } from "@/lib/data/customers";
import type { CustomerStats } from "@/types";

const STATUS_CONFIG = {
  vip:      { label: "VIP",      cor: "#facc15", icon: "mdi:trophy"                  },
  novo:     { label: "Novo",     cor: "#4ade80", icon: "line-md:star-pulsating-loop"  },
  regular:  { label: "Regular",  cor: "#60a5fa", icon: "mdi:account-check"            },
  dormente: { label: "Dormente", cor: "#f97316", icon: "mdi:sleep"                    },
};

const CANAL_LABEL: Record<string, { label: string; icon: string; cor: string }> = {
  atendimento: { label: "Atendimento (PDV)",  icon: "mdi:monitor-account", cor: "#60a5fa" },
  comercial:   { label: "Comercial (O.S.)",   icon: "mdi:briefcase-outline", cor: "#a78bfa" },
};

interface Props {
  cliente: CustomerStats | null;
  onClose: () => void;
}

export function ClienteDrawer({ cliente, onClose }: Props) {
  const supabase = createClient();
  const [detalhe, setDetalhe] = useState<Awaited<ReturnType<typeof getCustomerDetail>> | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [nota, setNota] = useState("");
  const [savingNota, setSavingNota] = useState(false);
  const [notaSalva, setNotaSalva] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!cliente) { setDetalhe(null); return; }
    setLoadingDetalhe(true);
    setDetalhe(null);
    setNotaSalva(false);

    getCustomerDetail(supabase, cliente.customer_name).then((d) => {
      setDetalhe(d);
      setNota(d.nota);
      setLoadingDetalhe(false);
    });
  }, [cliente?.customer_name]);

  const handleSaveNota = async () => {
    if (!cliente) return;
    setSavingNota(true);
    const { data: { user } } = await supabase.auth.getUser();
    await saveCustomerNote(supabase, cliente.customer_name, nota, user?.email ?? undefined);
    setSavingNota(false);
    setNotaSalva(true);
    setTimeout(() => setNotaSalva(false), 3000);
  };

  if (!cliente) return null;

  const st = STATUS_CONFIG[cliente.status];
  const canalInfo = detalhe?.canalPreferido ? CANAL_LABEL[detalhe.canalPreferido] : null;

  return (
    <AnimatePresence>
      {cliente && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 z-[90] w-full sm:w-[480px] flex flex-col overflow-hidden"
            style={{
              background: "rgba(8,10,18,0.98)",
              borderLeft: `1px solid rgba(255,255,255,0.08)`,
              boxShadow: "-32px 0 80px rgba(0,0,0,0.6)",
            }}
          >
            {/* Linha de cor no topo */}
            <div className="h-1 w-full flex-shrink-0" style={{ background: `linear-gradient(90deg, ${st.cor}, ${st.cor}44)` }} />

            {/* Header */}
            <div className="flex-shrink-0 p-6 border-b border-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
                    style={{ background: `${st.cor}20`, border: `1px solid ${st.cor}40`, color: st.cor }}
                  >
                    {cliente.customer_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white leading-tight">{cliente.customer_name}</h2>
                    <span
                      className="inline-flex items-center gap-1.5 mt-1 text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg"
                      style={{ background: `${st.cor}18`, border: `1px solid ${st.cor}35`, color: st.cor }}
                    >
                      <Icon icon={st.icon} className="h-3 w-3" />
                      {st.label}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0 border border-white/10"
                >
                  <Icon icon="line-md:close" className="h-4 w-4 text-white/50 hover:text-white" />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Gasto",    value: `R$ ${cliente.total_gasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: "mdi:currency-usd",    cor: "#4ade80" },
                  { label: "Compras",        value: cliente.total_compras,                                                              icon: "mdi:shopping",         cor: "#60a5fa" },
                  { label: "Ticket Médio",   value: `R$ ${cliente.ticket_medio.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`, icon: "mdi:trending-up",     cor: "#a78bfa" },
                  { label: "Última Compra",  value: cliente.dias_sem_comprar === 0 ? "Hoje" : `${cliente.dias_sem_comprar}d atrás`,     icon: "mdi:clock-outline",    cor: cliente.dias_sem_comprar > 30 ? "#f97316" : "#60a5fa" },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon icon={s.icon} className="h-4 w-4" style={{ color: s.cor }} />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{s.label}</span>
                    </div>
                    <p className="text-base font-black text-white">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Canal preferido */}
              {canalInfo && (
                <div
                  className="rounded-xl p-4 flex items-center gap-3"
                  style={{ background: `${canalInfo.cor}10`, border: `1px solid ${canalInfo.cor}25` }}
                >
                  <Icon icon={canalInfo.icon} className="h-5 w-5 flex-shrink-0" style={{ color: canalInfo.cor }} />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${canalInfo.cor}80` }}>Canal Preferido</p>
                    <p className="text-sm font-bold text-white">{canalInfo.label}</p>
                  </div>
                </div>
              )}

              {/* Atendentes */}
              {cliente.atendentes.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-2">Atendido(a) por</p>
                  <div className="flex flex-wrap gap-2">
                    {cliente.atendentes.map((a) => (
                      <span key={a} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 text-neutral-300">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico de compras */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Icon icon="mdi:receipt-text" className="h-4 w-4 text-neutral-500" />
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Histórico de Compras</p>
                  {detalhe && <span className="ml-auto text-[10px] text-neutral-600">{detalhe.compras.length} registros</span>}
                </div>

                {loadingDetalhe ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-14 bg-white/[0.03] rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : detalhe?.compras.length === 0 ? (
                  <p className="text-xs text-neutral-600 italic text-center py-4">Nenhuma compra registrada.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1 no-scrollbar">
                    {detalhe?.compras.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-xl px-4 py-3 border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                        <div>
                          <p className="text-xs text-neutral-300 font-medium">
                            {c.sale_date ? new Date(c.sale_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                          </p>
                          <p className="text-[10px] text-neutral-600">
                            {c.channel === "atendimento" ? "PDV" : c.channel === "comercial" ? "O.S." : c.channel ?? "—"}
                            {c.pdv_number ? ` · Nº ${c.pdv_number}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-teal-400">
                            R$ {c.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </p>
                          <p className="text-[10px] text-neutral-600">{c.seller_name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Observações */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Icon icon="mdi:note-text-outline" className="h-4 w-4 text-neutral-500" />
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Observações</p>
                </div>
                <textarea
                  ref={textareaRef}
                  value={nota}
                  onChange={(e) => { setNota(e.target.value); setNotaSalva(false); }}
                  placeholder="Adicione observações sobre este cliente: preferências, histórico de contato, próximos passos..."
                  rows={4}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-white/25 resize-none"
                />
                <div className="flex items-center justify-end mt-2 gap-3">
                  {notaSalva && (
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                      <Icon icon="mdi:check-circle" className="h-3.5 w-3.5" /> Salvo
                    </span>
                  )}
                  <button
                    onClick={handleSaveNota}
                    disabled={savingNota}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#c084fc" }}
                  >
                    {savingNota ? (
                      <><Icon icon="line-md:loading-loop" className="icon-always h-3.5 w-3.5" /> Salvando...</>
                    ) : (
                      <><Icon icon="mdi:content-save" className="h-3.5 w-3.5" /> Salvar</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
