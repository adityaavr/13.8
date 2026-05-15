"use client";

// ---------------------------------------------------------------------------
// 13.8 — Camera Controller (Fixed)
//
// All inputs unified through shared code paths:
//   - Zoom: O/P and scroll both go through OrbitControls' dolly mechanism
//   - Pan: WASD moves camera + target together
//   - Orbit: drag handled entirely by OrbitControls
//   - R: safety reset to known-good position
//
// Transition system uses a cancelled-flag pattern. User input is blocked
// cleanly during active transitions. controls.enabled is always restored.
// ---------------------------------------------------------------------------

import { useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useUniverseStore } from "@/lib/store";
import type { ZoomLevel } from "@/lib/types";

// ---------------------------------------------------------------------------
// Per-level config
// ---------------------------------------------------------------------------

const VIEW_CONFIGS: Record<ZoomLevel, {
  minDist: number;
  maxDist: number;
  pos: [number, number, number];
  look: [number, number, number];
}> = {
  landing: { minDist: 20, maxDist: 120, pos: [0, 20, 60], look: [0, 0, 0] },
  universe: { minDist: 40, maxDist: 400, pos: [0, 110, 140], look: [0, -15, 0] },
  galaxy: { minDist: 8, maxDist: 70, pos: [10, 22, 35], look: [0, -2, 0] },
  system: { minDist: 8, maxDist: 60, pos: [15, 16, 28], look: [0, -1, 0] },
  planet: { minDist: 3, maxDist: 20, pos: [4, 2, 6], look: [0, 0, 0] },
};

