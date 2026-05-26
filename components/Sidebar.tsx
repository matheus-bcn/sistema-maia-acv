"use client"

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, Trophy, Calendar, Medal,
  History, BarChart2, Users, Settings, Tv, LogOut, User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verificarPermissao = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.email) {
        // Blindagem contra Case Sensitivity: Força tudo para minúsculo
        const userEmail = user.email.toLowerCase();
        const masterAdminEmail = (process.env.NEXT_PUBLIC_MASTER_ADMIN_EMAIL || "admin@onlinegrafica.com").toLowerCase();
        
        const isMasterAdmin = userEmail === masterAdminEmail;

        const { data: seller } = await supabase
          .from("sellers")
          .select("is_admin")
          .eq("email", userEmail)
          .maybeSingle(); 
        
        // Libera as rotas de admin incondicionalmente se for a conta master ou se estiver setado no BD
        if (isMasterAdmin || seller?.is_admin) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      }
      setLoading(false);
    };
    
    verificarPermissao();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const rotasVendedor = [
    { nome: "Meu Painel", caminho: "/meu-painel", icone: User },
    { nome: "Ranking", caminho: "/ranking", icone: Trophy },
    { nome: "Calendário", caminho: "/calendario", icone: Calendar },
    { nome: "Premiações", caminho: "/premiacoes", icone: Medal },
  ];

  const rotasAdmin = [
    { nome: "Home", caminho: "/", icone: Home },
    { nome: "Ranking", caminho: "/ranking", icone: Trophy },
    { nome: "Calendário", caminho: "/calendario", icone: Calendar },
    { nome: "Premiações", caminho: "/premiacoes", icone: Medal },
    { nome: "Histórico", caminho: "/historico", icone: History },
    { nome: "Relatório", caminho: "/relatorio", icone: BarChart2 },
    { nome: "Equipe", caminho: "/equipe", icone: Users },
    { nome: "Configuração", caminho: "/configuracao", icone: Settings },
  ];

  const rotas = loading ? [] : (isAdmin ? rotasAdmin : rotasVendedor);

  return (
    <aside className="glass-card flex h-screen w-64 flex-col justify-between border-r border-white/10 p-6 relative z-50">
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        
        <div className="mb-10 flex items-center justify-center relative h-16 w-full">
          <Image 
            src="/logo.png" 
            alt="Logótipo MAIA" 
            fill
            sizes="160px"
            className="object-contain hover:scale-105 transition-transform drop-shadow-[0_0_15px_rgba(255,255,255,0.05)]" 
            priority
          />
        </div>

        <nav className="space-y-2">
          {rotas.map((rota) => {
            const ativo = pathname === rota.caminho;
            return (
              <Link
                key={rota.nome}
                href={rota.caminho}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-300",
                  ativo 
                    ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]" 
                    : "text-neutral-400 hover:bg-white/5 hover:text-white"
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
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-800 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-neutral-700"
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
  );
}