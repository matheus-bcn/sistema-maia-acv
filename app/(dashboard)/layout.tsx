import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#080b14] text-white relative antialiased">

      {/* Orbs de gradiente animados no fundo */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        {/* Orb roxo — superior esquerdo */}
        <div
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, #7c3aed 0%, #4f46e5 40%, transparent 70%)",
            animation: "orb-drift 18s ease-in-out infinite",
            filter: "blur(60px)",
          }}
        />
        {/* Orb laranja — inferior direito */}
        <div
          className="absolute -bottom-40 -right-40 w-[550px] h-[550px] rounded-full opacity-15"
          style={{
            background: "radial-gradient(circle, #f97316 0%, #ec4899 50%, transparent 70%)",
            animation: "orb-drift 22s ease-in-out infinite reverse",
            filter: "blur(70px)",
          }}
        />
        {/* Orb teal — centro superior */}
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
        <Sidebar />
        <main className="flex-1 w-full min-w-0 overflow-y-auto p-4 md:p-8 scroll-smooth custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
}
