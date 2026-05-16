// ---------------------------------------------------------------------------
// 13.8 — Deterministic procedural universe generation
//
// All randomness flows through a single seeded Mulberry32 RNG. Same seed →
// same universe, identical civ lifecycles, identical signal schedule.
// Critical for demo reproducibility — judges should always see a universe
// that "works" cinematically.
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
  SignalEvent,
} from "./types";
import { UNIVERSE_AGE_GYR } from "./civilization-epoch";
import {
  mulberry32,
  rand,
  randInt,
  pick,
  pickWeighted,
  chance,
  type Rng,
} from "./rng";
import {
  simulateCivilization,
  rngForCivilization,
  type CivilizationLifecycle,
} from "./civilization-lifecycle";

// ---------------------------------------------------------------------------
// Name generation
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

function generateName(rng: Rng): string {
  const hasMiddle = rng() < 0.4;
  const prefix = pick(rng, PREFIXES);
  const middle = hasMiddle ? pick(rng, MIDDLES) : "";
  const suffix = pick(rng, SUFFIXES);
  return prefix + middle + suffix;
}

function generateEpithet(rng: Rng): string {
  return `The ${pick(rng, EPITHETS_ADJ)} ${pick(rng, EPITHETS_NOUN)}`;
}

// ---------------------------------------------------------------------------
// Color palettes
// ---------------------------------------------------------------------------

const GALAXY_PALETTES: { primary: [number, number, number]; secondary: [number, number, number] }[] = [
  { primary: [0.75, 0.60, 0.90], secondary: [0.45, 0.65, 0.75] },
  { primary: [0.85, 0.65, 0.45], secondary: [0.55, 0.60, 0.80] },
  { primary: [0.50, 0.60, 0.85], secondary: [0.80, 0.70, 0.55] },
  { primary: [0.80, 0.55, 0.55], secondary: [0.55, 0.65, 0.70] },
  { primary: [0.60, 0.75, 0.70], secondary: [0.70, 0.55, 0.70] },
  { primary: [0.75, 0.65, 0.50], secondary: [0.60, 0.55, 0.78] },
  { primary: [0.55, 0.55, 0.80], secondary: [0.78, 0.60, 0.50] },
  { primary: [0.70, 0.55, 0.65], secondary: [0.50, 0.70, 0.65] },
];

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

// ---------------------------------------------------------------------------
// Planet / system / galaxy generators — now seeded
// ---------------------------------------------------------------------------

function generatePlanet(
  rng: Rng,
  index: number,
  systemId: string,
  isBlackHoleSystem = false,
): Planet {
  const type = pick<PlanetType>(rng, ["rocky", "gas", "ice", "ocean", "desert", "volcanic"]);
  const orbitRadius = isBlackHoleSystem
    ? 12 + index * rand(rng, 3.0, 5.0)
    : 3 + index * rand(rng, 2.0, 3.5);
  const isInHabitableZone = orbitRadius > 5 && orbitRadius < 14;
  const habitable =
    isInHabitableZone &&
    (type === "rocky" || type === "ocean") &&
    chance(rng, 0.35);

  return {
    id: `${systemId}-p${index}`,
    name: generateName(rng),
    type,
    orbitRadius,
    orbitSpeed: (0.3 + rng() * 0.5) / (1 + index * 0.5),
    orbitOffset: rand(rng, 0, Math.PI * 2),
    size: type === "gas" ? rand(rng, 1.5, 3.0) : rand(rng, 0.4, 1.2),
    habitable,
    color: pick(rng, PLANET_COLORS[type]),
  };
}

const BLACK_HOLE_NAMES = [
  "Gargantua", "Erebus", "Nyx Maw", "Obsidian Eye", "The Devourer",
  "Void Heart", "Singularis", "Abyssal Gate", "Entropy Well", "Null Core",
];

