"use client";

// ---------------------------------------------------------------------------
// Planet Surface View — detailed planet with civilization data
// Navigation handled by NavigationController.
// ---------------------------------------------------------------------------

import { useParams } from "next/navigation";
import { useUniverseStore } from "@/lib/store";
import { useState, useEffect, useCallback } from "react";

export default function PlanetPage() {
  const params = useParams<{ galaxyId: string; systemId: string; planetId: string }>();
  const { galaxyId, systemId, planetId } = params;
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");

  const updatePlanetTexture = useUniverseStore((s) => s.updatePlanetTexture);

  const planet = useUniverseStore((s) => {
    if (!s.universe) return null;
    const galaxy = s.universe.galaxies.find((g) => g.id === galaxyId);
    if (!galaxy) return null;
    const system = galaxy.systems.find((sys) => sys.id === systemId);
    if (!system) return null;
    return system.planets.find((p) => p.id === planetId) ?? null;
  });

  const system = useUniverseStore((s) => {
    if (!s.universe) return null;
    const galaxy = s.universe.galaxies.find((g) => g.id === galaxyId);
    if (!galaxy) return null;
    return galaxy.systems.find((sys) => sys.id === systemId) ?? null;
  });

  const generateTexture = useCallback(
    async (force = false) => {
      if (!planet || isScanning) return;
      if (!force && planet.textureUrl) return;

      setIsScanning(true);
      setScanStatus(force ? "RESYNTHESIZING SURFACE MAP..." : "SYNTHESIZING ATMOSPHERIC DATA...");

      try {
        const res = await fetch("/api/generate-planet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planet: {
              name: planet.name,
              type: planet.type,
              habitable: planet.habitable,
              orbitRadius: planet.orbitRadius,
              size: planet.size,
            },
            system: system
              ? {
                  spectralClass: system.spectralClass,
                  hasBlackHole: system.hasBlackHole,
                  temperature: system.temperature,
                }
              : undefined,
          }),
        });

        if (!res.ok) throw new Error("API Failed");

        const data = await res.json();

        if (data.imageUrl) {
          setScanStatus("DECODING SURFACE TOPOGRAPHY...");
          const img = new Image();
          img.src = data.imageUrl;
          img.onload = () => {
            updatePlanetTexture(planetId, data.imageUrl);
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
    [isScanning, planet, planetId, system, updatePlanetTexture],
  );

  // Automatically trigger AI generation if we don't have a texture
  useEffect(() => {
    if (!planet || planet.textureUrl || isScanning) return;

    // Small delay to let the initial zoom animation start before blocking the thread with fetch
    const t = setTimeout(() => {
      void generateTexture(false);
    }, 800);
    return () => clearTimeout(t);
  }, [planet, generateTexture, isScanning]);

  return (
    <div className="flex flex-col flex-1 relative z-10 pointer-events-none">
      {/* Planet name */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 text-center select-none">
        {planet && (
          <>
            <p className="font-serif text-3xl text-white/85 tracking-wide">
              {planet.name}
            </p>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/55 mt-1">
              {planet.type} world &middot; {planet.orbitRadius.toFixed(1)} AU
              {planet.habitable && (
                <span className="text-emerald-400/70 ml-2">habitable</span>
              )}
            </p>
          </>
        )}
      </div>

      {/* Planet info panel — left side */}
      {planet && (
        <div className="fixed left-8 top-1/2 -translate-y-1/2 w-80 select-none pointer-events-auto">
          <div className="bg-black/70 backdrop-blur-md border border-white/[0.08] rounded-xl p-6">
            <h3 className="font-mono text-[10px] tracking-[0.4em] uppercase text-white/60 mb-4">
              Planetary Data
            </h3>

            <div className="space-y-3">
              <PlanetStat label="Type" value={planet.type} />
              <PlanetStat label="Orbit" value={`${planet.orbitRadius.toFixed(1)} AU`} />
              <PlanetStat label="Radius" value={`${planet.size.toFixed(2)} Re`} />
              <PlanetStat
                label="Habitable"
                value={planet.habitable ? "CONFIRMED" : "NEGATIVE"}
                highlight={planet.habitable}
              />
            </div>

            {/* AI Generation Status Overlay */}
            {isScanning && (
              <div className="mt-6 p-4 border border-emerald-500/30 bg-emerald-500/10 rounded-lg animate-pulse">
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-emerald-400">
                  {scanStatus}
                </p>
                <div className="h-1 bg-emerald-500/20 w-full mt-3 rounded overflow-hidden">
                  <div className="h-full bg-emerald-400 w-full animate-[progress_1.5s_ease-in-out_infinite]" style={{ transformOrigin: "left" }} />
                </div>
              </div>
            )}

            <button
              onClick={() => {
                void generateTexture(true);
              }}
              disabled={isScanning}
              className="mt-4 w-full text-left font-mono text-[10px] tracking-[0.2em] uppercase px-3 py-2 border border-white/10 rounded transition-all duration-300 pointer-events-auto cursor-pointer text-white/60 hover:text-white/80 hover:bg-white/[0.04] hover:border-white/20 disabled:cursor-not-allowed disabled:text-white/25"
            >
              {isScanning
                ? "Rendering texture..."
                : planet.textureUrl
                  ? "Regenerate texture"
                  : "Generate texture"}
            </button>

            {/* Civilization section */}
            {planet.habitable && (
              <div className="mt-6 pt-5 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400/60 animate-pulse" />
                  <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-emerald-400/50">
                    Civilization Detected
                  </p>
                </div>
                <p className="font-mono text-[10px] text-white/30 leading-relaxed mb-4">
                  Deep scan analysis reveals traces of intelligent activity on this world.
                  Awaiting Claude API integration for full civilization profile...
                </p>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4">
                  <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/25 mb-2">
                    Surface Snapshot
                  </p>
                  <div className="aspect-video bg-white/[0.02] rounded border border-white/[0.04] flex items-center justify-center">
                    <p className="font-mono text-[9px] text-white/15">
                      AI image generation — Phase 3
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!planet.habitable && (
              <div className="mt-6 pt-5 border-t border-white/[0.06] space-y-3">
                <PlanetReport type={planet.type} seed={planet.id} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Host system info — top right */}
      {system && (
        <div className="fixed top-8 right-8 select-none">
          <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/25 text-right">
            System: {system.name}
          </p>
          <p className="font-mono text-[9px] tracking-[0.2em] text-white/15 text-right mt-0.5">
            Class {system.spectralClass} &middot; {system.planets.length} planets
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-center select-none">
        <div className="bg-black/50 backdrop-blur-sm rounded-full px-6 py-2.5 border border-white/[0.08] pointer-events-none">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/60">
            Orbit to inspect &middot; Scroll to enter atmosphere &middot; Esc to return to system
          </p>
        </div>
      </div>

      {/* Back */}
      <button
        onClick={() => useUniverseStore.getState().zoomOut()}
        className="fixed top-8 left-8 font-mono text-[11px] tracking-[0.3em] uppercase text-white/60 hover:text-white/90 transition-colors cursor-pointer pointer-events-auto"
      >
        &larr; System
      </button>
    </div>
  );
}

function PlanetStat({
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
      <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/30">
        {label}
      </span>
      <span className={`font-mono text-[10px] tracking-wide uppercase ${
        highlight ? "text-emerald-400/70" : "text-white/50"
      }`}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clinical planet reports — the observational voice IS the horror
// ---------------------------------------------------------------------------

function PlanetReport({ type, seed }: { type: string; seed: string }) {
  const hash = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  const reports: Record<string, string[]> = {
    gas: [
      "Massive hydrogen-helium envelope. No solid surface detected. Upper atmosphere wind speeds exceed 1,400 km/h. Deep pressure layers may harbor exotic chemistry. No biosignatures.",
      "Banded cloud structure with ammonia crystal layers. Lightning discharges detected in deep atmosphere. Radiation belts render surface approach inadvisable. No artificial signals.",
      "Supercritical hydrogen ocean at depth. Metallic hydrogen core generates intense magnetic field. Three minor shepherd moons detected in ring fragments. Status: uninhabitable.",
    ],
    ice: [
      "Surface temperature: -218C. Nitrogen ice plains with trace methane frost. Subsurface ocean possible at depth of 180km. No thermal signatures consistent with biology. Silent.",
      "Cryogenic world. Tidal heating insufficient for liquid water. Surface is ancient \u2014 crater density suggests 4.1 Gyr without resurfacing. No electromagnetic emissions detected.",
      "Thick water-ice mantle over silicate core. Faint geysers detected at south pole \u2014 cryovolcanic activity. Spectral analysis shows no organic compounds. Origin: geological.",
    ],
    rocky: [
      "Trace organic compounds detected in upper atmosphere. Origin: abiotic. Surface bombardment rate suggests late heavy impact epoch. No artificial structures visible at survey resolution.",
      "Thin CO2 atmosphere. Surface scarred by ancient channel networks \u2014 liquid water flowed here approximately 3.2 Gyr ago. Now desiccated. No biosignatures in regolith samples.",
      "Geologically dead. No magnetic field. Solar wind erosion has stripped 94% of original atmosphere. Surface radiation: 0.67 Sv/day. Conditions incompatible with unshielded biology.",
    ],
    ocean: [
      "Surface conditions within tolerance. Liquid water confirmed across 78% of surface. Atmospheric O2: 0.3%. No biosignatures detected. No artificial signals. Status: silent.",
      "Global ocean world. Depth exceeds 340km in places. Hydrothermal vents detected along mid-ocean ridges. Chemistry is pre-biotic. Given sufficient time \u2014 perhaps. But not yet.",
      "Temperate ocean with scattered volcanic archipelagos. Atmospheric analysis shows nitrogen-oxygen mix. Amino acids detected in surface samples. Origin: uncertain. No technology signatures.",
    ],
    desert: [
      "Iron oxide surface. Dust storms envelope the planet for months at a time. Water ice detected at polar regions \u2014 quantity insufficient to sustain biosphere. No artificial features.",
      "Ancient lakebed formations visible in equatorial regions. Surface mineralogy indicates wet epoch ending approximately 2.8 Gyr ago. Whatever window existed has closed.",
      "Silicate desert with eroded canyon systems. Wind erosion has sculpted formations resembling structures. Analysis confirms: geological. No intelligent design. Just physics and time.",
    ],
    volcanic: [
      "Continuous volcanic resurfacing. Surface age nowhere exceeds 50 Myr. Sulfur dioxide atmosphere at 92 bar. Surface temperature: 462C. Any proto-biology would be repeatedly sterilized.",
      "Tidal heating from orbital resonance drives extreme volcanism. Lava flows visible across 40% of surface. Io-class world. The energy is there. The stability is not.",
      "Magma ocean world. Still cooling from formation. Estimated surface solidification: 800 Myr from present. This world's story hasn't begun yet. Check back in a billion years.",
    ],
  };

  const options = reports[type] || reports.rocky;
  const report = options[hash % options.length];

  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-white/15" />
        <p className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/25">
          Survey Report
        </p>
      </div>
      <p className="font-mono text-[10px] text-white/25 leading-relaxed">
        {report}
      </p>
    </>
  );
}
