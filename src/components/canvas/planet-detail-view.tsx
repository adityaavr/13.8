"use client";

// ---------------------------------------------------------------------------
// 13.8 — Planet Detail View
//
// Large detailed planet at origin with:
//   - Procedural terrain texture
//   - Cloud layer (translucent noise)
//   - NMS-style fresnel atmosphere — warm rim on sun side, cool on dark side
//   - Rings for gas giants
//   - Slow rotation
//
// The atmosphere is now a custom shader (see atmosphere-shader.tsx) instead
// of flat backside spheres. This is the single biggest visual upgrade.
// ---------------------------------------------------------------------------

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUniverseStore } from "@/lib/store";
import { Atmosphere } from "./atmosphere-shader";
import type { Planet, PlanetType } from "@/lib/types";

const PLANET_RADIUS = 3;
// Sun direction shared with scene.tsx's LensFlareSync (must match!)
const SUN_POSITION = new THREE.Vector3(10, 5, 8);
const SUN_DIRECTION = SUN_POSITION.clone().normalize();

// ---------------------------------------------------------------------------
// Procedural terrain texture
// ---------------------------------------------------------------------------

interface TerrainPalette {
  base: [number, number, number];
  land1: [number, number, number];
  land2: [number, number, number];
  accent: [number, number, number];
}

const TERRAIN_PALETTES: Record<PlanetType, TerrainPalette> = {
  rocky: { base: [0.35, 0.28, 0.22], land1: [0.50, 0.42, 0.32], land2: [0.60, 0.50, 0.38], accent: [0.72, 0.58, 0.42] },
  gas: { base: [0.65, 0.45, 0.25], land1: [0.80, 0.55, 0.30], land2: [0.55, 0.40, 0.28], accent: [0.90, 0.70, 0.40] },
  ice: { base: [0.65, 0.78, 0.88], land1: [0.80, 0.90, 0.95], land2: [0.55, 0.70, 0.82], accent: [0.92, 0.95, 1.00] },
  ocean: { base: [0.10, 0.25, 0.55], land1: [0.15, 0.45, 0.35], land2: [0.08, 0.30, 0.60], accent: [0.20, 0.55, 0.40] },
  desert: { base: [0.75, 0.58, 0.32], land1: [0.85, 0.68, 0.38], land2: [0.65, 0.48, 0.28], accent: [0.90, 0.75, 0.42] },
  volcanic: { base: [0.20, 0.12, 0.10], land1: [0.35, 0.15, 0.08], land2: [0.85, 0.35, 0.10], accent: [1.00, 0.55, 0.15] },
};

const ATMOSPHERE_COLORS: Record<PlanetType, [number, number, number]> = {
  rocky: [0.55, 0.7, 1.0],
  gas: [0.95, 0.7, 0.35],
  ice: [0.7, 0.9, 1.0],
  ocean: [0.35, 0.7, 1.0],
  desert: [1.0, 0.78, 0.45],
  volcanic: [1.0, 0.35, 0.15],
};

