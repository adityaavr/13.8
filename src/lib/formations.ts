// ---------------------------------------------------------------------------
// 13.8 — Formation functions
//
// Pure math that computes target positions, colors, and scales for particles
// at each zoom level. The particle field lerps toward these targets.
// ---------------------------------------------------------------------------

import type { Universe, Galaxy, StarSystem } from "./types";

export interface FormationData {
  positions: Float32Array; // x,y,z interleaved (length = count * 3)
  colors: Float32Array; // r,g,b interleaved (length = count * 3)
  scales: Float32Array; // per-particle scale (length = count)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function gaussRand(): number {
  // Box-Muller transform — produces gaussian-distributed values
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Individual star colors — spectral diversity like real galaxies
// armFraction: 0 = core, 1 = outer arm. Core stars are old (warm),
// arm stars are young (blue) with occasional bright blue knots and red dwarfs.
function starColor(
  armFraction: number,
  galaxyPrimary: [number, number, number],
  galaxySecondary: [number, number, number],
): [number, number, number] {
  const roll = Math.random();

  if (armFraction < 0.2) {
    // Core region — old stellar population: yellow, orange, warm white
    if (roll < 0.4) return [rand(0.95, 1.0), rand(0.85, 0.95), rand(0.6, 0.75)];  // warm yellow
    if (roll < 0.7) return [rand(0.9, 1.0), rand(0.7, 0.82), rand(0.5, 0.6)];     // orange-gold
    if (roll < 0.9) return [rand(0.85, 0.95), rand(0.82, 0.92), rand(0.78, 0.88)]; // warm white
    return [rand(1.0, 1.0), rand(0.55, 0.65), rand(0.35, 0.45)];                   // K-type orange
  }

  if (armFraction < 0.5) {
    // Inner arms — mix of populations
    if (roll < 0.3) return [rand(0.7, 0.85), rand(0.8, 0.92), rand(0.95, 1.0)];    // blue-white (young)
    if (roll < 0.5) return [rand(0.9, 1.0), rand(0.88, 0.95), rand(0.8, 0.9)];     // white
    if (roll < 0.7) return [rand(0.95, 1.0), rand(0.82, 0.9), rand(0.6, 0.72)];    // yellow
    if (roll < 0.85) return [galaxySecondary[0] * rand(0.7, 1.0), galaxySecondary[1] * rand(0.7, 1.0), galaxySecondary[2] * rand(0.7, 1.0)]; // galaxy tint
    return [rand(1.0, 1.0), rand(0.5, 0.65), rand(0.35, 0.5)];                     // orange dwarf
  }

  // Outer arms — young star-forming regions: blue, blue-white, with bright knots
  if (roll < 0.35) return [rand(0.55, 0.75), rand(0.7, 0.85), rand(0.95, 1.0)];    // blue (O/B type)
  if (roll < 0.55) return [rand(0.75, 0.88), rand(0.85, 0.95), rand(0.95, 1.0)];   // blue-white (A type)
  if (roll < 0.7) return [rand(0.9, 1.0), rand(0.9, 1.0), rand(0.88, 0.98)];       // bright white
  if (roll < 0.82) return [galaxySecondary[0] * rand(0.6, 0.9), galaxySecondary[1] * rand(0.6, 0.9), galaxySecondary[2] * rand(0.6, 0.9)]; // galaxy color
  if (roll < 0.92) return [rand(0.95, 1.0), rand(0.75, 0.85), rand(0.55, 0.65)];   // F/G yellow-white
  return [rand(0.9, 1.0), rand(0.45, 0.55), rand(0.3, 0.4)];                       // red dwarf
}

// ---------------------------------------------------------------------------
// Landing formation — atmospheric nebula sky, subtle and indie
//
// Most particles are tiny, barely visible dust. A few soft nebula-colored
// clouds give hints of color. A handful of bright stars punctuate.
// The overall feel: looking up at a quiet sky, not a particle explosion.
// ---------------------------------------------------------------------------

// Subtle nebula palette clusters — positioned off-center for natural feel
const NEBULA_CLUSTERS = [
  { cx: -40, cy: 15, cz: -30, r: 35, color: [0.18, 0.08, 0.28] as [number, number, number] },  // deep violet
  { cx: 30, cy: -10, cz: -40, r: 30, color: [0.08, 0.15, 0.22] as [number, number, number] },   // dark teal
  { cx: 15, cy: 25, cz: -20, r: 25, color: [0.22, 0.10, 0.06] as [number, number, number] },    // faint amber
  { cx: -25, cy: -20, cz: -35, r: 28, color: [0.06, 0.10, 0.20] as [number, number, number] },  // navy blue
  { cx: 50, cy: 10, cz: -25, r: 20, color: [0.15, 0.05, 0.12] as [number, number, number] },    // muted magenta
];

export function landingFormation(count: number): FormationData {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);

