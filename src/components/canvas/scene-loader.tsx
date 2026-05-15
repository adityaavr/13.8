"use client";

// ---------------------------------------------------------------------------
// 13.8 — Scene Loader
//
// Client-side wrapper that dynamically imports the 3D scene with ssr: false.
// This prevents Three.js from being evaluated during server-side rendering.
// ---------------------------------------------------------------------------

import dynamic from "next/dynamic";

const Scene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => (
    <div
      className="fixed inset-0 -z-10"
      style={{ background: "#020208" }}
    />
  ),
});

export function SceneLoader() {
  return <Scene />;
}
