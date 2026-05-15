"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useUniverseStore } from "@/lib/store";
import { useTexture } from "@react-three/drei";
import type { Planet, PlanetType } from "@/lib/types";

const PLANET_RADIUS = 3.2;
const FALLBACK_PIXEL_TEXTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

interface PlanetLook {
  shadow: [number, number, number];
  sand: [number, number, number];
  rock: [number, number, number];
  accent: [number, number, number];
  atmosphere: [number, number, number];
  cloud: [number, number, number];
  ring: [number, number, number];
}

const PLANET_LOOKS: Record<PlanetType, PlanetLook> = {
  rocky: {
    shadow: [0.18, 0.13, 0.1],
    sand: [0.52, 0.41, 0.31],
    rock: [0.66, 0.55, 0.43],
    accent: [0.86, 0.71, 0.52],
    atmosphere: [0.58, 0.74, 0.94],
    cloud: [0.86, 0.88, 0.92],
    ring: [0.74, 0.66, 0.58],
  },
  gas: {
    shadow: [0.28, 0.16, 0.1],
    sand: [0.68, 0.42, 0.22],
    rock: [0.84, 0.56, 0.3],
    accent: [0.97, 0.76, 0.48],
    atmosphere: [0.96, 0.74, 0.45],
    cloud: [0.97, 0.88, 0.73],
    ring: [0.86, 0.76, 0.56],
  },
  ice: {
    shadow: [0.18, 0.3, 0.42],
    sand: [0.46, 0.65, 0.78],
    rock: [0.68, 0.84, 0.92],
    accent: [0.9, 0.96, 1.0],
    atmosphere: [0.64, 0.83, 1.0],
    cloud: [0.9, 0.96, 1.0],
    ring: [0.72, 0.84, 0.92],
  },
  ocean: {
    shadow: [0.05, 0.11, 0.26],
    sand: [0.12, 0.35, 0.54],
    rock: [0.16, 0.51, 0.42],
    accent: [0.34, 0.68, 0.52],
    atmosphere: [0.3, 0.62, 1.0],
    cloud: [0.86, 0.92, 0.98],
    ring: [0.58, 0.7, 0.76],
  },
  desert: {
    shadow: [0.32, 0.18, 0.1],
    sand: [0.72, 0.52, 0.29],
    rock: [0.86, 0.66, 0.36],
    accent: [0.96, 0.82, 0.5],
    atmosphere: [0.94, 0.78, 0.55],
    cloud: [0.9, 0.82, 0.64],
    ring: [0.84, 0.72, 0.5],
  },
  volcanic: {
    shadow: [0.1, 0.06, 0.05],
    sand: [0.28, 0.13, 0.09],
    rock: [0.56, 0.21, 0.1],
    accent: [1.0, 0.5, 0.2],
    atmosphere: [0.95, 0.44, 0.24],
    cloud: [0.76, 0.56, 0.44],
    ring: [0.74, 0.48, 0.3],
  },
};

interface MoonConfig {
  radius: number;
  orbitRadius: number;
  orbitSpeed: number;
  phase: number;
  tilt: number;
  color: [number, number, number];
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
  for (int i = 0; i < 6; i++) {
    value += noise3(p) * amplitude;
    p = p * 2.01 + vec3(9.7, 3.1, 6.3);
    amplitude *= 0.5;
  }
  return value;
}
`;

const SURFACE_VERTEX_SHADER = `
uniform float uTime;
uniform float uNoiseScale;
uniform float uDisplacement;

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vLocalPos;
varying float vElevation;

${NOISE_GLSL}

float getElevation(vec3 p) {
  float n = fbm(p * uNoiseScale + vec3(uTime * 0.015, 0.0, 0.0));
  float ridge = abs(fbm(p * (uNoiseScale * 1.8) + vec3(0.0, uTime * 0.01, 13.7)) * 2.0 - 1.0);
  float warp = fbm(p * uNoiseScale * 0.6);
  return mix(n, ridge, 0.4 + warp * 0.3);
}

