import { sigmoid, mean } from '../../math/statistics';

export interface LogisticRegressionResult {
  weights: number[];
  bias: number;
  predict: (x: number[]) => number;
  predictProba: (x: number[]) => number;
  lossHistory: number[];
}

export function logisticRegression(
  X: number[][],
  y: number[],
  lr = 0.1,
  maxIter = 1000,
  onStep?: (iter: number, loss: number, weights: number[], bias: number) => void
): LogisticRegressionResult {
  const p = X[0].length;
  let weights = Array(p).fill(0);
  let bias = 0;
  const lossHistory: number[] = [];

  for (let iter = 0; iter < maxIter; iter++) {
    const probs = X.map(xi => sigmoid(xi.reduce((s, v, j) => s + v * weights[j], bias)));
    const loss = -mean(y.map((yi, i) => {
      const p = Math.min(Math.max(probs[i], 1e-15), 1 - 1e-15);
      return yi * Math.log(p) + (1 - yi) * Math.log(1 - p);
    }));
    lossHistory.push(loss);

    const diffs = probs.map((pi, i) => pi - y[i]);
    const dw = weights.map((_, j) => mean(diffs.map((d, i) => d * X[i][j])));
    const db = mean(diffs);
    weights = weights.map((w, j) => w - lr * dw[j]);
    bias -= lr * db;

    if (onStep && iter % 50 === 0) onStep(iter, loss, weights, bias);
  }

  const predictProba = (x: number[]) => sigmoid(x.reduce((s, v, j) => s + v * weights[j], bias));
  const predict = (x: number[]) => predictProba(x) >= 0.5 ? 1 : 0;
  return { weights, bias, predict, predictProba, lossHistory };
}
