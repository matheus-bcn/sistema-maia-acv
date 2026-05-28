"use client"

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, Trophy, Calendar, Medal,
  History, BarChart2, Users, Settings, Tv, LogOut, User, Upload, Menu, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState("/logo.png");
  // Estado para controlar o menu mobile
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userEmail = user.email?.toLowerCase();
      const masterAdminEmail = (process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL || "admin@onlinegrafica.com").toLowerCase();

      // 1. Verificar permissão
      const { data: seller } = await supabase
        .from("sellers")
        .select("is_admin")
        .eq("email", userEmail)
        .maybeSingle();

      const isMasterAdmin = userEmail === masterAdminEmail;
      setIsAdmin(!!(isMasterAdmin || seller?.is_admin));

      // 2. Carregar logo customizada
      const { data: settings } = await supabase
        .from("company_settings")
        .select("logo_url")
        .maybeSingle();
      
      if (settings?.logo_url) {
        setLogoUrl(settings.logo_url);
      }

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
    { nome: "Home", caminho: "/", icone: Home },
    { nome: "Ranking", caminho: "/ranking", icone: Trophy },
    { nome: "Calendário", caminho: "/calendario", icone: Calendar },
    { nome: "Premiações", caminho: "/premiacoes", icone: Medal },
    { nome: "Histórico", caminho: "/historico", icone: History },
    { nome: "Relatório", caminho: "/relatorio", icone: BarChart2 },
    { nome: "Equipe", caminho: "/equipe", icone: Users },
    { nome: "Configuração", caminho: "/configuracao", icone: Settings },
  ] : [
    { nome: "Meu Painel", caminho: "/meu-painel", icone: User },
    { nome: "Ranking", caminho: "/ranking", icone: Trophy },
    { nome: "Calendário", caminho: "/calendario", icone: Calendar },
    { nome: "Premiações", caminho: "/premiacoes", icone: Medal },
  ];

  return (
    <>
      {/* Botão Hamburger (Visível apenas em Mobile) */}
      <button 
        className="md:hidden fixed top-4 left-4 z-[60] p-2 bg-neutral-900/80 backdrop-blur border border-white/10 rounded-lg text-white"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay Mobile (Fecha ao clicar fora) */}
      {isMobileOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-[55]" 
          onClick={() => setIsMobileOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "glass-card fixed md:static inset-y-0 left-0 z-[58] flex h-screen w-64 flex-col justify-between border-r border-white/10 p-6 transition-transform duration-300 ease-in-out",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex-1 overflow-y-auto pr-2">
          
          {/* LOGO AREA */}
          <div className="mb-10 mt-12 md:mt-0 flex flex-col items-center justify-center relative">
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
                  <Upload className="text-white h-6 w-6" />
                </div>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleLogoUpload} 
            />
          </div>

          <nav className="space-y-2">
            {rotas.map((rota) => {
              const ativo = pathname === rota.caminho;
              return (
                <Link
                  key={rota.nome}
                  href={rota.caminho}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all",
                    ativo ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <rota.icone className="h-5 w-5" />
                  {rota.nome}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2 pt-4 border-t border-white/5 mt-4">
          {isAdmin && (
            <Link
              href="/modo-tv"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-800 px-4 py-3 text-sm font-bold text-white hover:bg-neutral-700 transition-colors"
            >
              <Tv className="h-5 w-5 text-green-400" />
              Modo TV
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}