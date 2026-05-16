// ---------------------------------------------------------------------------
// 13.8 — Procedural scan annotations
//
// Pure data generator. Given an entity (planet / system / galaxy) and its
// state, returns a list of annotation pins to overlay on the 3D scene.
//
// This module is intentionally text-only — the rendering layer (HUD overlay)
// is responsible for positioning, leader lines, animations. We export world-
// space coordinates (relative to the current scene's coordinate origin for
// that zoom level) so the renderer can project them.
//
// Later: this is the seam where an LLM/VLM call would plug in to produce
// more evocative copy. For now we use templated procedural strings — fast,
// deterministic, no API cost.
// ---------------------------------------------------------------------------

import type { Planet, PlanetType, StarSystem, Galaxy } from "./types";

export type AnnotationTone = "default" | "highlight" | "warning" | "info";

export interface Annotation {
  id: string;
  position: [number, number, number]; // world space at this zoom level
  label: string;
  sublabel?: string;
  tone: AnnotationTone;
  // Direction the leader line should extend in screen space (degrees, 0 = right, 90 = up)
  leaderAngle: number;
}

// ---------------------------------------------------------------------------
// Planet annotations — 4-6 pins per planet
// ---------------------------------------------------------------------------

const PLANET_RADIUS = 3; // mirror of planet-detail-view.tsx

const PLANET_FEATURE_LABELS: Record<PlanetType, { primary: string; sublabel?: string; biome: string }[]> = {
  rocky: [
    { primary: "Silicate Crust", biome: "rocky" },
    { primary: "Tectonic Ridge", sublabel: "active fault system", biome: "rocky" },
    { primary: "Impact Basin", sublabel: "ancient cratering", biome: "rocky" },
  ],
  gas: [
    { primary: "Banded Cloud Belt", biome: "gas" },
    { primary: "Storm Eye", sublabel: "antocyclonic vortex", biome: "gas" },
    { primary: "Ring System", sublabel: "ice & rock debris", biome: "gas" },
  ],
  ice: [
    { primary: "Glacial Plain", biome: "ice" },
    { primary: "Cryovolcanic Vent", sublabel: "ammonia ejecta", biome: "ice" },
    { primary: "Subsurface Ocean", sublabel: "liquid layer detected", biome: "ice" },
  ],
  ocean: [
    { primary: "Pelagic Zone", biome: "ocean" },
    { primary: "Archipelago", sublabel: "volcanic origin", biome: "ocean" },
    { primary: "Thermal Current", sublabel: "equatorial flow", biome: "ocean" },
  ],
  desert: [
    { primary: "Arid Plateau", biome: "desert" },
    { primary: "Salt Flat", sublabel: "evaporite deposits", biome: "desert" },
    { primary: "Dune Sea", sublabel: "aeolian formations", biome: "desert" },
  ],
  volcanic: [
    { primary: "Lava Field", biome: "volcanic" },
    { primary: "Caldera", sublabel: "active eruption site", biome: "volcanic" },
    { primary: "Pyroclastic Plain", sublabel: "tephra deposits", biome: "volcanic" },
  ],
};

const ATMOSPHERE_LABELS: Record<PlanetType, string> = {
  rocky: "Thin nitrogen-CO₂",
  gas: "Hydrogen-helium envelope",
  ice: "Trace methane",
  ocean: "Oxygen-rich",
  desert: "CO₂ trace",
  volcanic: "Sulfuric, opaque",
};

// Hash a planet id to a deterministic int (no Math.random in pure functions)
function hashSeed(id: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Compute a feature point on the planet's lit hemisphere at given (lat, lon)
function planetSurfacePoint(latDeg: number, lonDeg: number, radius = PLANET_RADIUS * 1.02): [number, number, number] {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  return [
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.sin(lon),
  ];
}

export function annotationsForPlanet(planet: Planet): Annotation[] {
  const rng = seededRng(hashSeed(planet.id));
  const pool = PLANET_FEATURE_LABELS[planet.type];

  const annos: Annotation[] = [];

  // North pole
  annos.push({
    id: `${planet.id}-pole`,
    position: planetSurfacePoint(78, rng() * 30),
    label: planet.type === "ice" || planet.type === "ocean" ? "Ice Cap" : "Polar Region",
    sublabel: planet.type === "ice" ? "permanent freeze" : "low insolation",
    tone: "default",
    leaderAngle: 60,
  });

  // Equatorial / habitable band feature
  if (planet.habitable) {
    annos.push({
      id: `${planet.id}-band`,
      position: planetSurfacePoint(8, 30),
      label: "Habitable Band",
      sublabel: "liquid water, stable temp",
      tone: "highlight",
      leaderAngle: 10,
    });
  } else {
    const feature = pool[Math.floor(rng() * pool.length)];
    annos.push({
      id: `${planet.id}-eq`,
      position: planetSurfacePoint(rng() * 30 - 15, 20 + rng() * 30),
      label: feature.primary,
      sublabel: feature.sublabel,
      tone: "default",
      leaderAngle: 15,
    });
  }

  // Terminator (day/night) — atmosphere readout
  annos.push({
    id: `${planet.id}-term`,
    position: planetSurfacePoint(15, -78),
    label: "Atmosphere",
    sublabel: ATMOSPHERE_LABELS[planet.type],
    tone: "info",
    leaderAngle: 165,
  });

  // 1-2 random surface features
  const featureCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < featureCount; i++) {
    const feature = pool[Math.floor(rng() * pool.length)];
    const lat = rng() * 60 - 30;
    const lon = rng() * 120 - 60;
    // Skip if too close to existing pin (rough check)
    annos.push({
      id: `${planet.id}-f${i}`,
      position: planetSurfacePoint(lat, lon),
      label: feature.primary,
      sublabel: feature.sublabel,
      tone: "default",
      leaderAngle: lat > 0 ? -25 : 200,
    });
  }

  return annos;
}

