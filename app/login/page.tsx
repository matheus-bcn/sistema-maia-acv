"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6 overflow-hidden bg-[#080b14]">

      {/* Orbs de fundo vibrantes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-25"
          style={{
            background: "radial-gradient(circle, #7c3aed 0%, #4f46e5 50%, transparent 70%)",
            filter: "blur(60px)",
            animation: "orb-drift 18s ease-in-out infinite",
          }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-[450px] h-[450px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, #f97316 0%, #ec4899 50%, transparent 70%)",
            filter: "blur(70px)",
            animation: "orb-drift 22s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #14b8a6 0%, #06b6d4 60%, transparent 80%)",
            filter: "blur(80px)",
            animation: "orb-drift 26s ease-in-out infinite",
          }}
        />
      </div>

      <motion.form
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        onSubmit={handleLogin}
        className="relative z-10 w-full max-w-md"
      >
        {/* Card com borda gradiente */}
        <div className="rounded-2xl p-px" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.4), rgba(236,72,153,0.2), rgba(249,115,22,0.15))" }}>
          <div className="rounded-2xl bg-[#0d1117]/90 backdrop-blur-2xl p-8">

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-8 flex flex-col items-center gap-3"
            >
              <div className="relative w-20 h-20 mb-2">
                <Image
                  src="/logo.png"
                  alt="Logo A.C.V"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-gradient-purple">A.C.V</h1>
              <p className="text-sm text-white/40 text-center">Acesso ao painel comercial</p>
            </motion.div>

            <div className="space-y-4">
              <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
                <label className="text-xs font-bold uppercase tracking-widest text-white/40">E-mail</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
                />
              </motion.div>
              <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                <label className="text-xs font-bold uppercase tracking-widest text-white/40">Senha</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
                />
              </motion.div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-red-400 text-center bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                {error}
              </motion.p>
            )}

            <motion.button
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-50 transition-all btn-gradient-orange"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
            </motion.button>
          </div>
        </div>
      </motion.form>

      <style>{`
        @keyframes orb-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.97); }
        }
      `}</style>
    </div>
  );
}
