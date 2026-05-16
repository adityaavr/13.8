// ---------------------------------------------------------------------------
// 13.8 — Civilization Lifecycle Simulator
//
// Deterministic per-civilization "what happened across 13.8 Gyr" simulator.
// For a candidate habitable world + seed, returns either null (life never
// arose / planet stayed inert) or a full CivilizationLifecycle with:
//
//   - Timestamped lifecycle events (abiogenesis → multicellular → sapience
//     → industrial → atomic → digital → spacefaring)
//   - The Great Filter encountered (which one, when)
//   - A categorical outcome (one of six Fermi solutions)
//   - The transient signal window (when this civ was detectable)
//
// This module owns ALL the lore. The agent layer (Phase 2) reads
// CivilizationLifecycle and reasons about it; the renderer reads it for
// timeline events; the visual director uses it for image prompts.
// ---------------------------------------------------------------------------

import type { Planet, StarSystem, Galaxy } from "./types";
import {
  chance,
  pickWeighted,
  pick,
  rand,
  type Rng,
  mulberry32,
  hashStringSeed,
} from "./rng";
import { UNIVERSE_AGE_GYR } from "./civilization-epoch";

// ---------------------------------------------------------------------------
// Outcome taxonomy — exactly the 6 categorical Fermi solutions the UI shows
// ---------------------------------------------------------------------------

export type FermiOutcome =
  | "PRE_LIFE" // Habitable but nothing ever bootstrapped
  | "LIFE_WITHOUT_MIND" // Life arose, never made it to sapience
  | "SUICIDED" // Self-destructed (nuclear, climate, grey-goo, etc.)
  | "TRANSCENDED" // Uploaded / went post-biological / left lightcone
  | "DORMANT" // Still out there, signal-silent, hibernating
  | "SILENT_BY_CHOICE"; // Dark forest — knows we're listening, chooses silence

export type GreatFilter =
  | "ABIOGENESIS" // Life never started
  | "MULTICELLULARITY" // Stayed microbial
  | "SAPIENCE" // Complex life, no minds
  | "INDUSTRIAL_COLLAPSE" // Pre-industrial collapse (climate, plague, war)
  | "NUCLEAR" // Atomic-era self-extinction
  | "CLIMATE" // Runaway greenhouse / ice
  | "BIOTECH_PLAGUE" // Engineered pathogen
  | "AI_TAKEOVER" // Misaligned superintelligence
  | "GREY_GOO" // Self-replicator collapse
  | "RESOURCE_EXHAUSTION" // Burned through their planet
  | "IMPACT" // Asteroid / GRB
  | "STELLAR" // Their star did them in
  | "DARK_FOREST" // Predated by something out there
  | "TRANSCENDENCE" // (Not a death) — they ascended
  | "NONE"; // (Outcome = DORMANT) — still alive

export type LifecycleEventKind =
  | "abiogenesis"
  | "multicellular"
  | "sapience"
  | "industrial"
  | "atomic"
  | "digital"
  | "spacefaring"
  | "filter"
  | "silence";

export interface LifecycleEvent {
  kind: LifecycleEventKind;
  /** Gyr since Big Bang (absolute universe time) */
  atGyr: number;
  /** One-line agent-readable description */
  description: string;
}

export interface CivilizationLifecycle {
  /** Stable id (matches CivilizationTrace.id) */
  id: string;
  galaxyId: string;
  systemId: string;
  planetId: string;

  /** Categorical Fermi solution */
  outcome: FermiOutcome;
  /** Specific filter (or NONE if dormant, TRANSCENDENCE if transcended) */
  filter: GreatFilter;

  /** Lifecycle timeline (sorted, abs Gyr) */
  events: LifecycleEvent[];

  /** Radio-detectable window — when an observer could have heard them */
  signalStartGyr: number;
  signalEndGyr: number;

  /** Peak signal strength (0..1) — drives marker brightness in viz */
  peakSignal: number;

  /** Free-form name for the species, used in agent prompts */
  speciesName: string;
  /** Free-form name for their civilization at peak */
  civilizationName: string;
}

// ---------------------------------------------------------------------------
// Outcome distribution — weighted to be hauntingly Fermi
// ---------------------------------------------------------------------------

