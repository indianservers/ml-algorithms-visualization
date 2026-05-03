import { euclideanDistance } from '../../math/statistics';

export type PointType = 'core' | 'border' | 'noise';

export interface DBSCANResult {
  labels: number[];
  pointTypes: PointType[];
  numClusters: number;
  corePoints: number[];
  borderPoints: number[];
  noisePoints: number[];
}

export function dbscan(X: number[][], eps: number, minPts: number): DBSCANResult {
  const n = X.length;
  const labels = Array(n).fill(-1);
  let clusterID = 0;

  function regionQuery(pointIdx: number): number[] {
    return X.map((x, i) => euclideanDistance(x, X[pointIdx]) <= eps ? i : -1).filter(i => i >= 0);
  }

  function expandCluster(pointIdx: number, neighbors: number[]): void {
    labels[pointIdx] = clusterID;
    const queue = [...neighbors];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (labels[current] === -1) labels[current] = clusterID;
      if (labels[current] !== undefined && labels[current] >= 0 && labels[current] !== clusterID) continue;
      labels[current] = clusterID;
      const currentNeighbors = regionQuery(current);
      if (currentNeighbors.length >= minPts) {
        currentNeighbors.forEach(nb => {
          if (labels[nb] === -1 || labels[nb] === undefined) queue.push(nb);
        });
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue;
    const neighbors = regionQuery(i);
    if (neighbors.length < minPts) {
      labels[i] = -1; // noise initially
    } else {
      expandCluster(i, neighbors);
      clusterID++;
    }
  }

  const pointTypes: PointType[] = X.map((_, i) => {
    const neighbors = regionQuery(i);
    if (neighbors.length >= minPts) return 'core';
    if (labels[i] >= 0) return 'border';
    return 'noise';
  });

  const corePoints = pointTypes.map((t, i) => t === 'core' ? i : -1).filter(i => i >= 0);
  const borderPoints = pointTypes.map((t, i) => t === 'border' ? i : -1).filter(i => i >= 0);
  const noisePoints = pointTypes.map((t, i) => t === 'noise' ? i : -1).filter(i => i >= 0);

  return { labels, pointTypes, numClusters: clusterID, corePoints, borderPoints, noisePoints };
}
