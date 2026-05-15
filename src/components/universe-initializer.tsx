"use client";

// ---------------------------------------------------------------------------
// 13.8 — Universe Initializer
//
// Generates the universe on first mount. Lives in the root layout so the
// universe is ready before any page renders. Also handles keyboard shortcuts
// (Escape to zoom out).
// ---------------------------------------------------------------------------

import { useEffect } from "react";
import { useUniverseStore } from "@/lib/store";

export function UniverseInitializer() {
  const initialize = useUniverseStore((s) => s.initialize);
  const zoomOut = useUniverseStore((s) => s.zoomOut);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Escape key to zoom out
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        zoomOut();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zoomOut]);

  return null;
}
