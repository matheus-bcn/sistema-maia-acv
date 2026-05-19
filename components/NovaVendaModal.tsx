"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Calendar as CalendarIcon, Tag } from "lucide-react";
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
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [amount, setAmount] = useState("");
  
  // NOVOS ESTADOS
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split("T")[0]);
  const [channel, setChannel] = useState("comercial");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();
    listSellers(supabase, "Ativo").then((list) => {
      setSellers(list);
      if (list[0]) setSellerId(list[0].id);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount.replace(/\./g, "").replace(",", "."));
    if (!sellerId || isNaN(value) || value <= 0) {
      setError("Preencha vendedor e valor válido.");
      return;
    }
    setLoading(true);
    setError(null);
    
    // Agora enviamos data e canal junto
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.form
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onSubmit={handleSubmit}
        className="glass-card w-full max-w-md rounded-2xl p-6 border border-white/20"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black">Nova Venda</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
            <X className="h-5 w-5 text-neutral-500" />
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
              <label className="text-xs font-bold uppercase text-neutral-500 flex items-center gap-1"><Tag className="h-3 w-3"/> Canal</label>
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
              <label className="text-xs font-bold uppercase text-neutral-500 flex items-center gap-1"><CalendarIcon className="h-3 w-3"/> Data</label>
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
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-4 py-3 text-sm outline-none text-emerald-400 font-bold"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-white py-3 text-sm font-bold text-black hover:bg-neutral-200 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar venda"}
        </button>
      </motion.form>
    </div>
  );
}