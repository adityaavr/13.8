"use client";

// ---------------------------------------------------------------------------
// 13.8 — Transient Signal Alert
//
// Fires during cosmic timeline playback when the epoch crosses a scheduled
// SignalEvent.atGyr. Slides in from the right, red pulse, two buttons:
//   - INVESTIGATE → camera flies to the system, Xenologist panel opens
//   - IGNORE      → dismiss, playback continues
//
// This is the "we found someone and lost them" beat in the demo.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { useUniverseStore } from "@/lib/store";

export function TransientSignalAlert() {
  const pending = useUniverseStore((s) => s.pendingSignal);
  const dismiss = useUniverseStore((s) => s.dismissSignal);
  const investigate = useUniverseStore((s) => s.investigateSignal);
  const universe = useUniverseStore((s) => s.universe);
  const selectGalaxy = useUniverseStore((s) => s.selectGalaxy);
  const selectSystem = useUniverseStore((s) => s.selectSystem);
  const dismissTimerRef = useRef<number | null>(null);

  // Auto-dismiss after 9s if user does nothing (signal becomes part of
  // the "you were not paying attention" tragedy).
  useEffect(() => {
    if (!pending) return;
    dismissTimerRef.current = window.setTimeout(() => dismiss(), 9000);
    return () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, [pending, dismiss]);

  if (!pending || !universe) return null;

  // Find the civ + system so we can route the investigate action
  const trace = universe.civilizations.find((c) => c.id === pending.civilizationId);
  if (!trace) return null;

  const handleInvestigate = () => {
    investigate(pending);
    selectGalaxy(trace.galaxyId);
    // Wait a beat for the galaxy transition before flying into the system
    setTimeout(() => selectSystem(trace.systemId), 1300);
  };

  return (
    <div className="fixed right-4 md:right-6 top-44 md:top-44 z-30 w-[min(92vw,360px)] pointer-events-auto select-none">
      <div className="relative animate-[fadeIn_400ms_ease-out] bg-black/85 backdrop-blur-md border border-red-400/40 rounded-xl p-4 shadow-[0_0_40px_-10px_rgba(248,113,113,0.4)]">
        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-xl border border-red-400/40 animate-ping pointer-events-none" />

        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
          <p className="font-mono text-[9px] tracking-[0.35em] uppercase text-red-300/85">
            Transient Signal Detected
          </p>
        </div>

        <p className="font-mono text-[13px] tracking-[0.04em] text-white/95 mt-3">
          {pending.headline}
        </p>

        <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-white/45 mt-1.5">
          Bearing: {trace.galaxyId} · {trace.systemId.replace(`${trace.galaxyId}-`, "")}
        </p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={handleInvestigate}
            className="flex-1 font-mono text-[10px] tracking-[0.22em] uppercase text-red-50 bg-red-500/20 hover:bg-red-500/35 border border-red-400/40 rounded-md px-3 py-2 transition-all cursor-pointer"
          >
            Investigate
          </button>
          <button
            onClick={dismiss}
            className="font-mono text-[10px] tracking-[0.22em] uppercase text-white/40 hover:text-white/70 border border-white/10 hover:border-white/25 rounded-md px-3 py-2 transition-all cursor-pointer"
          >
            Ignore
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
