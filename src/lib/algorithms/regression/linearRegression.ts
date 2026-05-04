import { mean, std, covariance } from '../../math/statistics';

export interface LinearRegressionResult {
  slope: number;
  intercept: number;
  predict: (x: number) => number;
  residuals: number[];
}

export function simpleLinearRegression(x: number[], y: number[]): LinearRegressionResult {
  const mx = mean(x), my = mean(y);
  const cov = covariance(x, y);
  const varX = x.reduce((s, xi) => s + (xi - mx) ** 2, 0) / x.length;
  const slope = varX === 0 ? 0 : cov / varX;
  const intercept = my - slope * mx;
  const predict = (xNew: number) => slope * xNew + intercept;
  const residuals = y.map((yi, i) => yi - predict(x[i]));
  return { slope, intercept, predict, residuals };
}

export interface MultipleRegressionResult {
  coefficients: number[];
  intercept: number;
  predict: (x: number[]) => number;
  residuals: number[];
}

export function multipleLinearRegression(X: number[][], y: number[]): MultipleRegressionResult {
  const n = y.length;
  const p = X[0].length;
  // Add bias column
  const Xb = X.map(row => [1, ...row]);
  const cols = p + 1;

  // Normal equations: beta = (X'X)^-1 X'y
  const XtX: number[][] = Array.from({ length: cols }, () => Array(cols).fill(0));
  const Xty: number[] = Array(cols).fill(0);

  for (let i = 0; i < n; i++) {
    for (let r = 0; r < cols; r++) {
      Xty[r] += Xb[i][r] * y[i];
      for (let c = 0; c < cols; c++) {
        XtX[r][c] += Xb[i][r] * Xb[i][c];
      }
    }
  }

  const beta = solveLinearSystem(XtX, Xty);
  const intercept = beta[0];
  const coefficients = beta.slice(1);
  const predict = (x: number[]) => intercept + x.reduce((s, xi, i) => s + xi * coefficients[i], 0);
  const residuals = y.map((yi, i) => yi - predict(X[i]));
  return { coefficients, intercept, predict, residuals };
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const aug = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-12) continue;
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = aug[row][col] / aug[col][col];
        for (let k = col; k <= n; k++) {
          aug[row][k] -= factor * aug[col][k];
        }
      }
    }
  }
  return aug.map((row, i) => row[n] / (row[i] || 1e-12));
}

export function ridgeRegression(X: number[][], y: number[], alpha: number): MultipleRegressionResult {
  const n = y.length;
  const p = X[0].length;
  const Xb = X.map(row => [1, ...row]);
  const cols = p + 1;

  const XtX: number[][] = Array.from({ length: cols }, () => Array(cols).fill(0));
  const Xty: number[] = Array(cols).fill(0);
  for (let i = 0; i < n; i++) {
    for (let r = 0; r < cols; r++) {
      Xty[r] += Xb[i][r] * y[i];
      for (let c = 0; c < cols; c++) XtX[r][c] += Xb[i][r] * Xb[i][c];
    }
  }
  for (let j = 1; j < cols; j++) XtX[j][j] += alpha;
  const beta = solveLinearSystem(XtX, Xty);
  const intercept = beta[0];
  const coefficients = beta.slice(1);
  const predict = (x: number[]) => intercept + x.reduce((s, xi, i) => s + xi * coefficients[i], 0);
  const residuals = y.map((yi, i) => yi - predict(X[i]));
  return { coefficients, intercept, predict, residuals };
}

export function lassoRegression(X: number[][], y: number[], alpha: number, maxIter = 1000, tol = 1e-4): MultipleRegressionResult {
  const n = y.length;
  const p = X[0].length;
  const mx = X[0].map((_, j) => mean(X.map(row => row[j])));
  const sx = X[0].map((_, j) => std(X.map(row => row[j])) || 1);
  const Xs = X.map(row => row.map((v, j) => (v - mx[j]) / sx[j]));
  const my = mean(y);
  const ys = y.map(v => v - my);

  const w = Array(p).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    const wOld = [...w];
    for (let j = 0; j < p; j++) {
      const r = ys.map((yi, i) => yi - Xs[i].reduce((s, xij, k) => k !== j ? s + xij * w[k] : s, 0));
      const rho = Xs.map((row, i) => row[j] * r[i]).reduce((a, b) => a + b, 0);
      w[j] = softThreshold(rho / n, alpha) / (Xs.map(row => row[j] ** 2).reduce((a, b) => a + b, 0) / n);
    }
    if (w.every((wj, j) => Math.abs(wj - wOld[j]) < tol)) break;
  }
  const coefficients = w.map((wj, j) => wj / sx[j]);
  const intercept = my - mx.reduce((s, mxj, j) => s + mxj * coefficients[j], 0);
  const predict = (x: number[]) => intercept + x.reduce((s, xi, i) => s + xi * coefficients[i], 0);
  const residuals = y.map((yi, i) => yi - predict(X[i]));
  return { coefficients, intercept, predict, residuals };
}

function softThreshold(x: number, lambda: number): number {
  if (x > lambda) return x - lambda;
  if (x < -lambda) return x + lambda;
  return 0;
}

export function polynomialFeatures(x: number[], degree: number): number[][] {
  return x.map(xi => Array.from({ length: degree }, (_, d) => xi ** (d + 1)));
}
