"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Medal,
  Trophy,
  Star,
  Shield,
  Zap,
  Target,
  Lock,
  Unlock,
  AlertCircle,
  RefreshCw,
  LucideIcon
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Conquista {
  id: any;
  titulo: string;
  descricao: string;
  requisito: string;
  conquistado: boolean;
  icone: LucideIcon;
  cor: string;
  progresso: number;
  faturamentoAtual: number;
  valorMeta: number;
}

// Skeleton para garantir que o loading não cause Layout Shift
const SkeletonAchievement = () => (
  <div className="glass-card relative overflow-hidden rounded-2xl p-6 border border-white/5 bg-white/[0.02] animate-pulse">
    <div className="flex items-start gap-4">
      <div className="p-4 rounded-xl bg-white/10 h-16 w-16" />
      <div className="flex-1 space-y-3 py-1">
        <div className="h-5 w-3/4 bg-white/10 rounded" />
        <div className="h-4 w-full bg-white/5 rounded" />
        <div className="h-4 w-5/6 bg-white/5 rounded" />
      </div>
    </div>
    <div className="mt-6 pt-4 border-t border-white/5 flex justify-between items-center">
      <div className="h-3 w-16 bg-white/10 rounded" />
      <div className="h-3 w-24 bg-white/10 rounded" />
    </div>
  </div>
);

