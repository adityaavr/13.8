"use client";

import { useParams } from "next/navigation";
import { useUniverseStore } from "@/lib/store";

export default function GalaxyPage() {
  const params = useParams<{ galaxyId: string }>();
  const galaxyId = params.galaxyId;

  const galaxy = useUniverseStore((s) => {
    if (!s.universe) return null;
    return s.universe.galaxies.find((g) => g.id === galaxyId) ?? null;
  });

  const habitableCount = galaxy
    ? galaxy.systems.reduce(
        (acc, sys) => acc + sys.planets.filter((p) => p.habitable).length,
        0,
      )
    : 0;

  return (
    <div className="flex flex-col flex-1 items-center justify-center relative z-10 pointer-events-none">
      {/* Galaxy info */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 text-center select-none">
        {galaxy && (
          <>
            <p className="font-serif text-2xl text-white/90 tracking-wide">
              {galaxy.name}
            </p>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/50 mt-1">
              {galaxy.epithet}
            </p>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/55 mt-2">
              {galaxy.systems.length} systems &middot; {habitableCount} habitable worlds &middot;{" "}
              {galaxy.type}
            </p>
            <p className="font-mono text-[10px] tracking-[0.4em] uppercase text-white/30 mt-1.5">
              Signals detected: 0
            </p>
          </>
        )}
      </div>

      {/* Instructions */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-center select-none">
        <div className="bg-black/50 backdrop-blur-sm rounded-full px-6 py-2.5 border border-white/[0.08]">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/60">
            Click a star system to explore &middot; Esc to zoom out
          </p>
        </div>
      </div>

      {/* Back */}
      <button
        onClick={() => useUniverseStore.getState().zoomOut()}
        className="fixed top-8 left-8 font-mono text-[11px] tracking-[0.3em] uppercase text-white/60 hover:text-white/90 transition-colors cursor-pointer pointer-events-auto"
      >
        &larr; Universe
      </button>
    </div>
  );
}
