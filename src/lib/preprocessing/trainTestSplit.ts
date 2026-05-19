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
    const testIndices: number[] = [];
    const trainIndices: number[] = [];
    Object.entries(classMap).forEach(([classLabel, idxs], classOffset) => {
      const shuffled = shuffle(idxs, randomState === undefined ? undefined : randomState + Number(classLabel) + classOffset);
      const rawClassTestCount = Math.round(idxs.length * testSize);
      const classTestCount = idxs.length <= 1 ? idxs.length : Math.min(idxs.length - 1, Math.max(1, rawClassTestCount));
      testIndices.push(...shuffled.slice(0, classTestCount));
      trainIndices.push(...shuffled.slice(classTestCount));
    });
    return {
      trainX: trainIndices.map(i => X[i]),
      testX: testIndices.map(i => X[i]),
      trainY: trainIndices.map(i => y[i]),
      testY: testIndices.map(i => y[i]),
      trainIndices,
      testIndices,
    };
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
  const boundedK = Math.max(2, Math.min(k, n));
  const indices = shuffle(Array.from({ length: n }, (_, i) => i));
  const baseFoldSize = Math.floor(n / boundedK);
  const remainder = n % boundedK;
  let cursor = 0;
  return Array.from({ length: boundedK }, (_, fold) => {
    const foldSize = baseFoldSize + (fold < remainder ? 1 : 0);
    const testIndices = indices.slice(cursor, cursor + foldSize);
    cursor += foldSize;
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
