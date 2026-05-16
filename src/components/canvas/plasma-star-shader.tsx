"use client";

// ---------------------------------------------------------------------------
// 13.8 — Plasma Star Shader
//
// Custom GLSL star surface: layered noise produces flowing convection cells
// + sunspot darkening + bright limb. Far more alive than a flat sphere.
//
// Three meshes layered:
//   1. Plasma core sphere (this shader)
//   2. Tight corona shell (additive, fresnel-driven)
//   3. Wide diffuse halo (additive, distant fade)
// ---------------------------------------------------------------------------

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface PlasmaStarProps {
  radius?: number;
  color: THREE.Color;
  /** Convection speed multiplier */
  activity?: number;
}

// --- Plasma surface shader ------------------------------------------------

const VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Cheap 3D noise (Perlin-ish via dot+sin) — enough for stylized plasma
const NOISE_LIB = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute( permute( permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

const FRAG_PLASMA = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uActivity;
  varying vec3 vNormal;
  varying vec3 vPos;

  ${NOISE_LIB}

  void main() {
    // FBM — slow large cells + fast small turbulence
    vec3 p = normalize(vPos) * 2.0;
    float n = 0.0;
    n += snoise(p * 1.5 + vec3(0.0, uTime * 0.06 * uActivity, 0.0)) * 0.55;
    n += snoise(p * 3.5 + vec3(uTime * 0.12 * uActivity, 0.0, 0.0)) * 0.30;
    n += snoise(p * 9.0 - vec3(0.0, 0.0, uTime * 0.20 * uActivity)) * 0.18;
    n = n * 0.5 + 0.5;

    // Banded contrast — hot ridges / cooler darks
    float hot = smoothstep(0.45, 0.85, n);
    float cool = 1.0 - smoothstep(0.10, 0.45, n);

    // Sunspots — rare dark patches from low-frequency noise
    float spotNoise = snoise(p * 0.7);
    float spot = smoothstep(0.55, 0.75, spotNoise) * 0.5;

    // Brighter limb — fresnel
    float vdn = max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
    float limb = pow(1.0 - vdn, 1.5);

    vec3 baseHot = uColor * 1.6;
    vec3 baseCool = uColor * 0.7;
    vec3 color = mix(baseCool, baseHot, hot);
    color = mix(color, color * 0.35, spot);
    color += uColor * limb * 1.2;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// --- Component -------------------------------------------------------------

export function PlasmaStar({ radius = 1.8, color, activity = 1 }: PlasmaStarProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const coronaRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: color.clone() },
      uActivity: { value: activity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Keep uniforms in sync if color/activity changes
  useFrame((_, delta) => {
    if (matRef.current) {
      const u = matRef.current.uniforms;
      u.uTime.value += delta;
      u.uColor.value.copy(color);
      u.uActivity.value = activity;
    }
    if (coronaRef.current) {
      // Subtle breathing on the corona
      const t = uniforms.uTime.value;
      const s = 1 + Math.sin(t * 0.6) * 0.04;
      coronaRef.current.scale.setScalar(s);
    }
  });

  return (
    <group userData={{ lensflare: "no-occlusion" }}>
      {/* Plasma core */}
      <mesh userData={{ lensflare: "no-occlusion" }}>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={FRAG_PLASMA}
          uniforms={uniforms}
        />
      </mesh>

      {/* Tight corona (additive fresnel halo) */}
      <mesh ref={coronaRef} userData={{ lensflare: "no-occlusion" }}>
        <sphereGeometry args={[radius * 1.35, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.32}
          toneMapped={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Wide diffuse halo */}
      <mesh userData={{ lensflare: "no-occlusion" }}>
        <sphereGeometry args={[radius * 2.4, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.08}
          toneMapped={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Outer halo */}
      <mesh userData={{ lensflare: "no-occlusion" }}>
        <sphereGeometry args={[radius * 4.0, 20, 20]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.025}
          toneMapped={false}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Point light to illuminate planets */}
      <pointLight color={color} intensity={3} distance={80} decay={2} />
    </group>
  );
}
