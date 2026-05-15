// ---------------------------------------------------------------------------
// 13.8 — Ambient Sound Engine
//
// Procedural audio that shifts with zoom depth. Uses Tone.js.
//
// Each zoom level crossfades between different drone layers:
// - Landing:  very quiet deep sub-bass hum, barely audible
// - Universe: wider drone with shimmer harmonics, vast emptiness
// - Galaxy:   warmer mid-range tone, subtle LFO movement
// - System:   closer feel, crystalline high partials
// - Planet:   atmospheric rumble, wind-like filtered noise
//
// Everything is procedural — no audio files needed.
// User can mute/unmute. Audio only starts after first interaction
// (browser autoplay policy).
// ---------------------------------------------------------------------------

import * as Tone from "tone";
import type { ZoomLevel } from "./types";

let initialized = false;
let muted = false;

// Layers
let subDrone: Tone.Synth | null = null;
let padSynth: Tone.PolySynth | null = null;
let shimmer: Tone.Synth | null = null;
let noiseLayer: Tone.Noise | null = null;
let masterGain: Tone.Gain | null = null;
let noiseGain: Tone.Gain | null = null;
let noiseFilter: Tone.Filter | null = null;

// Per-layer gains for crossfading
let subGain: Tone.Gain | null = null;
let padGain: Tone.Gain | null = null;
let shimmerGain: Tone.Gain | null = null;

// Target volumes per layer (set by zoom level)
const targets = {
  sub: 0,
  pad: 0,
  shimmer: 0,
  noise: 0,
  noiseFreq: 200,
  master: 0.35,
};

export async function initAudio() {
  if (initialized) return;
  initialized = true;

  await Tone.start();

  masterGain = new Tone.Gain(0.35).toDestination();

  // Sub drone — deep bass oscillator
  subGain = new Tone.Gain(0).connect(masterGain);
  subDrone = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 4, decay: 0, sustain: 1, release: 4 },
  }).connect(subGain);
  subDrone.triggerAttack("C1");

  // Pad synth — warm evolving chord
  padGain = new Tone.Gain(0).connect(masterGain);
  padSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 6, decay: 2, sustain: 0.6, release: 6 },
    volume: -12,
  }).connect(padGain);
  padSynth.triggerAttack(["C2", "G2", "E3"]);

  // Shimmer — high harmonic
  shimmerGain = new Tone.Gain(0).connect(masterGain);
  shimmer = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 5, decay: 1, sustain: 0.4, release: 5 },
    volume: -18,
  }).connect(shimmerGain);
  shimmer.triggerAttack("C5");

  // Noise — filtered for wind/atmosphere
  noiseGain = new Tone.Gain(0).connect(masterGain);
  noiseFilter = new Tone.Filter(200, "lowpass", -24).connect(noiseGain);
  noiseLayer = new Tone.Noise("pink").connect(noiseFilter);
  noiseLayer.volume.value = -20;
  noiseLayer.start();

  // Start crossfade loop
  crossfadeLoop();
}

function crossfadeLoop() {
  const rate = 0.015; // smooth crossfade speed

  function tick() {
    if (muted) {
      if (masterGain) masterGain.gain.value = 0;
    } else {
      if (masterGain) {
        masterGain.gain.value += (targets.master - masterGain.gain.value) * rate;
      }
    }

    if (subGain) subGain.gain.value += (targets.sub - subGain.gain.value) * rate;
    if (padGain) padGain.gain.value += (targets.pad - padGain.gain.value) * rate;
    if (shimmerGain) shimmerGain.gain.value += (targets.shimmer - shimmerGain.gain.value) * rate;
    if (noiseGain) noiseGain.gain.value += (targets.noise - noiseGain.gain.value) * rate;
    if (noiseFilter) {
      const currentFreq = Number(noiseFilter.frequency.value);
      noiseFilter.frequency.value = currentFreq + (targets.noiseFreq - currentFreq) * rate;
    }

    requestAnimationFrame(tick);
  }
  tick();
}

export function setZoomAudio(level: ZoomLevel) {
  switch (level) {
    case "landing":
      targets.sub = 0.15;
      targets.pad = 0;
      targets.shimmer = 0;
      targets.noise = 0;
      targets.noiseFreq = 100;
      break;
    case "universe":
      targets.sub = 0.25;
      targets.pad = 0.3;
      targets.shimmer = 0.15;
      targets.noise = 0.05;
      targets.noiseFreq = 150;
      break;
    case "galaxy":
      targets.sub = 0.2;
      targets.pad = 0.4;
      targets.shimmer = 0.2;
      targets.noise = 0.08;
      targets.noiseFreq = 250;
      break;
    case "system":
      targets.sub = 0.12;
      targets.pad = 0.25;
      targets.shimmer = 0.35;
      targets.noise = 0.06;
      targets.noiseFreq = 400;
      break;
    case "planet":
      targets.sub = 0.1;
      targets.pad = 0.15;
      targets.shimmer = 0.1;
      targets.noise = 0.25;
      targets.noiseFreq = 600;
      break;
  }
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

export function isMuted(): boolean {
  return muted;
}
