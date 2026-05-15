// ---------------------------------------------------------------------------
// 13.8 — Procedural universe generation (client-side, no AI)
// ---------------------------------------------------------------------------

import type {
  Universe,
  Galaxy,
  GalaxyType,
  StarSystem,
  SpectralClass,
  Planet,
  PlanetType,
  CivilizationTrace,
} from "./types";
import { UNIVERSE_AGE_GYR } from "./civilization-epoch";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Name generation — syllable combiner (NMS-style)
// ---------------------------------------------------------------------------

const PREFIXES = [
  "An", "Vor", "Kel", "Dra", "Thi", "Nos", "Eri", "Zal", "Ori",
  "Ven", "Sol", "Kyr", "Xen", "Ath", "Cor", "Nyx", "Pho", "Aur",
  "Cel", "Rav", "Lum", "Kas", "Eld", "Nym", "Tal", "Vex", "Rho",
  "Zan", "Iri", "Myr", "Cyn", "Hel", "Ter", "Ax", "Bel", "Dar",
];

const MIDDLES = [
  "an", "or", "el", "is", "ar", "on", "al", "en", "ir", "os",
  "eth", "ith", "ax", "ul", "em", "ov", "ik", "at", "un", "ash",
];

const SUFFIXES = [
  "is", "a", "on", "us", "ia", "os", "ar", "en", "um", "ax",
  "ith", "ora", "eon", "yx", "ael", "ine", "ova", "ant", "eth",
];

const EPITHETS_ADJ = [
  "Silent", "Eternal", "Crimson", "Ashen", "Shattered", "Frozen",
  "Luminous", "Veiled", "Hollow", "Burning", "Ancient", "Drifting",
  "Radiant", "Darkened", "Crystalline", "Wandering", "Fractured",
  "Spectral", "Verdant", "Obsidian", "Cerulean", "Gilded", "Pale",
];

const EPITHETS_NOUN = [
  "Expanse", "Veil", "Cradle", "Remnant", "Drift", "Forge",
  "Abyss", "Spiral", "Crown", "Wound", "Haven", "Frontier",
  "Chorus", "Beacon", "Threshold", "Shroud", "Garden", "Rift",
  "Shore", "Prism", "Cascade", "Monolith", "Sanctum", "Ember",
];

function generateName(): string {
  const hasMiddle = Math.random() < 0.4;
  const prefix = pick(PREFIXES);
  const middle = hasMiddle ? pick(MIDDLES) : "";
  const suffix = pick(SUFFIXES);
  return prefix + middle + suffix;
}

function generateEpithet(): string {
  return `The ${pick(EPITHETS_ADJ)} ${pick(EPITHETS_NOUN)}`;
}

// ---------------------------------------------------------------------------
// Color palettes
// ---------------------------------------------------------------------------

// NMS-indie galaxy colors — the sweet spot between neon and photorealism.
// Soft but with personality. Think watercolor nebulas, not spectroscopy data.
// Each galaxy should feel like it has its own mood/identity.
const GALAXY_PALETTES: { primary: [number, number, number]; secondary: [number, number, number] }[] = [
  { primary: [0.75, 0.60, 0.90], secondary: [0.45, 0.65, 0.75] },  // soft violet → muted teal
  { primary: [0.85, 0.65, 0.45], secondary: [0.55, 0.60, 0.80] },  // warm amber → dusty blue
  { primary: [0.50, 0.60, 0.85], secondary: [0.80, 0.70, 0.55] },  // gentle blue → soft gold
  { primary: [0.80, 0.55, 0.55], secondary: [0.55, 0.65, 0.70] },  // dusty rose → steel teal
  { primary: [0.60, 0.75, 0.70], secondary: [0.70, 0.55, 0.70] },  // sage green → muted purple
  { primary: [0.75, 0.65, 0.50], secondary: [0.60, 0.55, 0.78] },  // warm ochre → lavender
  { primary: [0.55, 0.55, 0.80], secondary: [0.78, 0.60, 0.50] },  // twilight blue → copper
  { primary: [0.70, 0.55, 0.65], secondary: [0.50, 0.70, 0.65] },  // mauve → jade
];

