"use client";

// ---------------------------------------------------------------------------
// 13.8 — Gargantua Black Hole (Physically-Informed)
//
// Reference: Interstellar (2014) — Kip Thorne / DNEG
//
// Structure (inside → out):
// 1. Event horizon — small black sphere
// 2. Photon ring — razor-thin blazing ring at shadow edge
// 3. Accretion disk — thin flat ring, white-hot inner → amber outer,
//    Doppler-beamed, turbulent spiral streaks
// 4. Lensing arc — thin bright arc over the top (back of disk bent by gravity)
//
// Planets orbit FAR outside the disk (r > 12).
// ---------------------------------------------------------------------------

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const EH = 1.6; // event horizon radius
const DISK_INNER = 2.8; // accretion disk inner edge (ISCO ~ 3x Schwarzschild)
const DISK_OUTER = 8.0; // accretion disk outer edge

// ---------------------------------------------------------------------------
// Procedural disk texture
// ---------------------------------------------------------------------------

function createDiskTexture(width: number, height: number): THREE.DataTexture {
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const radial = y / height; // 0 = inner, 1 = outer

    // Temperature: blazing white inner → amber → dark orange outer
    const baseR = 255;
    const baseG = Math.floor((0.95 - radial * 0.5) * 255);
    const baseB = Math.floor((0.82 - radial * 0.72) * 255);
    const radialBright = Math.exp(-radial * 2.2) * 0.9 + 0.1;

    for (let x = 0; x < width; x++) {
      const angle = (x / width) * Math.PI * 2;

      // Doppler beaming — approaching side brighter
      const doppler = 1.0 + Math.cos(angle) * 0.3;

      // Turbulent structure
      const turb = 1
        + Math.sin(angle * 7 + radial * 18) * 0.1
        + Math.sin(angle * 19 - radial * 9) * 0.05
        + Math.cos(angle * 4 + radial * 25) * 0.07;

      // Spiral infall streaks
      const spiral = 1 + Math.sin(angle * 3 - radial * 14) * 0.12;

      const b = radialBright * doppler * turb * spiral;
      const alpha = Math.max(0, 0.92 - radial * 0.55);

      const idx = (y * width + x) * 4;
      data[idx] = Math.min(255, Math.floor(baseR * b));
      data[idx + 1] = Math.min(255, Math.floor(baseG * b));
      data[idx + 2] = Math.min(255, Math.floor(baseB * b));
      data[idx + 3] = Math.floor(alpha * 255);
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Accretion Disk — custom geometry with proper UVs
// ---------------------------------------------------------------------------

function AccretionDisk() {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => createDiskTexture(512, 64), []);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        toneMapped: false,
        depthWrite: false,
      }),
    [texture],
  );

  const geometry = useMemo(() => {
    const segments = 256;
    const rings = 24;
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let r = 0; r <= rings; r++) {
      const t = r / rings;
      const radius = DISK_INNER + t * (DISK_OUTER - DISK_INNER);
      for (let s = 0; s <= segments; s++) {
        const angle = (s / segments) * Math.PI * 2;
        verts.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        uvs.push(s / segments, t);
      }
    }

    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segments; s++) {
        const a = r * (segments + 1) + s;
        const b = a + 1;
        const c = a + segments + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }, []);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.05;
    }
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} />;
}

// ---------------------------------------------------------------------------
// Lensing Arc — thin bright arc over the top of the black hole
// In Interstellar, this is the back of the disk gravitationally lensed
// into a thin ring perpendicular to the disk plane.
// ---------------------------------------------------------------------------

function LensingArc() {
  const ref = useRef<THREE.Group>(null);
  const texture = useMemo(() => createDiskTexture(512, 16), []);

  // Thin torus-like ring in the Y-Z plane
  const geometry = useMemo(() => {
    const centerR = (DISK_INNER + DISK_OUTER) * 0.45;
    const bandWidth = (DISK_OUTER - DISK_INNER) * 0.55;
    const segments = 256;
    const strips = 8;
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let t = 0; t <= strips; t++) {
      const tt = t / strips;
      const r = centerR - bandWidth * 0.5 + tt * bandWidth;
      for (let s = 0; s <= segments; s++) {
        const angle = (s / segments) * Math.PI * 2;
        verts.push(0, Math.cos(angle) * r, Math.sin(angle) * r);
        uvs.push(s / segments, tt);
      }
    }

    for (let t = 0; t < strips; t++) {
      for (let s = 0; s < segments; s++) {
        const a = t * (segments + 1) + s;
        const b = a + 1;
        const c = a + segments + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        toneMapped: false,
        depthWrite: false,
      }),
    [texture],
  );

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.x = clock.elapsedTime * 0.01;
    }
  });

  return <mesh ref={ref} geometry={geometry} material={material} />;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BlackHole() {
  return (
    <group>
      {/* Event horizon — clean black sphere, nothing else */}
      <mesh renderOrder={10}>
        <sphereGeometry args={[EH, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Photon ring — razor-thin blazing ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[EH + 0.02, EH + 0.1, 128]} />
        <meshBasicMaterial
          color={new THREE.Color(2.5, 2.0, 1.3)}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Photon ring soft glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[EH - 0.05, EH + 0.3, 128]} />
        <meshBasicMaterial
          color={new THREE.Color(1.5, 1.2, 0.8)}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Vertical photon ring (lensed orbit) */}
      <mesh>
        <torusGeometry args={[EH + 0.05, 0.035, 8, 128]} />
        <meshBasicMaterial
          color={new THREE.Color(2.5, 1.8, 1.1)}
          transparent
          opacity={0.7}
          toneMapped={false}
        />
      </mesh>

      {/* Accretion disk */}
      <AccretionDisk />

      {/* Gravitational lensing arc */}
      <LensingArc />

      {/* Light from accretion disk illuminates planets */}
      <pointLight
        color={new THREE.Color(1.0, 0.85, 0.6)}
        intensity={2}
        distance={60}
        decay={2}
      />
    </group>
  );
}