const OUTCOME_WEIGHTS: [FermiOutcome, number][] = [
  ["SUICIDED", 0.32], // Most common — the great filter is ahead/behind
  ["LIFE_WITHOUT_MIND", 0.22], // Sapience is hard
  ["PRE_LIFE", 0.18], // Abiogenesis is really hard
  ["TRANSCENDED", 0.10], // Rare, glorious
  ["SILENT_BY_CHOICE", 0.10], // Dark forest
  ["DORMANT", 0.08], // Still there, asleep
];

// Filters per outcome — keeps story consistent
const SUICIDE_FILTERS: GreatFilter[] = [
  "NUCLEAR",
  "CLIMATE",
  "BIOTECH_PLAGUE",
  "AI_TAKEOVER",
  "GREY_GOO",
  "RESOURCE_EXHAUSTION",
];

// ---------------------------------------------------------------------------
// Species naming — distinct from system/planet names
// ---------------------------------------------------------------------------

const SPECIES_ROOTS = [
  "Kethri", "Vorath", "Olum", "Saryn", "Threx", "Iliani", "Mosek", "Anaeli",
  "Phalen", "Cyrra", "Vossun", "Quenari", "Tholom", "Erith", "Naxal", "Suuvi",
  "Mehrek", "Tovari", "Yssra", "Lurok", "Anveil", "Korith", "Pallaxi", "Nyren",
];

const CIV_NOUNS = [
  "Compact", "Concord", "Hegemony", "Choir", "Garden", "Lattice", "Pact",
  "Spire", "Convergence", "Helix", "Mandate", "Synthesis", "Diadem",
  "Choir-of-Names", "Many-Veined Polity", "Quiet Republic", "Final Reach",
];

function generateSpeciesName(rng: Rng): string {
  return pick(rng, SPECIES_ROOTS);
}

function generateCivilizationName(rng: Rng, species: string): string {
  const noun = pick(rng, CIV_NOUNS);
  return `${species} ${noun}`;
}

// ---------------------------------------------------------------------------
// Event descriptions — kept short; the agent will elaborate
// ---------------------------------------------------------------------------

const FILTER_DESCRIPTIONS: Record<GreatFilter, string> = {
  ABIOGENESIS: "Conditions hospitable but life never bootstrapped.",
  MULTICELLULARITY: "Single-celled biosphere stalled for billions of years.",
  SAPIENCE: "Complex animals never developed symbolic cognition.",
  INDUSTRIAL_COLLAPSE: "Pre-industrial society collapsed under climate and disease.",
  NUCLEAR: "Atomic-era exchange rendered the surface uninhabitable.",
  CLIMATE: "Runaway greenhouse boiled away the oceans.",
  BIOTECH_PLAGUE: "Engineered pathogen leaked from a research compound.",
  AI_TAKEOVER: "Misaligned superintelligence repurposed the biosphere.",
  GREY_GOO: "Self-replicating assemblers consumed available matter.",
  RESOURCE_EXHAUSTION: "Depleted their world's reserves before achieving spaceflight.",
  IMPACT: "Cosmic impact extinguished them before they could leave.",
  STELLAR: "Stellar instability sterilized the system.",
  DARK_FOREST: "Predated by something older and quieter.",
  TRANSCENDENCE: "Uploaded their substrate. No further biological activity.",
  NONE: "Still active. Signal undetected.",
};

const PRE_LIFE_REASONS = [
  "Stable but never crossed the abiogenesis threshold.",
  "Hadean chemistry never selected for replicators.",
  "Ocean chemistry hostile to peptide formation.",
  "Insufficient mineral templating on early sea floors.",
];

const LIFE_NO_MIND_REASONS = [
  "Biosphere stalled at single-celled organisms for the planet's lifetime.",
  "Complex life arose but never developed nervous systems.",
  "Many-bodied organisms existed; none became symbolic thinkers.",
  "Active biosphere, no toolmakers.",
];

// ---------------------------------------------------------------------------
// Core simulator
// ---------------------------------------------------------------------------

const PRESENT_SILENCE_BUFFER_GYR = 0.08;
const MAX_AGE_BEFORE_PRESENT = UNIVERSE_AGE_GYR - PRESENT_SILENCE_BUFFER_GYR;

