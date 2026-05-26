"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Settings, 
  Target, 
  Medal, 
  Save, 
  Globe, 
  Bell, 
  DollarSign, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Gift,
  Plus,
  Trash2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getTeamGoal, getIndividualBaseGoal } from "@/lib/data/goals";

// --- Utilitários de Moeda ---
const formatCurrency = (val: string | number) => {
  const stringVal = typeof val === "number" ? val.toFixed(2) : val;
  const numericValue = stringVal.replace(/\D/g, "");
  if (!numericValue) return "0,00";
  
  const numberValue = parseInt(numericValue, 10) / 100;
  return numberValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseCurrency = (val: string) => {
  return parseFloat(val.replace(/\./g, "").replace(",", "."));
};

const SkeletonInput = () => (
  <div className="glass-card rounded-xl p-6 animate-pulse bg-white/[0.02] border border-white/5">
    <div className="h-5 w-48 bg-white/10 rounded mb-6" />
    <div className="h-3 w-16 bg-white/10 rounded mb-2 uppercase" />
    <div className="h-12 w-full bg-white/5 rounded-lg" />
  </div>
);

export default function ConfiguracaoPage() {
  const supabase = useMemo(() => createClient(), []);

  const [abaAtiva, setAbaAtiva] = useState("metas");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Estados de Metas
  const [metaEquipe, setMetaEquipe] = useState("0,00");
  const [metaIndividual, setMetaIndividual] = useState("0,00");

  // Estados de Premiações
  const [premiacoes, setPremiacoes] = useState<{ id: string; titulo: string; descricao: string; valor: string }[]>([]);
  const [novaPremiacao, setNovaPremiacao] = useState({ titulo: "", descricao: "", valor: "" });

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    
    try {
      // 1. CARREGAMENTO DE METAS
      let team = 0;
      let ind = 0;
      
      try { team = await getTeamGoal(supabase); } catch (e) {}
      try { ind = await getIndividualBaseGoal(supabase); } catch (e) {}

      setMetaEquipe(formatCurrency(team || 0));
      setMetaIndividual(formatCurrency(ind || 0));

      // 2. BUSCA DE PRÊMIOS
      try {
        const { data: rewards, error: fetchError } = await supabase
          .from("awards")
          .select("*");

        if (fetchError) throw fetchError;

        if (rewards && rewards.length > 0) {
          const premiosMapeados = rewards.map((r: any) => ({
            id: r.id?.toString() || Math.random().toString(),
            titulo: r.title || r.name || "Conquista",
            descricao: r.description || "",
            valor: (r.cost || r.trigger_value || 0).toString(),
          }));
          
          premiosMapeados.sort((a, b) => Number(a.valor) - Number(b.valor));
          setPremiacoes(premiosMapeados);
        } else {
          setPremiacoes([]);
        }
      } catch (errAwards: any) {
        console.error("Aviso: A tabela 'awards' não pôde ser carregada.", errAwards.message);
        setPremiacoes([]);
      }

    } catch (err) {
      console.error("Erro geral no carregamento:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleMetaEquipeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMetaEquipe(formatCurrency(e.target.value));
    setFeedback(null);
  };

  const handleMetaIndividualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMetaIndividual(formatCurrency(e.target.value));
    setFeedback(null);
  };

  const salvarMetas = async () => {
    setSaving(true);
    setFeedback(null);
    
    const teamNum = parseCurrency(metaEquipe);
    const indNum = parseCurrency(metaIndividual);

    try {
      const date = new Date();
      const monthYearStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

      const { data: existingTeam } = await supabase.from("goals").select("id").eq("type", "equipe").eq("month_year", monthYearStr).limit(1).maybeSingle();
      if (existingTeam?.id) {
        await supabase.from("goals").update({ target_value: teamNum }).eq("id", existingTeam.id);
      } else {
        await supabase.from("goals").insert({ type: "equipe", target_value: teamNum, month_year: monthYearStr });
      }

      const { data: existingInd } = await supabase.from("goals").select("id").eq("type", "individual").eq("month_year", monthYearStr).limit(1).maybeSingle();
      if (existingInd?.id) {
        await supabase.from("goals").update({ target_value: indNum }).eq("id", existingInd.id);
      } else {
        await supabase.from("goals").insert({ type: "individual", target_value: indNum, month_year: monthYearStr });
      }

      setFeedback({ type: "success", message: "Metas salvas com sucesso!" });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: "error", message: `Falha ao salvar metas: ${err.message || "Erro desconhecido."}` });
    } finally {
      setSaving(false);
    }
  };

  const adicionarPremiacao = async () => {
    if (!novaPremiacao.titulo || !novaPremiacao.valor) return;
    
    setSaving(true);
    setFeedback(null);
    const valorNumerico = parseCurrency(novaPremiacao.valor);
    
    try {
      // INSERÇÃO SUPER BLINDADA: Preenche ABSOLUTAMENTE TODAS as colunas para não haver chance de erro
      const payload = {
        title: novaPremiacao.titulo,          // Coluna nova
        name: novaPremiacao.titulo,           // Coluna antiga
        description: novaPremiacao.descricao, // Coluna nova/antiga
        cost: valorNumerico,                  // Coluna nova
        trigger_value: valorNumerico,         // Coluna antiga
        icon_name: "Gift"                     // Preenche a coluna 'icon_name' obrigatória apontada no erro
      };

      const { data, error } = await supabase
        .from("awards")
        .insert(payload)
        .select()
        .single();

      if (error) throw error; 

      setPremiacoes([...premiacoes, { 
        id: data.id.toString(), 
        titulo: data.title || data.name || "", 
        descricao: data.description || "",
        valor: data.cost?.toString() || data.trigger_value?.toString() || "0" 
      }]);

      setNovaPremiacao({ titulo: "", descricao: "", valor: "" });
      setFeedback({ type: "success", message: "Conquista gamificada criada com sucesso!" });
      setTimeout(() => setFeedback(null), 4000);

    } catch (err: any) {
      console.error("Erro ao inserir:", err);
      const errorMessage = err?.message || err?.details || JSON.stringify(err);
      setFeedback({ type: "error", message: `Erro no Banco: ${errorMessage}` });
    } finally {
      setSaving(false);
    }
  };

  const removerPremiacao = async (id: string) => {
    setFeedback(null);
    try {
      const { error } = await supabase.from("awards").delete().eq("id", id);
      if (error) throw error;

      setPremiacoes(premiacoes.filter(p => p.id !== id));
      setFeedback({ type: "success", message: "Premiação removida com sucesso!" });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: "error", message: `Erro ao excluir: ${err.message || "Tente novamente."}` });
    }
  };

  const abas = [
    { id: "geral", nome: "Geral", icone: Globe },
    { id: "metas", nome: "Metas & Valores", icone: Target },
    { id: "premiacoes", nome: "Premiações", icone: Medal },
    { id: "notificacoes", nome: "Notificações", icone: Bell },
  ];

  return (
    <>
      <header className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <Settings className="h-8 w-8 text-neutral-400" />
            Configurações
          </h2>
          <p className="text-neutral-400 mt-1">Parâmetros globais do sistema MAIA</p>
        </div>
        {abaAtiva === "metas" && (
          <button
            type="button"
            onClick={salvarMetas}
            disabled={saving || loading}
            className="flex items-center gap-2 rounded-md bg-white px-6 py-2.5 text-sm font-bold text-black shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:bg-neutral-200 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        )}
      </header>

      <div className="flex gap-2 mb-8 border-b border-white/5 pb-4 overflow-x-auto custom-scrollbar">
        {abas.map((aba) => (
          <button
            key={aba.id}
            type="button"
            onClick={() => {
              setAbaAtiva(aba.id);
              setFeedback(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${
              abaAtiva === aba.id 
                ? "bg-white/10 text-white border border-white/20 shadow-sm" 
                : "text-neutral-500 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            <aba.icone className="h-4 w-4" />
            {aba.nome}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-6 flex items-center gap-3 p-4 rounded-xl border backdrop-blur-md ${
              feedback.type === "success" 
                ? "bg-purple-500/10 border-purple-500/20 text-purple-400" 
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}
          >
            {feedback.type === "success" ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <p className="text-sm font-semibold">{feedback.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-[400px]">
        {abaAtiva === "metas" && (
          <div className="grid gap-6 lg:grid-cols-2">
            {loading ? (
              <>
                <SkeletonInput />
                <SkeletonInput />
              </>
            ) : (
              <>
                <div className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02]">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-400" />
                    Meta Global da Equipe
                  </h3>
                  <label className="text-xs font-bold text-neutral-500 uppercase">Valor Mensal (R$)</label>
                  <div className="relative mt-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-neutral-500">R$</span>
                    <input
                      type="text"
                      value={metaEquipe}
                      onChange={handleMetaEquipeChange}
                      className="w-full bg-black/50 border border-white/10 rounded-lg pl-12 pr-4 py-3 text-xl font-black text-purple-400 outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                </div>

                <div className="glass-card rounded-xl p-6 border border-white/5 bg-white/[0.02]">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-400" />
                    Meta Individual Base
                  </h3>
                  <label className="text-xs font-bold text-neutral-500 uppercase">Valor Mensal (R$)</label>
                  <div className="relative mt-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-neutral-500">R$</span>
                    <input
                      type="text"
                      value={metaIndividual}
                      onChange={handleMetaIndividualChange}
                      className="w-full bg-black/50 border border-white/10 rounded-lg pl-12 pr-4 py-3 text-xl font-black text-blue-400 outline-none focus:ring-2 focus:ring-white/20"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        
        {abaAtiva === "premiacoes" && (
          <div className="space-y-6">
            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">Título da Conquista</label>
                  <input 
                    type="text" 
                    value={novaPremiacao.titulo} 
                    onChange={(e) => setNovaPremiacao({ ...novaPremiacao, titulo: e.target.value })} 
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500" 
                    placeholder="Ex: Lendário MAIA" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">Requisito de Faturamento (R$)</label>
                  <input 
                    type="text" 
                    value={novaPremiacao.valor} 
                    onChange={(e) => setNovaPremiacao({ ...novaPremiacao, valor: formatCurrency(e.target.value) })} 
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500" 
                    placeholder="Ex: 50.000,00" 
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">Descrição Detalhada do Prêmio</label>
                <input 
                  type="text" 
                  value={novaPremiacao.descricao} 
                  onChange={(e) => setNovaPremiacao({ ...novaPremiacao, descricao: e.target.value })} 
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500" 
                  placeholder="Ex: Viagem paga ou Pix Bônus." 
                />
              </div>

              <div className="flex justify-end">
                <button 
                  onClick={adicionarPremiacao} 
                  disabled={saving}
                  className="bg-white text-black font-bold h-[46px] px-6 rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-200 transition-all hover:scale-105 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 font-black" />} 
                  Criar Conquista Gamificada
                </button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {premiacoes.map((premio) => (
                <motion.div 
                  key={premio.id} 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card p-5 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col justify-between group relative"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400 border border-purple-500/20">
                      <Gift className="h-6 w-6" />
                    </div>
                    <div className="space-y-1 pr-8">
                      <h4 className="font-black text-white text-lg">{premio.titulo}</h4>
                      <p className="text-xs text-purple-400 font-bold uppercase tracking-wider">
                        Requisito: R$ {formatCurrency(premio.valor)}
                      </p>
                      {premio.descricao && <p className="text-sm text-neutral-400 leading-normal">{premio.descricao}</p>}
                    </div>
                  </div>

                  <button 
                    onClick={() => removerPremiacao(premio.id)} 
                    className="absolute top-4 right-4 p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </motion.div>
              ))}
              {premiacoes.length === 0 && (
                <p className="text-center py-8 text-neutral-500 italic md:col-span-2">Nenhuma conquista cadastrada. Monte a sua jornada acima!</p>
              )}
            </div>
          </div>
        )}
        
        {abaAtiva === "geral" && (
          <div className="glass-card rounded-xl p-8 max-w-2xl text-sm text-neutral-400 border border-white/5 bg-white/[0.02]">
            <Globe className="h-8 w-8 text-neutral-600 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Preferências Gerais</h3>
            <p>Configurações de identidade visual em desenvolvimento estrutural.</p>
          </div>
        )}
        
        {abaAtiva === "notificacoes" && (
          <div className="glass-card rounded-xl p-8 max-w-2xl text-sm text-neutral-400 border border-white/5 bg-white/[0.02]">
            <Bell className="h-8 w-8 text-neutral-600 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Central de Alertas</h3>
            <p>Disparos automatizados na esteira de produção.</p>
          </div>
        )}
      </div>
    </>
  );
}