// Star colors by spectral class (normalized RGB)
const SPECTRAL_COLORS: Record<SpectralClass, [number, number, number]> = {
  O: [0.6, 0.7, 1.0],
  B: [0.7, 0.8, 1.0],
  A: [0.85, 0.9, 1.0],
  F: [1.0, 1.0, 0.9],
  G: [1.0, 0.95, 0.7],
  K: [1.0, 0.7, 0.4],
  M: [1.0, 0.5, 0.3],
};

const SPECTRAL_TEMPS: Record<SpectralClass, [number, number]> = {
  O: [30000, 50000],
  B: [10000, 30000],
  A: [7500, 10000],
  F: [6000, 7500],
  G: [5200, 6000],
  K: [3700, 5200],
  M: [2400, 3700],
};

const PLANET_COLORS: Record<PlanetType, [number, number, number][]> = {
  rocky: [[0.6, 0.5, 0.4], [0.5, 0.4, 0.3], [0.7, 0.6, 0.5]],
  gas: [[0.8, 0.6, 0.3], [0.5, 0.4, 0.7], [0.6, 0.7, 0.8]],
  ice: [[0.7, 0.85, 0.95], [0.8, 0.9, 1.0], [0.6, 0.75, 0.9]],
  ocean: [[0.2, 0.4, 0.8], [0.15, 0.5, 0.7], [0.1, 0.35, 0.65]],
  desert: [[0.85, 0.7, 0.4], [0.9, 0.75, 0.5], [0.8, 0.6, 0.35]],
  volcanic: [[0.8, 0.3, 0.1], [0.6, 0.2, 0.1], [0.9, 0.4, 0.15]],
};

const PRESENT_SILENCE_BUFFER_GYR = 0.08;
const MIN_CIV_DURATION_GYR = 0.015;
const MAX_CIV_DURATION_GYR = 0.22;

// ---------------------------------------------------------------------------
// Planet generation
// ---------------------------------------------------------------------------

function generatePlanet(index: number, systemId: string, isBlackHoleSystem = false): Planet {
  const type = pick<PlanetType>(["rocky", "gas", "ice", "ocean", "desert", "volcanic"]);
  // Black hole planets orbit far outside the accretion disk (which ends at ~8 units)
  const orbitRadius = isBlackHoleSystem
    ? 12 + index * rand(3.0, 5.0)
    : 3 + index * rand(2.0, 3.5);
  const isInHabitableZone = orbitRadius > 5 && orbitRadius < 14;
  const habitable =
    isInHabitableZone &&
    (type === "rocky" || type === "ocean") &&
    Math.random() < 0.35;

  return {
    id: `${systemId}-p${index}`,
    name: generateName(),
    type,
    orbitRadius,
    orbitSpeed: (0.3 + Math.random() * 0.5) / (1 + index * 0.5),
    orbitOffset: rand(0, Math.PI * 2),
    size: type === "gas" ? rand(1.5, 3.0) : rand(0.4, 1.2),
    habitable,
    color: pick(PLANET_COLORS[type]),
  };
}

// ---------------------------------------------------------------------------
// Star system generation
// ---------------------------------------------------------------------------

const BLACK_HOLE_NAMES = [
  "Gargantua", "Erebus", "Nyx Maw", "Obsidian Eye", "The Devourer",
  "Void Heart", "Singularis", "Abyssal Gate", "Entropy Well", "Null Core",
];

