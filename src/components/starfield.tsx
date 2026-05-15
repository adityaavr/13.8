"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * No Man's Sky–inspired ambient space background.
 *
 * Visual reference: NMS warp screens, space vistas, and planetary skies —
 * bold saturated nebula bands, smooth painterly gradients, vibrant color
 * palettes that shift per "system". Fewer stars but dreamier. Less
 * photorealism, more illustrated indie feel.
 *
 * Each page load picks a random color palette (like entering a new star
 * system in NMS), then renders sweeping nebula bands and clean stars.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  color: [number, number, number];
  hasGlow: boolean;
}

interface CloudLayer {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
  color: [number, number, number];
  opacity: number;
  stops: { at: number; opacity: number }[];
}

// ---------------------------------------------------------------------------
// NMS-style color palettes — each is a "star system" feel
// ---------------------------------------------------------------------------

interface SystemPalette {
  name: string;
  // Primary sweeping nebula colors (2-3 dominant tones)
  primary: [number, number, number][];
  // Secondary accent colors (smaller wisps, highlights)
  accent: [number, number, number][];
  // Star tint — NMS stars often lean toward the palette
  starTint: [number, number, number][];
  // Base ambient fill — subtle overall wash
  ambient: [number, number, number];
}

const PALETTES: SystemPalette[] = [
  {
    // Deep purple & teal — classic NMS warp feel
    name: "void-nebula",
    primary: [
      [90, 30, 160],   // rich purple
      [60, 20, 130],   // deep violet
      [30, 120, 140],  // ocean teal
      [20, 90, 120],   // dark teal
    ],
    accent: [
      [160, 40, 180],  // magenta bloom
      [40, 180, 170],  // bright cyan
      [120, 50, 200],  // electric violet
    ],
    starTint: [
      [200, 190, 255], // lavender
      [180, 230, 255], // ice blue
      [255, 255, 255], // white
      [220, 200, 255], // soft violet
    ],
    ambient: [20, 10, 40],
  },
  {
    // Warm orange & magenta — NMS sunset system
    name: "ember-drift",
    primary: [
      [180, 50, 30],   // burnt orange
      [200, 70, 40],   // deep amber
      [150, 30, 70],   // crimson
      [170, 40, 100],  // dark magenta
    ],
    accent: [
      [255, 120, 50],  // bright orange
      [220, 50, 120],  // hot pink
      [255, 160, 60],  // golden
    ],
    starTint: [
      [255, 220, 180], // warm white
      [255, 200, 160], // peach
      [255, 255, 240], // cream
      [255, 180, 140], // salmon
    ],
    ambient: [35, 12, 15],
  },
  {
    // Teal & pink — NMS alien atmosphere
    name: "chromatic-sea",
    primary: [
      [20, 100, 130],  // deep teal
      [30, 130, 150],  // medium teal
      [140, 40, 100],  // muted magenta
      [100, 30, 80],   // plum
    ],
    accent: [
      [50, 200, 180],  // bright aqua
      [200, 60, 140],  // neon pink
      [30, 160, 160],  // vivid teal
    ],
    starTint: [
      [180, 255, 240], // mint
      [255, 200, 220], // pink white
      [220, 255, 255], // cyan white
      [255, 255, 255], // pure white
    ],
    ambient: [10, 25, 30],
  },
  {
    // Blue & gold — NMS discovery moment
    name: "atlas-signal",
    primary: [
      [15, 40, 120],   // deep navy
      [25, 60, 150],   // royal blue
      [30, 50, 100],   // dark steel
      [160, 120, 30],  // dark gold
    ],
    accent: [
      [50, 100, 220],  // bright blue
      [220, 180, 50],  // amber gold
      [40, 80, 180],   // cobalt
    ],
    starTint: [
      [200, 210, 255], // blue white
      [255, 240, 200], // warm white
      [255, 255, 255], // white
      [180, 200, 255], // soft blue
    ],
    ambient: [8, 12, 30],
  },
  {
    // Green & violet — NMS toxic/lush planet sky
    name: "emerald-void",
    primary: [
      [20, 100, 60],   // deep emerald
      [30, 80, 50],    // forest
      [60, 30, 100],   // dark violet
      [80, 40, 120],   // medium purple
    ],
    accent: [
      [40, 200, 100],  // bright green
      [140, 60, 200],  // vivid violet
      [60, 180, 120],  // jade
    ],
    starTint: [
      [200, 255, 220], // green tint
      [220, 200, 255], // violet tint
      [255, 255, 255], // white
      [180, 255, 200], // mint
    ],
    ambient: [8, 20, 15],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// Smooth noise for large-scale gradients (NMS uses smooth blends, not grain)
function makeSmoothNoise(
  w: number,
  h: number,
  scale: number,
  color: [number, number, number],
  opacity: number,
): ImageData {
  const data = new ImageData(w, h);
  const d = data.data;

  const gw = Math.ceil(w / scale) + 2;
  const gh = Math.ceil(h / scale) + 2;
  const grid: number[] = [];
  for (let i = 0; i < gw * gh; i++) grid.push(Math.random());

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x / scale;
      const gy = y / scale;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const fx = gx - ix;
      const fy = gy - iy;

      // Smoothstep for painterly blending
      const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10); // quintic smoothstep
      const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

      const i00 = iy * gw + ix;
      const v00 = grid[i00] ?? 0;
      const v10 = grid[i00 + 1] ?? 0;
      const v01 = grid[i00 + gw] ?? 0;
      const v11 = grid[i00 + gw + 1] ?? 0;

      const v =
        v00 * (1 - sx) * (1 - sy) +
        v10 * sx * (1 - sy) +
        v01 * (1 - sx) * sy +
        v11 * sx * sy;

      const idx = (y * w + x) * 4;
      d[idx] = Math.floor(color[0] * v);
      d[idx + 1] = Math.floor(color[1] * v);
      d[idx + 2] = Math.floor(color[2] * v);
      d[idx + 3] = Math.floor(v * opacity * 255);
    }
  }

  return data;
}

