"use client";

import { CosmicCounter } from "@/components/cosmic-counter";
import { useUniverseStore } from "@/lib/store";

export default function Home() {
  const enterUniverse = useUniverseStore((s) => s.enterUniverse);

  return (
    <div className="flex flex-col flex-1 items-center justify-center relative z-10 pointer-events-none">
      <main className="flex flex-col items-center gap-8 select-none">
        {/* The number */}
        <h1 className="font-serif text-[clamp(5rem,15vw,12rem)] leading-none tracking-tight text-white/90">
          13.8
        </h1>

        {/* Ticking counter */}
        <CosmicCounter />

        {/* Tagline */}
        <div className="flex flex-col items-center gap-3 mt-4">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-white/60">
            The Fermi Paradox Simulator
          </p>
          <div className="w-8 h-px bg-white/15" />
          <p className="max-w-sm text-center text-sm leading-relaxed text-white/50 font-sans">
            A journey through 13.8 billion years of cosmic history.
            Every civilisation that rose and fell before us.
          </p>
          {/* The question — frames the paradox explicitly */}
          <p className="font-mono text-[11px] tracking-[0.2em] text-white/30 mt-2 italic">
            If the universe is so vast — where is everyone?
          </p>
        </div>

        {/* Enter button — clearly interactive */}
        <button
          onClick={enterUniverse}
          className="mt-12 pointer-events-auto cursor-pointer group relative"
        >
          <div className="border border-white/20 rounded-lg px-8 py-3 group-hover:border-white/40 group-hover:bg-white/[0.04] transition-all duration-500">
            <p className="font-mono text-[11px] tracking-[0.5em] uppercase text-white/80 group-hover:text-white/95 transition-colors duration-500">
              Enter the Universe
            </p>
          </div>
          {/* Subtle idle pulse */}
          <div className="absolute inset-0 border border-white/10 rounded-lg animate-pulse pointer-events-none" />
        </button>
      </main>

      {/* Bottom left */}
      <div className="fixed bottom-6 left-6 font-mono text-[10px] text-white/25 tracking-widest z-10">
        v0.0.1
      </div>

      {/* Bottom right */}
      <div className="fixed bottom-6 right-6 font-mono text-[10px] text-white/25 tracking-widest z-10">
        {new Date().getFullYear()}
      </div>
    </div>
  );
}
