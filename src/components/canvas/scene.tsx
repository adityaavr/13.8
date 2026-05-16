"use client";

// ---------------------------------------------------------------------------
// 13.8 — Main 3D Scene
//
// Persistent Canvas with NMS-grade post-processing stack:
//   - Bloom (tight star bloom + wide nebula glow)
//   - Anamorphic lens flare on the active star
//   - Chromatic aberration (subtle screen-edge fringe)
//   - Vignette (cinematic darkening)
//   - HueSaturation + BrightnessContrast (saturated NMS color grade)
//   - Noise (film grain)
//   - SMAA antialiasing
//   - Warp dust streaks (camera-space speed cue)
// ---------------------------------------------------------------------------

import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  Noise,
  HueSaturation,
  BrightnessContrast,
  SMAA,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { Suspense, useMemo } from "react";
import { ParticleField } from "./particle-field";
import { CameraController } from "./camera-controller";
import { ClickHandler } from "./click-handler";
import { NebulaBackdrop } from "./nebula-backdrop";
import { StarSystemView } from "./star-system-view";
import { PlanetDetailView } from "./planet-detail-view";
import { CivilizationMarkers } from "./civilization-markers";
import { WarpDust } from "./warp-dust";
// LensFlareController temporarily disabled — Next 16 dev mode trips on
// THREE.Vector3 prop serialization. Re-enable after switching to a ref-only
// position update.
// import { LensFlareController } from "./lens-flare-controller";
import { ScanAnnotations } from "./scan-annotations";
import { useUniverseStore } from "@/lib/store";
import { lensFlareState } from "@/lib/lens-flare-state";

// ---------------------------------------------------------------------------
// Drives chromatic aberration intensity from camera velocity — pure scene
// component (mutates an effect's uniform via ref).
// ---------------------------------------------------------------------------

function DynamicChromaticAberration() {
  const offset = useMemo(() => new THREE.Vector2(0.0006, 0.0006), []);
  return (
    <ChromaticAberration
      blendFunction={BlendFunction.NORMAL}
      offset={offset}
      radialModulation
      modulationOffset={0.35}
    />
  );
}

// ---------------------------------------------------------------------------
// Tiny FX bus — keeps the lens flare flag in sync with the current scene
// without re-rendering the EffectComposer.
// ---------------------------------------------------------------------------

function LensFlareSync() {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);
  const hasBlackHole = useUniverseStore((s) => {
    if (!s.universe || !s.selectedGalaxyId || !s.selectedSystemId) return false;
    const g = s.universe.galaxies.find((x) => x.id === s.selectedGalaxyId);
    return g?.systems.find((x) => x.id === s.selectedSystemId)?.hasBlackHole ?? false;
  });
  const starColor = useUniverseStore((s) => {
    if (!s.universe || !s.selectedGalaxyId || !s.selectedSystemId) return null;
    const g = s.universe.galaxies.find((x) => x.id === s.selectedGalaxyId);
    return g?.systems.find((x) => x.id === s.selectedSystemId)?.starColor ?? null;
  });

  useFrame(() => {
    // System view: star sits at world origin (StarSystemView is at scene root)
    if (zoomLevel === "system" && !hasBlackHole) {
      lensFlareState.position.set(0, 0, 0);
      lensFlareState.active = true;
      if (starColor) {
        // Boost the star color into bloom-feeding range
        lensFlareState.colorGain.setRGB(
          starColor[0] * 2.6,
          starColor[1] * 2.3,
          starColor[2] * 2.0,
        );
      }
    } else if (zoomLevel === "planet") {
      // Sun direction in planet view is [10, 5, 8] (see planet-detail-view).
      // Place flare far along that direction so it sits "in the sky".
      lensFlareState.position.set(80, 40, 64);
      lensFlareState.active = true;
      lensFlareState.colorGain.setRGB(2.5, 2.1, 1.7);
    } else {
      lensFlareState.active = false;
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// Effects layer — separates the rendering hook from the post stack so that
// the LensFlare's `enabled` flag can update without forcing the composer
// to recreate every effect.
// ---------------------------------------------------------------------------

function PostFx() {
  return (
    <EffectComposer multisampling={0} stencilBuffer={false}>
      {/* Anti-aliasing first */}
      <SMAA />

      {/* Bloom — wide diffuse glow on bright meshes */}
      <Bloom
        luminanceThreshold={0.18}
        luminanceSmoothing={0.85}
        intensity={1.4}
        mipmapBlur
        radius={0.85}
      />

      {/* Subtle chromatic aberration */}
      <DynamicChromaticAberration />

      {/* NMS color grade */}
      <HueSaturation hue={0} saturation={0.22} />
      <BrightnessContrast brightness={0.02} contrast={0.08} />

      {/* Cinematic vignette */}
      <Vignette eskil={false} offset={0.18} darkness={0.62} />

      {/* Film grain */}
      <Noise opacity={0.035} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />
    </EffectComposer>
  );
}

// ---------------------------------------------------------------------------
// Root scene
// ---------------------------------------------------------------------------

export default function Scene() {
  return (
    <Canvas
      camera={{
        position: [0, 20, 60],
        fov: 55, // slightly tighter than 60 for that NMS dolly feel
        near: 0.1,
        far: 1200,
      }}
      gl={{
        antialias: false, // SMAA handles it
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
        powerPreference: "high-performance",
      }}
      dpr={[1, 2]}
      className="!fixed inset-0 z-0"
      style={{ background: "#020208" }}
    >
      <AdaptiveDpr pixelated />

      {/* Slightly cooler, denser fog for the velvet-black NMS deep space */}
      <fogExp2 attach="fog" args={["#06050f", 0.0028]} />

      <ambientLight intensity={0.15} />

      <Suspense fallback={null}>
        <NebulaBackdrop />
        <ParticleField />
        <CivilizationMarkers />
        <StarSystemView />
        <PlanetDetailView />
        <WarpDust />
        <ScanAnnotations />
        <CameraController />
        <ClickHandler />
        <LensFlareSync />
        <PostFx />
      </Suspense>
    </Canvas>
  );
}
