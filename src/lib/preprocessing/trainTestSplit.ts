import { shuffle } from '../math/statistics';

export interface SplitResult<T> {
  trainX: T[];
  testX: T[];
  trainY: number[];
  testY: number[];
  trainIndices: number[];
  testIndices: number[];
}

export function trainTestSplit<T>(
  X: T[],
  y: number[],
  testSize = 0.2,
  randomState?: number,
  stratify = false
): SplitResult<T> {
  const n = X.length;
  let indices = Array.from({ length: n }, (_, i) => i);

  if (stratify) {
    const classMap: Record<number, number[]> = {};
    y.forEach((yi, i) => { classMap[yi] = [...(classMap[yi] ?? []), i]; });
    indices = [];
    Object.values(classMap).forEach(idxs => {
      indices.push(...shuffle(idxs, randomState));
    });
  } else {
    indices = shuffle(indices, randomState);
  }

  const testCount = Math.round(n * testSize);
  const testIndices = indices.slice(0, testCount);
  const trainIndices = indices.slice(testCount);

  return {
    trainX: trainIndices.map(i => X[i]),
    testX: testIndices.map(i => X[i]),
    trainY: trainIndices.map(i => y[i]),
    testY: testIndices.map(i => y[i]),
    trainIndices,
    testIndices,
  };
}

export function kFoldSplit<T>(X: T[], y: number[], k: number): SplitResult<T>[] {
  const n = X.length;
  const indices = shuffle(Array.from({ length: n }, (_, i) => i));
  const foldSize = Math.floor(n / k);
  return Array.from({ length: k }, (_, fold) => {
    const testIndices = indices.slice(fold * foldSize, (fold + 1) * foldSize);
    const trainIndices = indices.filter(i => !testIndices.includes(i));
    return {
      trainX: trainIndices.map(i => X[i]),
      testX: testIndices.map(i => X[i]),
      trainY: trainIndices.map(i => y[i]),
      testY: testIndices.map(i => y[i]),
      trainIndices,
      testIndices,
    };
  });
}
