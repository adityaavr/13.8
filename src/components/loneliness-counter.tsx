"use client";

// ---------------------------------------------------------------------------
// 13.8 — Loneliness Counter
//
// Quantifies cosmic loneliness. During timeline playback, accumulates
// "civ-years of unanswered existence" — for every active civilization at
// every epoch tick, we add (delta-time × 1) civ-year. Climbs into the
// billions over a full 13.8 Gyr run, which is the point: silence as
// quantifiable tragedy.
//
// The store's `lonelinessGyrYears` field stores the value in Gyr · civs.
// We render it as plain years for impact.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { useUniverseStore } from "@/lib/store";

function formatYears(years: number): string {
  if (years >= 1e9) return `${(years / 1e9).toFixed(2)} Gyr·civ`;
  if (years >= 1e6) return `${(years / 1e6).toFixed(2)} Myr·civ`;
  if (years >= 1e3) return `${(years / 1e3).toFixed(1)} Kyr·civ`;
  return `${Math.round(years)} yr·civ`;
}

export function LonelinessCounter() {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);
  const lonelinessGyrYears = useUniverseStore((s) => s.lonelinessGyrYears);
  const isPlaying = useUniverseStore((s) => s.isEpochPlaying);

  // Smoothly tween toward the store value so digits don't jump
  const [displayYears, setDisplayYears] = useState(0);
  const animRef = useRef<number | null>(null);
  const targetRef = useRef(0);

  useEffect(() => {
    targetRef.current = lonelinessGyrYears * 1e9; // Gyr·civ → yr·civ
  }, [lonelinessGyrYears]);

  useEffect(() => {
    const tick = () => {
      setDisplayYears((cur) => {
        const target = targetRef.current;
        const delta = target - cur;
        if (Math.abs(delta) < 0.5) return target;
        return cur + delta * 0.08;
      });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    };
  }, []);

  if (zoomLevel !== "universe") return null;
  if (lonelinessGyrYears === 0 && !isPlaying) return null;

  return (
    <div className="fixed left-4 top-24 md:left-6 md:top-8 z-20 pointer-events-none select-none">
      <div className="bg-black/55 backdrop-blur-md border border-white/[0.08] rounded-xl px-4 py-3">
        <p className="font-mono text-[9px] tracking-[0.32em] uppercase text-white/45">
          Loneliness Accrued
        </p>
        <p className="font-mono text-[18px] tracking-tight text-white/85 mt-1 tabular-nums">
          {formatYears(displayYears)}
        </p>
        <p className="font-mono text-[8.5px] tracking-[0.18em] uppercase text-white/30 mt-1">
          civ-years without contact
        </p>
      </div>
    </div>
  );
}