void main() {
  vec3 p = position;
  float elevation = getElevation(p);
  float displacement = (elevation - 0.5) * uDisplacement;

  vec3 displaced = p + normal * displacement;
  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);

  vWorldPos = worldPos.xyz;
  vNormalW = normalize(normalMatrix * normal);
  vLocalPos = position;
  vElevation = elevation;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const SURFACE_FRAGMENT_SHADER = `
uniform float uTime;
uniform float uNoiseScale;
uniform float uDisplacement;
uniform vec3 uShadowColor;
uniform vec3 uSandColor;
uniform vec3 uRockColor;
uniform vec3 uAccentColor;
uniform vec3 uAtmosphereColor;
uniform vec3 uLightDirection;

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vLocalPos;
varying float vElevation;

${NOISE_GLSL}

float getElevation(vec3 p) {
  float n = fbm(p * uNoiseScale + vec3(uTime * 0.015, 0.0, 0.0));
  float ridge = abs(fbm(p * (uNoiseScale * 1.8) + vec3(0.0, uTime * 0.01, 13.7)) * 2.0 - 1.0);
  float warp = fbm(p * uNoiseScale * 0.6);
  return mix(n, ridge, 0.4 + warp * 0.3);
}

vec3 calculateNormal(vec3 p, vec3 sphereNormal) {
    float eps = 0.005;
    vec3 tangent = normalize(cross(vec3(0.0, 1.0, 0.0), sphereNormal));
    if (length(tangent) < 0.01) tangent = normalize(cross(vec3(1.0, 0.0, 0.0), sphereNormal));
    vec3 bitangent = normalize(cross(sphereNormal, tangent));

    float h0 = vElevation; 
    float hX = getElevation(p + tangent * eps);
    float hZ = getElevation(p + bitangent * eps);

    vec3 dpdx = tangent * eps + sphereNormal * (hX - h0) * uDisplacement;
    vec3 dpdz = bitangent * eps + sphereNormal * (hZ - h0) * uDisplacement;

    return normalize(cross(dpdz, dpdx));
}

void main() {
  vec3 sphereNormalLocal = normalize(vLocalPos);
  vec3 normalLocal = calculateNormal(vLocalPos, sphereNormalLocal);
  
  // Transform normal back to world space for lighting
  // Since we don't have non-uniform scaling, we can just use the viewMatrix/modelMatrix directly
  vec3 sphereNormal = normalize(vNormalW);
  vec3 normal = normalize(normalLocal);
  // Simple hack to world space since the planet doesn't rotate with a complex matrix in the shader
  // We approximate by mixing the bumped normal with the world normal
  normal = normalize(sphereNormal + (normal - sphereNormalLocal));

  // If we are looking from inside or backface, flip the normal
  if (!gl_FrontFacing) {
      normal = -normal;
  }

  // Striated banding pattern (like dunes/strata)
  vec3 p = normalize(vLocalPos);
  float bands = sin(p.y * 45.0 + fbm(p * 2.5) * 8.0) * 0.5 + 0.5;
  float microDetail = fbm(p * 25.0);
  
  float pattern = mix(bands, microDetail, 0.25);

  float slope = 1.0 - max(dot(normal, sphereNormal), 0.0); // Difference between bumpy normal and smooth normal
  slope = smoothstep(0.01, 0.25, slope);

  vec3 sediment = mix(
    uShadowColor,
    uSandColor,
    smoothstep(0.05, 0.95, pattern + vElevation * 0.4)
  );

  vec3 rocky = mix(
    uRockColor,
    uAccentColor,
    smoothstep(0.15, 0.85, pattern * 0.6 + vElevation)
  );

  vec3 terrain = mix(
    sediment,
    rocky,
    slope
  );

  // Lighting
  vec3 lightDir = normalize(uLightDirection);
  float lambert = max(dot(normal, lightDir), 0.0);
  
  // Wrap lighting for softer terminator
  float wrap = 0.3;
  float diffuse = max(0.0, (dot(normal, lightDir) + wrap) / (1.0 + wrap));
  diffuse = smoothstep(0.0, 0.9, diffuse); // Increase contrast

  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 halfVec = normalize(lightDir + viewDir);
  float specular = pow(max(dot(normal, halfVec), 0.0), 16.0) * 0.06;

  float rim = pow(1.0 - max(dot(viewDir, sphereNormal), 0.0), 2.5);
  float horizonWarm = pow(max(dot(viewDir, -lightDir), 0.0), 3.0);

  // Rayleigh/Mie scattering approximations
  vec3 coolScatter = uAtmosphereColor * rim * (0.1 + diffuse * 0.4);
  vec3 warmScatter = vec3(1.0, 0.5, 0.2) * horizonWarm * rim * 0.6 * (1.0 - diffuse);

  // Core shadow tinting
  vec3 shadowTint = mix(vec3(0.02, 0.03, 0.08), uAtmosphereColor * 0.1, rim);
  vec3 lit = mix(shadowTint, terrain, diffuse) + specular;
  
  lit += coolScatter + warmScatter;

  gl_FragColor = vec4(lit, 1.0);
}
`;

