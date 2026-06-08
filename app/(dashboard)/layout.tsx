import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { NotificationBell } from "@/components/NotificationBell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#080b14] text-white relative antialiased">

      {/* Orbs de gradiente animados no fundo */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, #7c3aed 0%, #4f46e5 40%, transparent 70%)",
            animation: "orb-drift 18s ease-in-out infinite",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[550px] h-[550px] rounded-full opacity-15"
          style={{
            background: "radial-gradient(circle, #f97316 0%, #ec4899 50%, transparent 70%)",
            animation: "orb-drift 22s ease-in-out infinite reverse",
            filter: "blur(70px)",
          }}
        />
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #14b8a6 0%, #06b6d4 50%, transparent 70%)",
            animation: "orb-drift 25s ease-in-out infinite",
            filter: "blur(80px)",
          }}
        />
      </div>

      <div className="flex z-10 w-full h-full relative">
        {/* Sidebar — apenas desktop */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 w-full min-w-0 flex flex-col overflow-hidden">
          {/* Barra superior com sino */}
          <div className="flex-shrink-0 flex items-center justify-end px-4 pt-4 md:px-8 md:pt-6 pb-0">
            <NotificationBell />
          </div>

          <main className="flex-1 w-full min-w-0 overflow-y-auto px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-4 scroll-smooth custom-scrollbar">
            {children}
          </main>
        </div>
      </div>

      {/* Bottom Nav — apenas mobile */}
      <BottomNav />
    </div>
  );
}
