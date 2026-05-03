import { euclideanDistance } from '../../math/statistics';

export interface KMeansStep {
  iteration: number;
  centroids: number[][];
  assignments: number[];
  inertia: number;
}

export interface KMeansResult {
  centroids: number[][];
  assignments: number[];
  inertia: number;
  steps: KMeansStep[];
  converged: boolean;
}

function randomCentroids(X: number[][], k: number): number[][] {
  const indices = new Set<number>();
  while (indices.size < k) indices.add(Math.floor(Math.random() * X.length));
  return [...indices].map(i => [...X[i]]);
}

function kMeansPlusPlusCentroids(X: number[][], k: number): number[][] {
  const centroids: number[][] = [X[Math.floor(Math.random() * X.length)]];
  while (centroids.length < k) {
    const distances = X.map(x => Math.min(...centroids.map(c => euclideanDistance(x, c) ** 2)));
    const total = distances.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < X.length; i++) {
      r -= distances[i];
      if (r <= 0) { centroids.push([...X[i]]); break; }
    }
  }
  return centroids;
}

function assignClusters(X: number[][], centroids: number[][]): number[] {
  return X.map(x => {
    let minDist = Infinity, minIdx = 0;
    centroids.forEach((c, i) => {
      const d = euclideanDistance(x, c);
      if (d < minDist) { minDist = d; minIdx = i; }
    });
    return minIdx;
  });
}

function updateCentroids(X: number[][], assignments: number[], k: number): number[][] {
  const dims = X[0].length;
  const sums = Array.from({ length: k }, () => Array(dims).fill(0));
  const counts = Array(k).fill(0);
  assignments.forEach((c, i) => {
    counts[c]++;
    X[i].forEach((v, d) => { sums[c][d] += v; });
  });
  return sums.map((s, c) => counts[c] > 0 ? s.map(v => v / counts[c]) : X[Math.floor(Math.random() * X.length)]);
}

function calcInertia(X: number[][], assignments: number[], centroids: number[][]): number {
  return X.reduce((s, x, i) => s + euclideanDistance(x, centroids[assignments[i]]) ** 2, 0);
}

export function kmeans(
  X: number[][],
  k: number,
  maxIter = 100,
  init: 'random' | 'kmeans++' = 'kmeans++'
): KMeansResult {
  let centroids = init === 'kmeans++' ? kMeansPlusPlusCentroids(X, k) : randomCentroids(X, k);
  const steps: KMeansStep[] = [];
  let assignments = assignClusters(X, centroids);
  let converged = false;

  for (let iter = 0; iter < maxIter; iter++) {
    const inertia = calcInertia(X, assignments, centroids);
    steps.push({ iteration: iter, centroids: centroids.map(c => [...c]), assignments: [...assignments], inertia });
    const newCentroids = updateCentroids(X, assignments, k);
    const newAssignments = assignClusters(X, newCentroids);
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    centroids = newCentroids;
    assignments = newAssignments;
    if (!changed) { converged = true; break; }
  }

  const inertia = calcInertia(X, assignments, centroids);
  return { centroids, assignments, inertia, steps, converged };
}

export function elbowMethod(X: number[][], maxK = 10): number[] {
  return Array.from({ length: maxK - 1 }, (_, i) => {
    const { inertia } = kmeans(X, i + 2, 50);
    return inertia;
  });
}
