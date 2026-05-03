export function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function variance(arr: number[]): number {
  const m = mean(arr);
  return arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
}

export function std(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

export function covariance(x: number[], y: number[]): number {
  const mx = mean(x), my = mean(y);
  return x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0) / x.length;
}

export function correlation(x: number[], y: number[]): number {
  const sx = std(x), sy = std(y);
  if (sx === 0 || sy === 0) return 0;
  return covariance(x, y) / (sx * sy);
}

export function normalize(arr: number[]): number[] {
  const mn = Math.min(...arr), mx = Math.max(...arr);
  const range = mx - mn;
  if (range === 0) return arr.map(() => 0);
  return arr.map(v => (v - mn) / range);
}

export function standardize(arr: number[]): number[] {
  const m = mean(arr), s = std(arr);
  if (s === 0) return arr.map(() => 0);
  return arr.map(v => (v - m) / s);
}

export function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function mode(arr: number[]): number {
  const freq: Map<number, number> = new Map();
  arr.forEach(v => freq.set(v, (freq.get(v) ?? 0) + 1));
  return [...freq.entries()].reduce((a, b) => b[1] > a[1] ? b : a)[0];
}

export function quantile(arr: number[], q: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function iqr(arr: number[]): number {
  return quantile(arr, 0.75) - quantile(arr, 0.25);
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function softmax(arr: number[]): number[] {
  const max = Math.max(...arr);
  const exps = arr.map(x => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

export function relu(x: number): number {
  return Math.max(0, x);
}

export function tanh(x: number): number {
  return Math.tanh(x);
}

export function dot(a: number[], b: number[]): number {
  return a.reduce((s, ai, i) => s + ai * b[i], 0);
}

export function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((s, ai, i) => s + (ai - b[i]) ** 2, 0));
}

export function manhattanDistance(a: number[], b: number[]): number {
  return a.reduce((s, ai, i) => s + Math.abs(ai - b[i]), 0);
}

export function cosineDistance(a: number[], b: number[]): number {
  const dotAB = dot(a, b);
  const magA = Math.sqrt(dot(a, a));
  const magB = Math.sqrt(dot(b, b));
  if (magA === 0 || magB === 0) return 1;
  return 1 - dotAB / (magA * magB);
}

export function entropy(probs: number[]): number {
  return -probs.filter(p => p > 0).reduce((s, p) => s + p * Math.log2(p), 0);
}

export function gini(probs: number[]): number {
  return 1 - probs.reduce((s, p) => s + p * p, 0);
}

export function shuffle<T>(arr: T[], seed?: number): T[] {
  const result = [...arr];
  let s = seed ?? Date.now();
  const rng = () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function linspace(start: number, end: number, n: number): number[] {
  if (n <= 1) return [start];
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => start + i * step);
}
