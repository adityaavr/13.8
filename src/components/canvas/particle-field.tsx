"use client";

// ---------------------------------------------------------------------------
// 13.8 — Particle Field
//
// One InstancedMesh with ~PARTICLE_COUNT instances. Reads target positions
// from formation functions (driven by the Zustand store), and lerps toward
// them every frame. This produces the "particle morphing" effect as users
// zoom between universe → galaxy → system.
//
// Performance: all work happens in typed arrays with direct matrix mutation.
// No React state changes in the frame loop. Zero GC pressure.
// ---------------------------------------------------------------------------

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUniverseStore } from "@/lib/store";
import {
  landingFormation,
  universeFormation,
  galaxyFormation,
  systemFormation,
} from "@/lib/formations";
import type { FormationData } from "@/lib/formations";

export const PARTICLE_COUNT = 15000;

export function ParticleField() {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Current interpolated state (mutated every frame)
  const state = useMemo(
    () => ({
      positions: new Float32Array(PARTICLE_COUNT * 3),
      colors: new Float32Array(PARTICLE_COUNT * 3),
      scales: new Float32Array(PARTICLE_COUNT),
      targetPositions: new Float32Array(PARTICLE_COUNT * 3),
      targetColors: new Float32Array(PARTICLE_COUNT * 3),
      targetScales: new Float32Array(PARTICLE_COUNT),
    }),
    [],
  );

  // Reusable objects (never allocate in the frame loop)
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tempColor = useMemo(() => new THREE.Color(), []);

  // Initialize with landing formation
  useEffect(() => {
    const formation = landingFormation(PARTICLE_COUNT);
    // Set both current and target to the same — no morph on first paint
    state.positions.set(formation.positions);
    state.colors.set(formation.colors);
    state.scales.set(formation.scales);
    state.targetPositions.set(formation.positions);
    state.targetColors.set(formation.colors);
    state.targetScales.set(formation.scales);

    // Initialize instance matrices and colors
    const mesh = meshRef.current;
    if (!mesh) return;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      dummy.position.set(
        state.positions[i3],
        state.positions[i3 + 1],
        state.positions[i3 + 2],
      );
      dummy.scale.setScalar(state.scales[i]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      tempColor.setRGB(
        state.colors[i3],
        state.colors[i3 + 1],
        state.colors[i3 + 2],
      );
      mesh.setColorAt(i, tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [state, dummy, tempColor]);

  // Subscribe to store changes → recompute target formation
  useEffect(() => {
    const unsubscribe = useUniverseStore.subscribe((store) => {
      let formation: FormationData | null = null;

      if (store.zoomLevel === "landing") {
        formation = landingFormation(PARTICLE_COUNT);
      } else if (store.zoomLevel === "universe" && store.universe) {
        formation = universeFormation(store.universe, PARTICLE_COUNT);
      } else if (store.zoomLevel === "galaxy") {
        const galaxy = store.currentGalaxy();
        if (galaxy) {
          formation = galaxyFormation(galaxy, PARTICLE_COUNT);
        }
      } else if (store.zoomLevel === "system" || store.zoomLevel === "planet") {
        const system = store.currentSystem();
        if (system) {
          formation = systemFormation(system, PARTICLE_COUNT);
        }
      }

      if (formation) {
        state.targetPositions.set(formation.positions);
        state.targetColors.set(formation.colors);
        state.targetScales.set(formation.scales);
      }
    });

    return unsubscribe;
  }, [state]);

  // Frame loop — lerp current toward target, update instance matrices
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const lerpFactor = 0.035;
    let hasChanges = false;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Lerp positions
      const dx = state.targetPositions[i3] - state.positions[i3];
      const dy = state.targetPositions[i3 + 1] - state.positions[i3 + 1];
      const dz = state.targetPositions[i3 + 2] - state.positions[i3 + 2];

      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001 || Math.abs(dz) > 0.001) {
        state.positions[i3] += dx * lerpFactor;
        state.positions[i3 + 1] += dy * lerpFactor;
        state.positions[i3 + 2] += dz * lerpFactor;
        hasChanges = true;
      }

      // Lerp colors
      state.colors[i3] += (state.targetColors[i3] - state.colors[i3]) * lerpFactor;
      state.colors[i3 + 1] += (state.targetColors[i3 + 1] - state.colors[i3 + 1]) * lerpFactor;
      state.colors[i3 + 2] += (state.targetColors[i3 + 2] - state.colors[i3 + 2]) * lerpFactor;

      // Lerp scales
      state.scales[i] += (state.targetScales[i] - state.scales[i]) * lerpFactor;

      // Update instance matrix
      dummy.position.set(
        state.positions[i3],
        state.positions[i3 + 1],
        state.positions[i3 + 2],
      );
      dummy.scale.setScalar(state.scales[i]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Update instance color
      tempColor.setRGB(
        Math.max(0, state.colors[i3]),
        Math.max(0, state.colors[i3 + 1]),
        Math.max(0, state.colors[i3 + 2]),
      );
      mesh.setColorAt(i, tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, PARTICLE_COUNT]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
