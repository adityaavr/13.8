"use client";

import { useParams } from "next/navigation";
import { useUniverseStore } from "@/lib/store";

export default function SystemPage() {
  const params = useParams<{ galaxyId: string; systemId: string }>();
  const { galaxyId, systemId } = params;

  const selectPlanet = useUniverseStore((s) => s.selectPlanet);

  const system = useUniverseStore((s) => {
    if (!s.universe) return null;
    const galaxy = s.universe.galaxies.find((g) => g.id === galaxyId);
    if (!galaxy) return null;
    return galaxy.systems.find((sys) => sys.id === systemId) ?? null;
  });

  const habitableCount = system
    ? system.planets.filter((p) => p.habitable).length
    : 0;

  return (
    <div className="flex flex-col flex-1 relative z-10 pointer-events-none">
      {/* System info */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 text-center select-none">
        {system && (
          <>
            <p className="font-serif text-2xl text-white/90 tracking-wide">
              {system.name}
            </p>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/55 mt-1">
              {system.hasBlackHole ? "Black Hole" : `Class ${system.spectralClass}`} &middot;{" "}
              {system.hasBlackHole ? "" : `${Math.round(system.temperature).toLocaleString()}K · `}
              {system.planets.length} planets &middot;{" "}
              {habitableCount} habitable
            </p>
            <p className="font-mono text-[10px] tracking-[0.4em] uppercase text-white/30 mt-1.5">
              Life signatures: 0
            </p>
          </>
        )}
      </div>

      {/* Planet list — left side */}
      {system && (
        <div className="fixed left-8 top-1/2 -translate-y-1/2 flex flex-col gap-2 select-none">
          {system.planets.map((planet) => (
            <button
              key={planet.id}
              onClick={() => selectPlanet(planet.id)}
              className={`
                text-left font-mono text-[10px] tracking-[0.2em] uppercase px-3 py-2
                border border-white/8 rounded transition-all duration-300 pointer-events-auto cursor-pointer
                text-white/50 hover:text-white/75 hover:bg-white/[0.06] hover:border-white/15
                ${planet.habitable ? "border-l-2 border-l-emerald-500/50" : ""}
              `}
            >
              <span className="block text-white/70">{planet.name}</span>
              <span className="block text-[8px] text-white/30 mt-0.5">
                {planet.type} {planet.habitable ? " · habitable" : ""}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Instructions */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-center select-none">
        <div className="bg-black/50 backdrop-blur-sm rounded-full px-6 py-2.5 border border-white/[0.08]">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/60">
            Click a planet to explore &middot; Esc to zoom out
          </p>
        </div>
      </div>

      {/* Back */}
      <button
        onClick={() => useUniverseStore.getState().zoomOut()}
        className="fixed top-8 left-8 font-mono text-[11px] tracking-[0.3em] uppercase text-white/60 hover:text-white/90 transition-colors cursor-pointer pointer-events-auto"
      >
        &larr; Galaxy
      </button>
    </div>
  );
}
