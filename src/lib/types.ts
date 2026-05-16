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
  /** Seed that produced this universe — used to rehydrate deterministically. */
  seed: number;
  galaxies: Galaxy[];
  civilizations: CivilizationTrace[];
  /** Pre-scheduled transient signal events surfaced during timeline playback. */
  signalEvents: SignalEvent[];
}

export interface CivilizationTrace {
  id: string;
  galaxyId: string;
  systemId: string;
  planetId: string;
  /** When this civ became technologically detectable (radio era). */
  startGyr: number;
  /** When their signal fell silent (filter event or transcendence). */
  endGyr: number;
  peakSignal: number;
  color: [number, number, number];
  /** Position in the universe-map coordinate frame (offset from galaxy). */
  position: { x: number; y: number; z: number };
  /** Full lifecycle simulation (events, outcome, filter). Always present. */
  lifecycle: CivilizationLifecycleRef;
}

// Forward-declared reference — actual type defined in civilization-lifecycle.ts
// (we duplicate the shape here so types.ts stays the data contract.)
export interface CivilizationLifecycleRef {
  outcome:
    | "PRE_LIFE"
    | "LIFE_WITHOUT_MIND"
    | "SUICIDED"
    | "TRANSCENDED"
    | "DORMANT"
    | "SILENT_BY_CHOICE";
  filter: string;
  speciesName: string;
  civilizationName: string;
  peakSignal: number;
  signalStartGyr: number;
  signalEndGyr: number;
  events: { kind: string; atGyr: number; description: string }[];
}

export interface SignalEvent {
  id: string;
  /** Epoch (Gyr) when this signal should fire during playback. */
  atGyr: number;
  /** Civ this signal comes from. */
  civilizationId: string;
  galaxyId: string;
  /** Approximate universe-map position so we can fly the camera there. */
  position: { x: number; y: number; z: number };
  /** Headline for the notification. */
  headline: string;
}
