"use client";

// ---------------------------------------------------------------------------
// 13.8 — Title screen ("Where are they?")
//
// Cinematic intro. Four beats:
//   1. Black void (1s)
//   2. The question fades in: "Where are they?"
//   3. Tagline + universe-age counter fade in
//   4. BEGIN SURVEY button appears
//
// Make the viewer feel the silence before they click anything.
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { CosmicCounter } from "@/components/cosmic-counter";
import { useUniverseStore } from "@/lib/store";

export default function TitleScreen() {
  const enterUniverse = useUniverseStore((s) => s.enterUniverse);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Pacing: q → tagline → button. Total ~5s before button appears.
    const t1 = setTimeout(() => setPhase(1), 1000);
    const t2 = setTimeout(() => setPhase(2), 2800);
    const t3 = setTimeout(() => setPhase(3), 4600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div className="flex flex-col flex-1 items-center justify-center relative z-10 pointer-events-none">
      <main className="flex flex-col items-center gap-10 select-none px-6 max-w-3xl">
        {/* The question — load-bearing */}
        <h1
          className={`font-serif text-[clamp(3rem,9vw,7.5rem)] leading-[1.05] tracking-tight text-center transition-all duration-[2400ms] ease-out
            ${phase >= 1 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
            text-white/90`}
        >
          Where are they?
        </h1>

        {/* Tagline block */}
        <div
          className={`flex flex-col items-center gap-4 transition-opacity duration-[2200ms] ease-out
            ${phase >= 2 ? "opacity-100" : "opacity-0"}`}
        >
          <p className="font-mono text-[11px] tracking-[0.42em] uppercase text-white/55">
            A simulation of the Fermi paradox
          </p>
          <div className="w-8 h-px bg-white/15" />
          <p className="max-w-md text-center text-[13px] leading-relaxed text-white/45 font-sans">
            Thirteen point eight billion years of cosmic history. Every
            civilisation that rose and fell before us. The vast silence in
            between.
          </p>
          <CosmicCounter />
        </div>

        {/* Begin button — clearly interactive */}
        <button
          onClick={enterUniverse}
          className={`mt-6 pointer-events-auto cursor-pointer group relative transition-all duration-[1800ms] ease-out
            ${phase >= 3 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}
        >
          <div className="border border-white/20 rounded-lg px-9 py-3.5 group-hover:border-white/40 group-hover:bg-white/[0.04] transition-all duration-500">
            <p className="font-mono text-[11px] tracking-[0.5em] uppercase text-white/85 group-hover:text-white/95 transition-colors duration-500">
              Begin Survey
            </p>
          </div>
          <div className="absolute inset-0 border border-white/10 rounded-lg animate-pulse pointer-events-none" />
        </button>
      </main>

      {/* Bottom decorations */}
      <div className="fixed bottom-6 left-6 font-mono text-[10px] text-white/25 tracking-widest z-10">
        13.8 · v0.1
      </div>
      <div className="fixed bottom-6 right-6 font-mono text-[10px] text-white/25 tracking-widest z-10">
        {new Date().getFullYear()}
      </div>
    </div>
  );
}
