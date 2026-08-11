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