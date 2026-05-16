"use client";

// ---------------------------------------------------------------------------
// 13.8 — Survey Report Panel
//
// The agentic flex. When opened, three agent panels appear with streaming
// reasoning:
//   - Cosmographer (always present at universe scope)
//   - Xenologist  (when the target is a civilization or a planet with one)
//   - Visual Director (when the target is a planet — emits the image prompt)
//
// Targets are set via store.openSurvey({ kind, ...ids }). The signal-event
// flow opens kind=signal which routes to the civ's planet automatically.
//
// Phase 2: each `script={...}` array gets replaced with an async iterator
// driven by /api/agent/<name>. The UI is already ready for that.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import { useUniverseStore } from "@/lib/store";
import { AgentStream } from "./agent-stream";
import {
  cosmographerScript,
  xenologistScript,
  visualDirectorScript,
} from "@/lib/agent-scripts";
import { OUTCOME_DISPLAY } from "@/lib/civilization-lifecycle";
import type { Galaxy, StarSystem, Planet, CivilizationTrace } from "@/lib/types";

type Resolved =
  | { kind: "universe" }
  | { kind: "galaxy"; galaxy: Galaxy }
  | { kind: "system"; galaxy: Galaxy; system: StarSystem }
  | {
      kind: "planet";
      galaxy: Galaxy;
      system: StarSystem;
      planet: Planet;
      trace: CivilizationTrace | null;
    };

const TONE_COLORS: Record<string, { label: string; ring: string; bg: string; glow: string }> = {
  grey:  { label: "text-white/60",   ring: "ring-white/15",      bg: "bg-white/[0.04]",   glow: "" },
  green: { label: "text-emerald-200",ring: "ring-emerald-400/30",bg: "bg-emerald-500/10", glow: "shadow-[0_0_30px_-10px_rgba(52,211,153,0.5)]" },
  red:   { label: "text-red-200",    ring: "ring-red-400/40",    bg: "bg-red-500/10",     glow: "shadow-[0_0_30px_-10px_rgba(248,113,113,0.5)]" },
  gold:  { label: "text-amber-200",  ring: "ring-amber-400/40",  bg: "bg-amber-500/10",   glow: "shadow-[0_0_30px_-10px_rgba(251,191,36,0.6)]" },
  blue:  { label: "text-sky-200",    ring: "ring-sky-400/30",    bg: "bg-sky-500/10",     glow: "shadow-[0_0_30px_-10px_rgba(125,211,252,0.4)]" },
  white: { label: "text-white/90",   ring: "ring-white/30",      bg: "bg-white/[0.06]",   glow: "" },
};