  // Distribute particles across tiers:
  // ~85% faint dust (nearly invisible), ~12% nebula-tinted, ~3% bright stars
  const dustEnd = Math.floor(count * 0.85);
  const nebulaEnd = Math.floor(count * 0.97);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const phi = rand(0, Math.PI * 2);
    const cosTheta = rand(-1, 1);
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);

    if (i < dustEnd) {
      // --- Faint cosmic dust --- very small, very dim, spread wide
      const r = rand(30, 180);
      positions[i3] = r * sinTheta * Math.cos(phi);
      positions[i3 + 1] = r * cosTheta * 0.6; // flatten slightly
      positions[i3 + 2] = r * sinTheta * Math.sin(phi);

      // Nearly monochrome, very faint — just enough to add texture
      const dim = rand(0.03, 0.12);
      colors[i3] = dim;
      colors[i3 + 1] = dim;
      colors[i3 + 2] = dim + rand(0, 0.03); // very slight blue tint

      scales[i] = rand(0.01, 0.06);
    } else if (i < nebulaEnd) {
      // --- Nebula-tinted particles --- cluster near nebula centers
      const cluster = NEBULA_CLUSTERS[Math.floor(Math.random() * NEBULA_CLUSTERS.length)];
      const r = Math.abs(gaussRand()) * cluster.r;
      positions[i3] = cluster.cx + r * sinTheta * Math.cos(phi);
      positions[i3 + 1] = cluster.cy + r * cosTheta * 0.5;
      positions[i3 + 2] = cluster.cz + r * sinTheta * Math.sin(phi);

      // Tinted by cluster color, still subtle
      const intensity = rand(0.4, 0.8);
      const fade = Math.max(0, 1 - r / cluster.r); // brighter near center
      colors[i3] = cluster.color[0] * intensity * fade;
      colors[i3 + 1] = cluster.color[1] * intensity * fade;
      colors[i3 + 2] = cluster.color[2] * intensity * fade;

      scales[i] = rand(0.03, 0.1);
    } else {
      // --- Bright stars --- sparse, clean, punctuating
      const r = rand(40, 160);
      positions[i3] = r * sinTheta * Math.cos(phi);
      positions[i3 + 1] = r * cosTheta * 0.5;
      positions[i3 + 2] = r * sinTheta * Math.sin(phi);

      // Clean white with very slight color variation
      const warmth = Math.random();
      const brightness = rand(0.5, 0.9);
      colors[i3] = brightness * (0.9 + warmth * 0.1);
      colors[i3 + 1] = brightness * (0.9 + warmth * 0.05);
      colors[i3 + 2] = brightness;

      scales[i] = rand(0.08, 0.2);
    }
  }

  return { positions, colors, scales };
}

// ---------------------------------------------------------------------------
// Universe formation — particles cluster into galaxy shapes
// ---------------------------------------------------------------------------

