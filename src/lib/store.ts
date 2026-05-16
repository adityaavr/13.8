// ---------------------------------------------------------------------------
// 13.8 — Global state (Zustand)
//
// Zustand works across React reconciler boundaries, so both the DOM tree
// and the R3F Canvas tree can read/write the same store.
//
// Phase 1 adds:
//   - Deterministic seed (passed into generateUniverse)
//   - Signal event dispatch tracking
//   - Loneliness accumulator
//   - Verdict (final cinematic) overlay state
//   - "Survey Report" panel open/closed
// ---------------------------------------------------------------------------

import { create } from "zustand";
import type { Universe, Galaxy, StarSystem, ZoomLevel, SignalEvent } from "./types";
import { generateUniverse, DEMO_SEED } from "./generate-universe";
import { clampEpochGyr, UNIVERSE_AGE_GYR } from "./civilization-epoch";

export type SurveyPanelTarget =
  | { kind: "universe" }
  | { kind: "galaxy"; galaxyId: string }
  | { kind: "system"; galaxyId: string; systemId: string }
  | { kind: "planet"; galaxyId: string; systemId: string; planetId: string }
  | { kind: "signal"; signalId: string };

interface UniverseStore {
  // Data
  universe: Universe | null;
  initialized: boolean;
  /** Seed in effect — keeps `?seed=...` style overrides and replay possible. */
  seed: number;

  // Navigation
  zoomLevel: ZoomLevel;
  selectedGalaxyId: string | null;
  selectedSystemId: string | null;
  selectedPlanetId: string | null;

  // Timeline
  epochGyr: number;
  isEpochPlaying: boolean;
  /** Set of signal-event ids already surfaced this playback. */
  firedSignalIds: Set<string>;
  /** The signal alert currently demanding attention (clicked → investigate). */
  pendingSignal: SignalEvent | null;

  // Loneliness — cumulative civ-years of unanswered existence accrued during playback
  lonelinessGyrYears: number;

  // Transitions
  isTransitioning: boolean;
  zoomTargetPosition: { x: number; y: number; z: number } | null;
  cameraResetTrigger: number;

  // Overlays
  /** When true, the Cosmographer Verdict cinematic is showing. */
  verdictOpen: boolean;
  /** What the Survey Report panel is currently summarizing. null = closed. */
  surveyTarget: SurveyPanelTarget | null;

  // Actions
  initialize: (seed?: number) => void;
  regenerate: (seed?: number) => void;
  setZoomLevel: (level: ZoomLevel) => void;
  setEpochGyr: (epochGyr: number) => void;
  setEpochPlaying: (playing: boolean) => void;
  resetEpoch: () => void;
  accrueLoneliness: (delta: number) => void;
  fireSignal: (event: SignalEvent) => void;
  dismissSignal: () => void;
  investigateSignal: (event: SignalEvent) => void;
  openSurvey: (target: SurveyPanelTarget) => void;
  closeSurvey: () => void;
  openVerdict: () => void;
  closeVerdict: () => void;
  selectGalaxy: (id: string) => void;
  selectSystem: (id: string) => void;
  selectPlanet: (id: string | null) => void;
  zoomOut: () => void;
  enterUniverse: () => void;
  resetCamera: () => void;

  // Derived
  currentGalaxy: () => Galaxy | null;
  currentSystem: () => StarSystem | null;
}

