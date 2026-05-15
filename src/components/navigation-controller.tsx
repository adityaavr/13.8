"use client";

// ---------------------------------------------------------------------------
// 13.8 — Navigation Controller
//
// Single component that bridges the Zustand store with Next.js routing.
// Lives in the root layout. When store state changes (galaxy/system selected),
// it handles the route transition after a delay (so particles start morphing
// before the URL changes).
//
// This replaces the scattered useEffects on individual pages that were
// fighting each other.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUniverseStore } from "@/lib/store";

export function NavigationController() {
  const router = useRouter();
  const pathname = usePathname();
  const prevZoomRef = useRef<string | null>(null);

  const zoomLevel = useUniverseStore((s) => s.zoomLevel);
  const selectedGalaxyId = useUniverseStore((s) => s.selectedGalaxyId);
  const selectedSystemId = useUniverseStore((s) => s.selectedSystemId);
  const selectedPlanetId = useUniverseStore((s) => s.selectedPlanetId);

  // React to store-driven navigation (from Canvas clicks or zoomOut)
  useEffect(() => {
    // Skip initial render
    if (prevZoomRef.current === null) {
      prevZoomRef.current = zoomLevel;
      return;
    }

    // Only navigate if zoom level actually changed
    if (prevZoomRef.current === zoomLevel) return;
    prevZoomRef.current = zoomLevel;

    const delay = 500; // let particles start morphing before route change

    const timeout = setTimeout(() => {
      if (zoomLevel === "landing") {
        if (pathname !== "/") router.push("/");
      } else if (zoomLevel === "universe") {
        if (pathname !== "/explore") router.push("/explore");
      } else if (zoomLevel === "galaxy" && selectedGalaxyId) {
        const target = `/explore/${selectedGalaxyId}`;
        if (pathname !== target) router.push(target);
      } else if (zoomLevel === "system" && selectedGalaxyId && selectedSystemId) {
        const target = `/explore/${selectedGalaxyId}/${selectedSystemId}`;
        if (pathname !== target) router.push(target);
      } else if (zoomLevel === "planet" && selectedGalaxyId && selectedSystemId && selectedPlanetId) {
        const target = `/explore/${selectedGalaxyId}/${selectedSystemId}/${selectedPlanetId}`;
        if (pathname !== target) router.push(target);
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [zoomLevel, selectedGalaxyId, selectedSystemId, selectedPlanetId, pathname, router]);

  // Sync store FROM URL when user navigates directly (e.g. browser back/forward, direct URL)
  useEffect(() => {
    const store = useUniverseStore.getState();
    if (!store.initialized) return;

    if (pathname === "/") {
      if (store.zoomLevel !== "landing") {
        store.setZoomLevel("landing");
      }
    } else if (pathname === "/explore") {
      if (store.zoomLevel !== "universe") {
        store.setZoomLevel("universe");
      }
    } else {
      // Parse /explore/[galaxyId] or /explore/[galaxyId]/[systemId]
      const parts = pathname.split("/").filter(Boolean);
      if (parts[0] === "explore" && parts[1]) {
        const gId = parts[1];
        if (store.selectedGalaxyId !== gId) {
          store.selectGalaxy(gId);
        }
        if (parts[2]) {
          const sId = parts[2];
          if (store.selectedSystemId !== sId) {
            setTimeout(() => store.selectSystem(sId), 50);
          }
          if (parts[3]) {
            const pId = parts[3];
            if (store.selectedPlanetId !== pId) {
              setTimeout(() => store.selectPlanet(pId), 100);
            }
          }
        } else if (store.zoomLevel !== "galaxy") {
          store.selectGalaxy(gId);
        }
      }
    }
  }, [pathname]);

  return null;
}
