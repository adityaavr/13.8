// ---------------------------------------------------------------------------
// 13.8 — Seeded deterministic RNG
//
// Mulberry32. Tiny, fast, decent distribution, fully deterministic given a
// 32-bit seed. Used universally for universe generation so the same seed
// always produces the same universe — critical for demo reproducibility.
// ---------------------------------------------------------------------------

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rand(rng: Rng, min: number, max: number): number {
  return rng() * (max - min) + min;
}

export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rand(rng, min, max + 1));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function pickWeighted<T>(rng: Rng, items: readonly [T, number][]): T {
  let total = 0;
  for (const [, w] of items) total += w;
  let r = rng() * total;
  for (const [val, w] of items) {
    r -= w;
    if (r <= 0) return val;
  }
  return items[items.length - 1][0];
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

// Fork a child RNG deterministically from a parent. Lets each subsystem
// (civilization sim, name generator, color picker) have its own stream
// without one consuming numbers that affect another.
export function forkRng(parent: Rng, salt: number): Rng {
  const seed = Math.floor(parent() * 0xffffffff) ^ (salt * 0x9e3779b9);
  return mulberry32(seed);
}

// String → 32-bit hash (FNV-1a) — for deriving deterministic seeds from
// entity ids when we don't want to thread an RNG explicitly.
export function hashStringSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
