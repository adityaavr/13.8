"use client";

// ---------------------------------------------------------------------------
// 13.8 — Main 3D Scene
//
// Persistent Canvas that lives in the root layout. Contains the particle
// field, camera controller, bloom postprocessing, and ambient lighting.
// Never unmounts between routes — particles morph instead of remounting.
// ---------------------------------------------------------------------------

import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { Suspense } from "react";
import { ParticleField } from "./particle-field";
import { CameraController } from "./camera-controller";
import { ClickHandler } from "./click-handler";
import { NebulaBackdrop } from "./nebula-backdrop";
import { StarSystemView } from "./star-system-view";
import { PlanetDetailView } from "./planet-detail-view";
import { CivilizationMarkers } from "./civilization-markers";

export default function Scene() {
  return (
    <Canvas
      camera={{
        position: [0, 20, 60],
        fov: 60,
        near: 0.1,
        far: 800,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      dpr={[1, 2]}
      className="!fixed inset-0 z-0"
      style={{ background: "#020208" }}
    >
      <AdaptiveDpr pixelated />

      {/* Exponential fog for NMS depth */}
      <fogExp2 attach="fog" args={["#0a0612", 0.003]} />

      {/* Ambient for planet meshes — particles are self-lit via meshBasicMaterial */}
      <ambientLight intensity={0.15} />

      <Suspense fallback={null}>
        <NebulaBackdrop />
        <ParticleField />
        <CivilizationMarkers />
        <StarSystemView />
        <PlanetDetailView />
        <CameraController />
        <ClickHandler />

        <EffectComposer>
          <Bloom
            luminanceThreshold={0.25}
            luminanceSmoothing={0.9}
            intensity={1.0}
            mipmapBlur
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
