"use client";

// ---------------------------------------------------------------------------
// 13.8 — Final Report / "You are alone."
//
// A floating button that opens a survey summary overlay.
// The emotional payload of the entire project.
// ---------------------------------------------------------------------------

import { useState, useMemo } from "react";
import { useUniverseStore } from "@/lib/store";

export function FinalReport() {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);
  const universe = useUniverseStore((s) => s.universe);
  const enterUniverse = useUniverseStore((s) => s.enterUniverse);
  const resetEpoch = useUniverseStore((s) => s.resetEpoch);
  const [open, setOpen] = useState(false);
  const [showFinalLine, setShowFinalLine] = useState(false);

  const stats = useMemo(() => {
    if (!universe) return null;
    let totalSystems = 0;
    let totalPlanets = 0;
    let habitableWorlds = 0;
    universe.galaxies.forEach((g) => {
      totalSystems += g.systems.length;
      g.systems.forEach((s) => {
        totalPlanets += s.planets.length;
        habitableWorlds += s.planets.filter((p) => p.habitable).length;
      });
    });
    return {
      galaxies: universe.galaxies.length,
      totalSystems,
      totalPlanets,
      habitableWorlds,
    };
  }, [universe]);

  // Only show on explore views
  if (zoomLevel === "landing" || !stats) return null;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => {
          setOpen(true);
          setShowFinalLine(false);
          // Delay the final line for impact
          setTimeout(() => setShowFinalLine(true), 1500);
        }}
        className="fixed bottom-20 left-6 z-20 pointer-events-auto cursor-pointer bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-3.5 py-2 hover:bg-white/10 hover:border-white/20 transition-all"
      >
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/60">
          Survey Report
        </span>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-500"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-w-md w-full mx-8 bg-black/90 border border-white/10 rounded-xl p-10 animate-in zoom-in-95 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-[10px] tracking-[0.5em] uppercase text-white/40 mb-8">
              Survey Results
            </p>

            <div className="space-y-4 font-mono text-[12px]">
              <ReportLine label="Galaxies observed" value={String(stats.galaxies)} />
              <ReportLine label="Star systems scanned" value={`~${stats.totalSystems}`} />
              <ReportLine label="Worlds catalogued" value={String(stats.totalPlanets)} />
              <ReportLine label="Habitable worlds" value={String(stats.habitableWorlds)} />
              <div className="h-px bg-white/[0.06] my-2" />
              <ReportLine label="Civilizations detected" value="0" highlight />
            </div>

            {/* The line */}
            {showFinalLine && (
              <div className="mt-10 text-center animate-in fade-in duration-1000">
                <p className="font-serif text-xl text-white/85 tracking-wide">
                  You are alone.
                </p>
              </div>
            )}

            <div className="h-px bg-white/[0.06] mt-8 mb-6" />

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setOpen(false);
                  // Re-generate universe
                  resetEpoch();
                  useUniverseStore.setState({ initialized: false, universe: null });
                  enterUniverse();
                }}
                className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 rounded-lg px-4 py-2 transition-all cursor-pointer"
              >
                Generate New Universe
              </button>
              <button
                onClick={() => setOpen(false)}
                className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/30 hover:text-white/60 px-4 py-2 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ReportLine({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-white/40 tracking-[0.15em]">{label}</span>
      <span className={highlight ? "text-white/80 font-bold" : "text-white/70"}>
        {value}
      </span>
    </div>
  );
}
