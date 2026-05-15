"use client";

// ---------------------------------------------------------------------------
// 13.8 — Audio Controller
//
// Initializes ambient audio on first user interaction.
// Updates drone parameters when zoom level changes.
// Provides mute toggle button.
// ---------------------------------------------------------------------------

import { useEffect, useState, useRef } from "react";
import { useUniverseStore } from "@/lib/store";
import { initAudio, setZoomAudio, toggleMute, isMuted } from "@/lib/ambient-sound";

export function AudioController() {
  const zoomLevel = useUniverseStore((s) => s.zoomLevel);
  const [muted, setMuted] = useState(true);
  const audioStarted = useRef(false);

  // Start audio on first interaction (browser policy requires user gesture)
  useEffect(() => {
    const startAudio = async () => {
      if (audioStarted.current) return;
      audioStarted.current = true;
      await initAudio();
      setMuted(isMuted());
      setZoomAudio(zoomLevel);
    };

    window.addEventListener("click", startAudio, { once: true });
    window.addEventListener("keydown", startAudio, { once: true });

    return () => {
      window.removeEventListener("click", startAudio);
      window.removeEventListener("keydown", startAudio);
    };
  }, [zoomLevel]);

  // Update audio when zoom level changes
  useEffect(() => {
    if (audioStarted.current) {
      setZoomAudio(zoomLevel);
    }
  }, [zoomLevel]);

  const handleToggle = () => {
    const newMuted = toggleMute();
    setMuted(newMuted);
  };

  return (
    <button
      onClick={handleToggle}
      className="fixed bottom-6 right-6 z-20 pointer-events-auto cursor-pointer bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg w-9 h-9 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all"
      title={muted ? "Unmute ambient audio" : "Mute ambient audio"}
    >
      <span className="font-mono text-[10px] text-white/60">
        {muted ? "M" : "S"}
      </span>
    </button>
  );
}
