export type ActivationFn = 'step' | 'sigmoid' | 'tanh';

export interface PerceptronStep {
  epoch: number;
  weights: number[];
  bias: number;
  errors: number;
  predictions: number[];
}

function activate(x: number, fn: ActivationFn): number {
  if (fn === 'step') return x >= 0 ? 1 : 0;
  if (fn === 'sigmoid') return 1 / (1 + Math.exp(-x));
  return Math.tanh(x);
}

export function trainPerceptron(
  X: number[][],
  y: number[],
  lr = 0.1,
  maxEpochs = 50,
  activation: ActivationFn = 'step'
): { weights: number[]; bias: number; steps: PerceptronStep[] } {
  const p = X[0].length;
  let weights = Array(p).fill(0).map(() => (Math.random() - 0.5) * 0.1);
  let bias = 0;
  const steps: PerceptronStep[] = [];

  for (let epoch = 0; epoch < maxEpochs; epoch++) {
    let errors = 0;
    const predictions: number[] = [];
    for (let i = 0; i < X.length; i++) {
      const net = X[i].reduce((s, x, j) => s + x * weights[j], bias);
      const pred = activation === 'step' ? (net >= 0 ? 1 : 0) : Math.round(activate(net, activation));
      predictions.push(pred);
      const err = y[i] - pred;
      if (err !== 0) {
        errors++;
        weights = weights.map((w, j) => w + lr * err * X[i][j]);
        bias += lr * err;
      }
    }
    steps.push({ epoch, weights: [...weights], bias, errors, predictions: [...predictions] });
    if (errors === 0) break;
  }
  return { weights, bias, steps };
}

export function predictPerceptron(x: number[], weights: number[], bias: number): number {
  const net = x.reduce((s, xi, j) => s + xi * weights[j], bias);
  return net >= 0 ? 1 : 0;
}
