"use client";

// ---------------------------------------------------------------------------
// 13.8 — Atmosphere Shader (NMS-style rim scattering)
//
// Fresnel-driven rim glow that:
//   - Brightens at the planet limb (perpendicular view angle)
//   - Tints warm on the sun-facing side, cool on the dark side
//   - Adds a soft outer halo with falloff
//
// Two-shell pattern: inner shell for the dense atmosphere band hugging the
// horizon, outer shell for the wide diffuse halo. Both use additive blending.
// ---------------------------------------------------------------------------

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface AtmosphereProps {
  radius: number;
  color: [number, number, number];
  sunDirection: THREE.Vector3;
  intensity?: number;
}

const VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// Inner shell — narrow rim band, warm sunlit limb
const FRAG_INNER = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float vdn = max(0.0, dot(viewDir, vNormal));
    // Fresnel — strongest at the limb where viewDir ⟂ normal
    float fresnel = 1.0 - vdn;
    fresnel = pow(fresnel, 2.5);

    // Sun bias — light scatters strongest on the sun side
    float sunSide = max(0.0, dot(uSunDir, vNormal));
    sunSide = pow(sunSide, 0.5);

    // Warm tint on sunlit rim (Rayleigh-ish), cool on shadow rim
    vec3 warm = uColor * vec3(1.6, 1.15, 0.85);
    vec3 cool = uColor * vec3(0.4, 0.55, 0.85);
    vec3 col = mix(cool, warm, sunSide);

    float a = fresnel * (0.35 + sunSide * 1.4) * uIntensity;
    gl_FragColor = vec4(col * a, a);
  }
`;

// Outer shell — wide diffuse halo, fades smoothly
const FRAG_OUTER = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunDir;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float vdn = max(0.0, dot(viewDir, vNormal));
    float fresnel = 1.0 - vdn;
    fresnel = pow(fresnel, 4.0); // softer, wider falloff

    float sunSide = max(0.0, dot(uSunDir, vNormal));
    sunSide = pow(sunSide, 0.7);

    vec3 col = uColor * mix(vec3(0.6, 0.7, 0.95), vec3(1.3, 1.05, 0.85), sunSide);

    float a = fresnel * (0.15 + sunSide * 0.55) * uIntensity;
    gl_FragColor = vec4(col * a, a);
  }
`;

export function Atmosphere({ radius, color, sunDirection, intensity = 1.0 }: AtmosphereProps) {
  const innerRef = useRef<THREE.ShaderMaterial>(null);
  const outerRef = useRef<THREE.ShaderMaterial>(null);

  const innerUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color[0], color[1], color[2]) },
      uSunDir: { value: sunDirection.clone().normalize() },
      uIntensity: { value: intensity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const outerUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color[0], color[1], color[2]) },
      uSunDir: { value: sunDirection.clone().normalize() },
      uIntensity: { value: intensity * 0.85 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Keep uniforms in sync if props change between renders
  useFrame(() => {
    if (innerRef.current) {
      const u = innerRef.current.uniforms;
      u.uColor.value.setRGB(color[0], color[1], color[2]);
      u.uSunDir.value.copy(sunDirection).normalize();
      u.uIntensity.value = intensity;
    }
    if (outerRef.current) {
      const u = outerRef.current.uniforms;
      u.uColor.value.setRGB(color[0], color[1], color[2]);
      u.uSunDir.value.copy(sunDirection).normalize();
      u.uIntensity.value = intensity * 0.85;
    }
  });

  return (
    <group>
      {/* Inner dense rim (1.025x) */}
      <mesh scale={radius * 1.025}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          ref={innerRef}
          vertexShader={VERT}
          fragmentShader={FRAG_INNER}
          uniforms={innerUniforms}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Wider outer halo (1.18x) */}
      <mesh scale={radius * 1.18}>
        <sphereGeometry args={[1, 48, 48]} />
        <shaderMaterial
          ref={outerRef}
          vertexShader={VERT}
          fragmentShader={FRAG_OUTER}
          uniforms={outerUniforms}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  );
}
