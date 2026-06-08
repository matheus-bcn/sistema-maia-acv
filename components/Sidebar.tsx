"use client"

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const ROUTE_COLORS: Record<string, string> = {
  "/":           "text-orange-400",
  "/meu-painel": "text-orange-400",
  "/ranking":    "text-yellow-400",
  "/calendario": "text-teal-400",
  "/premiacoes": "text-pink-400",
  "/historico":  "text-blue-400",
  "/relatorio":  "text-violet-400",
  "/equipe":     "text-cyan-400",
  "/configuracao": "text-rose-400",
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState("/logo.png");
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userEmail = user.email?.toLowerCase();
      const masterAdminEmail = (process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL || "admin@onlinegrafica.com").toLowerCase();

      const { data: seller } = await supabase
        .from("sellers")
        .select("is_admin")
        .eq("email", userEmail)
        .maybeSingle();

      const isMasterAdmin = userEmail === masterAdminEmail;
      setIsAdmin(!!(isMasterAdmin || seller?.is_admin));

      const { data: settings } = await supabase
        .from("company_settings")
        .select("logo_url")
        .maybeSingle();

      if (settings?.logo_url) setLogoUrl(settings.logo_url);
      setLoading(false);
    };
    init();
  }, [supabase]);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !event.target.files[0]) return;
    const file = event.target.files[0];
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("brand-assets").upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from("brand-assets").getPublicUrl(fileName);
      const newUrl = publicUrlData.publicUrl;
      await supabase.from("company_settings").upsert({ id: 1, logo_url: newUrl });
      setLogoUrl(newUrl);
      alert("Logo atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao subir logo:", error);
      alert("Falha ao atualizar logo.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const rotas = isAdmin ? [
    { nome: "Home",        caminho: "/",            icone: "line-md:home-md" },
    { nome: "Ranking",     caminho: "/ranking",      icone: "mdi:trophy" },
    { nome: "Calendário",  caminho: "/calendario",   icone: "line-md:calendar" },
    { nome: "Premiações",  caminho: "/premiacoes",   icone: "line-md:star-pulsating-loop" },
    { nome: "Histórico",   caminho: "/historico",    icone: "line-md:watch-loop" },
    { nome: "Relatório",   caminho: "/relatorio",    icone: "mdi:chart-bar" },
    { nome: "Equipe",      caminho: "/equipe",       icone: "mdi:account-group" },
    { nome: "Configuração",caminho: "/configuracao", icone: "line-md:cog-loop" },
  ] : [
    { nome: "Meu Painel",  caminho: "/meu-painel",  icone: "line-md:account" },
    { nome: "Ranking",     caminho: "/ranking",      icone: "mdi:trophy" },
    { nome: "Calendário",  caminho: "/calendario",   icone: "line-md:calendar" },
    { nome: "Premiações",  caminho: "/premiacoes",   icone: "line-md:star-pulsating-loop" },
  ];

  return (
    <>
      {/* Hamburger Mobile */}
      <button
        className="md:hidden fixed top-4 left-4 z-[60] p-2 bg-white/5 backdrop-blur border border-white/10 rounded-xl text-white"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        <Icon icon={isMobileOpen ? "line-md:close" : "line-md:menu"} className="h-5 w-5" />
      </button>

      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 bg-black/70 z-[55]" onClick={() => setIsMobileOpen(false)} />
      )}

      <aside className={cn(
        "fixed md:static inset-y-0 left-0 z-[58] flex h-screen w-60 flex-col justify-between p-5 transition-transform duration-300 ease-in-out",
        "border-r border-white/[0.05] bg-[#080b14]/95 backdrop-blur-xl",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>

        {/* Glow decorativo lateral */}
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-violet-500/30 to-transparent pointer-events-none" />

        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* LOGO */}
          <div className="mb-8 mt-12 md:mt-0 flex flex-col items-center justify-center">
            <div
              onClick={() => isAdmin && fileInputRef.current?.click()}
              className={cn(
                "relative h-16 w-full flex items-center justify-center transition-all",
                isAdmin ? "cursor-pointer group" : "cursor-default"
              )}
            >
              <Image
                src={logoUrl}
                alt="Logo Empresa"
                fill
                sizes="160px"
                className="object-contain transition-transform group-hover:scale-105"
                priority
              />
              {isAdmin && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-lg transition-opacity">
                  <Icon icon="mdi:cloud-upload" className="text-white h-5 w-5" />
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
          </div>

          {/* Separador */}
          <div className="mb-5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <nav className="space-y-1">
            {rotas.map((rota) => {
              const ativo = pathname === rota.caminho;
              const iconColor = ROUTE_COLORS[rota.caminho] ?? "text-white/50";
              return (
                <Link
                  key={rota.nome}
                  href={rota.caminho}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
                    ativo ? "nav-active" : "nav-inactive"
                  )}
                >
                  <Icon icon={rota.icone} className={cn("h-4 w-4 flex-shrink-0", ativo ? "text-violet-300" : iconColor)} />
                  <span>{rota.nome}</span>
                  {ativo && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-400" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="space-y-2 pt-4 mt-4">
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-3" />
          {isAdmin && (
            <Link
              href="/modo-tv"
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white bg-white/5 border border-white/8 hover:bg-white/10 transition-colors"
            >
              <Icon icon="mdi:television" className="h-4 w-4 text-emerald-400" />
              Modo TV
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 px-4 py-2.5 text-sm font-semibold text-white/40 hover:text-red-400 hover:bg-red-500/8 hover:border-red-500/20 transition-all"
          >
            <Icon icon="mdi:logout" className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
