"use client";

// ---------------------------------------------------------------------------
// 13.8 — Warp Dust
//
// Camera-space dust particles that streak in front of the camera. Each
// particle is a small additive sprite stretched along the camera's velocity
// vector. When the camera moves fast (transitions, scroll, WASD), the
// streaks become long and bright; when still, they fade to nearly invisible
// drift.
//
// This is the layer that sells the sense of speed and "spaceflight" — NMS
// has this on every camera dolly.
// ---------------------------------------------------------------------------

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useUniverseStore } from "@/lib/store";

const DUST_COUNT = 220;
const SHELL_RADIUS = 22; // how far in front of camera dust lives
const SHELL_THICKNESS = 18;

interface DustParticle {
  // Position relative to camera (local camera space)
  local: THREE.Vector3;
}

// Mulberry32 — small deterministic PRNG so dust placement is stable across
// renders and the React 19 purity lint doesn't trip on Math.random.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomShellPoint(rng: () => number, out: THREE.Vector3) {
  const theta = Math.acos(2 * rng() - 1);
  const phi = rng() * Math.PI * 2;
  const r = SHELL_RADIUS - SHELL_THICKNESS / 2 + rng() * SHELL_THICKNESS;
  out.set(
    r * Math.sin(theta) * Math.cos(phi),
    r * Math.sin(theta) * Math.sin(phi),
    r * Math.cos(theta),
  );
}

export function WarpDust() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);

  // All scratch + state lives in a single ref initialized once.
  const stateRef = useRef<{
    dummy: THREE.Object3D;
    tmpColor: THREE.Color;
    prevCamPos: THREE.Vector3;
    velocity: THREE.Vector3;
    smoothedVel: THREE.Vector3;
    worldPos: THREE.Vector3;
    forward: THREE.Vector3;
    right: THREE.Vector3;
    up: THREE.Vector3;
    quat: THREE.Quaternion;
    lookM: THREE.Matrix4;
    localVel: THREE.Vector3;
    invQuat: THREE.Quaternion;
    rng: () => number;
    particles: DustParticle[];
    initialized: boolean;
  } | null>(null);

  if (stateRef.current === null) {
    const rng = makeRng(0xc0ffee);
    const particles: DustParticle[] = [];
    for (let i = 0; i < DUST_COUNT; i++) {
      const v = new THREE.Vector3();
      randomShellPoint(rng, v);
      particles.push({ local: v });
    }
    stateRef.current = {
      dummy: new THREE.Object3D(),
      tmpColor: new THREE.Color(),
      prevCamPos: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      smoothedVel: new THREE.Vector3(),
      worldPos: new THREE.Vector3(),
      forward: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      lookM: new THREE.Matrix4(),
      localVel: new THREE.Vector3(),
      invQuat: new THREE.Quaternion(),
      rng,
      particles,
      initialized: false,
    };
  }

  useEffect(() => {
    if (stateRef.current) stateRef.current.prevCamPos.copy(camera.position);
  }, [camera]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    const s = stateRef.current;
    if (!mesh || !s) return;

    // First-frame init: lock prevCamPos to current camera and skip velocity
    // (avoids a one-frame velocity spike from (0,0,0) → camera.position that
    // shoots streaks across the entire title screen).
    if (!s.initialized) {
      s.prevCamPos.copy(camera.position);
      s.initialized = true;
      // Render once with all streaks at zero scale, zero opacity, then bail
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0;
      for (let i = 0; i < DUST_COUNT; i++) {
        s.dummy.position.set(0, 0, 0);
        s.dummy.scale.set(0, 0, 0);
        s.dummy.updateMatrix();
        mesh.setMatrixAt(i, s.dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      return;
    }

    // World-space velocity
    s.velocity.subVectors(camera.position, s.prevCamPos);
    s.prevCamPos.copy(camera.position);

    // Hard cap on velocity — guards against frame skips / teleports during
    // transitions causing huge streaks.
    const MAX_FRAME_DELTA = 5;
    if (s.velocity.length() > MAX_FRAME_DELTA) {
      s.velocity.setScalar(0);
    }

    // Smooth velocity so streaks feel inertial, not jittery
    const k = Math.min(1, delta * 8);
    s.smoothedVel.lerp(s.velocity, k);

    const speed = s.smoothedVel.length() / Math.max(delta, 0.001);
    const stretch = Math.min(8, speed * 0.04);
    // Opacity stays at 0 until camera moves meaningfully — title screen
    // should be perfectly still.
    const opacity =
      zoomLevel === "landing"
        ? 0
        : Math.min(0.9, Math.max(0, (speed - 1.0) * 0.012));

    // Build streak orientation along velocity
    camera.getWorldDirection(s.forward);
    s.right.crossVectors(s.forward, camera.up).normalize();
    s.up.crossVectors(s.right, s.forward).normalize();

    const velLen = s.smoothedVel.length();
    if (velLen > 0.0001) {
      s.localVel.copy(s.smoothedVel).divideScalar(velLen);
      s.lookM.lookAt(new THREE.Vector3(0, 0, 0), s.localVel, camera.up);
      s.quat.setFromRotationMatrix(s.lookM);
    } else {
      s.quat.copy(camera.quaternion);
    }

    // Camera-local velocity, computed once
    s.invQuat.copy(camera.quaternion).invert();
    s.localVel.copy(s.smoothedVel).applyQuaternion(s.invQuat);

    for (let i = 0; i < DUST_COUNT; i++) {
      const p = s.particles[i];

      // Drift the particle backward through the camera-local shell so it
      // streams past as the camera moves.
      p.local.addScaledVector(s.localVel, -1);

      const localLen = p.local.length();
      if (localLen > SHELL_RADIUS + SHELL_THICKNESS / 2 || localLen < 2) {
        randomShellPoint(s.rng, p.local);
      }

      s.worldPos.copy(p.local).applyQuaternion(camera.quaternion).add(camera.position);

      s.dummy.position.copy(s.worldPos);
      s.dummy.quaternion.copy(s.quat);
      s.dummy.scale.set(0.04, 0.04 + stretch, 0.04);
      s.dummy.updateMatrix();
      mesh.setMatrixAt(i, s.dummy.matrix);

      const variation = (i % 7) / 7;
      s.tmpColor.setRGB(0.7 + variation * 0.3, 0.75 + variation * 0.2, 0.95);
      mesh.setColorAt(i, s.tmpColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, DUST_COUNT]}
      frustumCulled={false}
      renderOrder={5}
    >
      <cylinderGeometry args={[1, 1, 1, 4, 1]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
