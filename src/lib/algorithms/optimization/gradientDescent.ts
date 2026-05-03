export interface GDStep { iter: number; x: number; y: number; loss: number; gradient: number }

export type LossFunction = 'quadratic' | 'rosenbrock' | 'absolute';

export function optimizeGD(
  fn: (x: number) => number,
  grad: (x: number) => number,
  x0: number,
  lr: number,
  maxIter: number
): GDStep[] {
  let x = x0;
  const steps: GDStep[] = [];
  for (let i = 0; i < maxIter; i++) {
    const loss = fn(x);
    const g = grad(x);
    steps.push({ iter: i, x, y: loss, loss, gradient: g });
    x = x - lr * g;
    if (Math.abs(g) < 1e-6) break;
  }
  return steps;
}

export const presetFunctions = {
  quadratic: {
    fn: (x: number) => x * x,
    grad: (x: number) => 2 * x,
    label: 'f(x) = x²',
    domain: [-5, 5],
  },
  cubic: {
    fn: (x: number) => x * x * x - 3 * x,
    grad: (x: number) => 3 * x * x - 3,
    label: 'f(x) = x³ − 3x',
    domain: [-3, 3],
  },
  sine: {
    fn: (x: number) => -Math.sin(x),
    grad: (x: number) => -Math.cos(x),
    label: 'f(x) = −sin(x)',
    domain: [-Math.PI * 2, Math.PI * 2],
  },
  bowl: {
    fn: (x: number) => 0.5 * x * x + 2 * x + 1,
    grad: (x: number) => x + 2,
    label: 'f(x) = 0.5x² + 2x + 1',
    domain: [-8, 4],
  },
};