function generateSystem(
  rng: Rng,
  index: number,
  galaxyId: string,
  galaxyRadius: number,
  forceBlackHole = false,
): StarSystem {
  const angle = rand(rng, 0, Math.PI * 2);
  const dist = forceBlackHole ? rand(rng, 0.5, 3) : rand(rng, 2, galaxyRadius * 0.8);
  const elevation = rand(rng, -galaxyRadius * 0.1, galaxyRadius * 0.1);

  const isBlackHole = forceBlackHole || chance(rng, 0.03);

  const spectralClass = pickWeighted<SpectralClass>(rng, [
    ["O", 0.02], ["B", 0.05], ["A", 0.08], ["F", 0.15],
    ["G", 0.25], ["K", 0.25], ["M", 0.20],
  ]);

  const id = `${galaxyId}-s${index}`;
  const tempRange = SPECTRAL_TEMPS[spectralClass];
  const planetCount = isBlackHole ? randInt(rng, 3, 5) : randInt(rng, 3, 8);

  return {
    id,
    name: isBlackHole ? pick(rng, BLACK_HOLE_NAMES) : generateName(rng),
    spectralClass: isBlackHole ? "O" : spectralClass,
    position: {
      x: Math.cos(angle) * dist,
      y: elevation * (isBlackHole ? 0.2 : 1),
      z: Math.sin(angle) * dist,
    },
    luminosity: isBlackHole ? 0 : rand(rng, 0.5, 2.0),
    temperature: isBlackHole ? 0 : rand(rng, tempRange[0], tempRange[1]),
    starColor: isBlackHole ? [1.0, 0.85, 0.5] : SPECTRAL_COLORS[spectralClass],
    hasBlackHole: isBlackHole,
    planets: Array.from({ length: planetCount }, (_, i) =>
      generatePlanet(rng, i, id, isBlackHole),
    ),
  };
}

function generateGalaxy(rng: Rng, index: number): Galaxy {
  const type = pick<GalaxyType>(rng, ["spiral", "spiral", "spiral", "elliptical", "irregular"]);
  const palette = pick(rng, GALAXY_PALETTES);
  const systemCount = randInt(rng, 8, 15);
  const galaxyRadius = rand(rng, 15, 25);
  const id = `g${index}`;

  const phi = rand(rng, 0, Math.PI * 2);
  const cosTheta = rand(rng, -0.4, 0.4);
  const r = rand(rng, 60, 150);
  const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);

  const tiltRoll = rng();
  let tiltX: number;
  if (tiltRoll < 0.15) tiltX = rand(rng, 0, 0.2);
  else if (tiltRoll < 0.85) tiltX = rand(rng, 0.3, 1.0);
  else tiltX = rand(rng, 1.1, 1.45);

  return {
    id,
    name: generateName(rng),
    epithet: generateEpithet(rng),
    type,
    position: {
      x: r * sinTheta * Math.cos(phi),
      y: r * cosTheta * 0.35,
      z: r * sinTheta * Math.sin(phi),
    },
    color: palette.primary,
    secondaryColor: palette.secondary,
    age: rand(rng, 2, 13.2),
    rotation: rand(rng, 0, Math.PI * 2),
    tiltX,
    tiltZ: rand(rng, -0.3, 0.3),
    armCount: type === "spiral" ? pick(rng, [2, 2, 2, 3, 4]) : 0,
    armTightness: rand(rng, 0.25, 0.45),
    systems: Array.from({ length: systemCount }, (_, i) =>
      generateSystem(rng, i, id, galaxyRadius, i === 0),
    ),
  };
}

// ---------------------------------------------------------------------------
// Civilization trace generation — now backed by full lifecycle sim
// ---------------------------------------------------------------------------

function buildTraceFromLifecycle(
  lifecycle: CivilizationLifecycle,
  galaxy: Galaxy,
  system: StarSystem,
  rng: Rng,
): CivilizationTrace | null {
  // PRE_LIFE / LIFE_WITHOUT_MIND don't have signals — skip
  if (lifecycle.signalStartGyr === lifecycle.signalEndGyr) return null;
  if (lifecycle.signalEndGyr <= lifecycle.signalStartGyr) return null;

  const [sr, sg, sb] = system.starColor;
  const signalTint = rand(rng, 0.78, 1.0);

  return {
    id: lifecycle.id,
    galaxyId: galaxy.id,
    systemId: system.id,
    planetId: lifecycle.planetId,
    startGyr: lifecycle.signalStartGyr,
    endGyr: lifecycle.signalEndGyr,
    peakSignal: lifecycle.peakSignal,
    color: [
      Math.min(1, sr * signalTint + 0.12),
      Math.min(1, sg * signalTint + 0.1),
      Math.min(1, sb * signalTint + 0.08),
    ],
    position: {
      x: galaxy.position.x + system.position.x * 0.23 + rand(rng, -0.45, 0.45),
      y: galaxy.position.y + system.position.y * 0.23 + rand(rng, -0.25, 0.25),
      z: galaxy.position.z + system.position.z * 0.23 + rand(rng, -0.45, 0.45),
    },
    lifecycle: {
      outcome: lifecycle.outcome,
      filter: lifecycle.filter,
      speciesName: lifecycle.speciesName,
      civilizationName: lifecycle.civilizationName,
      peakSignal: lifecycle.peakSignal,
      signalStartGyr: lifecycle.signalStartGyr,
      signalEndGyr: lifecycle.signalEndGyr,
      events: lifecycle.events,
    },
  };
}

