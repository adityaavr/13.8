"use client";

import { useEffect, useState } from "react";

/**
 * The universe is ~13.8 billion years old.
 * This counter ticks forward in real time from that baseline,
 * showing the age of the universe down to ~millisecond precision.
 *
 * The rate: 1 real second = 1 second of cosmic time.
 * It's a reminder that the clock is still running.
 */

const UNIVERSE_AGE_YEARS = 13_800_000_000;

function formatAge(years: number): string {
  const billions = years / 1_000_000_000;
  // Show 12 decimal places for that deep-time feel
  return billions.toFixed(12);
}

export function CosmicCounter() {
  const [age, setAge] = useState(UNIVERSE_AGE_YEARS);

  useEffect(() => {
    const interval = setInterval(() => {
      // 1 tick = 50ms real time
      // 1 year = 31,557,600 seconds
      // Each tick adds (0.05 / 31557600) years ≈ tiny increment
      // But for visual effect, we tick faster: ~1 year per second of real time
      // Actually let's make it feel cosmic: 1 real second = ~100 years
      setAge((prev) => prev + 100 / 20); // 100 years per second, updating 20x/sec
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const display = formatAge(age);

  return (
    <div className="font-mono text-sm tracking-[0.2em] text-white/55 tabular-nums">
      <span className="text-white/35 mr-1">~</span>
      {display}
      <span className="text-white/35 ml-1">Gyr</span>
    </div>
  );
}