// ---------------------------------------------------------------------------
// NMS-style cloud generation — big sweeping bands
// ---------------------------------------------------------------------------

function createNebulaClouds(
  w: number,
  h: number,
  palette: SystemPalette,
): CloudLayer[] {
  const layers: CloudLayer[] = [];
  const cx = w * 0.5;
  const cy = h * 0.5;

  // ---- Dominant sweep — the big band that defines the system ----
  // NMS often has one massive nebula arc across the sky
  const sweepAngle = rand(-0.4, 0.4);
  const sweepColor = pick(palette.primary);
  layers.push({
    x: cx + rand(-w * 0.1, w * 0.1),
    y: cy + rand(-h * 0.15, h * 0.15),
    rx: w * rand(0.6, 0.9),
    ry: h * rand(0.2, 0.35),
    rotation: sweepAngle,
    color: sweepColor,
    opacity: rand(0.2, 0.32),
    stops: [
      { at: 0, opacity: 1 },
      { at: 0.1, opacity: 0.9 },
      { at: 0.3, opacity: 0.6 },
      { at: 0.55, opacity: 0.3 },
      { at: 0.8, opacity: 0.08 },
      { at: 1, opacity: 0 },
    ],
  });

  // ---- Second major sweep — contrasting color, offset ----
  const sweep2Color = pick(
    palette.primary.filter((c) => c !== sweepColor),
  );
  layers.push({
    x: cx + rand(-w * 0.15, w * 0.15),
    y: cy + rand(-h * 0.2, h * 0.2),
    rx: w * rand(0.5, 0.75),
    ry: h * rand(0.15, 0.28),
    rotation: sweepAngle + rand(0.3, 0.8) * (Math.random() < 0.5 ? 1 : -1),
    color: sweep2Color,
    opacity: rand(0.15, 0.25),
    stops: [
      { at: 0, opacity: 1 },
      { at: 0.15, opacity: 0.8 },
      { at: 0.4, opacity: 0.4 },
      { at: 0.7, opacity: 0.1 },
      { at: 1, opacity: 0 },
    ],
  });

  // ---- Bright core bloom — where the two sweeps converge ----
  const coreColor = lerpColor(sweepColor, sweep2Color, rand(0.3, 0.7));
  layers.push({
    x: cx + rand(-w * 0.08, w * 0.08),
    y: cy + rand(-h * 0.08, h * 0.08),
    rx: w * rand(0.12, 0.22),
    ry: h * rand(0.1, 0.18),
    rotation: rand(-0.5, 0.5),
    color: coreColor,
    opacity: rand(0.12, 0.2),
    stops: [
      { at: 0, opacity: 1 },
      { at: 0.2, opacity: 0.7 },
      { at: 0.5, opacity: 0.3 },
      { at: 0.8, opacity: 0.08 },
      { at: 1, opacity: 0 },
    ],
  });

  // ---- Accent blooms — vivid pops of color scattered around ----
  const accentCount = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < accentCount; i++) {
    const angle = rand(0, Math.PI * 2);
    const dist = rand(h * 0.1, Math.min(w, h) * 0.45);
    layers.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist * 0.6,
      rx: rand(w * 0.08, w * 0.2),
      ry: rand(h * 0.06, h * 0.14),
      rotation: rand(0, Math.PI),
      color: pick(palette.accent),
      opacity: rand(0.08, 0.16),
      stops: [
        { at: 0, opacity: 1 },
        { at: 0.2, opacity: 0.75 },
        { at: 0.5, opacity: 0.3 },
        { at: 0.8, opacity: 0.06 },
        { at: 1, opacity: 0 },
      ],
    });
  }

  // ---- Broad fill clouds — prevent hard black gaps ----
  // NMS skies always feel full, not sparse
  const fillCount = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < fillCount; i++) {
    layers.push({
      x: rand(w * 0.05, w * 0.95),
      y: rand(h * 0.05, h * 0.95),
      rx: rand(w * 0.2, w * 0.45),
      ry: rand(h * 0.12, h * 0.25),
      rotation: rand(0, Math.PI),
      color: pick(palette.primary),
      opacity: rand(0.05, 0.12),
      stops: [
        { at: 0, opacity: 1 },
        { at: 0.3, opacity: 0.5 },
        { at: 0.65, opacity: 0.15 },
        { at: 1, opacity: 0 },
      ],
    });
  }

  // ---- Edge washes — NMS never has bare black edges ----
  const edges: Array<{ x: number; y: number }> = [
    { x: rand(w * 0.1, w * 0.9), y: rand(-h * 0.1, h * 0.08) },
    { x: rand(w * 0.1, w * 0.9), y: rand(h * 0.92, h * 1.1) },
    { x: rand(-w * 0.1, w * 0.08), y: rand(h * 0.1, h * 0.9) },
    { x: rand(w * 0.92, w * 1.1), y: rand(h * 0.1, h * 0.9) },
  ];
  for (const pos of edges) {
    layers.push({
      x: pos.x,
      y: pos.y,
      rx: rand(w * 0.2, w * 0.4),
      ry: rand(h * 0.15, h * 0.3),
      rotation: rand(0, Math.PI),
      color: pick([...palette.primary, ...palette.accent]),
      opacity: rand(0.04, 0.1),
      stops: [
        { at: 0, opacity: 1 },
        { at: 0.3, opacity: 0.5 },
        { at: 0.7, opacity: 0.1 },
        { at: 1, opacity: 0 },
      ],
    });
  }

  // ---- Wispy tendrils — elongated streaks for movement ----
  const wisps = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < wisps; i++) {
    const angle = rand(0, Math.PI * 2);
    const dist = rand(h * 0.05, Math.min(w, h) * 0.4);
    layers.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist * 0.5,
      rx: rand(w * 0.15, w * 0.4),
      ry: rand(h * 0.015, h * 0.04),
      rotation: angle + rand(-0.6, 0.6),
      color: pick(palette.primary),
      opacity: rand(0.06, 0.14),
      stops: [
        { at: 0, opacity: 1 },
        { at: 0.2, opacity: 0.7 },
        { at: 0.5, opacity: 0.25 },
        { at: 0.85, opacity: 0.04 },
        { at: 1, opacity: 0 },
      ],
    });
  }

  return layers;
}