export function universeFormation(
  universe: Universe,
  count: number,
): FormationData {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);

  const galaxies = universe.galaxies;
  const perGalaxy = Math.floor((count * 0.93) / galaxies.length);

  let idx = 0;

  for (const galaxy of galaxies) {
    const cx = galaxy.position.x;
    const cy = galaxy.position.y;
    const cz = galaxy.position.z;

    // Precompute tilt rotation matrix (rotate disk into 3D orientation)
    const cosTX = Math.cos(galaxy.tiltX), sinTX = Math.sin(galaxy.tiltX);
    const cosTZ = Math.cos(galaxy.tiltZ), sinTZ = Math.sin(galaxy.tiltZ);
    const cosR = Math.cos(galaxy.rotation), sinR = Math.sin(galaxy.rotation);

    // Place a point in the galaxy disk plane, then tilt it into world space
    const tiltPoint = (lx: number, ly: number, lz: number): [number, number, number] => {
      // Rotate around Y by galaxy.rotation (spin in plane)
      let x = lx * cosR - lz * sinR;
      let z = lx * sinR + lz * cosR;
      let y = ly;
      // Tilt around X (inclination)
      const y2 = y * cosTX - z * sinTX;
      const z2 = y * sinTX + z * cosTX;
      y = y2; z = z2;
      // Small roll around Z
      const x2 = x * cosTZ - y * sinTZ;
      const y3 = x * sinTZ + y * cosTZ;
      x = x2; y = y3;
      return [cx + x, cy + y, cz + z];
    };

    const R = 28; // galaxy radius in world units — big and immersive

    // Budget: 25% core, 75% disk/arms
    const coreCount = Math.floor(perGalaxy * 0.25);
    const diskCount = perGalaxy - coreCount;

    // --- Dense bulge/core ---
    for (let p = 0; p < coreCount && idx < count; p++) {
      const i3 = idx * 3;
      // Exponential profile — most particles packed tight at center
      const r = Math.abs(gaussRand()) * R * 0.15;
      const angle = rand(0, Math.PI * 2);
      const h = gaussRand() * R * 0.02 * (1 + r / (R * 0.15)); // slight puff

      const [wx, wy, wz] = tiltPoint(
        Math.cos(angle) * r,
        h,
        Math.sin(angle) * r,
      );
      positions[i3] = wx;
      positions[i3 + 1] = wy;
      positions[i3 + 2] = wz;

      // Core stars — bright, warm, vivid
      const brightness = rand(0.7, 1.2) * Math.max(0.4, 1 - r / (R * 0.25));
      const [cR, cG, cB] = starColor(0.1, galaxy.color, galaxy.secondaryColor);
      colors[i3] = cR * brightness;
      colors[i3 + 1] = cG * brightness;
      colors[i3 + 2] = cB * brightness;

      scales[idx] = rand(0.15, 0.35) * Math.max(0.4, 1 - r / (R * 0.25));
      idx++;
    }

    // --- Disk + arms ---
    for (let p = 0; p < diskCount && idx < count; p++) {
      const i3 = idx * 3;

      let lx: number, ly: number, lz: number;
      let armFraction = 0; // 0 = core, 1 = outer edge

      if (galaxy.type === "spiral") {
        const arms = galaxy.armCount || 2;
        const arm = Math.floor(Math.random() * arms);
        const armPhase = arm * ((Math.PI * 2) / arms);

        // Radial position — exponential disk profile (denser toward center)
        const t = Math.pow(Math.random(), 0.65);
        const r = t * R;
        armFraction = t;

        // Logarithmic spiral angle
        const pitch = galaxy.armTightness || 0.35;
        const spiralAngle = armPhase + (1 / Math.tan(pitch)) * Math.log(1 + r / (R * 0.1));

        // Arm width: narrow inner, wider outer + inter-arm scatter
        const isInterArm = Math.random() < 0.15;
        const baseWidth = (0.2 + t * 0.8) * R * 0.08;
        const width = isInterArm ? baseWidth * 3 : baseWidth;

        lx = Math.cos(spiralAngle) * r + gaussRand() * width;
        lz = Math.sin(spiralAngle) * r + gaussRand() * width;
        ly = gaussRand() * R * 0.008 * (1 + t * 2); // very thin disk, thicker at edge

      } else if (galaxy.type === "elliptical") {
        const r = Math.abs(gaussRand()) * R * 0.6;
        const phi = rand(0, Math.PI * 2);
        const cosT = rand(-1, 1);
        const sinT = Math.sqrt(1 - cosT * cosT);
        lx = r * sinT * Math.cos(phi) * 1.2;
        ly = r * cosT * 0.7;
        lz = r * sinT * Math.sin(phi);
        armFraction = Math.min(r / (R * 0.6), 1);

      } else {
        // Irregular
        const knot = Math.random() < 0.2;
        const r = Math.abs(gaussRand()) * R * 0.5;
        const phi = rand(0, Math.PI * 2);
        const cosT = rand(-1, 1);
        const sinT = Math.sqrt(1 - cosT * cosT);
        lx = r * sinT * Math.cos(phi) + (knot ? gaussRand() * R * 0.15 : 0);
        ly = r * cosT * 0.3;
        lz = r * sinT * Math.sin(phi) + (knot ? gaussRand() * R * 0.15 : 0);
        armFraction = Math.min(r / (R * 0.5), 1);
      }

      const [wx, wy, wz] = tiltPoint(lx, ly, lz);
      positions[i3] = wx;
      positions[i3 + 1] = wy;
      positions[i3 + 2] = wz;

      // Individual star colors — brighter, more vivid
      const t = armFraction;
      const brightness = Math.max(0.15, Math.exp(-t * 1.8) * 0.9 + 0.12);
      const [sR, sG, sB] = starColor(t, galaxy.color, galaxy.secondaryColor);

      colors[i3] = sR * brightness;
      colors[i3 + 1] = sG * brightness;
      colors[i3 + 2] = sB * brightness;

      // Particles scale with distance — bigger near core, still visible at edges
      scales[idx] = rand(0.06, 0.18) * Math.max(0.25, 1 - t * 0.4);
      idx++;
    }
  }

  // Ambient intergalactic medium — the space between galaxies should breathe
  // Mix of: faint nebula wisps, scattered stars, and subtle color clouds
  const ambientStart = idx;
  const ambientTotal = count - ambientStart;
  const nebulaWisps = Math.floor(ambientTotal * 0.35);
  const colorClouds = Math.floor(ambientTotal * 0.25);

  // Nebula wisps — elongated clusters that give directionality to the void
  const wispCount = 4 + Math.floor(Math.random() * 4);
  const wisps = Array.from({ length: wispCount }, () => ({
    x: rand(-80, 80),
    y: rand(-15, 15),
    z: rand(-80, 80),
    dx: rand(-1, 1), // direction of elongation
    dz: rand(-1, 1),
    length: rand(20, 50),
    width: rand(3, 8),
    color: [rand(0.15, 0.35), rand(0.12, 0.30), rand(0.20, 0.40)] as [number, number, number],
  }));

  for (let i = 0; i < nebulaWisps && idx < count; i++) {
    const i3 = idx * 3;
    const wisp = wisps[i % wisps.length];
    const along = gaussRand() * wisp.length * 0.4;
    const across = gaussRand() * wisp.width;
    const mag = Math.sqrt(wisp.dx * wisp.dx + wisp.dz * wisp.dz) || 1;

    positions[i3] = wisp.x + (wisp.dx / mag) * along + (-wisp.dz / mag) * across;
    positions[i3 + 1] = wisp.y + gaussRand() * 2;
    positions[i3 + 2] = wisp.z + (wisp.dz / mag) * along + (wisp.dx / mag) * across;

    const fade = Math.max(0.15, 1 - Math.abs(along) / (wisp.length * 0.5));
    colors[i3] = wisp.color[0] * fade;
    colors[i3 + 1] = wisp.color[1] * fade;
    colors[i3 + 2] = wisp.color[2] * fade;

    scales[idx] = rand(0.03, 0.09);
    idx++;
  }

  // Color clouds — soft blobs of color between galaxies, like distant nebulae
  const cloudCenters = galaxies.map((g, gi) => {
    const next = galaxies[(gi + 1) % galaxies.length];
    return {
      x: (g.position.x + next.position.x) * 0.5 + gaussRand() * 15,
      y: (g.position.y + next.position.y) * 0.5 + gaussRand() * 5,
      z: (g.position.z + next.position.z) * 0.5 + gaussRand() * 15,
      color: [
        (g.color[0] + next.color[0]) * 0.25,
        (g.color[1] + next.color[1]) * 0.25,
        (g.color[2] + next.color[2]) * 0.25,
      ] as [number, number, number],
    };
  });

  for (let i = 0; i < colorClouds && idx < count; i++) {
    const i3 = idx * 3;
    const cloud = cloudCenters[i % cloudCenters.length];
    const r = Math.abs(gaussRand()) * 12;
    const phi = rand(0, Math.PI * 2);
    const cosT = rand(-1, 1);
    const sinT = Math.sqrt(1 - cosT * cosT);

    positions[i3] = cloud.x + r * sinT * Math.cos(phi);
    positions[i3 + 1] = cloud.y + r * cosT * 0.3;
    positions[i3 + 2] = cloud.z + r * sinT * Math.sin(phi);

    const fade = Math.max(0.1, 1 - r / 15);
    colors[i3] = cloud.color[0] * fade + rand(-0.02, 0.02);
    colors[i3 + 1] = cloud.color[1] * fade + rand(-0.02, 0.02);
    colors[i3 + 2] = cloud.color[2] * fade + rand(-0.02, 0.02);

    scales[idx] = rand(0.02, 0.07);
    idx++;
  }

  // Scattered faint stars — fill the remaining void
  for (; idx < count; idx++) {
    const i3 = idx * 3;
    const phi = rand(0, Math.PI * 2);
    const cosT = rand(-1, 1);
    const sinT = Math.sqrt(1 - cosT * cosT);
    const r = rand(15, 140);

    positions[i3] = r * sinT * Math.cos(phi);
    positions[i3 + 1] = r * cosT * 0.25;
    positions[i3 + 2] = r * sinT * Math.sin(phi);

    // Faint warm tint — not pure grey
    const dim = rand(0.05, 0.14);
    const tint = Math.random();
    colors[i3] = dim + (tint < 0.3 ? rand(0, 0.04) : 0);
    colors[i3 + 1] = dim;
    colors[i3 + 2] = dim + (tint > 0.7 ? rand(0, 0.04) : 0);

    scales[idx] = rand(0.01, 0.05);
  }

  return { positions, colors, scales };
}

