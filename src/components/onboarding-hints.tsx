"use client";

// ---------------------------------------------------------------------------
// 13.8 — Onboarding Hints
//
// Shows 3 brief hints when user first enters the universe.
// Auto-dismisses after 5 seconds or on first interaction.
// Only shows once per session.
// ---------------------------------------------------------------------------

import { useState, useEffect } from "react";
import { useUniverseStore } from "@/lib/store";

const HINTS = [
  "Scroll to zoom",
  "Click a galaxy to dive in",
  "Look for signs of life",
];

export function OnboardingHints() {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (zoomLevel === "universe" && !shown) {
      setVisible(true);
      setShown(true);

      // Auto-dismiss after 5s
      const timeout = setTimeout(() => setVisible(false), 5000);

      // Dismiss on interaction
      const dismiss = () => {
        setVisible(false);
        clearTimeout(timeout);
      };
      window.addEventListener("click", dismiss, { once: true });
      window.addEventListener("wheel", dismiss, { once: true });
      window.addEventListener("keydown", dismiss, { once: true });

      return () => {
        clearTimeout(timeout);
        window.removeEventListener("click", dismiss);
        window.removeEventListener("wheel", dismiss);
        window.removeEventListener("keydown", dismiss);
      };
    }
  }, [zoomLevel, shown]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 animate-in fade-in duration-700">
        {HINTS.map((hint, i) => (
          <div
            key={i}
            className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-5 py-2.5"
            style={{ animationDelay: `${i * 200}ms` }}
          >
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase text-white/70">
              {hint}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