const CLOUD_VERTEX_SHADER = `
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vLocalPos;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vNormalW = normalize(normalMatrix * normal);
  vLocalPos = position;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const CLOUD_FRAGMENT_SHADER = `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uCloudColor;

varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vLocalPos;

${NOISE_GLSL}

void main() {
  vec3 normal = normalize(vNormalW);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);

  float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.25);
  vec3 p = normalize(vLocalPos) * 4.4;
  float n = fbm(p + vec3(uTime * 0.03, -uTime * 0.02, uTime * 0.012));
  float bands = sin(vLocalPos.y * 4.6 + n * 4.1 + uTime * 0.14) * 0.5 + 0.5;
  float cloud = smoothstep(0.54, 0.86, n * 0.68 + bands * 0.32);

  float alpha = cloud * (0.14 + fresnel * 0.42) * uOpacity;
  if (alpha < 0.005) discard;

  vec3 cloudColor = mix(uCloudColor * 0.72, vec3(1.0), cloud * 0.45 + fresnel * 0.2);
  gl_FragColor = vec4(cloudColor, alpha);
}
`;

const ATMOSPHERE_VERTEX_SHADER = `
varying vec3 vWorldPos;
varying vec3 vNormalW;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vNormalW = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const ATMOSPHERE_FRAGMENT_SHADER = `
uniform vec3 uAtmosphereColor;
uniform vec3 uLightDirection;
uniform float uStrength;

varying vec3 vWorldPos;
varying vec3 vNormalW;

void main() {
  vec3 normal = normalize(vNormalW);
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  vec3 lightDir = normalize(uLightDirection);

  float rim = pow(1.0 - max(dot(viewDir, normal), 0.0), 1.6); // Much stronger rim thickness
  float sun = pow(max(dot(normal, lightDir), 0.0), 1.4);

  float alpha = rim * (0.4 + sun * 0.8) * uStrength; // Brighter overall
  if (alpha < 0.001) discard;

  vec3 color = uAtmosphereColor * (0.9 + rim * 1.8); // Pushed up for bloom
  color += vec3(1.0, 0.65, 0.35) * sun * rim * 1.2;

  gl_FragColor = vec4(color, alpha);
}
`;

function seedFromString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function colorFrom(values: [number, number, number]): THREE.Color {
  return new THREE.Color(values[0], values[1], values[2]);
}

