"use client";

// ---------------------------------------------------------------------------
// 13.8 — NMS-Style Nebula Backdrop
//
// Rich, saturated, full-viewport color washes that make you feel like
// you're floating inside a nebula. Reference: No Man's Sky galaxy map.
//
// Three layers:
// 1. Far background — massive color washes that define the sky's mood
// 2. Mid-layer — medium clouds with more defined shapes
// 3. Near dust — smaller wisps for parallax depth
//
// Colors are vivid (ambers, purples, teals, magentas) but still atmospheric.
// Each session generates a unique nebula palette.
// ---------------------------------------------------------------------------

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Soft radial gradient texture
// ---------------------------------------------------------------------------

function createCloudTexture(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x / size) * 2 - 1;
      const dy = (y / size) * 2 - 1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const t = Math.max(0, 1 - dist);
      // Quintic smoothstep for very soft edges
      const alpha = t * t * t * (t * (t * 6 - 15) + 10);
      const idx = (y * size + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = Math.floor(alpha * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// NMS nebula color palettes — rich, saturated
// ---------------------------------------------------------------------------

interface NebulaPalette {
  far: [number, number, number][]; // massive background washes
  mid: [number, number, number][]; // medium clouds
  near: [number, number, number][]; // small dust wisps
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pickPalette(): NebulaPalette {
  const palettes: NebulaPalette[] = [
    {
      // Amber gold (NMS screenshot 1)
      far: [[0.45, 0.30, 0.08], [0.35, 0.22, 0.05], [0.50, 0.35, 0.10]],
      mid: [[0.55, 0.35, 0.10], [0.40, 0.25, 0.06], [0.60, 0.40, 0.12]],
      near: [[0.50, 0.32, 0.08], [0.45, 0.28, 0.06]],
    },
    {
      // Purple-magenta (NMS screenshot 2)
      far: [[0.30, 0.10, 0.35], [0.25, 0.08, 0.30], [0.35, 0.12, 0.40]],
      mid: [[0.40, 0.12, 0.45], [0.30, 0.10, 0.35], [0.45, 0.15, 0.50]],
      near: [[0.35, 0.12, 0.38], [0.28, 0.08, 0.32]],
    },
    {
      // Deep teal-blue
      far: [[0.05, 0.20, 0.30], [0.08, 0.25, 0.35], [0.04, 0.18, 0.28]],
      mid: [[0.06, 0.28, 0.38], [0.10, 0.32, 0.42], [0.04, 0.22, 0.32]],
      near: [[0.06, 0.25, 0.35], [0.08, 0.20, 0.30]],
    },
    {
      // Warm rose-violet
      far: [[0.35, 0.12, 0.25], [0.28, 0.10, 0.22], [0.40, 0.15, 0.30]],
      mid: [[0.42, 0.14, 0.30], [0.35, 0.12, 0.25], [0.48, 0.18, 0.35]],
      near: [[0.38, 0.12, 0.28], [0.32, 0.10, 0.22]],
    },
    {
      // Emerald-teal with amber accents
      far: [[0.08, 0.28, 0.18], [0.10, 0.32, 0.22], [0.30, 0.22, 0.08]],
      mid: [[0.10, 0.35, 0.24], [0.35, 0.28, 0.10], [0.12, 0.30, 0.20]],
      near: [[0.10, 0.30, 0.20], [0.28, 0.22, 0.08]],
    },
  ];
  return palettes[Math.floor(Math.random() * palettes.length)];
}

// ---------------------------------------------------------------------------
// Cloud data
// ---------------------------------------------------------------------------

interface Cloud {
  position: THREE.Vector3;
  color: THREE.Color;
  size: number;
  drift: { sx: number; sy: number; sz: number; ox: number; oy: number; oz: number };
  opacity: number;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateClouds(palette: NebulaPalette): Cloud[] {
  const clouds: Cloud[] = [];

  // --- Far background washes — huge, fill the sky ---
  for (let i = 0; i < 8; i++) {
    const c = pick(palette.far);
    const phi = rand(0, Math.PI * 2);
    const theta = rand(0.3, 2.8);
    const r = rand(100, 250);
    clouds.push({
      position: new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi) * r,
        Math.cos(theta) * r * 0.4,
        Math.sin(theta) * Math.sin(phi) * r,
      ),
      color: new THREE.Color(c[0], c[1], c[2]),
      size: rand(150, 300),
      drift: {
        sx: rand(0.00003, 0.0001), sy: rand(0.00002, 0.00008), sz: rand(0.00003, 0.0001),
        ox: rand(0, 100), oy: rand(0, 100), oz: rand(0, 100),
      },
      opacity: rand(0.12, 0.25),
    });
  }

  // --- Mid-layer clouds — defined shapes, moderate size ---
  for (let i = 0; i < 12; i++) {
    const c = pick(palette.mid);
    const phi = rand(0, Math.PI * 2);
    const theta = rand(0.5, 2.5);
    const r = rand(60, 180);
    clouds.push({
      position: new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi) * r,
        Math.cos(theta) * r * 0.3,
        Math.sin(theta) * Math.sin(phi) * r,
      ),
      color: new THREE.Color(c[0], c[1], c[2]),
      size: rand(60, 140),
      drift: {
        sx: rand(0.00005, 0.00015), sy: rand(0.00004, 0.00012), sz: rand(0.00005, 0.00015),
        ox: rand(0, 100), oy: rand(0, 100), oz: rand(0, 100),
      },
      opacity: rand(0.08, 0.18),
    });
  }

  // --- Near dust wisps — smaller, parallax depth ---
  for (let i = 0; i < 10; i++) {
    const c = pick(palette.near);
    const phi = rand(0, Math.PI * 2);
    const theta = rand(0.6, 2.4);
    const r = rand(30, 100);
    clouds.push({
      position: new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi) * r,
        Math.cos(theta) * r * 0.3,
        Math.sin(theta) * Math.sin(phi) * r,
      ),
      color: new THREE.Color(c[0], c[1], c[2]),
      size: rand(25, 60),
      drift: {
        sx: rand(0.0001, 0.0003), sy: rand(0.00008, 0.0002), sz: rand(0.0001, 0.0003),
        ox: rand(0, 100), oy: rand(0, 100), oz: rand(0, 100),
      },
      opacity: rand(0.06, 0.12),
    });
  }

  return clouds;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NebulaBackdrop() {
  const groupRef = useRef<THREE.Group>(null);

  const texture = useMemo(() => createCloudTexture(), []);
  const palette = useMemo(() => pickPalette(), []);
  const clouds = useMemo(() => generateClouds(palette), [palette]);

  const materials = useMemo(
    () =>
      clouds.map(
        (cloud) =>
          new THREE.SpriteMaterial({
            map: texture,
            color: cloud.color,
            transparent: true,
            opacity: cloud.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
          }),
      ),
    [clouds, texture],
  );

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const group = groupRef.current;
    if (!group) return;

    group.children.forEach((child, i) => {
      if (!(child instanceof THREE.Sprite)) return;
      const cloud = clouds[i];
      if (!cloud) return;

      child.position.set(
        cloud.position.x + Math.sin(time * cloud.drift.sx + cloud.drift.ox) * 8,
        cloud.position.y + Math.sin(time * cloud.drift.sy + cloud.drift.oy) * 5,
        cloud.position.z + Math.cos(time * cloud.drift.sz + cloud.drift.oz) * 8,
      );
    });
  });

  return (
    <group ref={groupRef}>
      {clouds.map((cloud, i) => (
        <sprite
          key={i}
          position={cloud.position}
          scale={[cloud.size, cloud.size, 1]}
          material={materials[i]}
          renderOrder={-1}
        />
      ))}
    </group>
  );
}
