"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, BrainCircuit, User, Sparkles, RotateCcw } from "lucide-react";
import { chatComMAIAAction } from "@/lib/actions/ai-actions";
import type { ContextoMAIA, MensagemHistorico } from "@/lib/actions/ai-actions";

type Mensagem = {
  id: string;
  role: "user" | "model";
  content: string;
};

const MENSAGEM_BOAS_VINDAS =
  "Olá! Sou M.A.I.A, sua analista comercial. Tenho acesso aos dados da equipe em tempo real e posso analisar performance, comparar vendedores, sugerir estratégias e muito mais. Como posso ajudar?";

const PERGUNTAS_RAPIDAS = [
  "Quem está abaixo da meta e o que fazer?",
  "Compare os dois melhores vendedores",
  "Como aumentar o ticket médio da equipe?",
  "Estratégia de fechamento para os próximos dias",
  "Qual vendedor precisa de mais atenção agora?",
  "Dicas de upsell para a equipe",
];

interface MAIAChatProps {
  contexto: ContextoMAIA;
}

export function MAIAChat({ contexto }: MAIAChatProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    { id: "welcome", role: "model", content: MENSAGEM_BOAS_VINDAS },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, loading]);

  const enviar = useCallback(
    async (texto: string) => {
      const trimmed = texto.trim();
      if (!trimmed || loading) return;

      const novaMensagem: Mensagem = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
      };

      setMensagens((prev) => [...prev, novaMensagem]);
      setInput("");
      setLoading(true);

      // Build history excluding welcome message and the new message just added
      const historico: MensagemHistorico[] = mensagens
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const resultado = await chatComMAIAAction(trimmed, contexto, historico);
        setMensagens((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}`,
            role: "model",
            content: resultado.success && resultado.resposta
              ? resultado.resposta
              : "Desculpe, não consegui processar sua pergunta. Tente novamente.",
          },
        ]);
      } catch {
        setMensagens((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}`,
            role: "model",
            content: "Erro de conexão. Tente novamente em instantes.",
          },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    },
    [loading, mensagens, contexto]
  );

  const reiniciar = () => {
    setMensagens([{ id: "welcome", role: "model", content: MENSAGEM_BOAS_VINDAS }]);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const mostrarSugestoes = mensagens.length <= 1;

  return (
    <div className="flex flex-col h-[640px] glass-card rounded-xl border border-fuchsia-500/30 bg-purple-500/5 overflow-hidden relative">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-500" />

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0">
        <div className="p-2 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20">
          <Sparkles className="h-5 w-5 text-fuchsia-400" />
        </div>
        <div>
          <h3 className="font-bold text-white text-sm uppercase tracking-wider">
            Chat com M.A.I.A
          </h3>
          <p className="text-xs text-neutral-400">Analista Comercial Inteligente</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 hidden sm:block">Online</span>
          </div>
          <button
            onClick={reiniciar}
            title="Nova conversa"
            className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/10 transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        <AnimatePresence initial={false}>
          {mensagens.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "model" && (
                <div className="w-7 h-7 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <BrainCircuit className="h-3.5 w-3.5 text-fuchsia-400" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-fuchsia-500/20 border border-fuchsia-500/30 text-white rounded-tr-sm"
                    : "bg-white/[0.05] border border-white/10 text-neutral-200 rounded-tl-sm"
                }`}
              >
                {msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </motion.div>
          ))}

          {loading && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-2.5 justify-start"
            >
              <div className="w-7 h-7 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center shrink-0">
                <BrainCircuit className="h-3.5 w-3.5 text-fuchsia-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  {[0, 150, 300].map((delay) => (
                    <div
                      key={delay}
                      className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      <AnimatePresence>
        {mostrarSugestoes && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-3 shrink-0"
          >
            <p className="text-xs text-neutral-500 mb-2">Perguntas sugeridas:</p>
            <div className="flex flex-wrap gap-1.5">
              {PERGUNTAS_RAPIDAS.map((p) => (
                <button
                  key={p}
                  onClick={() => enviar(p)}
                  disabled={loading}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-neutral-300 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/30 hover:text-white transition-all disabled:opacity-40"
                >
                  {p}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-white/10 shrink-0">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(input);
              }
            }}
            placeholder="Pergunte sobre vendas, estratégias, performance..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-fuchsia-500/50 focus:bg-white/[0.08] transition-all"
            disabled={loading}
          />
          <button
            onClick={() => enviar(input)}
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
