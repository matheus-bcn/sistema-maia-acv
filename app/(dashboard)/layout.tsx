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
      
      <div className="flex z-10 w-full h-full relative">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6 md:p-10 scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  );
}