// ---------------------------------------------------------------------------
// System annotations — name star + each planet + habitable zone marker
// ---------------------------------------------------------------------------

const SPECTRAL_DESCRIPTIONS: Record<string, string> = {
  O: "Blue supergiant",
  B: "Hot blue-white",
  A: "Hot white",
  F: "Yellow-white",
  G: "G-type, sun-like",
  K: "Orange dwarf",
  M: "Red dwarf",
};

export function annotationsForSystem(system: StarSystem): Annotation[] {
  const annos: Annotation[] = [];

  // Star label (only if not a black hole)
  if (!system.hasBlackHole) {
    annos.push({
      id: `${system.id}-star`,
      position: [0, 2.4, 0],
      label: system.name,
      sublabel: `${system.spectralClass}-class · ${SPECTRAL_DESCRIPTIONS[system.spectralClass] ?? ""}`,
      tone: "highlight",
      leaderAngle: 75,
    });
  } else {
    annos.push({
      id: `${system.id}-bh`,
      position: [0, 2.4, 0],
      label: system.name,
      sublabel: "Black hole · supermassive",
      tone: "warning",
      leaderAngle: 75,
    });
  }

  // Planet labels at orbit radius (skip — planet view already labels them inline).
  // Instead annotate one notable planet per system if any habitable.
  const habitable = system.planets.find((p) => p.habitable);
  if (habitable) {
    annos.push({
      id: `${system.id}-hz`,
      position: [habitable.orbitRadius * 0.7, 0, habitable.orbitRadius * 0.7],
      label: "Habitable Zone",
      sublabel: habitable.name,
      tone: "highlight",
      leaderAngle: 35,
    });
  }

  // Asteroid belt if there's a big gap between two planets
  for (let i = 1; i < system.planets.length; i++) {
    const gap = system.planets[i].orbitRadius - system.planets[i - 1].orbitRadius;
    if (gap > 4.5) {
      const r = (system.planets[i].orbitRadius + system.planets[i - 1].orbitRadius) / 2;
      annos.push({
        id: `${system.id}-belt-${i}`,
        position: [-r * 0.6, 0, r * 0.6],
        label: "Asteroid Belt",
        sublabel: "rocky debris",
        tone: "info",
        leaderAngle: 135,
      });
      break;
    }
  }

  return annos;
}

// ---------------------------------------------------------------------------
// Galaxy annotations — show core + arm + civ count
// ---------------------------------------------------------------------------

export function annotationsForGalaxy(galaxy: Galaxy): Annotation[] {
  const annos: Annotation[] = [];

  annos.push({
    id: `${galaxy.id}-name`,
    position: [0, 4, 0],
    label: galaxy.name,
    sublabel: galaxy.epithet,
    tone: "highlight",
    leaderAngle: 80,
  });

  annos.push({
    id: `${galaxy.id}-type`,
    position: [-6, -1, 4],
    label: `${galaxy.type[0].toUpperCase()}${galaxy.type.slice(1)} Galaxy`,
    sublabel: `${galaxy.age.toFixed(1)} Gyr old`,
    tone: "info",
    leaderAngle: 200,
  });

  if (galaxy.type === "spiral" && galaxy.armCount > 0) {
    annos.push({
      id: `${galaxy.id}-arm`,
      position: [8, 0.3, -3],
      label: `${galaxy.armCount} Spiral Arms`,
      sublabel: "stellar nurseries",
      tone: "default",
      leaderAngle: 25,
    });
  }

  const sysCount = galaxy.systems.length;
  annos.push({
    id: `${galaxy.id}-count`,
    position: [4, -2.5, -6],
    label: `${sysCount} Star Systems`,
    sublabel: "indexed",
    tone: "info",
    leaderAngle: -30,
  });

  return annos;
}