function createTerrainTexture(type: PlanetType, seed: number): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  const palette = TERRAIN_PALETTES[type];

  const noise = (x: number, y: number, freq: number) =>
    Math.sin(x * freq + seed * 1.3) * Math.cos(y * freq + seed * 0.7) * 0.5 + 0.5;

  const fbm = (x: number, y: number) => {
    let val = 0;
    val += noise(x, y, 3) * 0.5;
    val += noise(x, y, 7) * 0.25;
    val += noise(x, y, 15) * 0.125;
    val += noise(x, y, 31) * 0.0625;
    return val;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      const n = fbm(nx * 10, ny * 10);

      let r: number, g: number, b: number;
      if (n < 0.35) {
        const t = n / 0.35;
        r = palette.base[0] + (palette.land1[0] - palette.base[0]) * t;
        g = palette.base[1] + (palette.land1[1] - palette.base[1]) * t;
        b = palette.base[2] + (palette.land1[2] - palette.base[2]) * t;
      } else if (n < 0.6) {
        const t = (n - 0.35) / 0.25;
        r = palette.land1[0] + (palette.land2[0] - palette.land1[0]) * t;
        g = palette.land1[1] + (palette.land2[1] - palette.land1[1]) * t;
        b = palette.land1[2] + (palette.land2[2] - palette.land1[2]) * t;
      } else {
        const t = (n - 0.6) / 0.4;
        r = palette.land2[0] + (palette.accent[0] - palette.land2[0]) * t;
        g = palette.land2[1] + (palette.accent[1] - palette.land2[1]) * t;
        b = palette.land2[2] + (palette.accent[2] - palette.land2[2]) * t;
      }

      const idx = (y * size + x) * 4;
      data[idx] = Math.floor(r * 255);
      data[idx + 1] = Math.floor(g * 255);
      data[idx + 2] = Math.floor(b * 255);
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Cloud texture
// ---------------------------------------------------------------------------

function createCloudTexture(seed: number): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);

  const noise = (x: number, y: number, freq: number) =>
    Math.sin(x * freq + seed * 2.1) * Math.cos(y * freq - seed * 1.4) * 0.5 + 0.5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      let n = 0;
      n += noise(nx * 5, ny * 5, 4) * 0.5;
      n += noise(nx * 10, ny * 10, 8) * 0.3;
      n += noise(nx * 20, ny * 20, 16) * 0.2;

      const alpha = Math.max(0, (n - 0.4) * 2.5);

      const idx = (y * size + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.floor(Math.min(1, alpha) * 200);
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Planet
// ---------------------------------------------------------------------------

function PlanetSphere({ planet }: { planet: Planet }) {
  const surfaceRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const seed = useMemo(
    () => planet.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
    [planet.id],
  );

  const terrainTex = useMemo(() => createTerrainTexture(planet.type, seed), [planet.type, seed]);
  const cloudTex = useMemo(() => createCloudTexture(seed + 100), [seed]);
  const atmosColor = ATMOSPHERE_COLORS[planet.type];

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (surfaceRef.current) surfaceRef.current.rotation.y = t * 0.03;
    if (cloudRef.current) cloudRef.current.rotation.y = t * 0.05;
  });

  return (
    <group>
      {/* Planet surface */}
      <mesh ref={surfaceRef}>
        <sphereGeometry args={[PLANET_RADIUS, 96, 96]} />
        <meshStandardMaterial
          map={terrainTex}
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>

      {/* Cloud layer */}
      {planet.type !== "gas" && (
        <mesh ref={cloudRef}>
          <sphereGeometry args={[PLANET_RADIUS * 1.012, 64, 64]} />
          <meshStandardMaterial
            map={cloudTex}
            transparent
            opacity={planet.type === "ocean" ? 0.85 : 0.55}
            depthWrite={false}
            roughness={1}
            metalness={0}
          />
        </mesh>
      )}

      {/* Fresnel atmosphere — the NMS hallmark */}
      <Atmosphere
        radius={PLANET_RADIUS}
        color={atmosColor}
        sunDirection={SUN_DIRECTION}
        intensity={planet.type === "volcanic" ? 1.4 : 1.0}
      />

      {/* Gas giant rings */}
      {planet.type === "gas" && (
        <mesh rotation={[-Math.PI * 0.4, 0.2, 0]}>
          <ringGeometry args={[PLANET_RADIUS * 1.4, PLANET_RADIUS * 2.2, 128]} />
          <meshBasicMaterial
            color={new THREE.Color(0.85, 0.72, 0.55)}
            transparent
            opacity={0.32}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Sun illumination — strong directional + warm tint */}
      <directionalLight
        position={SUN_POSITION}
        intensity={2.0}
        color={new THREE.Color(1, 0.95, 0.85)}
      />

      {/* Dark-side ambient — subtle blue, sells the night terminator */}
      <ambientLight intensity={0.06} color={new THREE.Color(0.6, 0.7, 1.0)} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PlanetDetailView() {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);

  const planet = useUniverseStore((s) => {
    if (!s.universe || !s.selectedGalaxyId || !s.selectedSystemId || !s.selectedPlanetId) return null;
    const galaxy = s.universe.galaxies.find((g) => g.id === s.selectedGalaxyId);
    if (!galaxy) return null;
    const system = galaxy.systems.find((sys) => sys.id === s.selectedSystemId);
    if (!system) return null;
    return system.planets.find((p) => p.id === s.selectedPlanetId) ?? null;
  });

  if (zoomLevel !== "planet" || !planet) return null;

  return (
    <group>
      <PlanetSphere planet={planet} />
    </group>
  );
}
