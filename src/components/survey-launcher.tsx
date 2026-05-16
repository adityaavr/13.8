"use client";

// ---------------------------------------------------------------------------
// 13.8 — Survey Launcher
//
// Small floating button that opens the Survey Report for the current zoom
// target. Replaces the legacy FinalReport trigger.
// ---------------------------------------------------------------------------

import { useUniverseStore } from "@/lib/store";

export function SurveyLauncher() {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);
  const selectedGalaxyId = useUniverseStore((s) => s.selectedGalaxyId);
  const selectedSystemId = useUniverseStore((s) => s.selectedSystemId);
  const selectedPlanetId = useUniverseStore((s) => s.selectedPlanetId);
  const openSurvey = useUniverseStore((s) => s.openSurvey);

  if (zoomLevel === "landing") return null;

  const handle = () => {
    if (zoomLevel === "planet" && selectedGalaxyId && selectedSystemId && selectedPlanetId) {
      openSurvey({
        kind: "planet",
        galaxyId: selectedGalaxyId,
        systemId: selectedSystemId,
        planetId: selectedPlanetId,
      });
    } else if (zoomLevel === "system" && selectedGalaxyId && selectedSystemId) {
      openSurvey({ kind: "system", galaxyId: selectedGalaxyId, systemId: selectedSystemId });
    } else if (zoomLevel === "galaxy" && selectedGalaxyId) {
      openSurvey({ kind: "galaxy", galaxyId: selectedGalaxyId });
    } else {
      openSurvey({ kind: "universe" });
    }
  };

  return (
    <button
      onClick={handle}
      className="fixed bottom-20 left-6 z-20 pointer-events-auto cursor-pointer bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-3.5 py-2 hover:bg-white/10 hover:border-white/20 transition-all"
    >
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/65">
        Survey Report
      </span>
    </button>
  );
}
