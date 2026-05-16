// ---------------------------------------------------------------------------
// 13.8 — Agent Script Generator (procedural fallback)
//
// Generates the chain-of-reasoning scripts that the Survey Report panel
// streams. Phase 1 uses templated procedural text; Phase 2 will swap each
// of these `runAgent*` functions for a fetch() against /api/agent/... that
// streams real LLM tokens (Claude / Mastra). The UI is unchanged in either
// case — it just consumes an async iterable of strings.
//
// Each agent emits a sequence of "thought blocks":
//   { kind: "thought", text }       — chain-of-reasoning (italic, dimmer)
//   { kind: "conclusion", text }    — load-bearing finding (highlighted)
//
// The component throttles emission so chains feel deliberate, not pasted.
// ---------------------------------------------------------------------------

import type { Universe, CivilizationTrace, Planet, StarSystem, Galaxy } from "./types";
import {
  OUTCOME_DISPLAY,
  type FermiOutcome,
} from "./civilization-lifecycle";
import { countActiveCivilizations, UNIVERSE_AGE_GYR } from "./civilization-epoch";

export type AgentName = "Cosmographer" | "Xenologist" | "Visual Director";

export type AgentBlock =
  | { kind: "status"; text: string }
  | { kind: "thought"; text: string }
  | { kind: "conclusion"; text: string };

export type AgentScript = AgentBlock[];

// ---------------------------------------------------------------------------
// Cosmographer — universe-level Fermi reasoning
// ---------------------------------------------------------------------------

export function cosmographerScript(universe: Universe): AgentScript {
  let totalSystems = 0;
  let habitable = 0;
  universe.galaxies.forEach((g) => {
    totalSystems += g.systems.length;
    g.systems.forEach((s) => {
      habitable += s.planets.filter((p) => p.habitable).length;
    });
  });

  const civs = universe.civilizations;
  const total = civs.length;
  const outcomes: Record<FermiOutcome, number> = {
    PRE_LIFE: 0,
    LIFE_WITHOUT_MIND: 0,
    SUICIDED: 0,
    TRANSCENDED: 0,
    DORMANT: 0,
    SILENT_BY_CHOICE: 0,
  };
  for (const c of civs) outcomes[c.lifecycle.outcome]++;

  const dominantOutcome = (Object.entries(outcomes) as [FermiOutcome, number][])
    .sort((a, b) => b[1] - a[1])
    [0];

  const filters = new Map<string, number>();
  for (const c of civs) {
    filters.set(c.lifecycle.filter, (filters.get(c.lifecycle.filter) ?? 0) + 1);
  }
  const dominantFilter = [...filters.entries()].sort((a, b) => b[1] - a[1])[0];

  return [
    { kind: "status", text: "INDEXING UNIVERSE" },
    { kind: "thought", text: `Surveyed ${universe.galaxies.length} galaxies, ${totalSystems} star systems, ${habitable} candidate habitable worlds.` },
    { kind: "thought", text: "Computing expected civilization density via standard Drake estimators..." },
    { kind: "thought", text: `Detected ${total} civilizations across all of cosmic time. Currently active: ${countActiveCivilizations(universe, UNIVERSE_AGE_GYR)}.` },
    { kind: "status", text: "ANALYZING OUTCOMES" },
    { kind: "thought", text: `Outcome distribution — Suicided: ${outcomes.SUICIDED}, Life without mind: ${outcomes.LIFE_WITHOUT_MIND}, Pre-life: ${outcomes.PRE_LIFE}, Transcended: ${outcomes.TRANSCENDED}, Dormant: ${outcomes.DORMANT}, Silent by choice: ${outcomes.SILENT_BY_CHOICE}.` },
    { kind: "thought", text: `Dominant outcome class: ${OUTCOME_DISPLAY[dominantOutcome[0]].label}. Dominant filter: ${dominantFilter ? dominantFilter[0] : "—"}.` },
    { kind: "thought", text: "Cross-referencing with observed silence..." },
    { kind: "conclusion", text: `In this universe, ${total} civilizations arose. None survived to the present epoch.` },
    { kind: "conclusion", text: `The Great Filter, in this seed, lies primarily in ${describeFilter(dominantFilter?.[0] ?? "NUCLEAR")}.` },
  ];
}

function describeFilter(f: string): string {
  switch (f) {
    case "NUCLEAR": return "the atomic transition — they built the means and used it";
    case "CLIMATE": return "their own atmosphere — they could not stop heating their world";
    case "AI_TAKEOVER": return "succession — their successors did not preserve them";
    case "BIOTECH_PLAGUE": return "the laboratory bench — a single engineered escape";
    case "GREY_GOO": return "self-replicators they could not recall";
    case "RESOURCE_EXHAUSTION": return "the well — they drew it dry before leaving";
    case "SAPIENCE": return "the gap between life and mind — it was never crossed";
    case "ABIOGENESIS": return "the first replicator — chemistry stayed quiet";
    case "MULTICELLULARITY": return "the leap to collective bodies";
    case "TRANSCENDENCE": return "transcendence — they left the biological substrate behind";
    case "DARK_FOREST": return "older predators — they fell quiet, then they were silenced";
    default: return f.toLowerCase();
  }
}

// ---------------------------------------------------------------------------
// Xenologist — per-civilization deep reasoning
// ---------------------------------------------------------------------------