function generateSystem(
  index: number,
  galaxyId: string,
  galaxyRadius: number,
  forceBlackHole = false,
): StarSystem {
  const angle = rand(0, Math.PI * 2);
  const dist = forceBlackHole ? rand(0.5, 3) : rand(2, galaxyRadius * 0.8); // black holes near galactic center
  const elevation = rand(-galaxyRadius * 0.1, galaxyRadius * 0.1);

  const isBlackHole = forceBlackHole || Math.random() < 0.03; // rare chance for extras

  const spectralWeights: [SpectralClass, number][] = [
    ["O", 0.02], ["B", 0.05], ["A", 0.08], ["F", 0.15],
    ["G", 0.25], ["K", 0.25], ["M", 0.20],
  ];
  let r = Math.random();
  let spectralClass: SpectralClass = "G";
  for (const [cls, weight] of spectralWeights) {
    r -= weight;
    if (r <= 0) { spectralClass = cls; break; }
  }

  const id = `${galaxyId}-s${index}`;
  const tempRange = SPECTRAL_TEMPS[spectralClass];
  const planetCount = isBlackHole ? randInt(3, 5) : randInt(3, 8);

  return {
    id,
    name: isBlackHole ? pick(BLACK_HOLE_NAMES) : generateName(),
    spectralClass: isBlackHole ? "O" : spectralClass,
    position: {
      x: Math.cos(angle) * dist,
      y: elevation * (isBlackHole ? 0.2 : 1),
      z: Math.sin(angle) * dist,
    },
    luminosity: isBlackHole ? 0 : rand(0.5, 2.0),
    temperature: isBlackHole ? 0 : rand(tempRange[0], tempRange[1]),
    starColor: isBlackHole ? [1.0, 0.85, 0.5] : SPECTRAL_COLORS[spectralClass], // accretion disk color
    hasBlackHole: isBlackHole,
    planets: Array.from({ length: planetCount }, (_, i) => generatePlanet(i, id, isBlackHole)),
  };
}

// ---------------------------------------------------------------------------
// Galaxy generation
// ---------------------------------------------------------------------------

function generateGalaxy(index: number): Galaxy {
  const type = pick<GalaxyType>(["spiral", "spiral", "spiral", "elliptical", "irregular"]);
  const palette = pick(GALAXY_PALETTES);
  const systemCount = randInt(8, 15);
  const galaxyRadius = rand(15, 25);
  const id = `g${index}`;

  // Spread galaxies wide — bigger galaxies need more room
  const phi = rand(0, Math.PI * 2);
  const cosTheta = rand(-0.4, 0.4);
  const r = rand(60, 150);
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);

  // Inclination — mix of face-on, tilted, and edge-on views
  // Most galaxies tilted 20-60 degrees, a few face-on or edge-on
  const tiltRoll = Math.random();
  let tiltX: number;
  if (tiltRoll < 0.15) tiltX = rand(0, 0.2);           // face-on
  else if (tiltRoll < 0.85) tiltX = rand(0.3, 1.0);     // tilted
  else tiltX = rand(1.1, 1.45);                          // nearly edge-on

  return {
    id,
    name: generateName(),
    epithet: generateEpithet(),
    type,
    position: {
      x: r * sinTheta * Math.cos(phi),
      y: r * cosTheta * 0.35,
      z: r * sinTheta * Math.sin(phi),
    },
    color: palette.primary,
    secondaryColor: palette.secondary,
    age: rand(2, 13.2),
    rotation: rand(0, Math.PI * 2),
    tiltX,
    tiltZ: rand(-0.3, 0.3),
    armCount: type === "spiral" ? pick([2, 2, 2, 3, 4]) : 0,
    armTightness: rand(0.25, 0.45),
    systems: Array.from({ length: systemCount }, (_, i) =>
      generateSystem(i, id, galaxyRadius, i === 0), // first system is always a black hole
    ),
  };
}

// ---------------------------------------------------------------------------
// Civilization traces (timeline windows for the universe scrubber)
// ---------------------------------------------------------------------------

