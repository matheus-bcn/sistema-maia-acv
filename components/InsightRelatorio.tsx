// components/InsightRelatorio.tsx
"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { analisarRelatorioAction } from "@/lib/actions/ai-actions";

export function InsightRelatorio({ dados }: { dados: any }) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarInsight() {
      setLoading(true);
      const resultado = await analisarRelatorioAction(dados);
      if (resultado.success) {
        // CORREÇÃO AQUI: Adicionado o "|| null" para satisfazer o TypeScript
        setInsight(resultado.insight || null);
      }
      setLoading(false);
    }
    carregarInsight();
  }, [dados]);

  if (loading) {
    return (
      <div className="glass-card flex items-center gap-3 p-4 rounded-xl border border-white/10 text-neutral-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">M.A.I.A está analisando os dados...</span>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl border border-purple-500/20 bg-purple-500/5 relative overflow-hidden">
      <div className="flex items-center gap-2 mb-3 text-purple-400">
        <Sparkles className="h-5 w-5" />
        <h3 className="font-bold text-sm uppercase tracking-wider">Insight M.A.I.A</h3>
      </div>
      <p className="text-sm text-neutral-300 leading-relaxed">
        {insight}
      </p>
    </div>
  );
}