export function xenologistScript(
  trace: CivilizationTrace,
  context: { planet: Planet; system: StarSystem; galaxy: Galaxy },
): AgentScript {
  const lc = trace.lifecycle;
  const outcome = OUTCOME_DISPLAY[lc.outcome];

  const lookbackGyr = UNIVERSE_AGE_GYR - lc.signalEndGyr;
  const lookbackMyr = lookbackGyr * 1000;
  const lookbackText =
    lookbackMyr >= 10
      ? `${Math.round(lookbackMyr).toLocaleString()} million years ago`
      : lookbackMyr >= 1
      ? `${lookbackMyr.toFixed(1)} million years ago`
      : `${Math.round(lookbackMyr * 1000).toLocaleString()} thousand years ago`;

  const blocks: AgentScript = [
    { kind: "status", text: "ACQUIRING REMNANT SIGNATURE" },
    { kind: "thought", text: `Target: ${lc.civilizationName}. Origin: ${context.planet.name}, ${context.system.name}, ${context.galaxy.name}.` },
    { kind: "thought", text: `Carrier wave decayed ${lookbackText}. Reconstructing event timeline from spectral residue.` },
  ];

  // Walk the lifecycle events — let the reasoning chain emerge
  const phases = [
    lc.events.find((e) => e.kind === "abiogenesis"),
    lc.events.find((e) => e.kind === "sapience"),
    lc.events.find((e) => e.kind === "atomic"),
    lc.events.find((e) => e.kind === "spacefaring"),
  ].filter(Boolean) as { kind: string; atGyr: number; description: string }[];

  for (const ev of phases) {
    const epochAgo = (UNIVERSE_AGE_GYR - ev.atGyr) * 1000;
    blocks.push({
      kind: "thought",
      text: `T-${epochAgo >= 10 ? Math.round(epochAgo).toLocaleString() + " Myr" : epochAgo.toFixed(2) + " Myr"} · ${ev.description}`,
    });
  }

  blocks.push({ kind: "status", text: "DETERMINING TERMINAL EVENT" });
  const filterEvent = lc.events.find((e) => e.kind === "filter");
  if (filterEvent) {
    blocks.push({
      kind: "thought",
      text: `Filter signature consistent with ${prettyFilter(lc.filter)}: ${filterEvent.description}`,
    });
  }

  blocks.push({ kind: "status", text: "VERDICT" });
  blocks.push({
    kind: "conclusion",
    text: `${outcome.label}. ${outcome.tagline}`,
  });
  blocks.push({
    kind: "conclusion",
    text: terminalLine(lc.outcome, lc.civilizationName),
  });

  return blocks;
}

function prettyFilter(f: string): string {
  return f
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function terminalLine(outcome: FermiOutcome, name: string): string {
  switch (outcome) {
    case "SUICIDED":
      return `${name} held the means and the moment. They did not survive their own invention.`;
    case "TRANSCENDED":
      return `${name} are not here because they are no longer matter. They left signatures, then they left the page.`;
    case "DORMANT":
      return `${name} did not die. They are asleep. They may still be reached, if anyone went looking.`;
    case "SILENT_BY_CHOICE":
      return `${name} chose silence. They heard us. They will not answer.`;
    case "LIFE_WITHOUT_MIND":
      return `Life here was real and abundant. Nothing built a radio. Nothing carved a name.`;
    case "PRE_LIFE":
      return `The water never spoke. The crust never invented.`;
  }
}

// ---------------------------------------------------------------------------
// Visual Director — emits an image prompt for the planet's hero shot
// ---------------------------------------------------------------------------

export function visualDirectorScript(
  trace: CivilizationTrace | null,
  planet: Planet,
): AgentScript {
  const blocks: AgentScript = [
    { kind: "status", text: "COMPOSING HERO IMAGE PROMPT" },
    { kind: "thought", text: `Subject: ${planet.name}, a ${planet.type} world.` },
  ];

  let prompt = `${planet.type} exoplanet, viewed from low orbit`;

  if (trace) {
    const lc = trace.lifecycle;
    switch (lc.outcome) {
      case "SUICIDED":
        if (lc.filter === "NUCLEAR") prompt += ", glassed continents, soot-grey atmosphere, faint linear ruins visible from orbit";
        else if (lc.filter === "CLIMATE") prompt += ", scorched cloud layer, dried ocean basins, fragmented landmasses with geometric ruins";
        else if (lc.filter === "BIOTECH_PLAGUE") prompt += ", over-vegetated, bio-luminescent, runaway algal bloom across former cities";
        else prompt += ", ruined surface, structures rendered into geometric outlines";
        break;
      case "TRANSCENDED":
        prompt += ", geometric megastructures, dyson-fragment rings, golden inner glow";
        break;
      case "DORMANT":
        prompt += ", lit grid patterns on the dark side, faint thermal traces, sleeping but warm";
        break;
      case "SILENT_BY_CHOICE":
        prompt += ", radar-dark, suspiciously uniform cloud cover, almost no surface variation visible";
        break;
      case "LIFE_WITHOUT_MIND":
        prompt += ", vivid biological cover, no straight lines anywhere on the surface";
        break;
      case "PRE_LIFE":
        prompt += ", chemically rich but lifeless, sterile cloud layer, slightly hazy atmosphere";
        break;
    }
  }

  prompt += ", photoreal, cinematic, soft volumetric lighting, slight chromatic haze, 16:9";

  blocks.push({ kind: "thought", text: "Threading lore into the visual brief..." });
  blocks.push({ kind: "conclusion", text: prompt });
  return blocks;
}
