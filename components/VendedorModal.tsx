"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, User, Mail, Lock, Award, Loader2, AlertTriangle, Phone } from "lucide-react";
import { updateSellerAction } from "@/lib/actions/sellers"; 
import { criarVendedorComLoginAction } from "@/lib/actions/equipe"; 

interface VendedorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sellerToEdit?: any; 
  onSuccess: () => void;
}

export function VendedorModal({ isOpen, onClose, sellerToEdit, onSuccess }: VendedorModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "", 
    category: "Iniciante",
  });

  useEffect(() => {
    if (sellerToEdit) {
      setFormData({
        name: sellerToEdit.name || "",
        email: sellerToEdit.email || "",
        password: "", 
        phone: sellerToEdit.phone || "", 
        category: sellerToEdit.category || sellerToEdit.role || "Iniciante",
      });
    } else {
      setFormData({ name: "", email: "", password: "", phone: "", category: "Iniciante" });
    }
    setError(null);
  }, [sellerToEdit, isOpen]);

  const categories = ["Iniciante", "Intermediário", "Pleno"];

  const getCategoryColor = (cat: string, isSelected: boolean) => {
    if (!isSelected) {
      return "bg-black/40 text-neutral-400 border-white/10 hover:bg-white/5";
    }
    switch (cat) {
      case "Iniciante":
        return "bg-orange-500 text-white border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]";
      case "Intermediário":
        return "bg-yellow-500 text-black border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]";
      case "Pleno":
        return "bg-emerald-500 text-black border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
      default:
        return "bg-white text-black border-white";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (sellerToEdit) {
        const payload = {
          name: formData.name,
          email: formData.email,
          password: formData.password,
          phone: formData.phone, 
          category: formData.category
        };
        const result = await updateSellerAction(sellerToEdit.id, payload);
        if (result?.error) throw new Error(result.error);
      } else {
        // ========================================================
        // CORREÇÃO: Passando formData.category no final para preencher a 'role'
        // ========================================================
        const result = await criarVendedorComLoginAction(
          formData.name, 
          formData.email, 
          formData.password, 
          false,
          formData.phone,
          formData.category // <-- Parâmetro adicionado para satisfazer a restrição do banco
        );
        if (!result.success) throw new Error(result.error);
      }

      onSuccess(); 
      onClose(); 
    } catch (err: any) {
      setError(err.message || "Erro ao processar a solicitação.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.form
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onSubmit={handleSubmit}
        className="glass-card w-full max-w-md rounded-2xl p-6 border border-white/20 bg-neutral-900 shadow-2xl text-white"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black">
            {sellerToEdit ? "Editar Vendedor" : "Novo Vendedor"}
          </h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-neutral-500 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-2 mb-1.5">
              <User className="h-3 w-3" /> Nome Completo (Login)
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/30 transition-all placeholder:text-neutral-600"
              placeholder="Ex: Daniel Gomes"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-2 mb-1.5">
              <Mail className="h-3 w-3" /> E-mail Profissional
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/30 transition-all placeholder:text-neutral-600"
              placeholder="vendas@onlinegrafica.com"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-2 mb-1.5">
              <Phone className="h-3 w-3" /> Telefone / WhatsApp
            </label>
            <input
              type="text"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/30 transition-all placeholder:text-neutral-600"
              placeholder="Ex: 81999999999"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-2 mb-1.5">
              <Lock className="h-3 w-3" /> {sellerToEdit ? "Nova Senha (Deixe em branco para manter)" : "Senha de Acesso"}
            </label>
            <input
              type="password"
              required={!sellerToEdit} 
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-white/30 transition-all placeholder:text-neutral-600"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-2 mb-2">
              <Award className="h-3 w-3" /> Nível / Categoria
            </label>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((cat) => {
                const isSelected = formData.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat })}
                    className={`py-2.5 rounded-lg text-xs font-bold transition-all border ${getCategoryColor(cat, isSelected)}`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-400 mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-sm font-bold text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-[2] bg-white text-black py-3 rounded-xl text-sm font-black hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : sellerToEdit ? "Salvar Alterações" : "Cadastrar Vendedor"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}