const MIN_POLAR = 0.1; // prevent gimbal lock at top
const MAX_POLAR = Math.PI - 0.1; // prevent gimbal lock at bottom

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CameraController() {
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();

  // Transition state
  const tweenRef = useRef<{
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startLook: THREE.Vector3;
    endLook: THREE.Vector3;
    startTime: number;
    duration: number;
    cancelled: boolean;
  } | null>(null);

  // Track previous store values to detect changes
  const prevZoomLevel = useRef<string>("landing");
  const prevResetTrigger = useRef(0);

  // Keys held
  const keys = useRef<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Key listeners
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keys.current.add(key);

      // R = safety reset
      if (key === "r") {
        const level = useUniverseStore.getState().zoomLevel;
        startTransition(level, 800);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Transition system — cancelled-flag pattern, no GSAP
  // ---------------------------------------------------------------------------

  const startTransition = useCallback(
    (level: ZoomLevel, duration = 1200, customPos?: THREE.Vector3, customLook?: THREE.Vector3) => {
      // Cancel any active tween
      if (tweenRef.current) tweenRef.current.cancelled = true;

      const config = VIEW_CONFIGS[level];
      const controls = controlsRef.current;

      tweenRef.current = {
        startPos: camera.position.clone(),
        endPos: customPos ?? new THREE.Vector3(...config.pos),
        startLook: controls ? controls.target.clone() : new THREE.Vector3(),
        endLook: customLook ?? new THREE.Vector3(...config.look),
        startTime: performance.now(),
        duration,
        cancelled: false,
      };

      // Update orbit bounds immediately
      if (controls) {
        controls.minDistance = config.minDist;
        controls.maxDistance = config.maxDist;
        controls.enabled = false; // disable during transition
      }
    },
    [camera],
  );

  // ---------------------------------------------------------------------------
  // Initial camera position
  // ---------------------------------------------------------------------------

  useEffect(() => {
    camera.position.set(0, 20, 60);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [camera]);

  // ---------------------------------------------------------------------------
  // Store subscription — react to zoom level changes + reset trigger
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const unsubscribe = useUniverseStore.subscribe((store) => {
      const { zoomLevel, zoomTargetPosition, cameraResetTrigger } = store;

      // Explicit reset
      if (cameraResetTrigger !== prevResetTrigger.current) {
        prevResetTrigger.current = cameraResetTrigger;
        startTransition(zoomLevel, 800);
        prevZoomLevel.current = zoomLevel;
        return;
      }

      // Phase 1: zoom-into-system dive
      if (zoomTargetPosition && zoomLevel === "galaxy") {
        const tp = zoomTargetPosition;
        const flyPos = new THREE.Vector3(tp.x * 0.15 + 3, 4, tp.z * 0.15 + 5);
        const flyLook = new THREE.Vector3(tp.x * 0.3, tp.y * 0.3, tp.z * 0.3);
        startTransition(zoomLevel, 1000, flyPos, flyLook);
        prevZoomLevel.current = zoomLevel;
        return;
      }

      // Zoom level changed — transition to default camera for new level
      if (zoomLevel !== prevZoomLevel.current) {
        prevZoomLevel.current = zoomLevel;
        startTransition(zoomLevel, 1200);

        // Update orbit bounds even if transition doesn't start
        const controls = controlsRef.current;
        const config = VIEW_CONFIGS[zoomLevel];
        if (controls) {
          controls.minDistance = config.minDist;
          controls.maxDistance = config.maxDist;
        }
      }
    });
    return unsubscribe;
  }, [startTransition]);

  // ---------------------------------------------------------------------------
  // Frame loop
  // ---------------------------------------------------------------------------

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // --- Active transition ---
    const tween = tweenRef.current;
    if (tween && !tween.cancelled) {
      const elapsed = performance.now() - tween.startTime;
      const rawT = Math.min(elapsed / tween.duration, 1);
      // Cubic ease-in-out
      const t = rawT < 0.5
        ? 4 * rawT * rawT * rawT
        : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

      camera.position.lerpVectors(tween.startPos, tween.endPos, t);
      controls.target.lerpVectors(tween.startLook, tween.endLook, t);

      if (rawT >= 1) {
        // Transition complete
        tweenRef.current = null;
        controls.enabled = true;
      }

      controls.update();
      return; // block all user input during transition
    }

    // --- Ensure controls are enabled (safety) ---
    if (!controls.enabled) controls.enabled = true;

    // --- WASD pan (moves camera + target together) ---
    const moveSpeed = 25 * delta;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    const fLen = forward.length();
    if (fLen > 0.001) forward.divideScalar(fLen);
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

    let moved = false;
    if (keys.current.has("w")) {
      camera.position.addScaledVector(forward, moveSpeed);
      controls.target.addScaledVector(forward, moveSpeed);
      moved = true;
    }
    if (keys.current.has("s")) {
      camera.position.addScaledVector(forward, -moveSpeed);
      controls.target.addScaledVector(forward, -moveSpeed);
      moved = true;
    }
    if (keys.current.has("a")) {
      camera.position.addScaledVector(right, -moveSpeed);
      controls.target.addScaledVector(right, -moveSpeed);
      moved = true;
    }
    if (keys.current.has("d")) {
      camera.position.addScaledVector(right, moveSpeed);
      controls.target.addScaledVector(right, moveSpeed);
      moved = true;
    }

    // --- O/P zoom (unified with OrbitControls' distance) ---
    // Instead of moving camera.position directly along lookDir (which desyncs
    // from OrbitControls), we modify the distance from controls.target.
    // This keeps OrbitControls and keyboard zoom in sync.
    if (keys.current.has("o") || keys.current.has("p")) {
      const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
      const currentDist = dir.length();
      if (currentDist > 0.01) {
        dir.divideScalar(currentDist); // normalize

        const zoomDelta = 30 * delta;
        let newDist: number;
        if (keys.current.has("o")) {
          newDist = Math.max(controls.minDistance, currentDist - zoomDelta);
        } else {
          newDist = Math.min(controls.maxDistance, currentDist + zoomDelta);
        }

        camera.position.copy(controls.target).addScaledVector(dir, newDist);
        moved = true;
      }
    }

    // --- NaN safety check ---
    if (isNaN(camera.position.x) || isNaN(camera.position.y) || isNaN(camera.position.z)) {
      const level = useUniverseStore.getState().zoomLevel;
      const config = VIEW_CONFIGS[level];
      camera.position.set(...config.pos);
      controls.target.set(...config.look);
    }

    controls.update();
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      enablePan={false}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
      minDistance={VIEW_CONFIGS.landing.minDist}
      maxDistance={VIEW_CONFIGS.landing.maxDist}
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
    />
  );
}
