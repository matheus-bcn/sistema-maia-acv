"use client"

// Esqueleto para os Cards pequenos (Topo)
export function SkeletonCard() {
  return (
    <div className="glass-card rounded-xl p-5 h-32 flex flex-col justify-center animate-skeleton">
      <div className="h-3 w-24 bg-white/10 rounded mb-4"></div>
      <div className="h-8 w-16 bg-white/20 rounded"></div>
    </div>
  );
}

// Esqueleto para o Gráfico e Termômetro (Centro)
export function SkeletonChart() {
  return (
    <div className="glass-card rounded-xl p-6 h-[350px] w-full flex flex-col animate-skeleton">
      <div className="flex justify-between mb-8">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-white/10 rounded"></div>
          <div className="h-3 w-48 bg-white/5 rounded"></div>
        </div>
        <div className="h-8 w-24 bg-white/10 rounded"></div>
      </div>
      <div className="flex-1 w-full bg-white/[0.02] rounded-lg"></div>
    </div>
  );
}