"use client";

// ---------------------------------------------------------------------------
// 13.8 — Click Targets
//
// Invisible spheres placed at galaxy, system, and planet positions.
// Much more reliable and performant than raycasting 8k instanced particles.
// Only renders targets relevant to the current zoom level.
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import * as THREE from "three";
import { useUniverseStore } from "@/lib/store";

// Invisible but clickable material
const hitMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
});

export function ClickHandler() {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);
  const universe = useUniverseStore((s) => s.universe);
  const selectGalaxy = useUniverseStore((s) => s.selectGalaxy);
  const selectSystem = useUniverseStore((s) => s.selectSystem);

  const currentGalaxy = useUniverseStore((s) => {
    if (!s.universe || !s.selectedGalaxyId) return null;
    return s.universe.galaxies.find((g) => g.id === s.selectedGalaxyId) ?? null;
  });

  // Planet targets are handled by StarSystemView (animated orbit positions)

  // Galaxy hit targets
  const galaxyTargets = useMemo(() => {
    if (zoomLevel !== "universe" || !universe) return null;
    return universe.galaxies.map((g) => (
      <mesh
        key={g.id}
        position={[g.position.x, g.position.y, g.position.z]}
        material={hitMaterial}
        onClick={(e) => {
          e.stopPropagation();
          selectGalaxy(g.id);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        <sphereGeometry args={[20, 8, 8]} />
      </mesh>
    ));
  }, [zoomLevel, universe, selectGalaxy]);

  // System hit targets
  const systemTargets = useMemo(() => {
    if (zoomLevel !== "galaxy" || !currentGalaxy) return null;
    return currentGalaxy.systems.map((s) => (
      <mesh
        key={s.id}
        position={[s.position.x, s.position.y, s.position.z]}
        material={hitMaterial}
        onClick={(e) => {
          e.stopPropagation();
          selectSystem(s.id);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        <sphereGeometry args={[3, 8, 8]} />
      </mesh>
    ));
  }, [zoomLevel, currentGalaxy, selectSystem]);

  // Planet hit targets — handled by StarSystemView directly (animated positions)

  return (
    <group>
      {galaxyTargets}
      {systemTargets}
    </group>
  );
}