function createRingTexture(seed: number, ringColor: [number, number, number]): THREE.DataTexture {
  const width = 512;
  const height = 64;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const radial = y / (height - 1);
    const edgeFade =
      Math.min(1, radial / 0.12) *
      Math.min(1, (1 - radial) / 0.15);

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const angle = x / width;
      const band =
        Math.sin((angle * 120 + radial * 45 + seed * 0.0012) * Math.PI) * 0.5 + 0.5;
      const turbulence =
        Math.cos((angle * 240 - radial * 90 + seed * 0.0019) * Math.PI) * 0.5 + 0.5;
      const brightness = 0.42 + band * 0.35 + turbulence * 0.23;
      const alpha = edgeFade * (0.25 + brightness * 0.55);

      data[idx] = Math.min(255, Math.floor(ringColor[0] * brightness * 255));
      data[idx + 1] = Math.min(255, Math.floor(ringColor[1] * brightness * 255));
      data[idx + 2] = Math.min(255, Math.floor(ringColor[2] * brightness * 255));
      data[idx + 3] = Math.min(255, Math.floor(alpha * 255));
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function generateMoonConfigs(
  planet: Planet,
  seed: number,
  look: PlanetLook,
): MoonConfig[] {
  const rng = createRng(seed ^ 0x9e3779b9);
  const minCount = planet.type === "gas" ? 2 : 1;
  const maxCount = planet.type === "gas" ? 4 : 2;
  const count = minCount + Math.floor(rng() * (maxCount - minCount + 1));

  const moons: MoonConfig[] = [];
  for (let i = 0; i < count; i++) {
    const radius = 0.2 + rng() * (planet.type === "gas" ? 0.45 : 0.28);
    const orbitRadius = PLANET_RADIUS * 1.8 + i * (0.9 + rng() * 0.8);
    const speed = 0.08 + rng() * 0.18;
    const phase = rng() * Math.PI * 2;
    const tilt = (rng() - 0.5) * 0.5;
    const tone = 0.6 + rng() * 0.35;

    moons.push({
      radius,
      orbitRadius,
      orbitSpeed: speed,
      phase,
      tilt,
      color: [
        Math.min(1, look.shadow[0] * 0.6 + look.sand[0] * tone),
        Math.min(1, look.shadow[1] * 0.6 + look.sand[1] * tone),
        Math.min(1, look.shadow[2] * 0.6 + look.sand[2] * tone),
      ],
    });
  }

  return moons;
}

function OrbitingMoon({ config }: { config: MoonConfig }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group) return;
    const angle = clock.elapsedTime * config.orbitSpeed + config.phase;
    group.position.set(
      Math.cos(angle) * config.orbitRadius,
      Math.sin(angle * 0.8) * config.tilt,
      Math.sin(angle) * config.orbitRadius,
    );
    group.rotation.y = angle * 0.8;
  });

  const moonColor = useMemo(() => colorFrom(config.color), [config.color]);

  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[config.radius, 20, 20]} />
        <meshStandardMaterial
          color={moonColor}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}

