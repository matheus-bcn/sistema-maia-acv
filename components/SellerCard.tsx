"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, MoreVertical, Phone, ShieldCheck, UserX, Edit2, Trash2 } from "lucide-react";
import type { Seller, SellerStatus } from "@/types";

interface SellerCardProps {
  seller: Seller;
  onToggleStatus: (id: string, currentStatus: SellerStatus) => void;
  onEdit?: () => void;
  onDelete?: () => void; // NOVO: Prop para deletar
}

export function SellerCard({ seller, onToggleStatus, onEdit, onDelete }: SellerCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu dropdown ao clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Busca a categoria real do banco ou faz um fallback seguro
  const category = (seller as any).category || seller.role || "Iniciante";

  // Lógica dinâmica de cores para a Etiqueta da Categoria
  let categoryColor = "bg-white/10 text-neutral-400 border-white/20";
  if (category === "Iniciante") {
    categoryColor = "bg-orange-500/10 text-orange-400 border-orange-500/30";
  } else if (category === "Intermediário") {
    categoryColor = "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";
  } else if (category === "Pleno" || category === "Vendedor Pleno") {
    categoryColor = "bg-purple-500/10 text-purple-400 border-purple-500/30";
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`glass-card relative rounded-xl p-6 border ${
        seller.status === "Inativo" ? "opacity-60 border-red-500/20" : "border-white/10"
      }`}
    >
      {/* MENU DE TRÊS PONTOS */}
      <div className="absolute top-4 right-4 z-10" ref={menuRef}>
        <button 
          type="button" 
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 text-neutral-500 hover:text-white hover:bg-white/10 rounded-md transition-colors"
        >
          <MoreVertical className="h-5 w-5" />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-48 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl py-1 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  if (onEdit) onEdit();
                }}
                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-neutral-300 hover:bg-white/10 hover:text-white flex items-center gap-2 transition-colors"
              >
                <Edit2 className="h-4 w-4 text-neutral-400" />
                Editar Informações
              </button>
              
              {/* NOVO: Botão de Excluir */}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors border-t border-white/5"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir Vendedor
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-start gap-4 mb-6">
        <div className="h-16 w-16 rounded-full bg-neutral-800 flex items-center justify-center text-xl font-black border-2 border-neutral-700 uppercase">
          {seller.avatar ?? seller.name.charAt(0)}
        </div>
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            {seller.name}
            {seller.is_admin && <ShieldCheck className="h-4 w-4 text-purple-400" />}
          </h3>
          
          <div className="flex flex-wrap gap-2 mt-2">
            {/* BADGE DA CATEGORIA COM AS CORES ESCOLHIDAS */}
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase border ${categoryColor}`}>
              {category}
            </span>

            {/* BADGE DE STATUS */}
            <span
              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                seller.status === "Ativo"
                  ? "bg-purple-400/10 text-purple-400 border border-purple-400/20"
                  : "bg-red-400/10 text-red-400 border border-red-400/20"
              }`}
            >
              {seller.status}
            </span>
          </div>
        </div>
      </div>
      
      <div className="space-y-2 text-sm text-neutral-400 border-t border-white/5 pt-4">
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4" />
          <span className="truncate">{seller.email}</span>
        </div>
        {seller.phone && (
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4" />
            <span>{seller.phone}</span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onToggleStatus(seller.id, seller.status)}
        className={`w-full mt-6 py-2 text-sm font-semibold rounded flex items-center justify-center gap-2 transition-colors ${
          seller.status === "Ativo"
            ? "bg-white/5 hover:bg-red-500/20 hover:text-red-400"
            : "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20"
        }`}
      >
        {seller.status === "Ativo" ? (<><UserX className="h-4 w-4" /> Desativar</>) : ("Reativar")}
      </button>
    </motion.div>
  );
}