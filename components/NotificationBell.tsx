"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { createClient } from "@/lib/supabase/client";
import {
  getNotifications,
  markAllAsRead,
  markAsRead,
  NOTIF_CONFIG,
  type Notification,
} from "@/lib/data/notifications";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

export function NotificationBell() {
  const supabase = createClient();
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unread = notifs.filter((n) => !n.is_read).length;

  const carregarNotifs = useCallback(async (sid: string) => {
    const data = await getNotifications(supabase, sid);
    setNotifs(data);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.email) return;
      supabase
        .from("sellers")
        .select("id")
        .eq("email", user.email)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.id) {
            setSellerId(data.id);
            carregarNotifs(data.id);
          }
        });
    });
  }, []);

  // Polling a cada 30s
  useEffect(() => {
    if (!sellerId) return;
    const timer = setInterval(() => carregarNotifs(sellerId), 30000);
    return () => clearInterval(timer);
  }, [sellerId, carregarNotifs]);

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    setOpen((o) => !o);
  };

  const handleMarkAll = async () => {
    if (!sellerId) return;
    await markAllAsRead(supabase, sellerId);
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleMarkOne = async (id: string) => {
    await markAsRead(supabase, id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  if (!sellerId) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl hover:bg-white/10 transition-colors border border-white/10 flex-shrink-0"
        aria-label="Notificações"
      >
        <Icon icon="mdi:bell-outline" className="h-5 w-5 text-neutral-400" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border border-[#080b14]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 rounded-2xl overflow-hidden z-[200]"
            style={{
              background: "rgba(8,10,18,0.98)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Icon icon="mdi:bell" className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-black text-white">Notificações</span>
                {unread > 0 && (
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    {unread} nova{unread !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-[10px] font-bold text-neutral-500 hover:text-white transition-colors"
                >
                  Marcar tudo
                </button>
              )}
            </div>

            {/* Lista */}
            <div className="max-h-80 overflow-y-auto no-scrollbar">
              {notifs.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-2 text-neutral-600">
                  <Icon icon="mdi:bell-off-outline" className="h-8 w-8" />
                  <p className="text-xs font-medium">Nenhuma notificação</p>
                </div>
              ) : (
                notifs.map((n) => {
                  const cfg = NOTIF_CONFIG[n.type] ?? { icon: "mdi:bell", cor: "#60a5fa" };
                  return (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && handleMarkOne(n.id)}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] transition-colors ${!n.is_read ? "bg-white/[0.03] cursor-pointer hover:bg-white/[0.06]" : ""}`}
                    >
                      <div
                        className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${cfg.cor}18`, border: `1px solid ${cfg.cor}30` }}
                      >
                        <Icon icon={cfg.icon} className="h-4 w-4" style={{ color: cfg.cor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold leading-tight ${n.is_read ? "text-neutral-400" : "text-white"}`}>
                          {n.title}
                        </p>
                        {n.message && (
                          <p className="text-[10px] text-neutral-600 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                        )}
                        <p className="text-[10px] text-neutral-700 mt-1">{relativeTime(n.created_at)}</p>
                      </div>
                      {!n.is_read && (
                        <div className="h-2 w-2 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
