import * as THREE from "three";

// Shared mutable lens flare state. Components mutate these values directly;
// the LensFlareController reads them every frame. Avoids re-rendering the
// EffectComposer when the flare moves.

export const lensFlareState = {
  position: new THREE.Vector3(0, 0, 0),
  colorGain: new THREE.Color(2.4, 2.0, 1.6),
  glareSize: 0.32,
  haloScale: 0.65,
  flareSize: 0.005,
  active: false,
  opacity: 1.0,
};
