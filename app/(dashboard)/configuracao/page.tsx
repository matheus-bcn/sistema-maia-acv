"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { createClient } from "@/lib/supabase/client";
import { getTeamGoal, getIndividualBaseGoal, getAllSellerGoals, upsertSellerGoal } from "@/lib/data/goals";
import { listSellers } from "@/lib/data/sellers";

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

const inputClass =
  "w-full bg-[rgba(0,0,0,0.4)] border border-[rgba(255,255,255,0.1)] rounded-[10px] px-[13px] py-[10px] text-sm text-white outline-none focus:border-[rgba(139,92,246,0.5)] transition-colors placeholder:text-[rgba(255,255,255,0.2)]";

const labelClass =
  "block text-[11px] font-bold uppercase tracking-[0.5px] text-[rgba(255,255,255,0.4)] mb-2";

const cardClass =
  "rounded-[18px] p-[22px] bg-[rgba(255,255,255,0.025)] border border-[rgba(255,255,255,0.06)]";

type Aba = "perfil" | "metas" | "notif" | "integra";

interface NotifState {
  metas: boolean;
  churn: boolean;
  ranking: boolean;
  resumo: boolean;
}

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 9999,
        background: value
          ? "linear-gradient(135deg, #7c3aed, #ec4899)"
          : "rgba(255,255,255,0.12)",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.2s",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: value ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: 9999,
          background: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          transition: "left 0.2s",
          display: "block",
        }}
      />
    </button>
  );
}

