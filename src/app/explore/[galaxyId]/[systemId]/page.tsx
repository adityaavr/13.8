"use client";

import { useParams } from "next/navigation";
import { useUniverseStore } from "@/lib/store";
import { useState, useEffect, useCallback } from "react";

export default function SystemPage() {
  const params = useParams<{ galaxyId: string; systemId: string }>();
  const { galaxyId, systemId } = params;
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");

  const selectPlanet = useUniverseStore((s) => s.selectPlanet);
  const updateSystemSkybox = useUniverseStore((s) => s.updateSystemSkybox);

  const system = useUniverseStore((s) => {
    if (!s.universe) return null;
    const galaxy = s.universe.galaxies.find((g) => g.id === galaxyId);
    if (!galaxy) return null;
    return galaxy.systems.find((sys) => sys.id === systemId) ?? null;
  });

  const habitableCount = system
    ? system.planets.filter((p) => p.habitable).length
    : 0;

  const generateSkybox = useCallback(
    async (force = false) => {
      if (!system || isScanning) return;
      if (!force && system.skyboxUrl) return;

      setIsScanning(true);
      setScanStatus(force ? "RESYNTHESIZING LOCAL NEBULA..." : "SYNTHESIZING DEEP SPACE TELEMETRY...");

      try {
        const [r, g, b] = system.starColor;
        const hexColor = `#${Math.floor(r * 255)
          .toString(16)
          .padStart(2, "0")}${Math.floor(g * 255)
          .toString(16)
          .padStart(2, "0")}${Math.floor(b * 255)
          .toString(16)
          .padStart(2, "0")}`;
        const promptColors = system.hasBlackHole
          ? "obsidian black, amber accretion glow, starlight lensing"
          : `stellar tint ${hexColor}, cyan-teal dust, deep indigo void`;

        const res = await fetch("/api/generate-skybox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            colors: promptColors,
            system: {
              name: system.name,
              spectralClass: system.spectralClass,
              hasBlackHole: system.hasBlackHole,
              temperature: system.temperature,
              starColor: system.starColor,
              planetCount: system.planets.length,
            },
          }),
        });

        if (!res.ok) throw new Error("API Failed");

        const data = await res.json();

        if (data.imageUrl) {
          setScanStatus("RENDERING LOCAL NEBULA...");
          const img = new Image();
          img.src = data.imageUrl;
          img.onload = () => {
            updateSystemSkybox(systemId, data.imageUrl);
            setIsScanning(false);
          };
          img.onerror = () => setIsScanning(false);
          return;
        }

        setIsScanning(false);
      } catch (err) {
        console.error(err);
        setIsScanning(false);
      }
    },
    [isScanning, system, systemId, updateSystemSkybox],
  );

  // Generate Skybox Texture
  useEffect(() => {
    if (!system || system.skyboxUrl || isScanning) return;
    const t = setTimeout(() => {
      void generateSkybox(false);
    }, 1000);
    return () => clearTimeout(t);
  }, [system, generateSkybox, isScanning]);

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
          {isScanning && (
            <div className="mb-4 p-3 border border-emerald-500/30 bg-emerald-500/10 rounded-lg animate-pulse">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-emerald-400">
                {scanStatus}
              </p>
              <div className="h-0.5 bg-emerald-500/20 w-full mt-2 rounded overflow-hidden">
                <div className="h-full bg-emerald-400 w-full animate-[progress_1.5s_ease-in-out_infinite]" style={{ transformOrigin: "left" }} />
              </div>
            </div>
          )}
          <button
            onClick={() => {
              void generateSkybox(true);
            }}
            disabled={isScanning}
            className="mb-3 text-left font-mono text-[10px] tracking-[0.2em] uppercase px-3 py-2 border border-white/10 rounded transition-all duration-300 pointer-events-auto cursor-pointer text-white/60 hover:text-white/80 hover:bg-white/[0.04] hover:border-white/20 disabled:cursor-not-allowed disabled:text-white/25"
          >
            {isScanning
              ? "Rendering skybox..."
              : system.skyboxUrl
                ? "Regenerate skybox"
                : "Generate skybox"}
          </button>
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
