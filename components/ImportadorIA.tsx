"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { createClient } from "@/lib/supabase/client";
import { listSellers } from "@/lib/data/sellers";
import { importPdvReportAction } from "@/lib/actions/sales";
import type { Seller } from "@/types";

interface ImportadorIAProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

const CANAL_INFO = {
  atendimento: {
    label: "Atendimento (PDV)",
    icon: "mdi:monitor-account",
    desc: "Relatório de vendas do balcão / PDV",
    color: "#60a5fa",
  },
  comercial: {
    label: "Comercial (O.S.)",
    icon: "mdi:briefcase-outline",
    desc: "Relatório de Ordens de Serviço emitidas",
    color: "#a78bfa",
  },
} as const;

type Canal = keyof typeof CANAL_INFO;

export function ImportadorIA({ isOpen, onClose, onImported }: ImportadorIAProps) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerId, setSellerId] = useState("");
  const [canal, setCanal] = useState<Canal>("atendimento");
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();
    listSellers(supabase, "Ativo").then((list) => {
      setSellers(list);
      if (list[0]) setSellerId(list[0].id);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerId) {
      setError("Por favor, selecione um vendedor.");
      return;
    }
    if (!file) {
      setError("Por favor, selecione um arquivo válido (.csv ou .txt) para processar.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await importPdvReportAction(formData, sellerId, canal);

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        const canalLabel = CANAL_INFO[canal].label;
        setSuccessMessage(
          `Sucesso! O sistema identificou e lançou automaticamente ${result.inserted} vendas para ${result.sellerName} no canal ${canalLabel}.`
        );
        setFile(null);
        setTimeout(() => {
          onImported();
          onClose();
          setSuccessMessage(null);
        }, 3500);
      }
    } catch {
      setError("Ocorreu um erro inesperado ao realizar o upload do arquivo.");
    } finally {
      setLoading(false);
    }
  };

  const canalAtivo = CANAL_INFO[canal];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.form
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onSubmit={handleSubmit}
        className="glass-card w-full max-w-md rounded-2xl p-6 border border-white/20 bg-neutral-900 text-white"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-black">Importador Automatizado</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Leitura de relatório de vendas</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white">
            <Icon icon="line-md:close" className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* SELEÇÃO DO VENDEDOR */}
          <div>
            <label className="text-xs font-bold uppercase text-neutral-400 flex items-center gap-1 mb-1.5">
              <Icon icon="mdi:account-group" className="h-3 w-3" /> Vendedor do Relatório
            </label>
            <select
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/50 px-4 py-3 text-sm outline-none bg-neutral-900 text-white focus:border-white/30"
            >
              {sellers.map((s) => (
                <option key={s.id} value={s.id} className="bg-neutral-950">
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* SELEÇÃO DO CANAL */}
          <div>
            <label className="text-xs font-bold uppercase text-neutral-400 flex items-center gap-1 mb-1.5">
              <Icon icon="mdi:tag-outline" className="h-3 w-3" /> Canal do Relatório
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CANAL_INFO) as Canal[]).map((key) => {
                const info = CANAL_INFO[key];
                const ativo = canal === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setCanal(key); setError(null); }}
                    className="flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-all"
                    style={{
                      borderColor: ativo ? info.color + "60" : "rgba(255,255,255,0.08)",
                      background: ativo ? info.color + "15" : "rgba(0,0,0,0.3)",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon icon={info.icon} className="h-4 w-4" style={{ color: ativo ? info.color : "#6b7280" }} />
                      <span className="text-xs font-bold" style={{ color: ativo ? info.color : "#9ca3af" }}>
                        {info.label}
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-500 leading-tight">{info.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ÁREA DE UPLOAD DO ARQUIVO */}
          <div className="border-2 border-dashed border-white/10 hover:border-white/30 rounded-xl p-6 text-center cursor-pointer transition-all relative bg-black/20 group">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
            />

            {file ? (
              <div className="flex flex-col items-center justify-center" style={{ color: canalAtivo.color }}>
                <Icon icon="mdi:file-document-check" className="h-10 w-10 mb-2" />
                <p className="text-sm font-bold truncate max-w-xs">{file.name}</p>
                <p className="text-xs text-neutral-500 mt-1">{(file.size / 1024).toFixed(1)} KB · {canalAtivo.label}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-neutral-400 group-hover:text-neutral-200">
                <Icon icon="mdi:cloud-upload" className="h-10 w-10 mb-2 text-neutral-500 transition-colors group-hover:text-white" />
                <p className="text-sm font-bold">Arraste ou selecione o relatório</p>
                <p className="text-xs text-neutral-500 mt-1">Aceita .csv ou .txt — formato {canalAtivo.label}</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-400 mt-4 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
            <Icon icon="line-md:alert-circle-loop" className="icon-always h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="flex items-start gap-2 text-sm text-purple-400 mt-4 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <Icon icon="mdi:check-circle" className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{successMessage}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file || !sellerId}
          className="mt-6 w-full rounded-lg bg-white py-3 text-sm font-bold text-black hover:bg-neutral-200 disabled:opacity-30 flex items-center justify-center gap-2 transition-all"
        >
          {loading ? (
            <>
              <Icon icon="line-md:loading-loop" className="icon-always h-4 w-4" /> M.A.I.A processando relatório...
            </>
          ) : (
            "Processar e Lançar Vendas"
          )}
        </button>
      </motion.form>
    </div>
  );
}