export function SurveyReport() {
  const target = useUniverseStore((s) => s.surveyTarget);
  const closeSurvey = useUniverseStore((s) => s.closeSurvey);
  const universe = useUniverseStore((s) => s.universe);

  // Pull the resolved entity context
  const resolved = useMemo<Resolved | null>(() => {
    if (!target || !universe) return null;

    if (target.kind === "universe") {
      return { kind: "universe" };
    }

    if (target.kind === "signal") {
      // SignalEvent.id has form `sig-civ-<planetId>`; civ.id has form `civ-<planetId>`
      const civId = target.signalId.startsWith("sig-")
        ? target.signalId.slice(4)
        : target.signalId;
      const trace = universe.civilizations.find((c) => c.id === civId);
      if (!trace) return null;
      const galaxy = universe.galaxies.find((g) => g.id === trace.galaxyId);
      const system = galaxy?.systems.find((s) => s.id === trace.systemId);
      const planet = system?.planets.find((p) => p.id === trace.planetId);
      if (!galaxy || !system || !planet) return null;
      return { kind: "planet", galaxy, system, planet, trace };
    }

    if (target.kind === "galaxy") {
      const galaxy = universe.galaxies.find((g) => g.id === target.galaxyId);
      if (!galaxy) return null;
      return { kind: "galaxy", galaxy };
    }

    if (target.kind === "system") {
      const galaxy = universe.galaxies.find((g) => g.id === target.galaxyId);
      const system = galaxy?.systems.find((s) => s.id === target.systemId);
      if (!galaxy || !system) return null;
      return { kind: "system", galaxy, system };
    }

    if (target.kind === "planet") {
      const galaxy = universe.galaxies.find((g) => g.id === target.galaxyId);
      const system = galaxy?.systems.find((s) => s.id === target.systemId);
      const planet = system?.planets.find((p) => p.id === target.planetId);
      if (!galaxy || !system || !planet) return null;
      const trace = universe.civilizations.find((c) => c.planetId === planet.id) ?? null;
      return { kind: "planet", galaxy, system, planet, trace };
    }

    return null;
  }, [target, universe]);

  if (!target || !universe || !resolved) return null;

  // Compose scripts
  const cosmoScript = cosmographerScript(universe);
  const xenoData =
    resolved.kind === "planet" && resolved.trace
      ? { trace: resolved.trace, planet: resolved.planet, system: resolved.system, galaxy: resolved.galaxy }
      : null;
  const xenoScript = xenoData
    ? xenologistScript(xenoData.trace, { planet: xenoData.planet, system: xenoData.system, galaxy: xenoData.galaxy })
    : null;
  const visualScript =
    resolved.kind === "planet"
      ? visualDirectorScript(resolved.trace, resolved.planet)
      : null;

  const resetKey = JSON.stringify(target);

  // Outcome banner
  const outcome =
    resolved.kind === "planet" && resolved.trace
      ? OUTCOME_DISPLAY[resolved.trace.lifecycle.outcome]
      : null;

  const tone = outcome ? TONE_COLORS[outcome.tone] : null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/70 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-500"
      onClick={closeSurvey}
    >
      <div
        className="w-full max-w-[520px] h-full bg-black/95 border-l border-white/[0.08] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-7 space-y-7">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[9px] tracking-[0.45em] uppercase text-white/35">
                Survey Report
              </p>
              <h2 className="font-serif text-2xl text-white/95 mt-2 leading-tight">
                {renderTargetTitle(resolved)}
              </h2>
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/40 mt-1.5">
                {renderTargetSubtitle(resolved)}
              </p>
            </div>
            <button
              onClick={closeSurvey}
              className="font-mono text-[11px] tracking-[0.2em] uppercase text-white/35 hover:text-white/80 cursor-pointer leading-none"
            >
              ✕
            </button>
          </div>

          {/* Outcome banner (if planet w/ civ) */}
          {outcome && tone && (
            <div
              className={`rounded-xl border ${tone.ring} ${tone.bg} ${tone.glow} px-5 py-4`}
            >
              <p className="font-mono text-[9px] tracking-[0.4em] uppercase text-white/40">
                Verdict
              </p>
              <p className={`font-serif text-2xl ${tone.label} mt-1.5 tracking-wide`}>
                {outcome.label}
              </p>
              <p className="font-mono text-[10.5px] text-white/55 italic mt-1.5">
                {outcome.tagline}
              </p>
            </div>
          )}

          {/* Agents — streaming from /api/agent, with procedural fallback */}
          <div className="space-y-7">
            <AgentStream
              label="Cosmographer"
              agent="cosmographer"
              seed={universe.seed}
              fallbackScript={cosmoScript}
              resetKey={`cosmo-${resetKey}`}
            />

            {xenoData && xenoScript && (
              <AgentStream
                label="Xenologist"
                agent="xenologist"
                seed={universe.seed}
                galaxyId={xenoData.galaxy.id}
                systemId={xenoData.system.id}
                planetId={xenoData.planet.id}
                fallbackScript={xenoScript}
                resetKey={`xeno-${resetKey}`}
              />
            )}

            {resolved.kind === "planet" && visualScript && (
              <AgentStream
                label="Visual Director"
                agent="visualDirector"
                seed={universe.seed}
                galaxyId={resolved.galaxy.id}
                systemId={resolved.system.id}
                planetId={resolved.planet.id}
                fallbackScript={visualScript}
                resetKey={`vd-${resetKey}`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderTargetTitle(resolved: Resolved): string {
  if (resolved.kind === "universe") return "Universe Survey";
  if (resolved.kind === "galaxy") return resolved.galaxy.name;
  if (resolved.kind === "system") return resolved.system.name;
  return resolved.planet.name;
}

function renderTargetSubtitle(resolved: Resolved): string {
  if (resolved.kind === "universe") return "Cosmographer · all-scale Fermi reasoning";
  if (resolved.kind === "galaxy") return `${resolved.galaxy.epithet} · ${resolved.galaxy.systems.length} systems`;
  if (resolved.kind === "system") return `${resolved.system.spectralClass}-class · ${resolved.system.planets.length} planets`;
  return `${resolved.planet.type} world · ${resolved.system.name}`;
}
