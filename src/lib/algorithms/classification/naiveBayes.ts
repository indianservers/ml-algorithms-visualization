import { mean, variance } from '../../math/statistics';

export interface GaussianNBModel {
  classes: number[];
  priors: Record<number, number>;
  means: Record<number, number[]>;
  variances: Record<number, number[]>;
  predict: (x: number[]) => number;
  predictProba: (x: number[]) => Record<number, number>;
}

function gaussianPDF(x: number, mu: number, sigma2: number): number {
  if (sigma2 < 1e-9) return x === mu ? 1 : 0;
  return Math.exp(-((x - mu) ** 2) / (2 * sigma2)) / Math.sqrt(2 * Math.PI * sigma2);
}

export function trainGaussianNB(X: number[][], y: number[]): GaussianNBModel {
  const classes = [...new Set(y)].sort((a, b) => a - b);
  const n = y.length;
  const priors: Record<number, number> = {};
  const means: Record<number, number[]> = {};
  const variances: Record<number, number[]> = {};

  classes.forEach(c => {
    const indices = y.map((yi, i) => yi === c ? i : -1).filter(i => i >= 0);
    priors[c] = indices.length / n;
    const classX = indices.map(i => X[i]);
    const p = X[0].length;
    means[c] = Array.from({ length: p }, (_, j) => mean(classX.map(row => row[j])));
    variances[c] = Array.from({ length: p }, (_, j) => variance(classX.map(row => row[j])) + 1e-9);
  });

  const predictProba = (x: number[]): Record<number, number> => {
    const logProbs: Record<number, number> = {};
    classes.forEach(c => {
      let lp = Math.log(priors[c]);
      x.forEach((xi, j) => { lp += Math.log(gaussianPDF(xi, means[c][j], variances[c][j]) + 1e-300); });
      logProbs[c] = lp;
    });
    const maxLP = Math.max(...Object.values(logProbs));
    const expProbs: Record<number, number> = {};
    let total = 0;
    classes.forEach(c => { expProbs[c] = Math.exp(logProbs[c] - maxLP); total += expProbs[c]; });
    classes.forEach(c => { expProbs[c] /= total; });
    return expProbs;
  };

  const predict = (x: number[]) => {
    const probs = predictProba(x);
    return classes.reduce((best, c) => probs[c] > probs[best] ? c : best, classes[0]);
  };

  return { classes, priors, means, variances, predict, predictProba };
}
