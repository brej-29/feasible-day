/** Small, dependency-free statistics. Seeded so published numbers are reproducible. */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const w = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - w) / d, (c + w) / d];
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/** Percentile CI of a statistic over scenarios (cluster bootstrap: resample whole scenarios). */
export function bootstrapCI(
  groups: number[][], stat: (flat: number[]) => number = mean, iters = 10_000, seed = 7,
): [number, number] {
  const rnd = mulberry32(seed);
  const g = groups.filter((x) => x.length);
  const out: number[] = [];
  for (let i = 0; i < iters; i++) {
    const flat: number[] = [];
    for (let j = 0; j < g.length; j++) flat.push(...g[Math.floor(rnd() * g.length)]);
    out.push(stat(flat));
  }
  out.sort((a, b) => a - b);
  return [out[Math.floor(0.025 * iters)], out[Math.floor(0.975 * iters)]];
}

/** Paired difference (a - b) of per-scenario means, with bootstrap CI over scenarios. */
export function pairedDiffCI(a: number[], b: number[], iters = 10_000, seed = 11): { diff: number; ci: [number, number] } {
  const d = a.map((x, i) => x - b[i]);
  return { diff: mean(d), ci: bootstrapCI(d.map((x) => [x]), mean, iters, seed) };
}
