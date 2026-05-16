"use client";

// ---------------------------------------------------------------------------
// 13.8 — Habitable Zone Band
//
// A soft toroidal glow ring at the star's Goldilocks band. Uses a thin
// annulus mesh with a fresnel-like radial falloff so it reads as a "halo"
// rather than a solid ring. Subtle, atmospheric — not a hard line.
//
// Inner/outer radii match generate-universe.ts's habitable check:
//   orbitRadius > 5 && orbitRadius < 14
// ---------------------------------------------------------------------------

import { useMemo } from "react";
import * as THREE from "three";

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    // Smooth radial falloff — strongest in the middle of the band
    float d = abs(vUv.y - 0.5) * 2.0; // 0 center → 1 edge
    float a = smoothstep(1.0, 0.0, d) * uOpacity;
    gl_FragColor = vec4(uColor, a);
  }
`;

interface HabitableZoneProps {
  innerRadius?: number;
  outerRadius?: number;
}

export function HabitableZone({
  innerRadius = 5,
  outerRadius = 14,
}: HabitableZoneProps) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(0.18, 0.78, 0.55) },
      uOpacity: { value: 0.18 },
    }),
    [],
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[innerRadius, outerRadius, 128, 1]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