// ---------------------------------------------------------------------------
// Galaxy formation — zoomed into one galaxy, showing star systems
// ---------------------------------------------------------------------------

export function galaxyFormation(
  galaxy: Galaxy,
  count: number,
): FormationData {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);

  const systems = galaxy.systems;
  // Reserve bright particles for system positions
  const systemParticles = Math.min(systems.length * 8, Math.floor(count * 0.1));
  const armParticles = count - systemParticles;

  let idx = 0;

  // System markers — bright concentrated points like NMS star map
  // First particle is the bright core, rest form a tight glow halo
  for (const system of systems) {
    const cx = system.position.x;
    const cy = system.position.y;
    const cz = system.position.z;
    const particlesForThis = Math.floor(systemParticles / systems.length);
    const [sr, sg, sb] = system.starColor;

    for (let p = 0; p < particlesForThis && idx < count; p++) {
      const i3 = idx * 3;

      if (p === 0) {
        // Core — exact position, bright, large
        positions[i3] = cx;
        positions[i3 + 1] = cy;
        positions[i3 + 2] = cz;
        // Boosted brightness (>1.0 triggers bloom glow)
        colors[i3] = sr * 1.4;
        colors[i3 + 1] = sg * 1.4;
        colors[i3 + 2] = sb * 1.4;
        scales[idx] = rand(0.4, 0.6);
      } else {
        // Halo — tight cluster for glow effect
        const spread = 0.2;
        positions[i3] = cx + gaussRand() * spread;
        positions[i3 + 1] = cy + gaussRand() * spread * 0.5;
        positions[i3 + 2] = cz + gaussRand() * spread;
        const fade = rand(0.4, 0.8);
        colors[i3] = sr * fade;
        colors[i3 + 1] = sg * fade;
        colors[i3 + 2] = sb * fade;
        scales[idx] = rand(0.08, 0.2);
      }
      idx++;
    }
  }

  // Galaxy structure — arms, dust, ambient gas
  for (; idx < count; idx++) {
    const i3 = idx * 3;

    if (galaxy.type === "spiral") {
      const arm = Math.floor(Math.random() * 2);
      const armOffset = arm * Math.PI;
      const t = Math.random() * 6;
      const spread = 0.8 + t * 0.3;
      const angle = galaxy.rotation + armOffset + t * 0.7;
      const r = t * 3.5 + gaussRand() * spread;

      positions[i3] = Math.cos(angle) * r + gaussRand() * spread * 0.3;
      positions[i3 + 1] = gaussRand() * 0.4;
      positions[i3 + 2] = Math.sin(angle) * r + gaussRand() * spread * 0.3;
    } else if (galaxy.type === "elliptical") {
      positions[i3] = gaussRand() * 12;
      positions[i3 + 1] = gaussRand() * 5;
      positions[i3 + 2] = gaussRand() * 10;
    } else {
      const r = rand(0, 14);
      const phi = rand(0, Math.PI * 2);
      const cosT = rand(-1, 1);
      const sinT = Math.sqrt(1 - cosT * cosT);
      positions[i3] = r * sinT * Math.cos(phi) + gaussRand() * 3;
      positions[i3 + 1] = r * cosT * 0.4 + gaussRand();
      positions[i3 + 2] = r * sinT * Math.sin(phi) + gaussRand() * 3;
    }

    // Individual star colors for the galactic structure
    const dx = positions[i3], dz = positions[i3 + 2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    const maxR = galaxy.type === "spiral" ? 22 : 14;
    const frac = Math.min(dist / maxR, 1);
    const dim = rand(0.25, 0.6);
    const [sR, sG, sB] = starColor(frac, galaxy.color, galaxy.secondaryColor);
    colors[i3] = sR * dim;
    colors[i3 + 1] = sG * dim;
    colors[i3 + 2] = sB * dim;

    scales[idx] = rand(0.03, 0.12);
  }

  return { positions, colors, scales };
}

