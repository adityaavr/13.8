"use client";

// ---------------------------------------------------------------------------
// 13.8 — Lens Flare Controller
//
// Drives the @react-three/postprocessing LensFlare effect using the shared
// lensFlareState (mutated by whichever view owns the active light source).
// Frame-tracks position so we never re-create the effect.
// ---------------------------------------------------------------------------

import { LensFlare } from "@react-three/postprocessing";
import { useMemo } from "react";
import * as THREE from "three";
import { lensFlareState } from "@/lib/lens-flare-state";

export function LensFlareController({ active }: { active: boolean }) {
  // Pass the SHARED Vector3 — the effect reads its uniform from this object
  // each frame internally, so mutating lensFlareState.position is enough.
  const sharedPos = useMemo(() => lensFlareState.position, []);
  const sharedColor = useMemo(() => lensFlareState.colorGain, []);

  return (
    <LensFlare
      enabled={active}
      lensPosition={sharedPos}
      colorGain={sharedColor}
      glareSize={0.32}
      flareSize={0.005}
      flareSpeed={0.008}
      flareShape={0.5}
      starPoints={6}
      haloScale={0.65}
      anamorphic={false}
      animated
      secondaryGhosts
      aditionalStreaks
      ghostScale={0.18}
      starBurst
      opacity={0.95}
      smoothTime={0.08}
      // Project lens at a hidden raycaster-friendly distance
      screenRes={new THREE.Vector2(0, 0)}
    />
  );
}
