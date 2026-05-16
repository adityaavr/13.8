"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getActiveCivilizations } from "@/lib/civilization-epoch";
import { useUniverseStore } from "@/lib/store";
import type { CivilizationTrace } from "@/lib/types";

function CivilizationDot({ civilization }: { civilization: CivilizationTrace }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  // Stable per-civilization phase derived from id (so playback is deterministic)
  const phase = useMemo(() => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < civilization.id.length; i++) {
      h ^= civilization.id.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) / 4294967296) * Math.PI * 2;
  }, [civilization.id]);
  const color = useMemo(() => {
    const [r, g, b] = civilization.color;
    return new THREE.Color(r, g, b);
  }, [civilization.color]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse =
      0.68 +
      Math.sin(t * (2.2 + civilization.peakSignal * 2.0) + phase) * 0.32;
    const flicker =
      0.45 +
      Math.abs(Math.sin(t * (7.0 + civilization.peakSignal * 6.0) + phase * 1.7)) *
        0.55;
    const intensity = Math.max(0, pulse) * flicker;

    if (coreRef.current) {
      const material = coreRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.22 + intensity * 0.58;
      const coreScale = 0.28 + civilization.peakSignal * 0.22 + intensity * 0.06;
      coreRef.current.scale.setScalar(coreScale);
    }

    if (haloRef.current) {
      const material = haloRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.08 + intensity * 0.25;
      const haloScale = 1.1 + civilization.peakSignal * 0.5 + intensity * 0.3;
      haloRef.current.scale.setScalar(haloScale);
    }
  });

  return (
    <group
      position={[
        civilization.position.x,
        civilization.position.y,
        civilization.position.z,
      ]}
    >
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.65}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={haloRef}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18}
          toneMapped={false}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

export function CivilizationMarkers() {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);
  const universe = useUniverseStore((s) => s.universe);
  const epochGyr = useUniverseStore((s) => s.epochGyr);

  const activeCivilizations = useMemo(
    () => getActiveCivilizations(universe, epochGyr),
    [universe, epochGyr],
  );

  if (zoomLevel !== "universe" || activeCivilizations.length === 0) return null;

  return (
    <group>
      {activeCivilizations.map((civilization) => (
        <CivilizationDot
          key={civilization.id}
          civilization={civilization}
        />
      ))}
    </group>
  );
}
