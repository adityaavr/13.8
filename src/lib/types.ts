// ---------------------------------------------------------------------------
// 13.8 — Data model for the procedural universe
// ---------------------------------------------------------------------------

export type GalaxyType = "spiral" | "elliptical" | "irregular";
export type SpectralClass = "O" | "B" | "A" | "F" | "G" | "K" | "M";
export type PlanetType = "rocky" | "gas" | "ice" | "ocean" | "desert" | "volcanic";
export type ZoomLevel = "landing" | "universe" | "galaxy" | "system" | "planet";

export interface Planet {
  id: string;
  name: string;
  type: PlanetType;
  orbitRadius: number; // distance from star (arbitrary units)
  orbitSpeed: number; // radians per second
  orbitOffset: number; // starting angle
  size: number; // relative scale
  habitable: boolean;
  color: [number, number, number];
  textureUrl?: string; // AI generated texture
}

export interface StarSystem {
  id: string;
  name: string;
  spectralClass: SpectralClass;
  position: { x: number; y: number; z: number };
  luminosity: number;
  temperature: number; // Kelvin
  starColor: [number, number, number];
  hasBlackHole: boolean;
  planets: Planet[];
  skyboxUrl?: string; // AI generated skybox
}

export interface Galaxy {
  id: string;
  name: string;
  epithet: string;
  type: GalaxyType;
  position: { x: number; y: number; z: number };
  color: [number, number, number];
  secondaryColor: [number, number, number];
  age: number; // billions of years
  rotation: number; // radians, for spiral arm orientation
  tiltX: number; // radians, inclination toward viewer (0 = face-on, PI/2 = edge-on)
  tiltZ: number; // radians, roll
  armCount: number; // 2-4 spiral arms
  armTightness: number; // winding factor
  systems: StarSystem[];
}

export interface Universe {
  galaxies: Galaxy[];
  civilizations: CivilizationTrace[];
}

export interface CivilizationTrace {
  id: string;
  galaxyId: string;
  systemId: string;
  planetId: string;
  startGyr: number;
  endGyr: number;
  peakSignal: number;
  color: [number, number, number];
  position: { x: number; y: number; z: number };
}
