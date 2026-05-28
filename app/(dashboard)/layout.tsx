import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0a0a0a] text-white relative antialiased">
      {/* Background animado otimizado */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_600px_600px_at_50%_-10%,#1a1a1a,transparent)] pointer-events-none z-0 will-change-transform"
        aria-hidden="true"
      />
      
      {/* Container Principal */}
      <div className="flex z-10 w-full h-full relative">
        <Sidebar />
        
        {/* flex-1: Faz o conteúdo ocupar o espaço restante da Sidebar.
          w-full: Garante largura total.
          min-w-0: Impede que o conteúdo interno (gráficos/tabelas) force o container a crescer além da tela no mobile.
        */}
        <main className="flex-1 w-full min-w-0 overflow-y-auto p-4 md:p-10 scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  );
}