interface SimInput {
  planet: Planet;
  system: StarSystem;
  galaxy: Galaxy;
  /** Earliest possible start (galaxy-age-bounded). */
  earliestStartGyr: number;
  rng: Rng;
}

export function simulateCivilization(input: SimInput): CivilizationLifecycle | null {
  const { planet, system, galaxy, rng } = input;
  const id = `civ-${planet.id}`;
  const speciesName = generateSpeciesName(rng);
  const civilizationName = generateCivilizationName(rng, speciesName);

  // Pick the outcome FIRST — drives the rest of the timeline backward
  const outcome = pickWeighted(rng, OUTCOME_WEIGHTS);

  // PRE_LIFE — habitable but never arose. Still record so we can show the
  // empty slot in surveys. No signal window.
  if (outcome === "PRE_LIFE") {
    return {
      id,
      galaxyId: galaxy.id,
      systemId: system.id,
      planetId: planet.id,
      outcome,
      filter: "ABIOGENESIS",
      events: [
        {
          kind: "filter",
          atGyr: rand(rng, input.earliestStartGyr, MAX_AGE_BEFORE_PRESENT),
          description: pick(rng, PRE_LIFE_REASONS),
        },
      ],
      signalStartGyr: 0,
      signalEndGyr: 0,
      peakSignal: 0,
      speciesName,
      civilizationName,
    };
  }

  // LIFE_WITHOUT_MIND — life arose, stalled. Long abiogenesis + multicellular,
  // then a filter event for sapience.
  if (outcome === "LIFE_WITHOUT_MIND") {
    const abio = rand(rng, input.earliestStartGyr, input.earliestStartGyr + 1.2);
    const multi = abio + rand(rng, 0.5, 2.5);
    const filterAt = Math.min(multi + rand(rng, 0.3, 1.5), MAX_AGE_BEFORE_PRESENT);
    return {
      id,
      galaxyId: galaxy.id,
      systemId: system.id,
      planetId: planet.id,
      outcome,
      filter: "SAPIENCE",
      events: [
        { kind: "abiogenesis", atGyr: abio, description: "First replicating chemistry." },
        { kind: "multicellular", atGyr: multi, description: "Coordinated cellular cooperation." },
        { kind: "filter", atGyr: filterAt, description: pick(rng, LIFE_NO_MIND_REASONS) },
      ],
      signalStartGyr: 0,
      signalEndGyr: 0,
      peakSignal: 0,
      speciesName,
      civilizationName,
    };
  }

  // -- The rest are all full civilizations that DID emerge --

  // Build a forward timeline. Start abiogenesis somewhere in the first half
  // of the planet's window, then accelerate.
  const startGyr = rand(
    rng,
    input.earliestStartGyr,
    Math.max(input.earliestStartGyr + 0.1, MAX_AGE_BEFORE_PRESENT - 4),
  );

  const abio = startGyr;
  const multi = abio + rand(rng, 0.8, 2.6);
  const sapience = multi + rand(rng, 0.6, 1.8);
  const industrial = sapience + rand(rng, 0.001, 0.02);
  const atomic = industrial + rand(rng, 0.00005, 0.00015); // hundred-thousand years
  const digital = atomic + rand(rng, 0.00002, 0.00008);

  const spacefaringChance =
    outcome === "TRANSCENDED" ? 0.95 :
    outcome === "DORMANT" ? 0.85 :
    outcome === "SILENT_BY_CHOICE" ? 0.7 :
    0.45; // SUICIDED — many die before/at spacefaring

  const becomesSpacefaring = chance(rng, spacefaringChance);
  const spacefaring = becomesSpacefaring
    ? digital + rand(rng, 0.00005, 0.0003)
    : null;

  // Filter selection
  let filter: GreatFilter;
  let filterAt: number;

  switch (outcome) {
    case "SUICIDED": {
      filter = pick(rng, SUICIDE_FILTERS);
      // Filter hits between digital and (digital + 0.0008 Gyr — a few hundred kyr)
      filterAt = Math.min(
        digital + rand(rng, 0.00001, 0.0008),
        MAX_AGE_BEFORE_PRESENT,
      );
      break;
    }
    case "TRANSCENDED": {
      filter = "TRANSCENDENCE";
      filterAt = (spacefaring ?? digital) + rand(rng, 0.0002, 0.002);
      filterAt = Math.min(filterAt, MAX_AGE_BEFORE_PRESENT);
      break;
    }
    case "SILENT_BY_CHOICE": {
      filter = "DARK_FOREST";
      filterAt = (spacefaring ?? digital) + rand(rng, 0.0001, 0.001);
      filterAt = Math.min(filterAt, MAX_AGE_BEFORE_PRESENT);
      break;
    }
    case "DORMANT": {
      filter = "NONE";
      // Dormant civs go silent recently — within the last 0.01-0.06 Gyr
      filterAt = Math.min(
        digital + rand(rng, 0.0005, 0.005),
        MAX_AGE_BEFORE_PRESENT,
      );
      break;
    }
    default:
      filter = "NUCLEAR";
      filterAt = MAX_AGE_BEFORE_PRESENT;
  }

  // Signal window — atomic to filter (radio era)
  const signalStartGyr = atomic;
  const signalEndGyr = filterAt;

  // Peak signal strength — TRANSCENDED civs blaze before going silent,
  // SILENT_BY_CHOICE are quiet, etc.
  const peakSignal =
    outcome === "TRANSCENDED" ? rand(rng, 0.85, 1.0) :
    outcome === "SILENT_BY_CHOICE" ? rand(rng, 0.25, 0.45) :
    outcome === "DORMANT" ? rand(rng, 0.5, 0.7) :
    rand(rng, 0.55, 0.95);

  const events: LifecycleEvent[] = [
    { kind: "abiogenesis", atGyr: abio, description: "First replicating chemistry." },
    { kind: "multicellular", atGyr: multi, description: "Coordinated cellular cooperation." },
    { kind: "sapience", atGyr: sapience, description: `${speciesName} achieve symbolic cognition.` },
    { kind: "industrial", atGyr: industrial, description: "Mechanized energy capture begins." },
    { kind: "atomic", atGyr: atomic, description: "Nuclear fission demonstrated." },
    { kind: "digital", atGyr: digital, description: "General-purpose computation." },
  ];
  if (spacefaring !== null) {
    events.push({ kind: "spacefaring", atGyr: spacefaring, description: "Crewed interplanetary flight." });
  }
  events.push({
    kind: "filter",
    atGyr: filterAt,
    description: FILTER_DESCRIPTIONS[filter],
  });
  if (outcome !== "DORMANT") {
    events.push({
      kind: "silence",
      atGyr: filterAt,
      description: "Carrier wave fades into background noise.",
    });
  }

  return {
    id,
    galaxyId: galaxy.id,
    systemId: system.id,
    planetId: planet.id,
    outcome,
    filter,
    events,
    signalStartGyr,
    signalEndGyr,
    peakSignal,
    speciesName,
    civilizationName,
  };
}