function PlanetSphere({ planet }: { planet: Planet }) {
  const surfaceRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const { gl } = useThree();

  const look = useMemo(() => PLANET_LOOKS[planet.type], [planet.type]);
  const seed = useMemo(() => seedFromString(planet.id), [planet.id]);
  const lightDir = useMemo(() => new THREE.Vector3(1, 0.4, 0.75).normalize(), []);
  const hasAiTexture = Boolean(planet.textureUrl);

  // Load the AI texture if we have one
  const aiTexture = useTexture(planet.textureUrl || FALLBACK_PIXEL_TEXTURE);

  useEffect(() => {
    if (!hasAiTexture) return;
    aiTexture.colorSpace = THREE.SRGBColorSpace;
    aiTexture.wrapS = THREE.RepeatWrapping;
    aiTexture.wrapT = THREE.ClampToEdgeWrapping;
    aiTexture.minFilter = THREE.LinearMipmapLinearFilter;
    aiTexture.magFilter = THREE.LinearFilter;
    aiTexture.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
    aiTexture.needsUpdate = true;
  }, [aiTexture, gl, hasAiTexture]);

  const surfaceMaterial = useMemo(() => {
    // If we have an AI texture, use a Standard material wrapped with it
    if (hasAiTexture) {
      return new THREE.MeshStandardMaterial({
        map: aiTexture,
        roughness: planet.type === "ocean" ? 0.3 : 0.8,
        metalness: planet.type === "ocean" ? 0.2 : 0.05,
        bumpMap: aiTexture, // use the texture as its own bump map for some fake depth
        bumpScale: planet.type === "gas" ? 0.012 : 0.035,
      });
    }

    // Fallback to the procedural shader if no AI texture yet
    const displacement =
      planet.type === "gas" ? 0.08 : planet.type === "ocean" ? 0.35 : 0.85;

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uNoiseScale: { value: planet.type === "gas" ? 1.2 : 0.85 },
        uDisplacement: { value: displacement },
        uShadowColor: { value: colorFrom(look.shadow) },
        uSandColor: { value: colorFrom(look.sand) },
        uRockColor: { value: colorFrom(look.rock) },
        uAccentColor: { value: colorFrom(look.accent) },
        uAtmosphereColor: { value: colorFrom(look.atmosphere) },
        uLightDirection: { value: lightDir.clone() },
      },
      vertexShader: SURFACE_VERTEX_SHADER,
      fragmentShader: SURFACE_FRAGMENT_SHADER,
      toneMapped: true,
    });
  }, [planet.type, hasAiTexture, aiTexture, look, lightDir]);

  const cloudMaterial = useMemo(() => {
    const opacity = hasAiTexture
      ? planet.type === "ocean"
        ? 0.36
        : 0.2
      : planet.type === "gas"
        ? 0.35
        : planet.type === "ocean"
          ? 0.58
          : 0.46;

    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: opacity },
        uCloudColor: { value: colorFrom(look.cloud) },
      },
      vertexShader: CLOUD_VERTEX_SHADER,
      fragmentShader: CLOUD_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      toneMapped: false,
    });
  }, [planet.type, look, hasAiTexture]);

  const atmosphereMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uAtmosphereColor: { value: colorFrom(look.atmosphere) },
          uLightDirection: { value: lightDir.clone() },
          uStrength: { value: planet.type === "volcanic" ? 0.9 : 1.05 },
        },
        vertexShader: ATMOSPHERE_VERTEX_SHADER,
        fragmentShader: ATMOSPHERE_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [look, lightDir, planet.type],
  );

  const ringTexture = useMemo(
    () => createRingTexture(seed, look.ring),
    [seed, look],
  );

  const moons = useMemo(
    () => generateMoonConfigs(planet, seed, look),
    [planet, seed, look],
  );

  useEffect(
    () => () => {
      surfaceMaterial.dispose();
      cloudMaterial.dispose();
      atmosphereMaterial.dispose();
      ringTexture.dispose();
    },
    [surfaceMaterial, cloudMaterial, atmosphereMaterial, ringTexture],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (surfaceRef.current) surfaceRef.current.rotation.y = t * 0.07;
    if (cloudRef.current) cloudRef.current.rotation.y = t * 0.11;
    if (atmosphereRef.current) atmosphereRef.current.rotation.y = t * 0.03;
    if (ringRef.current) ringRef.current.rotation.z = t * 0.008;

    if (!hasAiTexture && surfaceMaterial instanceof THREE.ShaderMaterial) {
      surfaceMaterial.uniforms.uTime.value = t;
    }
    cloudMaterial.uniforms.uTime.value = t;
  });

  return (
    <group>
      <mesh ref={surfaceRef} material={surfaceMaterial}>
        <sphereGeometry args={[PLANET_RADIUS, 512, 512]} />
      </mesh>

      {planet.type !== "gas" && planet.type !== "desert" && planet.type !== "volcanic" && (
        <mesh ref={cloudRef} material={cloudMaterial}>
          <sphereGeometry args={[PLANET_RADIUS * 1.018, 256, 256]} />
        </mesh>
      )}

      <mesh ref={atmosphereRef} material={atmosphereMaterial}>
        <sphereGeometry args={[PLANET_RADIUS * 1.09, 128, 128]} />
      </mesh>

      {planet.type === "gas" && (
        <mesh ref={ringRef} rotation={[-Math.PI * 0.42, 0.22, 0.18]}>
          <ringGeometry args={[PLANET_RADIUS * 1.45, PLANET_RADIUS * 2.45, 192]} />
          <meshBasicMaterial
            map={ringTexture}
            transparent
            opacity={0.72}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      )}

      {moons.map((moon, index) => (
        <OrbitingMoon key={`${planet.id}-moon-${index}`} config={moon} />
      ))}

      <directionalLight
        position={[12, 5, 8]}
        intensity={1.6}
        color={new THREE.Color(1.0, 0.95, 0.86)}
      />
      <directionalLight
        position={[-6, -3, -10]}
        intensity={0.16}
        color={new THREE.Color(0.32, 0.42, 0.62)}
      />
      <ambientLight intensity={0.08} />
    </group>
  );
}

export function PlanetDetailView() {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);

  const planet = useUniverseStore((s) => {
    if (!s.universe || !s.selectedGalaxyId || !s.selectedSystemId || !s.selectedPlanetId) {
      return null;
    }
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
