"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { createClient } from "@/lib/supabase/client";
import { listSellers } from "@/lib/data/sellers";
import { createSaleAction } from "@/lib/actions/sales";
import type { Seller } from "@/types";

interface NovaVendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (valorVenda: number) => void; 
}

export function NovaVendaModal({ isOpen, onClose, onSuccess }: NovaVendaModalProps) {
  const [mounted, setMounted] = useState(false);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [amount, setAmount] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [channel, setChannel] = useState("comercial");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setSaleDate(new Date().toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();
    listSellers(supabase, "Ativo").then((list) => {
      setSellers(list);
      if (list[0]) setSellerId(list[0].id);
    });
  }, [isOpen]);

  if (!mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Fallback de formatação mais seguro
    let cleanAmount = amount.replace(/[^\d.,]/g, ""); // Remove tudo exceto digitos, pontos e virgulas
    if (cleanAmount.includes(",") && cleanAmount.includes(".")) {
      cleanAmount = cleanAmount.replace(/\./g, "").replace(",", "."); // Padrão PT-BR "1.000,50" -> "1000.50"
    } else if (cleanAmount.includes(",")) {
      cleanAmount = cleanAmount.replace(",", "."); // "1000,50" -> "1000.50"
    }
    
    const value = parseFloat(cleanAmount);
    
    if (!sellerId || isNaN(value) || value <= 0) {
      setError("Preencha vendedor e valor válido. (Ex: 1250,00)");
      return;
    }

    setLoading(true);
    setError(null);
    
    const result = await createSaleAction({ 
      seller_id: sellerId, 
      amount: value,
      sale_date: saleDate,
      channel: channel
    });
    
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAmount("");
    onSuccess(value);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.form
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onSubmit={handleSubmit}
            className="glass-card w-full max-w-md rounded-2xl p-6 border border-white/20 relative overflow-hidden"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black">Nova Venda</h3>
              <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <Icon icon="line-md:close" className="h-5 w-5 text-neutral-500 hover:text-white" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-neutral-500">Vendedor</label>
                <select
                  value={sellerId}
                  onChange={(e) => setSellerId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-4 py-3 text-sm outline-none"
                >
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-neutral-500 flex items-center gap-1"><Icon icon="mdi:tag" className="h-3 w-3" /> Canal</label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-4 py-3 text-sm outline-none"
                  >
                    <option value="comercial">Comercial</option>
                    <option value="atendimento">Atendimento</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-neutral-500 flex items-center gap-1"><Icon icon="line-md:calendar" className="h-3 w-3" /> Data</label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-4 py-3 text-sm outline-none invert-[0.8] brightness-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-neutral-500">Valor (R$)</label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="12500,00"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-4 py-3 text-sm outline-none text-purple-400 font-bold"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-400 mt-3 p-2 bg-red-500/10 rounded-md border border-red-500/20">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-lg bg-white py-3 text-sm font-bold text-black hover:bg-neutral-200 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? <Icon icon="line-md:loading-loop" className="icon-always h-4 w-4" /> : "Registrar venda"}
            </button>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}