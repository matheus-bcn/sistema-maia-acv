"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

const SLIDES = [
  {
    tag: "Metas em tempo real",
    icon: "mdi:bullseye-arrow",
    grad: "linear-gradient(160deg, #3a2470 0%, #241653 40%, #120d2c 100%)",
    glow: "radial-gradient(120% 80% at 28% 20%, rgba(167,139,250,0.40) 0%, transparent 55%)",
    headline: "Bata metas com previsibilidade",
    sub: "Acompanhe o ritmo do time minuto a minuto e saiba exatamente o que falta para fechar o mês.",
  },
  {
    tag: "CRM inteligente",
    icon: "mdi:account-heart",
    grad: "linear-gradient(160deg, #0d3b3a 0%, #0c2a3f 42%, #0a1226 100%)",
    glow: "radial-gradient(120% 80% at 30% 22%, rgba(45,212,191,0.38) 0%, transparent 55%)",
    headline: "Cada cliente no lugar certo",
    sub: "A M.A.I.A lê o histórico de compras e sugere a próxima ação para crescer o seu ticket médio.",
  },
  {
    tag: "Time engajado",
    icon: "mdi:trophy-variant",
    grad: "linear-gradient(160deg, #4a1d3f 0%, #3a1530 42%, #1a0c1f 100%)",
    glow: "radial-gradient(120% 80% at 30% 20%, rgba(236,72,153,0.36) 0%, transparent 55%)",
    headline: "Um time motivado a vender mais",
    sub: "Ranking, metas e premiações que transformam a rotina comercial em resultado todos os dias.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [lembrar, setLembrar] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSlide((s) => (s + 1) % SLIDES.length);
    }, 5500);
  };

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const goSlide = (i: number) => {
    setSlide(i);
    startTimer();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError("E-mail ou senha incorretos. Verifique suas credenciais.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        width: "100%",
        padding: "40px 24px",
        overflow: "hidden",
        background: "#080b14",
        color: "#fff",
        fontFamily: "'Manrope', system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
        boxSizing: "border-box",
      }}
    >
      {/* Background orbs */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -180, left: -140, width: 620, height: 620,
          borderRadius: "50%", opacity: 0.16, filter: "blur(70px)",
          background: "radial-gradient(circle, #7c3aed 0%, #ec4899 50%, transparent 70%)",
          animation: "orb-drift 22s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: -200, right: -160, width: 580, height: 580,
          borderRadius: "50%", opacity: 0.12, filter: "blur(80px)",
          background: "radial-gradient(circle, #14b8a6 0%, #06b6d4 45%, transparent 70%)",
          animation: "orb-drift 27s ease-in-out infinite reverse",
        }} />
      </div>

      {/* Login card */}
      <div style={{
        position: "relative", zIndex: 10, display: "flex",
        width: "100%", maxWidth: 1060, minHeight: 610,
        borderRadius: 26, overflow: "hidden",
        background: "#0e1320",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 40px 100px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.02)",
      }}>

        {/* Visual / Carousel panel (hidden < 880px) */}
        <div className="login-visual-panel" style={{ position: "relative", flex: "0 0 45%", overflow: "hidden" }}>

          {/* Slides */}
          {SLIDES.map((s, i) => (
            <div
              key={i}
              style={{
                position: "absolute", inset: 0,
                transition: "opacity 1s ease",
                opacity: i === slide ? 1 : 0,
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: s.grad, animation: "kenburns 18s ease-in-out infinite alternate" }} />
              <div style={{ position: "absolute", inset: 0, background: s.glow }} />
              <Icon
                icon={s.icon}
                style={{
                  position: "absolute", right: -34, top: "30%",
                  fontSize: 250, color: "rgba(255,255,255,0.07)",
                  animation: "floaty 9s ease-in-out infinite",
                }}
              />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(8,8,20,0) 38%, rgba(8,8,20,0.62) 100%)" }} />
              <div style={{ position: "absolute", left: 30, right: 30, bottom: 76 }}>
                <span style={{
                  display: "inline-block", marginBottom: 13,
                  fontSize: 10, fontWeight: 800, letterSpacing: 2,
                  textTransform: "uppercase", padding: "5px 11px",
                  borderRadius: 999, color: "#fff",
                  background: "rgba(255,255,255,0.14)",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}>{s.tag}</span>
                <h2 style={{ margin: 0, fontSize: 27, fontWeight: 800, lineHeight: 1.18, letterSpacing: "-0.5px", color: "#fff" }}>{s.headline}</h2>
                <p style={{ margin: "11px 0 0", fontSize: 13.5, lineHeight: 1.5, color: "rgba(255,255,255,0.68)", maxWidth: 330 }}>{s.sub}</p>
              </div>
            </div>
          ))}

          {/* Foreground overlay */}
          <div style={{ position: "relative", zIndex: 3, display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", padding: 30, pointerEvents: "none" }}>
            {/* Logo MAIA */}
            <div style={{ display: "flex", alignItems: "center", gap: 11, pointerEvents: "auto" }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                boxShadow: "0 6px 20px rgba(124,58,237,0.5)",
              }}>
                <span style={{ fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>M</span>
              </div>
              <div style={{ lineHeight: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 0.5, color: "#fff" }}>MAIA</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, color: "rgba(255,255,255,0.5)", marginTop: 3 }}>ACV · VENDAS</div>
              </div>
            </div>

            {/* Dot indicators */}
            <div style={{ display: "flex", gap: 7, pointerEvents: "auto" }}>
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goSlide(i)}
                  style={{
                    height: 5, borderRadius: 999, cursor: "pointer", border: "none", padding: 0,
                    transition: "width 0.4s ease, background 0.4s ease",
                    width: i === slide ? 38 : 22,
                    background: i === slide ? "#fff" : "rgba(255,255,255,0.3)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "52px 56px" }}>
          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 800, letterSpacing: "-1px", color: "#fff" }}>Bem-vindo de volta</h1>
          <p style={{ margin: "10px 0 32px", fontSize: 14, color: "rgba(255,255,255,0.5)" }}>
            Não tem uma conta?{" "}
            <span style={{ color: "#c4b5fd", fontWeight: 700, cursor: "default" }}>Solicitar acesso</span>
          </p>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 7 }}>
                E-mail
              </label>
              <input
                type="email"
                required
                placeholder="voce@empresa.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
                  padding: "14px 16px", fontSize: 14, color: "#fff",
                  outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                  transition: "border-color 0.2s, background 0.2s",
                }}
                onFocus={(e) => { e.target.style.borderColor = "rgba(139,92,246,0.6)"; e.target.style.background = "rgba(255,255,255,0.06)"; }}
                onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.04)"; }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 7 }}>
                Senha
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  required
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12,
                    padding: "14px 46px 14px 16px", fontSize: 14, color: "#fff",
                    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(139,92,246,0.6)"; e.target.style.background = "rgba(255,255,255,0.06)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.04)"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label="Mostrar senha"
                  style={{
                    position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                    width: 34, height: 34, borderRadius: 9, display: "flex",
                    alignItems: "center", justifyContent: "center",
                    background: "transparent", border: "none",
                    color: "rgba(255,255,255,0.5)", cursor: "pointer",
                  }}
                >
                  <Icon icon={showPass ? "mdi:eye-off-outline" : "mdi:eye-outline"} style={{ fontSize: 19 }} />
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0 6px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", userSelect: "none" }}>
                <button
                  type="button"
                  onClick={() => setLembrar(!lembrar)}
                  style={{
                    flexShrink: 0, width: 20, height: 20, borderRadius: 6,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "all 0.2s",
                    background: lembrar ? "linear-gradient(135deg, #7c3aed, #ec4899)" : "rgba(255,255,255,0.08)",
                    border: lembrar ? "none" : "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  <Icon icon="mdi:check" style={{ fontSize: 14, color: "#fff", opacity: lembrar ? 1 : 0 }} />
                </button>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Lembrar de mim</span>
              </label>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#c4b5fd", cursor: "default" }}>Esqueci a senha</span>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    margin: 0, padding: "10px 14px", borderRadius: 10, fontSize: 13,
                    color: "#fca5a5", background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: 15, borderRadius: 12,
                fontSize: 15, fontWeight: 700, color: "#fff", cursor: loading ? "not-allowed" : "pointer",
                border: "none", background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                boxShadow: "0 8px 24px rgba(124,58,237,0.4)",
                transition: "box-shadow 0.2s, transform 0.2s",
                opacity: loading ? 0.7 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {loading ? (
                <Icon icon="line-md:loading-loop" className="icon-always" style={{ fontSize: 20 }} />
              ) : "Entrar"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "26px 0" }}>
            <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>ou entre com</span>
            <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button
              type="button"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                padding: 13, borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#fff",
                cursor: "pointer", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)", transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
            >
              <Icon icon="logos:google-icon" style={{ fontSize: 18 }} /> Google
            </button>
            <button
              type="button"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                padding: 13, borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#fff",
                cursor: "pointer", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)", transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
            >
              <Icon icon="mdi:microsoft" style={{ fontSize: 18, color: "#fff" }} /> Microsoft
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes orb-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -26px) scale(1.06); }
          66% { transform: translate(-26px, 18px) scale(0.96); }
        }
        @keyframes kenburns {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
        @keyframes floaty {
          0%, 100% { transform: translateY(0) rotate(-6deg); }
          50% { transform: translateY(-14px) rotate(-6deg); }
        }
        .login-visual-panel {
          display: flex;
        }
        @media (max-width: 880px) {
          .login-visual-panel { display: none !important; }
        }
        input::placeholder { color: rgba(255,255,255,0.4); }
      `}</style>
    </div>
  );
}
