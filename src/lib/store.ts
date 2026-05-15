// ---------------------------------------------------------------------------
// 13.8 — Global state (Zustand)
//
// Zustand works across React reconciler boundaries, so both the DOM tree
// and the R3F Canvas tree can read/write the same store.
// ---------------------------------------------------------------------------

import { create } from "zustand";
import type { Universe, Galaxy, StarSystem, ZoomLevel } from "./types";
import { generateUniverse } from "./generate-universe";
import { clampEpochGyr, UNIVERSE_AGE_GYR } from "./civilization-epoch";

interface UniverseStore {
  // Data
  universe: Universe | null;
  initialized: boolean;

  // Navigation state
  zoomLevel: ZoomLevel;
  selectedGalaxyId: string | null;
  selectedSystemId: string | null;
  selectedPlanetId: string | null;

  // Timeline state (universe time scrubber)
  epochGyr: number;
  isEpochPlaying: boolean;

  // Transition
  isTransitioning: boolean;
  // Position the camera should zoom toward before entering system view
  zoomTargetPosition: { x: number; y: number; z: number } | null;
  // Increments when resetCamera is called — camera controller listens
  cameraResetTrigger: number;

  // Actions
  initialize: () => void;
  setZoomLevel: (level: ZoomLevel) => void;
  setEpochGyr: (epochGyr: number) => void;
  setEpochPlaying: (playing: boolean) => void;
  resetEpoch: () => void;
  selectGalaxy: (id: string) => void;
  selectSystem: (id: string) => void;
  selectPlanet: (id: string | null) => void;
  zoomOut: () => void;
  enterUniverse: () => void;
  resetCamera: () => void; // triggers camera to return to default position for current level

  // Derived getters
  currentGalaxy: () => Galaxy | null;
  currentSystem: () => StarSystem | null;
}

export const useUniverseStore = create<UniverseStore>((set, get) => ({
  // Initial state
  universe: null,
  initialized: false,
  zoomLevel: "landing",
  selectedGalaxyId: null,
  selectedSystemId: null,
  selectedPlanetId: null,
  epochGyr: UNIVERSE_AGE_GYR,
  isEpochPlaying: false,
  isTransitioning: false,
  zoomTargetPosition: null,
  cameraResetTrigger: 0,

  initialize: () => {
    if (get().initialized) return;
    const universe = generateUniverse();
    set({ universe, initialized: true });
  },

  setZoomLevel: (level) => {
    set({ zoomLevel: level, isTransitioning: true });
    setTimeout(() => set({ isTransitioning: false }), 2500);
  },

  setEpochGyr: (epochGyr) => {
    set({ epochGyr: clampEpochGyr(epochGyr) });
  },

  setEpochPlaying: (playing) => {
    set({ isEpochPlaying: playing });
  },

  resetEpoch: () => {
    set({ epochGyr: UNIVERSE_AGE_GYR, isEpochPlaying: false });
  },

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
    // Find the system's position within the galaxy so camera can fly there first
    const galaxy = get().currentGalaxy();
    let targetPos: { x: number; y: number; z: number } | null = null;
    if (galaxy) {
      const sys = galaxy.systems.find((s) => s.id === id);
      if (sys) {
        targetPos = { ...sys.position };
      }
    }

    // Phase 1: Camera dives toward the system within the galaxy
    set({
      selectedSystemId: id,
      selectedPlanetId: null,
      zoomTargetPosition: targetPos,
      isTransitioning: true,
    });

    // Phase 2: Switch to system view after camera has dived in
    setTimeout(() => {
      set({
        zoomLevel: "system",
        zoomTargetPosition: null,
      });
    }, 1400);

    setTimeout(() => set({ isTransitioning: false }), 3500);
  },

  selectPlanet: (id) => {
    if (!id) {
      // Deselect — go back to system view
      set({ selectedPlanetId: null, zoomLevel: "system", isTransitioning: true });
      setTimeout(() => set({ isTransitioning: false }), 2500);
      return;
    }
    set({
      selectedPlanetId: id,
      zoomLevel: "planet",
      isTransitioning: true,
    });
    setTimeout(() => set({ isTransitioning: false }), 2500);
  },

  zoomOut: () => {
    const { zoomLevel } = get();
    if (zoomLevel === "planet") {
      set({
        zoomLevel: "system",
        selectedPlanetId: null,
        isTransitioning: true,
      });
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

  resetCamera: () => {
    set((s) => ({ cameraResetTrigger: s.cameraResetTrigger + 1 }));
  },

  // Derived
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