// ---------------------------------------------------------------------------
// Helper — derive a stable RNG for a given planet without consuming the
// universe's master stream.
// ---------------------------------------------------------------------------

export function rngForCivilization(planetId: string, masterSeed: number): Rng {
  return mulberry32(hashStringSeed(planetId) ^ masterSeed);
}

// ---------------------------------------------------------------------------
// Outcome → visual treatment lookup (used by Survey Report UI)
// ---------------------------------------------------------------------------

export const OUTCOME_DISPLAY: Record<
  FermiOutcome,
  { label: string; tone: "grey" | "green" | "red" | "gold" | "blue" | "white"; tagline: string }
> = {
  PRE_LIFE: {
    label: "PRE-LIFE",
    tone: "grey",
    tagline: "The cradle never rocked.",
  },
  LIFE_WITHOUT_MIND: {
    label: "LIFE WITHOUT MIND",
    tone: "green",
    tagline: "Verdant. Silent. Wordless.",
  },
  SUICIDED: {
    label: "SUICIDED",
    tone: "red",
    tagline: "They built the means and used it.",
  },
  TRANSCENDED: {
    label: "TRANSCENDED",
    tone: "gold",
    tagline: "Left the lightcone.",
  },
  DORMANT: {
    label: "DORMANT",
    tone: "blue",
    tagline: "Sleeping. Possibly waiting.",
  },
  SILENT_BY_CHOICE: {
    label: "SILENT BY CHOICE",
    tone: "white",
    tagline: "They heard us. They did not answer.",
  },
};