// ---------------------------------------------------------------------------
// System formation — MINIMAL particles. The actual star, planets, orbits,
// and labels are rendered by StarSystemView with proper 3D meshes.
// Particles here just provide sparse ambient starfield backdrop.
// ---------------------------------------------------------------------------

export function systemFormation(
  system: StarSystem,
  count: number,
): FormationData {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);

  const [sr, sg, sb] = system.starColor;

  for (let idx = 0; idx < count; idx++) {
    const i3 = idx * 3;
    const phi = rand(0, Math.PI * 2);
    const cosT = rand(-1, 1);
    const sinT = Math.sqrt(1 - cosT * cosT);

    // All particles are distant background stars — clean void around the system
    const r = rand(30, 200);

    positions[i3] = r * sinT * Math.cos(phi);
    positions[i3 + 1] = r * cosT * 0.5;
    positions[i3 + 2] = r * sinT * Math.sin(phi);

    // Faint background stars — slight warm tint from the system's star
    const dim = rand(0.03, 0.12);
    const starTint = rand(0, 0.3); // some stars pick up star color
    colors[i3] = dim + sr * starTint * 0.05;
    colors[i3 + 1] = dim + sg * starTint * 0.05;
    colors[i3 + 2] = dim + sb * starTint * 0.05 + rand(0, 0.02);

    scales[idx] = rand(0.01, 0.06);
  }

  return { positions, colors, scales };
}