interface SimulationResult {
  traces: CivilizationTrace[];
  lifecycles: CivilizationLifecycle[];
}

function simulateAllCivilizations(
  galaxies: Galaxy[],
  seed: number,
  positionRng: Rng,
): SimulationResult {
  const traces: CivilizationTrace[] = [];
  const lifecycles: CivilizationLifecycle[] = [];

  for (const galaxy of galaxies) {
    for (const system of galaxy.systems) {
      for (const planet of system.planets) {
        if (!planet.habitable) continue;

        const lifecycleRng = rngForCivilization(planet.id, seed);
        const lifecycle = simulateCivilization({
          planet,
          system,
          galaxy,
          earliestStartGyr: Math.max(0.4, UNIVERSE_AGE_GYR - galaxy.age),
          rng: lifecycleRng,
        });

        if (!lifecycle) continue;

        lifecycles.push(lifecycle);
        const trace = buildTraceFromLifecycle(lifecycle, galaxy, system, positionRng);
        if (trace) traces.push(trace);
      }
    }
  }

  traces.sort((a, b) => a.startGyr - b.startGyr);
  return { traces, lifecycles };
}

// ---------------------------------------------------------------------------
// Transient signal scheduling — pick one or two civs to surface as
// "TRANSIENT SIGNAL DETECTED" events during playback. These become the
// emotional beat in the demo.
// ---------------------------------------------------------------------------

function scheduleSignalEvents(
  traces: CivilizationTrace[],
  rng: Rng,
): SignalEvent[] {
  if (traces.length === 0) return [];

  // Eligible: SUICIDED civs (highest emotional impact) with start in the
  // middle 60% of the universe's age (so the user has time to react during
  // playback). Fallback to any trace if not enough suicides.
  const eligible = traces.filter((t) => {
    if (t.startGyr < 2 || t.startGyr > UNIVERSE_AGE_GYR - 1) return false;
    return (
      t.lifecycle.outcome === "SUICIDED" ||
      t.lifecycle.outcome === "TRANSCENDED"
    );
  });
  const pool = eligible.length > 0 ? eligible : traces;
  if (pool.length === 0) return [];

  const pick1 = pool[Math.floor(rng() * pool.length)];
  const events: SignalEvent[] = [
    {
      id: `sig-${pick1.id}`,
      civilizationId: pick1.id,
      galaxyId: pick1.galaxyId,
      // Fire shortly after they go radio-active
      atGyr: Math.min(
        pick1.startGyr + (pick1.endGyr - pick1.startGyr) * 0.4,
        UNIVERSE_AGE_GYR - PRESENT_SILENCE_BUFFER_GYR,
      ),
      position: pick1.position,
      headline:
        pick1.lifecycle.outcome === "TRANSCENDED"
          ? "ANOMALOUS BURST · UNCLASSIFIED"
          : "NARROW-BAND CARRIER DETECTED",
    },
  ];
  return events;
}

// ---------------------------------------------------------------------------
// Entry point — seeded universe generation
// ---------------------------------------------------------------------------

/**
 * Demo-safe default seed. Hand-picked for a universe that has at least one
 * SUICIDED civ in the middle of the timeline (so the transient signal beat
 * lands during demo playback). Override via `?seed=<n>` in the URL or
 * generateUniverse({ seed: N }).
 */
export const DEMO_SEED = 0x13800013;

export interface GenerateOptions {
  seed?: number;
}

export function generateUniverse(opts: GenerateOptions = {}): Universe {
  const seed = opts.seed ?? DEMO_SEED;
  const masterRng = mulberry32(seed);

  // Pull galaxy count first so it's a stable, pre-civ decision
  const galaxyCount = randInt(masterRng, 4, 7);
  const galaxies = Array.from({ length: galaxyCount }, (_, i) =>
    generateGalaxy(masterRng, i),
  );

  // Civ simulation uses planet-id derived RNGs, but the position jitter
  // shares one stream.
  const positionRng = mulberry32(seed ^ 0xbadc0de);
  const { traces } = simulateAllCivilizations(galaxies, seed, positionRng);

  const signalRng = mulberry32(seed ^ 0xdeadbeef);
  const signalEvents = scheduleSignalEvents(traces, signalRng);

  return {
    seed,
    galaxies,
    civilizations: traces,
    signalEvents,
  };
}
