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
import type { Planet, StarSystem } from "@/lib/types";

// ---------------------------------------------------------------------------
// Central Star
// ---------------------------------------------------------------------------

function Star({ system }: { system: StarSystem }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [r, g, b] = system.starColor;
  const color = new THREE.Color(r, g, b);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      // Subtle pulse
      const pulse = 1 + Math.sin(clock.elapsedTime * 0.8) * 0.05;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      {/* Core sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.8, 32, 32]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      {/* Soft glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[3.5, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.08}
          toneMapped={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Outer glow */}
      <mesh>
        <sphereGeometry args={[6, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.025}
          toneMapped={false}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Point light to illuminate planets */}
      <pointLight
        color={color}
        intensity={2}
        distance={60}
        decay={2}
      />
    </group>
  );
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
  const [r, g, b] = planet.color;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    // Orbit animation
    const time = clock.elapsedTime;
    const angle = planet.orbitOffset + time * planet.orbitSpeed;
    groupRef.current.position.set(
      Math.cos(angle) * planet.orbitRadius,
      0,
      Math.sin(angle) * planet.orbitRadius,
    );

    // Habitable glow pulse
    if (glowRef.current && planet.habitable) {
      const pulse = 1 + Math.sin(time * 1.5) * 0.15;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  const planetColor = new THREE.Color(r, g, b);

  return (
    <group ref={groupRef}>
      {/* Planet sphere */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "default"; }}
      >
        <sphereGeometry args={[planet.size * 0.4, 24, 24]} />
        <meshStandardMaterial
          color={planetColor}
          roughness={0.7}
          metalness={0.1}
          emissive={planetColor}
          emissiveIntensity={0.05}
        />
      </mesh>

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

  return (
    <group>
      {/* Central body — star or black hole */}
      {system.hasBlackHole ? <BlackHole /> : <Star system={system} />}

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