function createCivilizationTrace({
  id,
  galaxy,
  system,
  planet,
  startGyr,
  durationGyr,
}: {
  id: string;
  galaxy: Galaxy;
  system: StarSystem;
  planet: Planet;
  startGyr: number;
  durationGyr: number;
}): CivilizationTrace | null {
  const epochCeiling = UNIVERSE_AGE_GYR - PRESENT_SILENCE_BUFFER_GYR;
  const clampedStart = Math.min(
    Math.max(startGyr, 0.04),
    epochCeiling - MIN_CIV_DURATION_GYR,
  );
  const clampedEnd = Math.min(clampedStart + durationGyr, epochCeiling);

  if (clampedEnd <= clampedStart) return null;

  const [sr, sg, sb] = system.starColor;
  const signalTint = rand(0.78, 1.0);

  return {
    id,
    galaxyId: galaxy.id,
    systemId: system.id,
    planetId: planet.id,
    startGyr: clampedStart,
    endGyr: clampedEnd,
    peakSignal: rand(0.45, 1.0),
    color: [
      Math.min(1, sr * signalTint + 0.12),
      Math.min(1, sg * signalTint + 0.1),
      Math.min(1, sb * signalTint + 0.08),
    ],
    position: {
      x: galaxy.position.x + system.position.x * 0.23 + rand(-0.45, 0.45),
      y: galaxy.position.y + system.position.y * 0.23 + rand(-0.25, 0.25),
      z: galaxy.position.z + system.position.z * 0.23 + rand(-0.45, 0.45),
    },
  };
}

function generateCivilizationTraces(galaxies: Galaxy[]): CivilizationTrace[] {
  const traces: CivilizationTrace[] = [];
  const candidateWorlds: Array<{ galaxy: Galaxy; system: StarSystem; planet: Planet }> = [];

  let traceId = 0;

  for (const galaxy of galaxies) {
    for (const system of galaxy.systems) {
      for (const planet of system.planets) {
        if (
          planet.habitable ||
          planet.type === "rocky" ||
          planet.type === "ocean"
        ) {
          candidateWorlds.push({ galaxy, system, planet });
        }

        if (!planet.habitable) continue;
        if (Math.random() > 0.42) continue;

        const civilizationCycles = Math.random() < 0.2 ? 2 : 1;
        let nextStart = rand(0.35, 11.8);

        for (let cycle = 0; cycle < civilizationCycles; cycle++) {
          const trace = createCivilizationTrace({
            id: `civ-${traceId++}`,
            galaxy,
            system,
            planet,
            startGyr: nextStart,
            durationGyr: rand(MIN_CIV_DURATION_GYR, MAX_CIV_DURATION_GYR),
          });

          if (!trace) break;
          traces.push(trace);

          nextStart = trace.endGyr + rand(0.3, 1.8);
          if (nextStart >= UNIVERSE_AGE_GYR - PRESENT_SILENCE_BUFFER_GYR) {
            break;
          }
        }
      }
    }
  }

  // Guarantee a visible historical signal population even in low-roll universes.
  const minimumTraceCount = 8;
  for (
    let i = 0;
    traces.length < minimumTraceCount && i < candidateWorlds.length * 2;
    i++
  ) {
    if (!candidateWorlds.length) break;
    const world = candidateWorlds[i % candidateWorlds.length];
    const trace = createCivilizationTrace({
      id: `civ-${traceId++}`,
      galaxy: world.galaxy,
      system: world.system,
      planet: world.planet,
      startGyr: rand(0.4, 12.5),
      durationGyr: rand(MIN_CIV_DURATION_GYR, MAX_CIV_DURATION_GYR * 0.9),
    });
    if (trace) traces.push(trace);
  }

  traces.sort((a, b) => a.startGyr - b.startGyr);
  return traces;
}

// ---------------------------------------------------------------------------
// Universe generation (entry point)
// ---------------------------------------------------------------------------

export function generateUniverse(): Universe {
  const galaxyCount = randInt(4, 7);
  const galaxies = Array.from({ length: galaxyCount }, (_, i) => generateGalaxy(i));

  return {
    galaxies,
    civilizations: generateCivilizationTraces(galaxies),
  };
}