export default function PremiacoesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [conquistas, setConquistas] = useState<Conquista[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meuFaturamento, setMeuFaturamento] = useState(0);

  const carregarConquistas = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Identifica o faturamento acumulado do usuário logado no mês atual
      const { data: { user } } = await supabase.auth.getUser();
      let faturamentoAtual = 0;

      if (user?.email) {
        const { data: sellerData } = await supabase
          .from("sellers")
          .select("id, is_admin")
          .eq("email", user.email)
          .maybeSingle();

        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString();
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59).toISOString();

        if (sellerData && !sellerData.is_admin) {
          // Se for vendedor comum, calcula apenas as vendas dele
          const { data: salesData } = await supabase
            .from("sales")
            .select("amount")
            .eq("seller_id", sellerData.id)
            .gte("sale_date", inicioMes)
            .lte("sale_date", fimMes);

          faturamentoAtual = salesData?.reduce((acc, v) => acc + Number(v.amount), 0) || 0;
        } else {
          // Se for o Admin logado visualizando a tela, soma o faturamento global da equipe no mês
          const { data: globalSales } = await supabase
            .from("sales")
            .select("amount")
            .gte("sale_date", inicioMes)
            .lte("sale_date", fimMes);

          faturamentoAtual = globalSales?.reduce((acc, v) => acc + Number(v.amount), 0) || 0;
        }
      }

      setMeuFaturamento(faturamentoAtual);

      // 2. BUSCA DINÂMICA: Puxa os prêmios reais criados por você na tabela 'awards'
      const { data: awardsData, error: awardsError } = await supabase
        .from("awards")
        .select("*")
        .order("cost", { ascending: true });

      if (awardsError) throw awardsError;

      // Paleta de Ícones e Cores Premium cíclicas para renderizar os cards com estilo gamificado
      const iconesDisponiveis = [Zap, Target, Shield, Trophy, Star, Medal];
      const coresDisponiveis = ["text-blue-400", "text-orange-400", "text-purple-400", "text-yellow-500", "text-purple-400", "text-red-400"];

      const conquistasCalculadas: Conquista[] = (awardsData || []).map((award: any, index: number) => {
        // Converte o custo/meta da premiação cadastrado no admin
        const valorMeta = Number(award.cost) || Number(award.target_value) || 0;
        const isConquistado = faturamentoAtual >= valorMeta;
        const percentualProgresso = valorMeta > 0 ? Math.min((faturamentoAtual / valorMeta) * 100, 100) : 100;

        return {
          id: award.id,
          titulo: award.title || "Premiação",
          descricao: award.description || "Alcança a meta de faturamento estabelecida para desbloquear esta recompensa.",
          requisito: `Meta: R$ ${valorMeta.toLocaleString("pt-BR")}`,
          conquistado: isConquistado,
          icone: iconesDisponiveis[index % iconesDisponiveis.length],
          cor: coresDisponiveis[index % coresDisponiveis.length],
          progresso: percentualProgresso,
          faturamentoAtual: faturamentoAtual,
          valorMeta: valorMeta
        };
      });

      setConquistas(conquistasCalculadas);
    } catch (err) {
      console.error("Erro ao carregar conquistas:", err);
      setError("Não foi possível processar suas premiações. Verifique a conexão com o banco de dados.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    carregarConquistas();
  }, [carregarConquistas]);

  return (
    <>
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <Medal className="h-8 w-8 text-yellow-500" />
            Minhas Premiações
          </h2>
          <p className="text-neutral-400 mt-1">Conquistas baseadas nos resultados reais da equipe</p>
        </div>
        
        <div className="bg-black/40 border border-white/10 px-5 py-3 rounded-xl backdrop-blur-md text-right">
          <p className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider mb-0.5">Meu Ritmo no Mês</p>
          <p className="text-xl font-black text-purple-400">R$ {meuFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {error ? (
          <motion.div
            key="error-state"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center p-10 rounded-xl border border-red-500/20 bg-red-500/5 backdrop-blur-md text-center max-w-2xl mx-auto my-8"
          >
            <AlertCircle className="h-10 w-10 text-red-400 mb-4 animate-bounce" />
            <h3 className="text-lg font-bold text-white mb-2">Erro de Sincronização</h3>
            <p className="text-sm text-neutral-400 mb-6">{error}</p>
            <button
              type="button"
              onClick={carregarConquistas}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white font-semibold rounded-md border border-white/10 hover:bg-white/20 transition-all text-sm"
            >
              <RefreshCw className="h-4 w-4" /> Tentar Novamente
            </button>
          </motion.div>
        ) : loading ? (
          <motion.div
            key="loading-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          >
            {[1, 2, 3].map((i) => (
              <SkeletonAchievement key={i} />
            ))}
          </motion.div>
        ) : conquistas.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
            <Medal className="h-12 w-12 text-neutral-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white">Nenhuma premiação ativa</h3>
            <p className="text-neutral-400 text-sm mt-1">Aguardando o administrador cadastrar novas conquistas gamificadas.</p>
          </div>
        ) : (
          <motion.div
            key="content-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
          >
            {conquistas.map((item) => (
              <motion.div
                key={item.id}
                whileHover={{ y: item.conquistado ? -4 : 0 }}
                className={`glass-card relative overflow-hidden rounded-2xl p-6 border flex flex-col justify-between transition-all duration-300 ${
                  !item.conquistado 
                    ? "border-white/5 bg-white/[0.01] opacity-50" 
                    : "border-purple-500/30 bg-gradient-to-br from-purple-500/[0.03] to-transparent shadow-[0_0_30px_rgba(16,185,129,0.04)]"
                }`}
              >
                {/* Badge Superior Direito de Status */}
                <div className="absolute top-4 right-4 z-20">
                  {item.conquistado ? (
                    <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-purple-500/20 text-purple-400 px-2.5 py-1 rounded-full border border-purple-500/30">
                      <Unlock className="h-3 w-3" /> Liberado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-black/40 text-neutral-400 px-2.5 py-1 rounded-full border border-white/5">
                      <Lock className="h-3 w-3" /> Bloqueado
                    </span>
                  )}
                </div>

                <div>
                  {/* Container do Ícone */}
                  <div className={`h-12 w-12 rounded-xl border flex items-center justify-center mb-5 transition-transform ${
                    item.conquistado 
                      ? "bg-purple-500/10 border-purple-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                      : "bg-white/5 border-white/10 text-neutral-500"
                  }`}>
                    <item.icone className={`h-6 w-6 ${item.conquistado ? item.cor : "text-neutral-500"}`} />
                  </div>

                  {/* Textos Informativos */}
                  <h3 className="text-xl font-black text-white mb-2 leading-tight">
                    {item.titulo}
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed mb-6">
                    {item.descricao}
                  </p>
                </div>

                {/* MECÂNICA DE PROGRESSO GAMIFICADA */}
                <div className="space-y-2 mt-auto">
                  <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-neutral-500">Progresso Alvo</span>
                    <span className={item.conquistado ? "text-purple-400" : "text-white"}>
                      {item.progresso.toFixed(0)}%
                    </span>
                  </div>
                  
                  {/* Barra de Progresso */}
                  <div className="h-2 w-full bg-black/50 rounded-full overflow-hidden border border-white/5 relative">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progresso}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className={`h-full ${
                        item.conquistado 
                          ? 'bg-gradient-to-r from-purple-500 to-teal-400' 
                          : 'bg-gradient-to-r from-purple-600 to-indigo-500'
                      }`}
                    />
                  </div>

                  {/* Requisito de Valor Base */}
                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-neutral-500 font-medium">Requisito</span>
                    <span className={`font-bold ${item.conquistado ? "text-purple-400" : "text-neutral-300"}`}>
                      {item.requisito}
                    </span>
                  </div>
                </div>

              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}