// ---------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------

function paintClouds(ctx: CanvasRenderingContext2D, clouds: CloudLayer[]) {
  for (const c of clouds) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rotation);

    const maxR = Math.max(c.rx, c.ry);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, maxR);
    for (const stop of c.stops) {
      grad.addColorStop(
        stop.at,
        `rgba(${c.color[0]}, ${c.color[1]}, ${c.color[2]}, ${c.opacity * stop.opacity})`,
      );
    }

    ctx.scale(1, c.ry / c.rx);
    ctx.beginPath();
    ctx.arc(0, 0, c.rx, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.restore();
  }
}

// Paint ambient base wash — NMS always has a slight color to the "black"
function paintAmbientWash(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ambient: [number, number, number],
) {
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
  grad.addColorStop(0, `rgba(${ambient[0]}, ${ambient[1]}, ${ambient[2]}, 0.4)`);
  grad.addColorStop(0.5, `rgba(${ambient[0]}, ${ambient[1]}, ${ambient[2]}, 0.2)`);
  grad.addColorStop(1, `rgba(${ambient[0]}, ${ambient[1]}, ${ambient[2]}, 0.06)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------------------
// Star generation — NMS style: cleaner, dreamier, fewer but more distinct
// ---------------------------------------------------------------------------

function createStars(
  w: number,
  h: number,
  palette: SystemPalette,
): Star[] {
  // Fewer stars than JWST — NMS space feels less dense, more curated
  const count = Math.floor((w * h) / 5000);
  const stars: Star[] = [];

  for (let i = 0; i < count; i++) {
    const isBright = Math.random() < 0.04;
    const isMedium = !isBright && Math.random() < 0.12;

    let r: number;
    let opacity: number;
    let hasGlow: boolean;

    if (isBright) {
      r = rand(1.5, 2.8);
      opacity = rand(0.7, 1.0);
      hasGlow = true;
    } else if (isMedium) {
      r = rand(0.8, 1.4);
      opacity = rand(0.4, 0.7);
      hasGlow = Math.random() < 0.4;
    } else {
      r = rand(0.2, 0.7);
      opacity = rand(0.1, 0.45);
      hasGlow = false;
    }

    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r,
      opacity,
      twinkleSpeed: rand(0.0003, 0.0015),
      twinkleOffset: rand(0, Math.PI * 2),
      color: pick(palette.starTint),
      hasGlow,
    });
  }

  return stars;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const nebulaBufferRef = useRef<HTMLCanvasElement | null>(null);
  const driftRef = useRef({ x: 0, y: 0 });

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const bw = w * dpr;
    const bh = h * dpr;

    // Pick a random system palette — like warping to a new NMS system
    const palette = pick(PALETTES);

    starsRef.current = createStars(bw, bh, palette);

    // Build nebula buffer
    const buffer = document.createElement("canvas");
    buffer.width = bw;
    buffer.height = bh;
    const bCtx = buffer.getContext("2d");
    if (!bCtx) return;

    // Layer 1: ambient wash — NMS never has pure black
    paintAmbientWash(bCtx, bw, bh, palette.ambient);

    // Layer 2: smooth color noise — subtle large-scale variation
    // Much smoother than JWST grain — NMS is painterly
    const noiseColor = lerpColor(palette.primary[0], palette.ambient, 0.5);
    const noise = makeSmoothNoise(bw, bh, 80 * dpr, noiseColor, 0.06);
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = bw;
    tmpCanvas.height = bh;
    const tmpCtx = tmpCanvas.getContext("2d");
    if (tmpCtx) {
      tmpCtx.putImageData(noise, 0, 0);
      bCtx.globalCompositeOperation = "screen";
      bCtx.drawImage(tmpCanvas, 0, 0);
      bCtx.globalCompositeOperation = "source-over";
    }

    // Layer 3: nebula clouds — the main event
    const clouds = createNebulaClouds(bw, bh, palette);
    paintClouds(bCtx, clouds);

    // Layer 4: light screen blend for added glow in bright areas
    if (tmpCtx) {
      const glowNoise = makeSmoothNoise(
        bw,
        bh,
        120 * dpr,
        pick(palette.accent),
        0.04,
      );
      tmpCtx.clearRect(0, 0, bw, bh);
      tmpCtx.putImageData(glowNoise, 0, 0);
      bCtx.globalCompositeOperation = "screen";
      bCtx.drawImage(tmpCanvas, 0, 0);
      bCtx.globalCompositeOperation = "source-over";
    }

    nebulaBufferRef.current = buffer;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    setup();

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      const time = performance.now();

      // Slow ambient drift — slightly more movement than before for that
      // NMS "floating through space" feel
      driftRef.current.x = Math.sin(time * 0.00003) * 8;
      driftRef.current.y = Math.cos(time * 0.00002) * 6;

      // Clear to near-black with a hint of the system's ambient color
      ctx.fillStyle = "#020208";
      ctx.fillRect(0, 0, w, h);

      // Draw nebula buffer with drift
      if (nebulaBufferRef.current) {
        ctx.save();
        ctx.translate(driftRef.current.x, driftRef.current.y);
        ctx.drawImage(nebulaBufferRef.current, 0, 0);
        ctx.restore();
      }

      // Draw stars — parallax offset from nebula
      const stars = starsRef.current;
      const dx = driftRef.current.x * 0.35;
      const dy = driftRef.current.y * 0.35;

      for (const star of stars) {
        const twinkle =
          Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.3 + 0.7;
        const alpha = star.opacity * twinkle;
        const [r, g, b] = star.color;

        const sx = star.x + dx;
        const sy = star.y + dy;

        // Glow — soft radial bloom (NMS stars have a dreamy softness)
        if (star.hasGlow) {
          const glowR = star.r * (star.r > 1.5 ? 6 : 3);
          const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
          glow.addColorStop(
            0,
            `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`,
          );
          glow.addColorStop(
            0.3,
            `rgba(${r}, ${g}, ${b}, ${alpha * 0.15})`,
          );
          glow.addColorStop(
            0.7,
            `rgba(${r}, ${g}, ${b}, ${alpha * 0.03})`,
          );
          glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.beginPath();
          ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        // Core dot
        ctx.beginPath();
        ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    }

    draw();

    const handleResize = () => setup();
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, [setup]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10"
    />
  );
}
