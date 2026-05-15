"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useUniverseStore } from "@/lib/store";
import { useTexture } from "@react-three/drei";

interface NebulaLayer {
  radius: number;
  density: number;
  scale: number;
  speed: number;
  opacity: number;
  fresnelPower: number;
  rotationSpeed: [number, number, number];
  colorA: [number, number, number];
  colorB: [number, number, number];
  colorC: [number, number, number];
}

interface NebulaPreset {
  layers: NebulaLayer[];
  starTint: [number, number, number];
}

const NOISE_GLSL = `
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += noise3(p) * amplitude;
    p = p * 2.03 + vec3(11.4, 7.3, 4.9);
    amplitude *= 0.5;
  }
  return value;
}
`;

const NEBULA_VERTEX_SHADER = `
varying vec3 vWorldPos;
varying vec3 vLocalPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vLocalPos = position;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const NEBULA_FRAGMENT_SHADER = `
uniform float uTime;
uniform float uDensity;
uniform float uScale;
uniform float uSpeed;
uniform float uOpacity;
uniform float uFresnelPower;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;

varying vec3 vWorldPos;
varying vec3 vLocalPos;

${NOISE_GLSL}

void main() {
  vec3 dir = normalize(vLocalPos);
  vec3 flow = vec3(
    dir.x * uScale + uTime * uSpeed,
    dir.y * uScale * 0.9 - uTime * uSpeed * 0.7,
    dir.z * uScale + uTime * uSpeed * 0.45
  );

  float n = fbm(flow);
  float ridges = abs(fbm(flow * 1.9 + vec3(7.3, 11.2, 5.4)) * 2.0 - 1.0);
  float cloud = smoothstep(0.34 - uDensity * 0.08, 0.78 + uDensity * 0.1, n * 0.75 + ridges * 0.25);

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - max(dot(viewDir, dir), 0.0), uFresnelPower);
  float edgeFade = smoothstep(0.08, 0.9, 1.0 - abs(dir.y));

  vec3 nebulaColor = mix(uColorA, uColorB, n);
  nebulaColor = mix(nebulaColor, uColorC, pow(cloud, 1.8));
  nebulaColor *= 0.4 + fresnel * 1.2;

  float alpha = cloud * edgeFade * uOpacity * (0.32 + fresnel * 0.85);
  if (alpha < 0.0025) discard;

  gl_FragColor = vec4(nebulaColor, alpha);
}
`;

const PRESETS: NebulaPreset[] = [
  {
    starTint: [0.8, 0.86, 1.0],
    layers: [
      {
        radius: 190,
        density: 1.15,
        scale: 1.45,
        speed: 0.012,
        opacity: 0.38,
        fresnelPower: 2.4,
        rotationSpeed: [0.0007, -0.0005, 0.0004],
        colorA: [0.05, 0.12, 0.24],
        colorB: [0.10, 0.34, 0.46],
        colorC: [0.24, 0.58, 0.66],
      },
      {
        radius: 255,
        density: 0.95,
        scale: 1.1,
        speed: 0.008,
        opacity: 0.32,
        fresnelPower: 3.0,
        rotationSpeed: [-0.00045, 0.00035, -0.00025],
        colorA: [0.24, 0.10, 0.28],
        colorB: [0.42, 0.15, 0.44],
        colorC: [0.64, 0.28, 0.56],
      },
      {
        radius: 340,
        density: 0.72,
        scale: 0.82,
        speed: 0.006,
        opacity: 0.24,
        fresnelPower: 3.6,
        rotationSpeed: [0.00025, 0.0002, 0.0003],
        colorA: [0.24, 0.08, 0.07],
        colorB: [0.50, 0.20, 0.12],
        colorC: [0.72, 0.36, 0.18],
      },
    ],
  },
  {
    starTint: [1.0, 0.9, 0.76],
    layers: [
      {
        radius: 185,
        density: 1.08,
        scale: 1.38,
        speed: 0.010,
        opacity: 0.4,
        fresnelPower: 2.7,
        rotationSpeed: [0.0006, -0.00045, 0.00035],
        colorA: [0.21, 0.11, 0.05],
        colorB: [0.42, 0.23, 0.10],
        colorC: [0.72, 0.42, 0.18],
      },
      {
        radius: 250,
        density: 0.92,
        scale: 1.04,
        speed: 0.007,
        opacity: 0.33,
        fresnelPower: 3.3,
        rotationSpeed: [-0.0005, 0.0003, -0.0002],
        colorA: [0.20, 0.07, 0.16],
        colorB: [0.36, 0.13, 0.30],
        colorC: [0.58, 0.21, 0.40],
      },
      {
        radius: 330,
        density: 0.68,
        scale: 0.78,
        speed: 0.005,
        opacity: 0.22,
        fresnelPower: 3.7,
        rotationSpeed: [0.0003, 0.00024, 0.0002],
        colorA: [0.08, 0.16, 0.14],
        colorB: [0.16, 0.30, 0.24],
        colorC: [0.30, 0.48, 0.34],
      },
    ],
  },
  {
    starTint: [0.82, 0.88, 1.0],
    layers: [
      {
        radius: 195,
        density: 1.12,
        scale: 1.5,
        speed: 0.011,
        opacity: 0.38,
        fresnelPower: 2.6,
        rotationSpeed: [0.00065, -0.00042, 0.00037],
        colorA: [0.08, 0.14, 0.34],
        colorB: [0.14, 0.28, 0.56],
        colorC: [0.22, 0.48, 0.80],
      },
      {
        radius: 262,
        density: 0.9,
        scale: 1.06,
        speed: 0.007,
        opacity: 0.3,
        fresnelPower: 3.2,
        rotationSpeed: [-0.0004, 0.00035, -0.0003],
        colorA: [0.18, 0.08, 0.34],
        colorB: [0.30, 0.12, 0.56],
        colorC: [0.44, 0.20, 0.74],
      },
      {
        radius: 346,
        density: 0.7,
        scale: 0.8,
        speed: 0.005,
        opacity: 0.22,
        fresnelPower: 3.8,
        rotationSpeed: [0.0003, 0.00018, 0.00022],
        colorA: [0.10, 0.07, 0.18],
        colorB: [0.22, 0.14, 0.32],
        colorC: [0.36, 0.24, 0.50],
      },
    ],
  },
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

function createNebulaMaterial(layer: NebulaLayer): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDensity: { value: layer.density },
      uScale: { value: layer.scale },
      uSpeed: { value: layer.speed },
      uOpacity: { value: layer.opacity },
      uFresnelPower: { value: layer.fresnelPower },
      uColorA: { value: new THREE.Color(...layer.colorA) },
      uColorB: { value: new THREE.Color(...layer.colorB) },
      uColorC: { value: new THREE.Color(...layer.colorC) },
    },
    vertexShader: NEBULA_VERTEX_SHADER,
    fragmentShader: NEBULA_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
}

function createStarfield(count: number, minRadius: number, maxRadius: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const phi = Math.random() * Math.PI * 2;
    const cosTheta = Math.random() * 2 - 1;
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    const radius = minRadius + Math.random() * (maxRadius - minRadius);

    positions[i3] = Math.cos(phi) * sinTheta * radius;
    positions[i3 + 1] = cosTheta * radius * 0.7;
    positions[i3 + 2] = Math.sin(phi) * sinTheta * radius;

    const brightness = 0.8 + Math.random() * 2.5;
    const warmth = Math.random();
    colors[i3] = brightness * (warmth > 0.75 ? 1.0 : 0.82);
    colors[i3 + 1] = brightness * (warmth < 0.2 ? 0.84 : 0.9);
    colors[i3 + 2] = brightness * (warmth < 0.2 ? 1.0 : 0.9);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function AISkybox({ url }: { url: string }) {
  const tex = useTexture(url);
  const { gl } = useThree();

  // Important for a sphere skybox
  useEffect(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
    tex.needsUpdate = true;
  }, [tex, gl]);

  return (
    <mesh renderOrder={-50}>
      <sphereGeometry args={[600, 64, 64]} />
      <meshBasicMaterial
        map={tex}
        side={THREE.BackSide}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

export function NebulaBackdrop() {
  const groupRef = useRef<THREE.Group>(null);
  const layerRefs = useRef<Array<THREE.Mesh | null>>([]);
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);

  const currentSystem = useUniverseStore((s) => {
    if (!s.universe || !s.selectedGalaxyId || !s.selectedSystemId) return null;
    const galaxy = s.universe.galaxies.find((g) => g.id === s.selectedGalaxyId);
    if (!galaxy) return null;
    return galaxy.systems.find((sys) => sys.id === s.selectedSystemId) ?? null;
  });

  const hasSkybox = Boolean(currentSystem?.skyboxUrl && (zoomLevel === "system" || zoomLevel === "planet"));

  const preset = useMemo(() => pick(PRESETS), []);
  const nebulaMaterials = useMemo(
    () => preset.layers.map((layer) => createNebulaMaterial(layer)),
    [preset],
  );
  const starGeometry = useMemo(() => createStarfield(4200, 130, 460), []);
  const starTint = useMemo(() => new THREE.Color(...preset.starTint), [preset]);

  useEffect(
    () => () => {
      nebulaMaterials.forEach((material) => material.dispose());
      starGeometry.dispose();
    },
    [nebulaMaterials, starGeometry],
  );

  useFrame(({ clock, camera }) => {
    const time = clock.elapsedTime;
    const group = groupRef.current;
    if (!group) return;

    group.position.set(
      camera.position.x * 0.12,
      camera.position.y * 0.07,
      camera.position.z * 0.12,
    );

    for (let i = 0; i < nebulaMaterials.length; i++) {
      const material = nebulaMaterials[i];
      const layerMesh = layerRefs.current[i];
      const layer = preset.layers[i];
      if (!material || !layerMesh || !layer) continue;

      material.uniforms.uTime.value = time;
      layerMesh.rotation.x += layer.rotationSpeed[0];
      layerMesh.rotation.y += layer.rotationSpeed[1];
      layerMesh.rotation.z += layer.rotationSpeed[2];
    }
  });

  return (
    <group ref={groupRef}>
      {hasSkybox && currentSystem?.skyboxUrl && (
        <AISkybox url={currentSystem.skyboxUrl} />
      )}
      
      {/* Procedural Fallback — fade out if AI skybox exists */}
      <group visible={!hasSkybox}>
        {preset.layers.map((layer, index) => (
          <mesh
            key={`nebula-layer-${index}`}
            ref={(mesh) => {
              layerRefs.current[index] = mesh;
            }}
            frustumCulled={false}
            material={nebulaMaterials[index]}
            renderOrder={-20 - index}
          >
            <sphereGeometry args={[layer.radius, 72, 72]} />
          </mesh>
        ))}

        <points geometry={starGeometry} frustumCulled={false} renderOrder={-10}>
          <pointsMaterial
            size={0.8}
            sizeAttenuation
            vertexColors
            color={starTint}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </points>
      </group>
    </group>
  );
}
