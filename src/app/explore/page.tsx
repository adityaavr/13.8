"use client";

import { useMemo } from "react";
import {
  UNIVERSE_AGE_GYR,
  countActiveCivilizations,
} from "@/lib/civilization-epoch";
import { useUniverseStore } from "@/lib/store";

export default function UniverseMapPage() {
  const universe = useUniverseStore((s) => s.universe);
  const epochGyr = useUniverseStore((s) => s.epochGyr);

  const stats = useMemo(() => {
    if (!universe) return null;
    let totalSystems = 0;
    let habitableWorlds = 0;
    universe.galaxies.forEach((g) => {
      totalSystems += g.systems.length;
      g.systems.forEach((s) => {
        habitableWorlds += s.planets.filter((p) => p.habitable).length;
      });
    });
    const activeSignals = countActiveCivilizations(universe, epochGyr);
    // "Civilizations detected" = active right now. "Transient signals" = the
    // ones that have ever existed in this universe (haunting context).
    const totalTraces = universe.civilizations.length;
    return {
      galaxies: universe.galaxies.length,
      totalSystems,
      habitableWorlds,
      activeSignals,
      totalTraces,
    };
  }, [universe, epochGyr]);

  const lookbackGyr = Math.max(0, UNIVERSE_AGE_GYR - epochGyr);

  return (
    <div className="flex flex-col flex-1 items-center justify-center relative z-10 pointer-events-none">
      {/* Title + stats */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 text-center select-none">
        <p className="font-mono text-sm tracking-[0.5em] uppercase text-white/85">
          Universe Map
        </p>
        {stats && (
          <>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/55 mt-2">
              {stats.galaxies} galaxies &middot; {stats.totalSystems} systems &middot; {stats.habitableWorlds} habitable worlds
            </p>
            <p className="font-mono text-[10px] tracking-[0.4em] uppercase text-white/45 mt-1.5 tabular-nums">
              Civilizations detected now: <span className={stats.activeSignals > 0 ? "text-cyan-200" : "text-white/55"}>{stats.activeSignals}</span> &middot; transient signals: <span className="text-white/55">{stats.totalTraces}</span>
            </p>
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-white/38 mt-1 tabular-nums">
              Epoch {epochGyr.toFixed(2)} Gyr &middot; {lookbackGyr.toFixed(2)} Gyr ago
            </p>
          </>
        )}
      </div>

      {/* Instructions */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-center select-none">
        <div className="bg-black/50 backdrop-blur-sm rounded-full px-6 py-2.5 border border-white/[0.08]">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/60">
            Click a galaxy to explore &middot; Use timeline to scrub epochs &middot; Drag to orbit
          </p>
        </div>
      </div>

      {/* Back */}
      <button
        onClick={() => useUniverseStore.getState().zoomOut()}
        className="fixed top-8 left-8 font-mono text-[11px] tracking-[0.3em] uppercase text-white/60 hover:text-white/90 transition-colors cursor-pointer pointer-events-auto"
      >
        &larr; Back
      </button>
    </div>
  );
}
