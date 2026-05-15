"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  UNIVERSE_AGE_GYR,
  clampEpochGyr,
  countActiveCivilizations,
} from "@/lib/civilization-epoch";
import { useUniverseStore } from "@/lib/store";

const PLAY_RATE_GYR_PER_SECOND = 0.35;

export function TimeScrubber() {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);
  const universe = useUniverseStore((s) => s.universe);
  const epochGyr = useUniverseStore((s) => s.epochGyr);
  const isEpochPlaying = useUniverseStore((s) => s.isEpochPlaying);
  const setEpochGyr = useUniverseStore((s) => s.setEpochGyr);
  const setEpochPlaying = useUniverseStore((s) => s.setEpochPlaying);

  const epochRef = useRef(epochGyr);

  useEffect(() => {
    epochRef.current = epochGyr;
  }, [epochGyr]);

  // Pause playback whenever user leaves the universe map.
  useEffect(() => {
    if (zoomLevel !== "universe" && isEpochPlaying) {
      setEpochPlaying(false);
    }
  }, [zoomLevel, isEpochPlaying, setEpochPlaying]);

  // Timeline playback loop.
  useEffect(() => {
    if (!isEpochPlaying || zoomLevel !== "universe") return;

    let rafId = 0;
    let prev = performance.now();

    const tick = (now: number) => {
      const deltaSeconds = (now - prev) / 1000;
      prev = now;

      const nextEpoch = clampEpochGyr(
        epochRef.current + deltaSeconds * PLAY_RATE_GYR_PER_SECOND,
      );

      epochRef.current = nextEpoch;
      setEpochGyr(nextEpoch);

      if (nextEpoch >= UNIVERSE_AGE_GYR) {
        setEpochPlaying(false);
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
  }, [isEpochPlaying, setEpochGyr, setEpochPlaying, zoomLevel]);

  const activeSignals = useMemo(
    () => countActiveCivilizations(universe, epochGyr),
    [universe, epochGyr],
  );

  const lookbackGyr = Math.max(0, UNIVERSE_AGE_GYR - epochGyr);

  const togglePlayback = () => {
    if (isEpochPlaying) {
      setEpochPlaying(false);
      return;
    }

    if (epochGyr >= UNIVERSE_AGE_GYR - 0.0001) {
      setEpochGyr(0);
      epochRef.current = 0;
    }

    setEpochPlaying(true);
  };

  if (zoomLevel !== "universe" || !universe) return null;

  return (
    <div className="fixed right-4 md:right-6 top-24 md:top-8 z-20 w-[min(92vw,430px)] pointer-events-auto select-none">
      <div className="bg-black/65 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3.5">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[9px] tracking-[0.35em] uppercase text-white/55">
            Cosmic Timeline
          </p>
          <button
            onClick={togglePlayback}
            className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/65 hover:text-white/90 border border-white/10 hover:border-white/25 rounded-md px-2.5 py-1 transition-colors cursor-pointer"
          >
            {isEpochPlaying ? "Pause" : "Play"}
          </button>
        </div>

        <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-white/72 mt-2.5 tabular-nums">
          Epoch {epochGyr.toFixed(2)} Gyr
        </p>
        <p className="font-mono text-[10px] tracking-[0.12em] text-white/38 mt-1 tabular-nums">
          {lookbackGyr.toFixed(2)} Gyr ago | {activeSignals} active signals
        </p>

        <input
          type="range"
          min={0}
          max={UNIVERSE_AGE_GYR}
          step={0.01}
          value={epochGyr}
          onChange={(event) => {
            setEpochPlaying(false);
            setEpochGyr(Number(event.target.value));
          }}
          className="mt-3 w-full h-1.5 rounded-full bg-white/10 accent-[#8cd4ff] cursor-pointer"
          aria-label="Universe epoch"
        />

        <div className="flex items-center justify-between mt-1.5 font-mono text-[9px] tracking-[0.16em] uppercase text-white/28 tabular-nums">
          <span>0.0</span>
          <span>6.9</span>
          <span>13.8</span>
        </div>
      </div>
    </div>
  );
}
