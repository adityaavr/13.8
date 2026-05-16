// ---------------------------------------------------------------------------
// 13.8 — Universe summary builder
//
// Produces the structured context block that all three agents share. Lives
// in its own module so we can keep the EXACT SAME bytes across requests —
// critical for the prompt cache.
//
// Stability rules:
//   - Deterministic ordering (galaxies sorted by id, etc.)
//   - No timestamps
//   - No request IDs
//   - JSON keys in stable order
// ---------------------------------------------------------------------------

import type { Universe, CivilizationTrace } from "./types";
import { UNIVERSE_AGE_GYR } from "./civilization-epoch";

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

export function buildUniverseSummary(universe: Universe): string {
  let totalSystems = 0;
  let totalPlanets = 0;
  let habitable = 0;
  for (const g of universe.galaxies) {
    totalSystems += g.systems.length;
    for (const s of g.systems) {
      totalPlanets += s.planets.length;
      habitable += s.planets.filter((p) => p.habitable).length;
    }
  }

  const outcomes: Record<string, number> = {};
  const filters: Record<string, number> = {};
  for (const c of universe.civilizations) {
    outcomes[c.lifecycle.outcome] = (outcomes[c.lifecycle.outcome] ?? 0) + 1;
    filters[c.lifecycle.filter] = (filters[c.lifecycle.filter] ?? 0) + 1;
  }

  // Build civilization roster — sorted by id for cache stability
  const civs = [...universe.civilizations].sort((a, b) => a.id.localeCompare(b.id));

  const lines: string[] = [];
  lines.push(`# Universe Survey — Seed 0x${universe.seed.toString(16)}`);
  lines.push("");
  lines.push("## Aggregate");
  lines.push(`- Universe age: ${UNIVERSE_AGE_GYR} Gyr (present epoch)`);
  lines.push(`- Galaxies: ${universe.galaxies.length}`);
  lines.push(`- Star systems: ${totalSystems}`);
  lines.push(`- Planets catalogued: ${totalPlanets}`);
  lines.push(`- Habitable worlds: ${habitable}`);
  lines.push(`- Civilizations that ever arose: ${universe.civilizations.length}`);
  lines.push("");
  lines.push("## Outcome distribution");
  for (const [k, v] of Object.entries(outcomes).sort()) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push("");
  lines.push("## Dominant filter distribution");
  for (const [k, v] of Object.entries(filters).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push("");
  lines.push("## Galaxies");
  for (const g of [...universe.galaxies].sort((a, b) => a.id.localeCompare(b.id))) {
    lines.push(`- ${g.id} · "${g.name}" (${g.epithet}) · ${g.type} · ${fmt(g.age, 1)} Gyr · ${g.systems.length} systems`);
  }
  lines.push("");
  lines.push("## Civilizations (full roster)");
  for (const c of civs) {
    lines.push(formatCiv(c));
  }
  return lines.join("\n");
}

function formatCiv(c: CivilizationTrace): string {
  const lc = c.lifecycle;
  const lookbackMyr = (UNIVERSE_AGE_GYR - lc.signalEndGyr) * 1000;
  return [
    `### ${c.id} — ${lc.civilizationName} (species: ${lc.speciesName})`,
    `  - Outcome: ${lc.outcome}`,
    `  - Filter: ${lc.filter}`,
    `  - Signal window: ${fmt(lc.signalStartGyr)}–${fmt(lc.signalEndGyr)} Gyr (silenced ~${fmt(lookbackMyr, 1)} Myr ago)`,
    `  - Peak signal: ${fmt(lc.peakSignal, 2)}`,
    `  - Location: ${c.galaxyId} / ${c.systemId} / ${c.planetId}`,
    `  - Key events:`,
    ...lc.events.map(
      (e) => `      • T+${fmt(e.atGyr, 3)} Gyr · ${e.kind} · ${e.description}`,
    ),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Per-agent context blocks — focused detail for one entity
// ---------------------------------------------------------------------------

export function buildPlanetFocus(
  universe: Universe,
  galaxyId: string,
  systemId: string,
  planetId: string,
): string | null {
  const galaxy = universe.galaxies.find((g) => g.id === galaxyId);
  const system = galaxy?.systems.find((s) => s.id === systemId);
  const planet = system?.planets.find((p) => p.id === planetId);
  if (!galaxy || !system || !planet) return null;
  const trace = universe.civilizations.find((c) => c.planetId === planet.id);

  const lines = [
    `## Focused target`,
    `- Planet: ${planet.name} (id ${planet.id}) — type ${planet.type}, ${planet.habitable ? "habitable" : "non-habitable"}`,
    `- Orbit radius: ${fmt(planet.orbitRadius, 2)} AU-ish`,
    `- Star: ${system.name} (${system.spectralClass}-class${system.hasBlackHole ? ", BLACK HOLE" : ""})`,
    `- Galaxy: ${galaxy.name} (${galaxy.epithet}, ${galaxy.type}, ${fmt(galaxy.age, 1)} Gyr)`,
  ];
  if (trace) {
    lines.push(`- Civilization on record: ${trace.lifecycle.civilizationName}`);
    lines.push(`- Outcome: ${trace.lifecycle.outcome} via ${trace.lifecycle.filter}`);
  } else {
    lines.push(`- Civilization on record: NONE`);
  }
  return lines.join("\n");
}
