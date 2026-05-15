"use client";

import { useUniverseStore } from "@/lib/store";

export function CameraControlsUI() {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);
  const resetCamera = useUniverseStore((s) => s.resetCamera);

  if (zoomLevel === "landing") return null;

  return (
    <div className="fixed right-6 bottom-20 z-20 select-none pointer-events-auto flex flex-col items-end gap-2">
      {/* Reset View */}
      <button
        onClick={resetCamera}
        className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-3.5 py-2 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer"
      >
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/70">
          Reset View
        </span>
      </button>

      {/* Controls */}
      <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-3.5 py-3">
        <p className="font-mono text-[8px] tracking-[0.3em] uppercase text-white/40 mb-2">
          Controls
        </p>
        <div className="flex flex-col gap-1.5">
          <ControlHint keys="WASD" label="Move" />
          <ControlHint keys="O / P" label="Zoom" />
          <ControlHint keys="Drag" label="Orbit" />
          <ControlHint keys="Scroll" label="Zoom" />
          <ControlHint keys="R" label="Reset" />
          <ControlHint keys="Esc" label="Back" />
        </div>
      </div>
    </div>
  );
}

function ControlHint({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <kbd className="font-mono text-[9px] text-white/60 bg-white/[0.08] rounded px-1.5 py-0.5 min-w-[40px] text-center">
        {keys}
      </kbd>
      <span className="font-mono text-[9px] text-white/45">{label}</span>
    </div>
  );
}
