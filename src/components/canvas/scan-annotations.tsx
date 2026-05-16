"use client";

// ---------------------------------------------------------------------------
// 13.8 — Scan Annotations HUD
//
// Renders the floating NMS-style discovery pins over the 3D scene. Each
// annotation has a pin (anchored at a world-space point on the active
// entity), an animated leader line, and a label card with monospace text.
//
// On entity change, the whole group remounts via a scan-key so the draw-on
// animations replay.
//
// This is a self-contained layer — the rendering is fully decoupled from
// annotation generation (see lib/annotations.ts). To swap procedural copy
// for LLM-generated copy later, only the data source changes.
// ---------------------------------------------------------------------------

import { Html } from "@react-three/drei";
import { useMemo } from "react";
import { useUniverseStore } from "@/lib/store";
import {
  annotationsForPlanet,
  annotationsForSystem,
  annotationsForGalaxy,
  type Annotation,
  type AnnotationTone,
} from "@/lib/annotations";

// ---------------------------------------------------------------------------
// Tone → tailwind class lookups
// ---------------------------------------------------------------------------

const TONE_PIN: Record<AnnotationTone, string> = {
  default: "bg-cyan-200/95 ring-cyan-300/40",
  highlight: "bg-emerald-200/95 ring-emerald-300/40",
  warning: "bg-amber-200/95 ring-amber-300/40",
  info: "bg-violet-200/95 ring-violet-300/40",
};

const TONE_LINE: Record<AnnotationTone, string> = {
  default: "stroke-cyan-300/70",
  highlight: "stroke-emerald-300/80",
  warning: "stroke-amber-300/80",
  info: "stroke-violet-300/70",
};

const TONE_LABEL: Record<AnnotationTone, string> = {
  default: "border-cyan-300/35 text-cyan-50",
  highlight: "border-emerald-300/45 text-emerald-50",
  warning: "border-amber-300/50 text-amber-50",
  info: "border-violet-300/35 text-violet-50",
};

const TONE_SUBLABEL: Record<AnnotationTone, string> = {
  default: "text-cyan-200/55",
  highlight: "text-emerald-200/60",
  warning: "text-amber-200/65",
  info: "text-violet-200/55",
};

// ---------------------------------------------------------------------------
// Single annotation
// ---------------------------------------------------------------------------

