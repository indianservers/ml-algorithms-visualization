import { mean, std } from '../../math/statistics';

export interface PCAResult {
  components: number[][];
  explainedVariance: number[];
  explainedVarianceRatio: number[];
  projections: number[][];
  covarianceMatrix: number[][];
  eigenvalues: number[];
  mean: number[];
}

function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length, cols = B[0].length, inner = B.length;
  return Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) =>
      Array.from({ length: inner }, (_, k) => A[i][k] * B[k][j]).reduce((a, b) => a + b, 0)
    )
  );
}

function transpose(M: number[][]): number[][] {
  return M[0].map((_, j) => M.map(row => row[j]));
}

function covarianceMatrix(Xs: number[][]): number[][] {
  const n = Xs.length;
  const p = Xs[0].length;
  return Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => {
      const xi = Xs.map(row => row[i]);
      const xj = Xs.map(row => row[j]);
      const mi = mean(xi), mj = mean(xj);
      return Xs.reduce((s, row) => s + (row[i] - mi) * (row[j] - mj), 0) / (n - 1);
    })
  );
}

// Power iteration for top eigenvectors
function powerIteration(A: number[][], numComponents: number, maxIter = 500): { vectors: number[][]; values: number[] } {
  const p = A.length;
  const vectors: number[][] = [];
  const values: number[] = [];
  let deflated = A.map(row => [...row]);

  for (let k = 0; k < numComponents; k++) {
    let v = Array.from({ length: p }, () => Math.random() - 0.5);
    // normalize
    let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    v = v.map(x => x / (norm || 1));

    for (let iter = 0; iter < maxIter; iter++) {
      const Av = deflated.map(row => row.reduce((s, x, j) => s + x * v[j], 0));
      const eigenval = Av.reduce((s, x, j) => s + x * v[j], 0);
      norm = Math.sqrt(Av.reduce((s, x) => s + x * x, 0));
      if (norm < 1e-10) break;
      const vNew = Av.map(x => x / norm);
      if (v.reduce((s, x, j) => s + Math.abs(x - vNew[j]), 0) < 1e-8) { v = vNew; break; }
      v = vNew;
    }
    const eigenvalue = deflated.map((row, i) => row.reduce((s, x, j) => s + x * v[j], 0) * v[i]).reduce((a, b) => a + b, 0);
    vectors.push(v);
    values.push(Math.abs(eigenvalue));
    // Deflate
    for (let i = 0; i < p; i++)
      for (let j = 0; j < p; j++)
        deflated[i][j] -= eigenvalue * v[i] * v[j];
  }
  return { vectors, values };
}

export function pca(X: number[][], numComponents = 2): PCAResult {
  const n = X.length;
  const p = X[0].length;
  const colMeans = Array.from({ length: p }, (_, j) => mean(X.map(row => row[j])));
  const Xc = X.map(row => row.map((v, j) => v - colMeans[j]));
  const cov = covarianceMatrix(Xc);
  const k = Math.min(numComponents, p);
  const { vectors, values } = powerIteration(cov, k);
  const totalVar = values.reduce((a, b) => a + b, 0) || 1;
  const projections = Xc.map(row =>
    vectors.map(v => row.reduce((s, x, j) => s + x * v[j], 0))
  );
  return {
    components: vectors,
    explainedVariance: values,
    explainedVarianceRatio: values.map(v => v / totalVar),
    projections,
    covarianceMatrix: cov,
    eigenvalues: values,
    mean: colMeans,
  };
}
