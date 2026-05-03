import { euclideanDistance, manhattanDistance, cosineDistance } from '../../math/statistics';

type DistanceMetric = 'euclidean' | 'manhattan' | 'cosine';

export interface KNNPrediction {
  predictedClass: number;
  neighbors: { index: number; distance: number; label: number }[];
  votes: Record<number, number>;
}

function getDistance(a: number[], b: number[], metric: DistanceMetric): number {
  if (metric === 'manhattan') return manhattanDistance(a, b);
  if (metric === 'cosine') return cosineDistance(a, b);
  return euclideanDistance(a, b);
}

export function knnPredict(
  trainX: number[][],
  trainY: number[],
  queryPoint: number[],
  k: number,
  metric: DistanceMetric = 'euclidean'
): KNNPrediction {
  const distances = trainX.map((x, i) => ({
    index: i,
    distance: getDistance(x, queryPoint, metric),
    label: trainY[i],
  }));
  distances.sort((a, b) => a.distance - b.distance);
  const neighbors = distances.slice(0, k);
  const votes: Record<number, number> = {};
  neighbors.forEach(n => { votes[n.label] = (votes[n.label] ?? 0) + 1; });
  const predictedClass = parseInt(
    Object.entries(votes).reduce((a, b) => b[1] > a[1] ? b : a)[0]
  );
  return { predictedClass, neighbors, votes };
}

export function knnClassifyAll(
  trainX: number[][],
  trainY: number[],
  testX: number[][],
  k: number,
  metric: DistanceMetric = 'euclidean'
): number[] {
  return testX.map(x => knnPredict(trainX, trainY, x, k, metric).predictedClass);
}
