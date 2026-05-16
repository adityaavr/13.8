"use client";

// ---------------------------------------------------------------------------
// 13.8 — Star System View
//
// Renders actual 3D meshes for the star and planets when zoomed into a
// system. Layered on top of the particle field (which provides ambient dust).
//
// - Central star: glowing emissive sphere + point light
// - Planets: colored spheres orbiting the star with animated rotation
// - Orbital rings: faint circle paths
// - Habitable planets: green/teal glow ring + subtle pulse
// - Labels: floating text near each planet (drei Billboard + Text)
// ---------------------------------------------------------------------------

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text, Ring, Line } from "@react-three/drei";
import * as THREE from "three";
import { useUniverseStore } from "@/lib/store";
import { BlackHole } from "./black-hole";
import { PlasmaStar } from "./plasma-star-shader";
import { HabitableZone } from "./habitable-zone";
import { Atmosphere } from "./atmosphere-shader";
import type { Planet, StarSystem } from "@/lib/types";


// ---------------------------------------------------------------------------
// Central Star — uses the plasma shader for surface convection + corona
// ---------------------------------------------------------------------------

function Star({ system }: { system: StarSystem }) {
  const color = useMemo(
    () => new THREE.Color(system.starColor[0], system.starColor[1], system.starColor[2]),
    [system.starColor],
  );

  // Hotter stars are more "active" — convection runs faster
  const activity =
    system.spectralClass === "O" || system.spectralClass === "B"
      ? 2.0
      : system.spectralClass === "M" || system.spectralClass === "K"
      ? 0.6
      : 1.0;

  return <PlasmaStar radius={1.8} color={color} activity={activity} />;
}

// ---------------------------------------------------------------------------
// Orbital Ring — using drei's Line to avoid SVG type conflicts
// ---------------------------------------------------------------------------

function OrbitalRing({ radius, habitable }: { radius: number; habitable: boolean }) {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push([
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius,
      ]);
    }
    return pts;
  }, [radius]);

  return (
    <Line
      points={points}
      color={habitable ? "#2dd4a8" : "#ffffff"}
      transparent
      opacity={habitable ? 0.12 : 0.04}
      lineWidth={1}
      toneMapped={false}
    />
  );
}

// ---------------------------------------------------------------------------
// Planet
// ---------------------------------------------------------------------------

// Per-planet atmosphere tints — match planet biome
const PLANET_ATMOS: Record<Planet["type"], [number, number, number]> = {
  rocky: [0.55, 0.7, 1.0],
  gas: [0.95, 0.7, 0.35],
  ice: [0.7, 0.9, 1.0],
  ocean: [0.35, 0.7, 1.0],
  desert: [1.0, 0.78, 0.45],
  volcanic: [1.0, 0.35, 0.15],
};

function PlanetMesh({
  planet,
  isSelected,
  onSelect,
}: {
  planet: Planet;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const surfaceRef = useRef<THREE.Mesh>(null);
  // Stable Vector3 mutated each frame — Atmosphere reads it by reference
  const sunDir = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const [r, g, b] = planet.color;
  const planetRadius = planet.size * 0.4;

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;

    if (groupRef.current) {
      const angle = planet.orbitOffset + time * planet.orbitSpeed;
      const px = Math.cos(angle) * planet.orbitRadius;
      const pz = Math.sin(angle) * planet.orbitRadius;
      groupRef.current.position.set(px, 0, pz);

      // Sun direction = unit vector from planet toward origin (star)
      sunDir.set(-px, 0, -pz).normalize();
    }

    if (surfaceRef.current) {
      surfaceRef.current.rotation.y = time * 0.08;
    }

    if (glowRef.current && planet.habitable) {
      const pulse = 1 + Math.sin(time * 1.5) * 0.15;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  const planetColor = useMemo(() => new THREE.Color(r, g, b), [r, g, b]);
  const atmosColor = PLANET_ATMOS[planet.type];

  return (
    <group ref={groupRef}>
      {/* Planet sphere — bumped subdivisions for smoother orbital appearance */}
      <mesh
        ref={surfaceRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "default"; }}
      >
        <sphereGeometry args={[planetRadius, 48, 48]} />
        <meshStandardMaterial
          color={planetColor}
          roughness={0.78}
          metalness={0.05}
          emissive={planetColor}
          emissiveIntensity={0.03}
        />
      </mesh>

      {/* Atmosphere — Fresnel rim glow with sun-side warm scattering */}
      <Atmosphere
        radius={planetRadius}
        color={atmosColor}
        sunDirection={sunDir}
        intensity={planet.habitable ? 0.85 : 0.55}
      />

      {/* Selection ring */}
      {isSelected && (
        <Ring
          args={[planet.size * 0.55, planet.size * 0.62, 32]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.5}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </Ring>
      )}

      {/* Habitable glow ring */}
      {planet.habitable && (
        <mesh ref={glowRef}>
          <ringGeometry args={[planet.size * 0.5, planet.size * 0.7, 32]} />
          <meshBasicMaterial
            color="#2dd4a8"
            transparent
            opacity={0.2}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Label */}
      <Billboard position={[0, planet.size * 0.6 + 0.8, 0]}>
        <Text
          fontSize={0.4}
          color={planet.habitable ? "#2dd4a8" : "#ffffff"}
          fillOpacity={isSelected ? 0.8 : 0.35}
          anchorX="center"
          anchorY="bottom"
          font={undefined}
        >
          {planet.name}
        </Text>
        <Text
          fontSize={0.2}
          color="#ffffff"
          fillOpacity={0.15}
          anchorX="center"
          anchorY="top"
          position={[0, -0.15, 0]}
          font={undefined}
        >
          {planet.type}{planet.habitable ? " · habitable" : ""}
        </Text>
      </Billboard>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function StarSystemView() {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);
  const selectedPlanetId = useUniverseStore((s) => s.selectedPlanetId);
  const selectPlanet = useUniverseStore((s) => s.selectPlanet);

  const system = useUniverseStore((s) => {
    if (!s.universe || !s.selectedGalaxyId || !s.selectedSystemId) return null;
    const galaxy = s.universe.galaxies.find((g) => g.id === s.selectedGalaxyId);
    if (!galaxy) return null;
    return galaxy.systems.find((sys) => sys.id === s.selectedSystemId) ?? null;
  });

  // Only render when zoomed into a system
  if (zoomLevel !== "system" || !system) return null;

  // Show the habitable zone halo only for normal stars (not black-hole systems)
  // and only if at least one planet sits in or near the band.
  const hasHabitable = system.planets.some((p) => p.habitable);

  return (
    <group>
      {/* Central body — star or black hole */}
      {system.hasBlackHole ? <BlackHole /> : <Star system={system} />}

      {/* Habitable Goldilocks band — soft green glow */}
      {!system.hasBlackHole && hasHabitable && <HabitableZone />}

      {/* Orbital rings */}
      {system.planets.map((planet) => (
        <OrbitalRing
          key={`ring-${planet.id}`}
          radius={planet.orbitRadius}
          habitable={planet.habitable}
        />
      ))}

      {/* Planets */}
      {system.planets.map((planet) => (
        <PlanetMesh
          key={planet.id}
          planet={planet}
          isSelected={selectedPlanetId === planet.id}
          onSelect={() => selectPlanet(planet.id)}
        />
      ))}
    </group>
  );
}