function ScanPin({ annotation, index }: { annotation: Annotation; index: number }) {
  const { leaderAngle, tone, label, sublabel } = annotation;
  // Distance from pin to start of label box, in CSS pixels
  const LEADER_LEN = 88;

  const rad = (leaderAngle * Math.PI) / 180;
  const lx = Math.cos(rad) * LEADER_LEN;
  // Screen Y is inverted (up = negative)
  const ly = -Math.sin(rad) * LEADER_LEN;

  // SVG viewBox sized to comfortably contain the line in any direction
  const SVG_PAD = 4;
  const minX = Math.min(0, lx) - SVG_PAD;
  const minY = Math.min(0, ly) - SVG_PAD;
  const w = Math.abs(lx) + SVG_PAD * 2;
  const h = Math.abs(ly) + SVG_PAD * 2;

  // Stagger each pin's reveal
  const baseDelay = index * 90;

  return (
    <Html
      position={annotation.position}
      style={{ pointerEvents: "none" }}
      center
      zIndexRange={[0, 0]}
      transform={false}
    >
      <div
        className="relative"
        style={{ ["--scan-delay" as string]: `${baseDelay}ms` }}
      >
        {/* Pin — small filled dot with pulsing ring */}
        <div
          className={`scan-pin absolute left-0 top-0 h-[6px] w-[6px] rounded-full ring-2 ${TONE_PIN[tone]}`}
          style={{ animationDelay: `${baseDelay}ms, ${baseDelay + 800}ms` }}
        />

        {/* Leader line (SVG, dashed, draws on) */}
        <svg
          className="scan-line pointer-events-none absolute overflow-visible"
          style={{
            left: `${minX}px`,
            top: `${minY}px`,
            width: `${w}px`,
            height: `${h}px`,
            animationDelay: `${baseDelay + 100}ms`,
          }}
          viewBox={`${minX} ${minY} ${w} ${h}`}
        >
          <line
            x1={0}
            y1={0}
            x2={lx}
            y2={ly}
            className={`${TONE_LINE[tone]} fill-none`}
            strokeWidth="1"
            strokeDasharray="3 3"
            style={{
              strokeDasharray: 240,
              strokeDashoffset: 240,
              animationDelay: `${baseDelay + 100}ms`,
            }}
          />
          {/* terminal tick on label end */}
          <circle
            cx={lx}
            cy={ly}
            r={1.6}
            className={`${TONE_LINE[tone]} fill-current`}
          />
        </svg>

        {/* Label box */}
        <div
          className="scan-label scan-sweep absolute overflow-hidden whitespace-nowrap rounded-sm border bg-black/45 px-2 py-[3px] font-mono backdrop-blur-md"
          style={{
            left: `${lx + (lx >= 0 ? 6 : -6)}px`,
            top: `${ly}px`,
            transform: lx >= 0 ? "translateY(-50%)" : "translate(-100%, -50%)",
            animationDelay: `${baseDelay + 380}ms, ${baseDelay + 380}ms`,
          }}
        >
          <div
            className={`text-[10px] uppercase tracking-[0.14em] leading-tight ${TONE_LABEL[tone]}`}
          >
            {label}
          </div>
          {sublabel && (
            <div
              className={`text-[8.5px] tracking-[0.08em] leading-tight ${TONE_SUBLABEL[tone]}`}
            >
              {sublabel}
            </div>
          )}
        </div>
      </div>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Active-entity selector — picks which annotations to render
// ---------------------------------------------------------------------------

function useActiveAnnotations(): { scanKey: string; annos: Annotation[] } {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);
  const isTransitioning = useUniverseStore((s) => s.isTransitioning);

  const selectedGalaxyId = useUniverseStore((s) => s.selectedGalaxyId);
  const selectedSystemId = useUniverseStore((s) => s.selectedSystemId);
  const selectedPlanetId = useUniverseStore((s) => s.selectedPlanetId);
  const universe = useUniverseStore((s) => s.universe);

  return useMemo(() => {
    // Hide during transitions for a clean redraw
    if (isTransitioning) return { scanKey: "transition", annos: [] };
    if (!universe) return { scanKey: "empty", annos: [] };

    if (zoomLevel === "planet" && selectedGalaxyId && selectedSystemId && selectedPlanetId) {
      const galaxy = universe.galaxies.find((g) => g.id === selectedGalaxyId);
      const system = galaxy?.systems.find((s) => s.id === selectedSystemId);
      const planet = system?.planets.find((p) => p.id === selectedPlanetId);
      if (!planet) return { scanKey: "missing", annos: [] };
      return { scanKey: `p:${planet.id}`, annos: annotationsForPlanet(planet) };
    }

    if (zoomLevel === "system" && selectedGalaxyId && selectedSystemId) {
      const galaxy = universe.galaxies.find((g) => g.id === selectedGalaxyId);
      const system = galaxy?.systems.find((s) => s.id === selectedSystemId);
      if (!system) return { scanKey: "missing", annos: [] };
      return { scanKey: `s:${system.id}`, annos: annotationsForSystem(system) };
    }

    if (zoomLevel === "galaxy" && selectedGalaxyId) {
      const galaxy = universe.galaxies.find((g) => g.id === selectedGalaxyId);
      if (!galaxy) return { scanKey: "missing", annos: [] };
      return { scanKey: `g:${galaxy.id}`, annos: annotationsForGalaxy(galaxy) };
    }

    return { scanKey: "none", annos: [] };
  }, [zoomLevel, isTransitioning, selectedGalaxyId, selectedSystemId, selectedPlanetId, universe]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function ScanAnnotations() {
  const { scanKey, annos } = useActiveAnnotations();

  if (annos.length === 0) return null;

  return (
    <group key={scanKey}>
      {annos.map((a, i) => (
        <ScanPin key={a.id} annotation={a} index={i} />
      ))}
    </group>
  );
}