export default function ConfiguracaoPage() {
  const supabase = useMemo(() => createClient(), []);

  const [abaAtiva, setAbaAtiva] = useState<Aba>("perfil");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [metaEquipe, setMetaEquipe] = useState("0,00");
  const [metaIndividual, setMetaIndividual] = useState("0,00");
  const [metasVendedores, setMetasVendedores] = useState<{ id: string; name: string; value: string }[]>([]);
  const [comissaoBase, setComissaoBase] = useState("2,50");
  const [comissaoBonus, setComissaoBonus] = useState("4,00");

  const [notif, setNotif] = useState<NotifState>({
    metas: true,
    churn: true,
    ranking: false,
    resumo: true,
  });

  const [perfilNome, setPerfilNome] = useState("");
  const [perfilCargo, setPerfilCargo] = useState("");
  const [perfilEmail, setPerfilEmail] = useState("");
  const [perfilTelefone, setPerfilTelefone] = useState("");

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setFeedback(null);

    try {
      let team = 0;
      let ind = 0;

      try { team = await getTeamGoal(supabase); } catch (_) {}
      try { ind = await getIndividualBaseGoal(supabase); } catch (_) {}

      setMetaEquipe(formatCurrency(team || 0));
      setMetaIndividual(formatCurrency(ind || 0));

      try {
        const { data: settings } = await supabase
          .from("company_settings")
          .select("commission_rate, commission_rate_bonus")
          .maybeSingle();
        if (settings?.commission_rate != null) {
          setComissaoBase(String(Number(settings.commission_rate)).replace(".", ","));
          setComissaoBonus(String(Number(settings.commission_rate_bonus ?? 4)).replace(".", ","));
        }
      } catch (_) {}

      try {
        const [sellers, sellerGoalsMap] = await Promise.all([
          listSellers(supabase, "Ativo"),
          getAllSellerGoals(supabase),
        ]);
        const ativos = sellers.filter((s: any) => !s.is_admin);
        setMetasVendedores(
          ativos.map((s: any) => ({
            id: s.id,
            name: s.name,
            value: formatCurrency(sellerGoalsMap[s.id] ?? ind ?? 25000),
          }))
        );
      } catch (_) {}

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: seller } = await supabase
            .from("sellers")
            .select("name, email, role, phone")
            .eq("auth_user_id", user.id)
            .maybeSingle();
          if (seller) {
            setPerfilNome(seller.name || "");
            setPerfilCargo(seller.role || "");
            setPerfilEmail(seller.email || user.email || "");
            setPerfilTelefone(seller.phone || "");
          } else {
            setPerfilEmail(user.email || "");
          }
        }
      } catch (_) {}
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
      const monthYearStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

      const { data: existingTeam } = await supabase
        .from("goals")
        .select("id")
        .eq("type", "equipe")
        .eq("month_year", monthYearStr)
        .limit(1)
        .maybeSingle();
      if (existingTeam?.id) {
        await supabase.from("goals").update({ target_value: teamNum }).eq("id", existingTeam.id);
      } else {
        await supabase.from("goals").insert({ type: "equipe", target_value: teamNum, seller_id: null, month_year: monthYearStr });
      }

      const { data: existingInd } = await supabase
        .from("goals")
        .select("id")
        .eq("type", "individual")
        .is("seller_id", null)
        .eq("month_year", monthYearStr)
        .limit(1)
        .maybeSingle();
      if (existingInd?.id) {
        await supabase.from("goals").update({ target_value: indNum }).eq("id", existingInd.id);
      } else {
        await supabase.from("goals").insert({ type: "individual", target_value: indNum, seller_id: null, month_year: monthYearStr });
      }

      await Promise.all(
        metasVendedores.map((v) => upsertSellerGoal(supabase, v.id, parseCurrency(v.value)))
      );

      const rateBase = parseFloat(comissaoBase.replace(",", ".")) || 2.5;
      const rateBonus = parseFloat(comissaoBonus.replace(",", ".")) || 4.0;
      const { data: existingSettings } = await supabase.from("company_settings").select("id").limit(1).maybeSingle();
      if (existingSettings?.id) {
        await supabase.from("company_settings").update({ commission_rate: rateBase, commission_rate_bonus: rateBonus }).eq("id", existingSettings.id);
      } else {
        await supabase.from("company_settings").insert({ commission_rate: rateBase, commission_rate_bonus: rateBonus });
      }

      setFeedback({ type: "success", message: "Metas salvas com sucesso!" });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: "error", message: `Falha ao salvar metas: ${err.message || "Erro desconhecido."}` });
    } finally {
      setSaving(false);
    }
  };

  const abas: { id: Aba; nome: string; icone: string }[] = [
    { id: "perfil", nome: "Perfil", icone: "mdi:account-circle" },
    { id: "metas", nome: "Metas", icone: "mdi:flag-checkered" },
    { id: "notif", nome: "Notificações", icone: "mdi:bell" },
    { id: "integra", nome: "Integrações", icone: "mdi:connection" },
  ];

  const iniciais = perfilNome
    ? perfilNome
        .split(" ")
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "?";

  const integracoes = [
    { icone: "mdi:whatsapp", cor: "#4ade80", bg: "rgba(74,222,128,0.12)", nome: "WhatsApp Business", desc: "Mensagens e atendimento", conectado: true },
    { icone: "mdi:database", cor: "#60a5fa", bg: "rgba(96,165,250,0.12)", nome: "ERP/Faturamento", desc: "Dados de vendas e notas", conectado: true },
    { icone: "mdi:calendar", cor: "#fb923c", bg: "rgba(251,146,60,0.12)", nome: "Google Calendar", desc: "Agenda e reuniões", conectado: true },
    { icone: "mdi:instagram", cor: "#f472b6", bg: "rgba(244,114,182,0.12)", nome: "Instagram Ads", desc: "Campanhas e leads pagos", conectado: false },
  ];

  const notifItems: { key: keyof NotifState; title: string; desc: string }[] = [
    { key: "metas", title: "Metas em risco", desc: "Avisar quando uma meta estiver atrasada" },
    { key: "churn", title: "Clientes dormentes", desc: "Alertar sobre clientes sem comprar há +30 dias" },
    { key: "ranking", title: "Mudança no ranking", desc: "Notificar quando alguém troca de posição" },
    { key: "resumo", title: "Resumo diário da MAIA", desc: "Receber o briefing às 8h todo dia" },
  ];

  return (
    <div>
      {/* Header */}
      <header className="mb-8 flex items-center gap-4">
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(251,113,133,0.22), rgba(236,72,153,0.12))",
            border: "1px solid rgba(251,113,133,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon icon="line-md:cog-loop" style={{ color: "#fb7185", fontSize: 22 }} />
        </div>
        <div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-0.8px",
              color: "#fff",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Configuração
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0, marginTop: 2 }}>
            Preferências do sistema, metas e integrações
          </p>
        </div>
      </header>

      {/* Layout grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "210px 1fr",
          gap: 22,
          alignItems: "start",
        }}
        className="cfg-grid"
      >
        {/* Nav lateral */}
        <nav
          style={{
            position: "sticky",
            top: 0,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
          className="cfg-nav"
        >
          {abas.map((aba) => {
            const ativo = abaAtiva === aba.id;
            return (
              <button
                key={aba.id}
                type="button"
                onClick={() => {
                  setAbaAtiva(aba.id);
                  setFeedback(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 13px",
                  borderRadius: 11,
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: ativo
                    ? "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.12))"
                    : "transparent",
                  border: ativo
                    ? "1px solid rgba(139,92,246,0.3)"
                    : "1px solid transparent",
                  color: ativo ? "#fff" : "rgba(255,255,255,0.45)",
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <Icon icon={aba.icone} style={{ fontSize: 17, flexShrink: 0 }} />
                {aba.nome}
              </button>
            );
          })}
        </nav>

        {/* Painel de conteúdo */}
        <div style={{ maxWidth: 680 }}>
          <AnimatePresence mode="wait">
            {feedback && (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "13px 16px",
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  background:
                    feedback.type === "success"
                      ? "rgba(124,58,237,0.12)"
                      : "rgba(239,68,68,0.1)",
                  border:
                    feedback.type === "success"
                      ? "1px solid rgba(139,92,246,0.25)"
                      : "1px solid rgba(239,68,68,0.25)",
                  color: feedback.type === "success" ? "#a78bfa" : "#f87171",
                }}
              >
                <Icon
                  icon={feedback.type === "success" ? "mdi:check-circle" : "mdi:alert-circle"}
                  style={{ fontSize: 18, flexShrink: 0 }}
                />
                {feedback.message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Seção Perfil */}
          {abaAtiva === "perfil" && (
            <div className={cardClass}>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>Perfil</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                  Como você aparece para a equipe
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 9999,
                    background: "linear-gradient(135deg, #f97316, #ec4899)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    fontWeight: 800,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {iniciais}
                </div>
                <button
                  type="button"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 10,
                    color: "rgba(255,255,255,0.55)",
                    fontSize: 13,
                    fontWeight: 700,
                    padding: "8px 14px",
                    cursor: "pointer",
                  }}
                >
                  Trocar foto
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className={labelClass}>Nome</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={perfilNome}
                    onChange={(e) => setPerfilNome(e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <label className={labelClass}>Cargo</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={perfilCargo}
                    onChange={(e) => setPerfilCargo(e.target.value)}
                    placeholder="Ex: Gerente Comercial"
                  />
                </div>
                <div>
                  <label className={labelClass}>E-mail</label>
                  <input
                    type="email"
                    className={inputClass}
                    value={perfilEmail}
                    onChange={(e) => setPerfilEmail(e.target.value)}
                    placeholder="email@empresa.com"
                  />
                </div>
                <div>
                  <label className={labelClass}>Telefone</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={perfilTelefone}
                    onChange={(e) => setPerfilTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Seção Metas */}
          {abaAtiva === "metas" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className={cardClass}>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>
                    Metas & Premiação
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                    Parâmetros que alimentam o ranking e os bônus
                  </p>
                </div>

                {loading ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {[0, 1].map((i) => (
                      <div
                        key={i}
                        style={{
                          height: 68,
                          borderRadius: 10,
                          background: "rgba(255,255,255,0.04)",
                          animation: "pulse 1.5s infinite",
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                      <div>
                        <label className={labelClass}>Meta mensal do time</label>
                        <div style={{ position: "relative" }}>
                          <span
                            style={{
                              position: "absolute",
                              left: 13,
                              top: "50%",
                              transform: "translateY(-50%)",
                              fontSize: 13,
                              fontWeight: 700,
                              color: "rgba(255,255,255,0.3)",
                            }}
                          >
                            R$
                          </span>
                          <input
                            type="text"
                            value={metaEquipe}
                            onChange={handleMetaEquipeChange}
                            className={inputClass}
                            style={{ paddingLeft: 36 }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Meta individual base</label>
                        <div style={{ position: "relative" }}>
                          <span
                            style={{
                              position: "absolute",
                              left: 13,
                              top: "50%",
                              transform: "translateY(-50%)",
                              fontSize: 13,
                              fontWeight: 700,
                              color: "rgba(255,255,255,0.3)",
                            }}
                          >
                            R$
                          </span>
                          <input
                            type="text"
                            value={metaIndividual}
                            onChange={handleMetaIndividualChange}
                            className={inputClass}
                            style={{ paddingLeft: 36 }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <div>
                        <label className={labelClass}>Comissão base (%)</label>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            value={comissaoBase}
                            onChange={(e) => setComissaoBase(e.target.value.replace(/[^0-9,]/g, ""))}
                            className={inputClass}
                            style={{ paddingRight: 32 }}
                            placeholder="2,50"
                          />
                          <span
                            style={{
                              position: "absolute",
                              right: 13,
                              top: "50%",
                              transform: "translateY(-50%)",
                              fontSize: 13,
                              fontWeight: 700,
                              color: "rgba(255,255,255,0.3)",
                            }}
                          >
                            %
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Comissão bônus (%)</label>
                        <div style={{ position: "relative" }}>
                          <input
                            type="text"
                            value={comissaoBonus}
                            onChange={(e) => setComissaoBonus(e.target.value.replace(/[^0-9,]/g, ""))}
                            className={inputClass}
                            style={{ paddingRight: 32 }}
                            placeholder="4,00"
                          />
                          <span
                            style={{
                              position: "absolute",
                              right: 13,
                              top: "50%",
                              transform: "translateY(-50%)",
                              fontSize: 13,
                              fontWeight: 700,
                              color: "rgba(255,255,255,0.3)",
                            }}
                          >
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {!loading && metasVendedores.length > 0 && (
                <div className={cardClass}>
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: 0 }}>
                      Metas por Vendedor
                    </p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                      Meta personalizada por vendedor. Deixe igual à base para usar o padrão.
                    </p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {metasVendedores.map((v) => (
                      <div
                        key={v.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                          padding: "12px 14px",
                          borderRadius: 12,
                          background: "rgba(0,0,0,0.25)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 9999,
                              background: "rgba(249,115,22,0.18)",
                              border: "1px solid rgba(249,115,22,0.3)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 11,
                              fontWeight: 800,
                              color: "#fb923c",
                              flexShrink: 0,
                            }}
                          >
                            {v.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                            {v.name.split(" ")[0]}
                          </span>
                        </div>
                        <div style={{ position: "relative" }}>
                          <span
                            style={{
                              position: "absolute",
                              left: 10,
                              top: "50%",
                              transform: "translateY(-50%)",
                              fontSize: 12,
                              fontWeight: 700,
                              color: "rgba(255,255,255,0.3)",
                            }}
                          >
                            R$
                          </span>
                          <input
                            type="text"
                            value={v.value}
                            onChange={(e) => {
                              const formatted = formatCurrency(e.target.value);
                              setMetasVendedores((prev) =>
                                prev.map((x) => (x.id === v.id ? { ...x, value: formatted } : x))
                              );
                            }}
                            className={inputClass}
                            style={{ paddingLeft: 32, fontSize: 13, fontWeight: 700, color: "#fb923c" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Seção Notificações */}
          {abaAtiva === "notif" && (
            <div className={cardClass}>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>Notificações</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                  Quando a M.A.I.A deve te avisar
                </p>
              </div>

              <div>
                {notifItems.map((item, i) => (
                  <div
                    key={item.key}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 14,
                      padding: "13px 0",
                      borderBottom:
                        i < notifItems.length - 1
                          ? "1px solid rgba(255,255,255,0.05)"
                          : "none",
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>
                        {item.title}
                      </p>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "3px 0 0" }}>
                        {item.desc}
                      </p>
                    </div>
                    <Toggle
                      value={notif[item.key]}
                      onChange={(v) => setNotif((prev) => ({ ...prev, [item.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Seção Integrações */}
          {abaAtiva === "integra" && (
            <div className={cardClass}>
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>Integrações</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "4px 0 0" }}>
                  Conexões que abastecem os dados da MAIA
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {integracoes.map((integ) => (
                  <div
                    key={integ.nome}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      borderRadius: 12,
                      padding: "13px 15px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: integ.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon icon={integ.icone} style={{ fontSize: 20, color: integ.cor }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>
                        {integ.nome}
                      </p>
                      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>
                        {integ.desc}
                      </p>
                    </div>
                    {integ.conectado ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#4ade80",
                          background: "rgba(74,222,128,0.12)",
                          border: "1px solid rgba(74,222,128,0.28)",
                          borderRadius: 8,
                          padding: "4px 10px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Conectado
                      </span>
                    ) : (
                      <button
                        type="button"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#fff",
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.16)",
                          borderRadius: 8,
                          padding: "4px 10px",
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                        }}
                      >
                        Conectar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rodapé de ações */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 20,
            }}
          >
            <button
              type="button"
              onClick={() => setFeedback(null)}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.55)",
                padding: "11px 20px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            {abaAtiva === "metas" && (
              <button
                type="button"
                onClick={salvarMetas}
                disabled={saving || loading}
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #ec4899)",
                  boxShadow: "0 6px 20px rgba(124,58,237,0.35)",
                  color: "#fff",
                  padding: "11px 22px",
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: saving || loading ? "not-allowed" : "pointer",
                  opacity: saving || loading ? 0.6 : 1,
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {saving && (
                  <Icon icon="mdi:loading" style={{ fontSize: 16, animation: "spin 1s linear infinite" }} />
                )}
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 1000px) {
          .cfg-grid { grid-template-columns: 1fr !important; }
          .cfg-nav { flex-direction: row !important; overflow-x: auto; position: static !important; gap: 6px !important; padding-bottom: 4px; }
        }
      `}</style>
    </div>
  );
}
