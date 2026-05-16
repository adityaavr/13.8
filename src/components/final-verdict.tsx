"use client";

// ---------------------------------------------------------------------------
// 13.8 — Final Verdict (cinematic)
//
// Triggered when cosmic timeline playback completes. The universe goes
// black, Cosmographer streams its final pronouncement, then the RESTART
// button appears with a fresh seed.
//
// This is the closing beat: "Every universe we simulate, the answer is
// the same. They were there. They aren't anymore."
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { useUniverseStore } from "@/lib/store";
import { cosmographerScript } from "@/lib/agent-scripts";
import { AgentStream } from "./agent-stream";

export function FinalVerdict() {
  const open = useUniverseStore((s) => s.verdictOpen);
  const universe = useUniverseStore((s) => s.universe);
  const close = useUniverseStore((s) => s.closeVerdict);
  const regenerate = useUniverseStore((s) => s.regenerate);
  const loneliness = useUniverseStore((s) => s.lonelinessGyrYears);
  const [streamDone, setStreamDone] = useState(false);
  const [codaTimerFired, setCodaTimerFired] = useState(false);

  // Procedural script tailored to the final universe state. (Phase 2: stream
  // a real Cosmographer call here.)
  const script = useMemo(
    () => (universe ? cosmographerScript(universe) : []),
    [universe],
  );

  // Pause showing the coda by 1.4s after the stream completes for drama.
  // (No setState-in-effect: timer only sets to true, never back to false.)
  useEffect(() => {
    if (!streamDone) return;
    const t = setTimeout(() => setCodaTimerFired(true), 1400);
    return () => clearTimeout(t);
  }, [streamDone]);

  const showCoda = streamDone && codaTimerFired;

  if (!open || !universe) return null;

  const lonelinessYears = loneliness * 1e9;
  const lonelinessText =
    lonelinessYears >= 1e9
      ? `${(lonelinessYears / 1e9).toFixed(2)} billion civ-years`
      : lonelinessYears >= 1e6
      ? `${(lonelinessYears / 1e6).toFixed(2)} million civ-years`
      : `${Math.round(lonelinessYears).toLocaleString()} civ-years`;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center pointer-events-auto animate-in fade-in duration-[1200ms]">
      <div className="max-w-2xl w-full px-8 md:px-12 py-10 space-y-10 select-none">
        {/* Eyebrow */}
        <div className="text-center">
          <p className="font-mono text-[10px] tracking-[0.5em] uppercase text-white/40">
            The Verdict
          </p>
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/22 mt-2">
            Seed {universe.seed.toString(16)}
          </p>
        </div>

        {/* Streamed Cosmographer pronouncement — Opus 4.7, server-side */}
        <div className="bg-black/60 backdrop-blur-sm rounded-2xl border border-white/[0.07] px-7 py-8">
          <AgentStream
            label="Cosmographer"
            agent="finalVerdict"
            seed={universe.seed}
            fallbackScript={script}
            resetKey={String(universe.seed)}
            onComplete={() => setStreamDone(true)}
          />
        </div>

        {/* Coda — appears after the stream lands */}
        <div
          className={`text-center space-y-6 transition-all duration-[1600ms] ${
            showCoda ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          <div className="space-y-2">
            <p className="font-mono text-[10px] tracking-[0.32em] uppercase text-white/35">
              Loneliness Accrued
            </p>
            <p className="font-serif text-2xl md:text-3xl text-white/90 tracking-wide">
              {lonelinessText}
            </p>
          </div>

          <div className="w-10 h-px bg-white/15 mx-auto" />

          <p className="font-serif text-lg md:text-xl text-white/80 leading-snug max-w-lg mx-auto italic">
            They were there. They aren&rsquo;t anymore.
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                close();
                regenerate();
              }}
              className="font-mono text-[10px] tracking-[0.32em] uppercase text-white/75 hover:text-white border border-white/15 hover:border-white/35 rounded-lg px-5 py-2.5 transition-all cursor-pointer"
            >
              Run Another Universe
            </button>
            <button
              onClick={close}
              className="font-mono text-[10px] tracking-[0.22em] uppercase text-white/30 hover:text-white/60 px-4 py-2 transition-all cursor-pointer"
            >
              Stay Here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