export const useUniverseStore = create<UniverseStore>((set, get) => ({
  // Initial state
  universe: null,
  initialized: false,
  seed: DEMO_SEED,
  zoomLevel: "landing",
  selectedGalaxyId: null,
  selectedSystemId: null,
  selectedPlanetId: null,
  epochGyr: UNIVERSE_AGE_GYR,
  isEpochPlaying: false,
  firedSignalIds: new Set(),
  pendingSignal: null,
  lonelinessGyrYears: 0,
  isTransitioning: false,
  zoomTargetPosition: null,
  cameraResetTrigger: 0,
  verdictOpen: false,
  surveyTarget: null,

  initialize: (seed) => {
    if (get().initialized) return;
    const effectiveSeed = seed ?? get().seed;
    const universe = generateUniverse({ seed: effectiveSeed });
    set({ universe, initialized: true, seed: effectiveSeed });
  },

  regenerate: (seed) => {
    const newSeed = seed ?? (Math.floor(Math.random() * 0xffffffff) >>> 0);
    const universe = generateUniverse({ seed: newSeed });
    set({
      universe,
      seed: newSeed,
      initialized: true,
      zoomLevel: "universe",
      selectedGalaxyId: null,
      selectedSystemId: null,
      selectedPlanetId: null,
      epochGyr: UNIVERSE_AGE_GYR,
      isEpochPlaying: false,
      firedSignalIds: new Set(),
      pendingSignal: null,
      lonelinessGyrYears: 0,
      verdictOpen: false,
      surveyTarget: null,
    });
  },

  setZoomLevel: (level) => {
    set({ zoomLevel: level, isTransitioning: true });
    setTimeout(() => set({ isTransitioning: false }), 2500);
  },

  setEpochGyr: (epochGyr) => set({ epochGyr: clampEpochGyr(epochGyr) }),

  setEpochPlaying: (playing) => {
    if (playing) {
      // Starting a fresh playback resets accrued loneliness + fired signals
      set({
        isEpochPlaying: true,
        lonelinessGyrYears: 0,
        firedSignalIds: new Set(),
        pendingSignal: null,
      });
    } else {
      set({ isEpochPlaying: false });
    }
  },

  resetEpoch: () => set({ epochGyr: UNIVERSE_AGE_GYR, isEpochPlaying: false }),

  accrueLoneliness: (delta) =>
    set((s) => ({ lonelinessGyrYears: s.lonelinessGyrYears + delta })),

  fireSignal: (event) => {
    set((s) => {
      if (s.firedSignalIds.has(event.id)) return s;
      const next = new Set(s.firedSignalIds);
      next.add(event.id);
      return { firedSignalIds: next, pendingSignal: event };
    });
  },

  dismissSignal: () => set({ pendingSignal: null }),

  investigateSignal: (event) => {
    set({
      pendingSignal: null,
      surveyTarget: { kind: "signal", signalId: event.id },
      isEpochPlaying: false, // pause for drama
    });
  },

  openSurvey: (target) => set({ surveyTarget: target }),
  closeSurvey: () => set({ surveyTarget: null }),

  openVerdict: () => set({ verdictOpen: true, isEpochPlaying: false }),
  closeVerdict: () => set({ verdictOpen: false }),

  enterUniverse: () => {
    const store = get();
    if (!store.initialized) store.initialize();
    set({
      zoomLevel: "universe",
      selectedGalaxyId: null,
      selectedSystemId: null,
      selectedPlanetId: null,
      zoomTargetPosition: null,
      isTransitioning: true,
    });
    setTimeout(() => set({ isTransitioning: false }), 2500);
  },

  selectGalaxy: (id) => {
    set({
      selectedGalaxyId: id,
      selectedSystemId: null,
      selectedPlanetId: null,
      zoomTargetPosition: null,
      zoomLevel: "galaxy",
      isTransitioning: true,
    });
    setTimeout(() => set({ isTransitioning: false }), 2500);
  },

  selectSystem: (id) => {
    const galaxy = get().currentGalaxy();
    let targetPos: { x: number; y: number; z: number } | null = null;
    if (galaxy) {
      const sys = galaxy.systems.find((s) => s.id === id);
      if (sys) targetPos = { ...sys.position };
    }

    set({
      selectedSystemId: id,
      selectedPlanetId: null,
      zoomTargetPosition: targetPos,
      isTransitioning: true,
    });

    setTimeout(() => set({ zoomLevel: "system", zoomTargetPosition: null }), 1400);
    setTimeout(() => set({ isTransitioning: false }), 3500);
  },

  selectPlanet: (id) => {
    if (!id) {
      set({ selectedPlanetId: null, zoomLevel: "system", isTransitioning: true });
      setTimeout(() => set({ isTransitioning: false }), 2500);
      return;
    }
    set({ selectedPlanetId: id, zoomLevel: "planet", isTransitioning: true });
    setTimeout(() => set({ isTransitioning: false }), 2500);
  },

  zoomOut: () => {
    const { zoomLevel } = get();
    if (zoomLevel === "planet") {
      set({ zoomLevel: "system", selectedPlanetId: null, isTransitioning: true });
      setTimeout(() => set({ isTransitioning: false }), 2500);
      return;
    }
    if (zoomLevel === "system") {
      set({
        zoomLevel: "galaxy",
        selectedSystemId: null,
        selectedPlanetId: null,
        zoomTargetPosition: null,
        isTransitioning: true,
      });
    } else if (zoomLevel === "galaxy") {
      set({
        zoomLevel: "universe",
        selectedGalaxyId: null,
        zoomTargetPosition: null,
        isTransitioning: true,
      });
    } else if (zoomLevel === "universe") {
      set({
        zoomLevel: "landing",
        zoomTargetPosition: null,
        isTransitioning: true,
      });
    }
    setTimeout(() => set({ isTransitioning: false }), 2500);
  },

  resetCamera: () => set((s) => ({ cameraResetTrigger: s.cameraResetTrigger + 1 })),

  currentGalaxy: () => {
    const { universe, selectedGalaxyId } = get();
    if (!universe || !selectedGalaxyId) return null;
    return universe.galaxies.find((g) => g.id === selectedGalaxyId) ?? null;
  },

  currentSystem: () => {
    const galaxy = get().currentGalaxy();
    const { selectedSystemId } = get();
    if (!galaxy || !selectedSystemId) return null;
    return galaxy.systems.find((s) => s.id === selectedSystemId) ?? null;
  },
}));
