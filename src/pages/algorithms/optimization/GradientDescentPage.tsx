import { useEffect, useMemo, useRef, useState } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, ComposedChart, ReferenceLine } from 'recharts';
import { ChevronRight, RotateCcw, TrendingDown } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { LearningPanel } from '../../../components/ml/LearningPanel';
import { linspace } from '../../../lib/math/statistics';

type FnKey = 'quadratic' | 'cubic' | 'sine';
type OptimizerKey = 'gd' | 'sgd' | 'momentum' | 'adam';
type SurfaceKey = 'bowl' | 'saddle' | 'rosenbrock';

type OptimizerStep = {
  iter: number;
  x: number;
  loss: number;
  gradient: number;
  update: number;
  velocity: number;
  m: number;
  v: number;
  mHat: number;
  vHat: number;
};

const optimizerLabels: Record<OptimizerKey, string> = {
  gd: 'Vanilla GD',
  sgd: 'SGD',
  momentum: 'Momentum',
  adam: 'Adam',
};

const optimizerColors: Record<OptimizerKey, string> = {
  gd: '#2563eb',
  sgd: '#f59e0b',
  momentum: '#7c3aed',
  adam: '#059669',
};

const functions: Record<FnKey, { label: string; domain: [number, number]; fn: (x: number) => number; grad: (x: number) => number }> = {
  quadratic: {
    label: 'Convex bowl: f(x) = (x - 1)^2 + 0.5',
    domain: [-4, 5],
    fn: x => (x - 1) ** 2 + 0.5,
    grad: x => 2 * (x - 1),
  },
  cubic: {
    label: 'Non-convex curve: f(x) = 0.08x^4 - 0.45x^2 + 0.3x + 2',
    domain: [-3.5, 3.5],
    fn: x => 0.08 * x ** 4 - 0.45 * x ** 2 + 0.3 * x + 2,
    grad: x => 0.32 * x ** 3 - 0.9 * x + 0.3,
  },
  sine: {
    label: 'Wavy loss: f(x) = sin(2x) + 0.12x^2 + 2',
    domain: [-5, 5],
    fn: x => Math.sin(2 * x) + 0.12 * x ** 2 + 2,
    grad: x => 2 * Math.cos(2 * x) + 0.24 * x,
  },
};

const surfaces: Record<SurfaceKey, { label: string; fn: (x: number, y: number) => number; grad: (x: number, y: number) => [number, number] }> = {
  bowl: {
    label: 'Elongated bowl: z = x^2 + 5y^2',
    fn: (x, y) => x ** 2 + 5 * y ** 2,
    grad: (x, y) => [2 * x, 10 * y],
  },
  saddle: {
    label: 'Saddle: z = x^2 - y^2 + 0.2y^4',
    fn: (x, y) => x ** 2 - y ** 2 + 0.2 * y ** 4 + 5,
    grad: (x, y) => [2 * x, -2 * y + 0.8 * y ** 3],
  },
  rosenbrock: {
    label: 'Rosenbrock banana valley',
    fn: (x, y) => (1 - x) ** 2 + 8 * (y - x ** 2) ** 2,
    grad: (x, y) => [-2 * (1 - x) - 32 * x * (y - x ** 2), 16 * (y - x ** 2)],
  },
};

function sampleGradient(trueGradient: number, x: number, iter: number, batchSize: number) {
  let total = 0;
  for (let sample = 0; sample < batchSize; sample++) {
    total += trueGradient + Math.sin((iter + 1) * (sample + 3) * 1.37 + x * 2.1) * 0.9;
  }
  return total / batchSize;
}

function runOptimizer(
  key: OptimizerKey,
  fn: (x: number) => number,
  grad: (x: number) => number,
  x0: number,
  learningRate: number,
  maxIter: number,
  params: { batchSize: number; beta: number; beta1: number; beta2: number; epsilon: number },
) {
  const steps: OptimizerStep[] = [];
  let x = x0;
  let velocity = 0;
  let m = 0;
  let v = 0;
  for (let iter = 0; iter < maxIter; iter++) {
    const trueGradient = grad(x);
    const gradient = key === 'sgd' ? sampleGradient(trueGradient, x, iter, params.batchSize) : trueGradient;
    let update = learningRate * gradient;
    let mHat = 0;
    let vHat = 0;

    if (key === 'momentum') {
      velocity = params.beta * velocity + learningRate * gradient;
      update = velocity;
    } else if (key === 'adam') {
      m = params.beta1 * m + (1 - params.beta1) * gradient;
      v = params.beta2 * v + (1 - params.beta2) * gradient ** 2;
      mHat = m / (1 - params.beta1 ** (iter + 1));
      vHat = v / (1 - params.beta2 ** (iter + 1));
      update = learningRate * mHat / (Math.sqrt(vHat) + params.epsilon);
    }

    steps.push({ iter, x, loss: fn(x), gradient, update, velocity, m, v, mHat, vHat });
    x -= update;
    if (!Number.isFinite(x) || Math.abs(x) > 1e6) break;
  }
  return steps;
}

function convergenceStep(steps: OptimizerStep[], threshold = 0.01) {
  const found = steps.find(step => Math.abs(step.gradient) < threshold);
  return found ? found.iter + 1 : null;
}

function run2dOptimizer(key: Exclude<OptimizerKey, 'sgd'>, surface: typeof surfaces[SurfaceKey], start: [number, number], learningRate: number, maxIter: number, params: { beta: number; beta1: number; beta2: number; epsilon: number }) {
  const path: Array<{ x: number; y: number; z: number }> = [];
  let [x, y] = start;
  let vx = 0, vy = 0, mx = 0, my = 0, sx = 0, sy = 0;
  for (let iter = 0; iter < maxIter; iter++) {
    path.push({ x, y, z: surface.fn(x, y) });
    const [gx, gy] = surface.grad(x, y);
    if (key === 'momentum') {
      vx = params.beta * vx + learningRate * gx;
      vy = params.beta * vy + learningRate * gy;
      x -= vx; y -= vy;
    } else if (key === 'adam') {
      mx = params.beta1 * mx + (1 - params.beta1) * gx;
      my = params.beta1 * my + (1 - params.beta1) * gy;
      sx = params.beta2 * sx + (1 - params.beta2) * gx ** 2;
      sy = params.beta2 * sy + (1 - params.beta2) * gy ** 2;
      const mxHat = mx / (1 - params.beta1 ** (iter + 1));
      const myHat = my / (1 - params.beta1 ** (iter + 1));
      const sxHat = sx / (1 - params.beta2 ** (iter + 1));
      const syHat = sy / (1 - params.beta2 ** (iter + 1));
      x -= learningRate * mxHat / (Math.sqrt(sxHat) + params.epsilon);
      y -= learningRate * myHat / (Math.sqrt(syHat) + params.epsilon);
    } else {
      x -= learningRate * gx;
      y -= learningRate * gy;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 6 || Math.abs(y) > 6) break;
  }
  return path;
}

export default function GradientDescentPage({ initialOptimizer = 'gd' }: { initialOptimizer?: OptimizerKey }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeOptimizer, setActiveOptimizer] = useState<OptimizerKey>(initialOptimizer);
  const [viewMode, setViewMode] = useState<'1d' | '2d'>('1d');
  const [surfaceKey, setSurfaceKey] = useState<SurfaceKey>('bowl');
  const [surfaceStart, setSurfaceStart] = useState<[number, number]>([2.6, 2.2]);
  const [fnKey, setFnKey] = useState<FnKey>('quadratic');
  const [learningRate, setLearningRate] = useState(0.08);
  const [x0, setX0] = useState(3);
  const [maxIter, setMaxIter] = useState(70);
  const [currentStep, setCurrentStep] = useState(24);
  const [batchSize, setBatchSize] = useState(8);
  const [beta, setBeta] = useState(0.9);
  const [beta1, setBeta1] = useState(0.9);
  const [beta2, setBeta2] = useState(0.99);
  const [epsilon, setEpsilon] = useState(0.000001);

  const activeFn = functions[fnKey];
  const curve = useMemo(() => linspace(activeFn.domain[0], activeFn.domain[1], 240).map(x => ({ x, y: activeFn.fn(x) })), [activeFn]);
  const runs = useMemo(() => {
    const params = { batchSize, beta, beta1, beta2, epsilon };
    return (Object.keys(optimizerLabels) as OptimizerKey[]).map(key => ({
      key,
      label: optimizerLabels[key],
      color: optimizerColors[key],
      steps: runOptimizer(key, activeFn.fn, activeFn.grad, x0, learningRate, maxIter, params),
    }));
  }, [activeFn, x0, learningRate, maxIter, batchSize, beta, beta1, beta2, epsilon]);
  const activeRun = runs.find(run => run.key === activeOptimizer) ?? runs[0];
  const activeStep = activeRun.steps[Math.min(currentStep, activeRun.steps.length - 1)];
  const convergenceRows = runs.map(run => ({ optimizer: run.label, steps: convergenceStep(run.steps), finalLoss: run.steps.at(-1)?.loss ?? 0, color: run.color }));
  const activeSurface = surfaces[surfaceKey];
  const surfacePaths = useMemo(() => {
    const params = { beta, beta1, beta2, epsilon };
    return (['gd', 'momentum', 'adam'] as const).map(key => ({
      key,
      label: optimizerLabels[key],
      color: optimizerColors[key],
      path: run2dOptimizer(key, activeSurface, surfaceStart, Math.min(learningRate, 0.08), maxIter, params),
    }));
  }, [activeSurface, surfaceStart, learningRate, maxIter, beta, beta1, beta2, epsilon]);

  useEffect(() => {
    if (viewMode !== '2d') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const size = 320;
    canvas.width = size;
    canvas.height = size;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = -3 + (px / (size - 1)) * 6;
        const y = 3 - (py / (size - 1)) * 6;
        const z = Math.min(12, Math.max(0, activeSurface.fn(x, y)));
        const hue = 240 - z * 18;
        const color = `hsl(${hue}, 80%, 52%)`;
        ctx.fillStyle = color;
        ctx.fillRect(px, py, 1, 1);
      }
    }
    const toPixel = (x: number, y: number) => [((x + 3) / 6) * size, ((3 - y) / 6) * size] as const;
    surfacePaths.forEach(run => {
      ctx.strokeStyle = run.color;
      ctx.fillStyle = run.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      run.path.forEach((point, index) => {
        const [px, py] = toPixel(point.x, point.y);
        if (index === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      run.path.forEach((point, index) => {
        if (index % 5 !== 0 && index !== run.path.length - 1) return;
        const [px, py] = toPixel(point.x, point.y);
        ctx.beginPath();
        ctx.arc(px, py, index === 0 ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }, [viewMode, activeSurface, surfacePaths]);

  const reset = () => setCurrentStep(0);
  const stepForward = () => setCurrentStep(step => Math.min(step + 1, maxIter - 1));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <PageHeader
        title="Optimizer Suite"
        subtitle="Compare Vanilla GD, SGD, Momentum, and Adam on the same loss curve with live optimizer internals."
        badge="Intermediate"
        category="Optimization"
        icon={<TrendingDown size={22} />}
      />

      <InfoBox type="info" title="Shared loss, different update rules">
        All four optimizers start from the same point. The chart overlays their paths so you can see why stochastic gradients wander, momentum smooths motion, and Adam adapts each step using first and second moments.
      </InfoBox>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Optimizer Tabs">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(optimizerLabels) as OptimizerKey[]).map(key => (
                <button
                  key={key}
                  onClick={() => setActiveOptimizer(key)}
                  className={`rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${activeOptimizer === key ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  {optimizerLabels[key]}
                </button>
              ))}
            </div>
          </Card>

          <Card title="Shared Controls">
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: '1d' as const, label: '1D Function' },
                  { id: '2d' as const, label: '2D Surface' },
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setViewMode(mode.id)}
                    className={`rounded-lg border px-3 py-2 font-bold ${viewMode === mode.id ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40' : 'border-gray-200 dark:border-gray-700'}`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <label className="block font-semibold text-gray-700 dark:text-gray-200">Function
                <select value={fnKey} onChange={event => { setFnKey(event.target.value as FnKey); reset(); }} className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                  {(Object.keys(functions) as FnKey[]).map(key => <option key={key} value={key}>{functions[key].label}</option>)}
                </select>
              </label>
              {viewMode === '2d' && (
                <label className="block font-semibold text-gray-700 dark:text-gray-200">Surface
                  <select value={surfaceKey} onChange={event => setSurfaceKey(event.target.value as SurfaceKey)} className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                    {(Object.keys(surfaces) as SurfaceKey[]).map(key => <option key={key} value={key}>{surfaces[key].label}</option>)}
                  </select>
                </label>
              )}
              <label className="block font-semibold text-gray-700 dark:text-gray-200">Learning rate: {learningRate.toFixed(3)}
                <input type="range" min={0.001} max={0.4} step={0.001} value={learningRate} onChange={event => setLearningRate(Number(event.target.value))} className="w-full accent-blue-600" />
              </label>
              <label className="block font-semibold text-gray-700 dark:text-gray-200">Starting point: {x0.toFixed(2)}
                <input type="range" min={activeFn.domain[0]} max={activeFn.domain[1]} step={0.05} value={x0} onChange={event => { setX0(Number(event.target.value)); reset(); }} className="w-full accent-blue-600" />
              </label>
              <label className="block font-semibold text-gray-700 dark:text-gray-200">Max iterations: {maxIter}
                <input type="range" min={10} max={200} step={5} value={maxIter} onChange={event => setMaxIter(Number(event.target.value))} className="w-full accent-blue-600" />
              </label>
            </div>
          </Card>

          <Card title={`${optimizerLabels[activeOptimizer]} Internals`}>
            <div className="space-y-4 text-sm">
              {activeOptimizer === 'sgd' && (
                <label className="block font-semibold text-gray-700 dark:text-gray-200">Mini-batch size: {batchSize}
                  <input type="range" min={1} max={32} value={batchSize} onChange={event => setBatchSize(Number(event.target.value))} className="w-full accent-amber-500" />
                </label>
              )}
              {activeOptimizer === 'momentum' && (
                <label className="block font-semibold text-gray-700 dark:text-gray-200">Momentum beta: {beta.toFixed(2)}
                  <input type="range" min={0.5} max={0.99} step={0.01} value={beta} onChange={event => setBeta(Number(event.target.value))} className="w-full accent-purple-600" />
                </label>
              )}
              {activeOptimizer === 'adam' && (
                <>
                  <label className="block font-semibold text-gray-700 dark:text-gray-200">Beta1: {beta1.toFixed(2)}
                    <input type="range" min={0.5} max={0.99} step={0.01} value={beta1} onChange={event => setBeta1(Number(event.target.value))} className="w-full accent-green-600" />
                  </label>
                  <label className="block font-semibold text-gray-700 dark:text-gray-200">Beta2: {beta2.toFixed(3)}
                    <input type="range" min={0.8} max={0.999} step={0.001} value={beta2} onChange={event => setBeta2(Number(event.target.value))} className="w-full accent-green-600" />
                  </label>
                  <label className="block font-semibold text-gray-700 dark:text-gray-200">Epsilon: {epsilon.toExponential(0)}
                    <input type="range" min={-8} max={-3} step={1} value={Math.round(Math.log10(epsilon))} onChange={event => setEpsilon(10 ** Number(event.target.value))} className="w-full accent-green-600" />
                  </label>
                </>
              )}
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 font-mono text-xs dark:bg-gray-800">
                <span>grad: {activeStep?.gradient.toFixed(5) ?? '-'}</span>
                <span>update: {activeStep?.update.toFixed(5) ?? '-'}</span>
                <span>v: {activeStep?.velocity.toFixed(5) ?? '-'}</span>
                <span>m: {activeStep?.m.toFixed(5) ?? '-'}</span>
                <span>adam v: {activeStep?.v.toFixed(5) ?? '-'}</span>
                <span>m_hat: {activeStep?.mHat.toFixed(5) ?? '-'}</span>
                <span>v_hat: {activeStep?.vHat.toFixed(5) ?? '-'}</span>
                <span>x: {activeStep?.x.toFixed(5) ?? '-'}</span>
              </div>
            </div>
          </Card>

          <Card title="Step Controls">
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Visible step: {Math.min(currentStep + 1, maxIter)} / {maxIter}
                <input type="range" min={0} max={maxIter - 1} value={Math.min(currentStep, maxIter - 1)} onChange={event => setCurrentStep(Number(event.target.value))} className="w-full accent-blue-600" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={stepForward} className="inline-flex min-h-10 items-center justify-center gap-2 rounded bg-blue-600 px-3 text-sm font-bold text-white hover:bg-blue-700">
                  <ChevronRight size={14} /> Step
                </button>
                <button onClick={reset} className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-gray-200 px-3 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                  <RotateCcw size={14} /> Reset
                </button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Shared Loss Curve and Optimizer Trajectories" subtitle="All paths use the same function, start, learning rate, and iteration limit.">
            {viewMode === '1d' ? (
              <ResponsiveContainer width="100%" height={360}>
              <ComposedChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="x" type="number" domain={activeFn.domain} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value: number) => value.toFixed(4)} labelFormatter={label => `x=${Number(label).toFixed(3)}`} />
                <Line data={curve} type="monotone" dataKey="y" stroke="#94a3b8" strokeWidth={2} dot={false} name={activeFn.label} />
                <ReferenceLine x={x0} stroke="#64748b" strokeDasharray="4 2" label={{ value: 'start', fontSize: 10 }} />
                {runs.map(run => (
                  <Scatter
                    key={run.key}
                    data={run.steps.slice(0, Math.min(currentStep + 1, run.steps.length)).map(step => ({ x: step.x, y: step.loss }))}
                    fill={run.color}
                    name={run.label}
                    opacity={run.key === activeOptimizer ? 0.95 : 0.52}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
                <canvas
                  ref={canvasRef}
                  className="h-80 w-80 max-w-full cursor-crosshair rounded-xl border border-gray-200 shadow-sm dark:border-gray-700"
                  onPointerDown={event => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const x = -3 + ((event.clientX - rect.left) / rect.width) * 6;
                    const y = 3 - ((event.clientY - rect.top) / rect.height) * 6;
                    setSurfaceStart([x, y]);
                  }}
                />
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{activeSurface.label}</p>
                  <p>Click the canvas to move the starting point. Paths compare GD, Momentum, and Adam on the same 2D loss surface.</p>
                  <div className="grid gap-2">
                    {surfacePaths.map(run => (
                      <div key={run.key} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                        <span className="inline-flex items-center gap-2 font-bold"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: run.color }} />{run.label}</span>
                        <p className="mt-1 text-xs">final z {run.path.at(-1)?.z.toFixed(4)} · steps {run.path.length}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              {runs.map(run => (
                <span key={run.key} className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: run.color }} />
                  {run.label}
                </span>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <MetricsPanel title="Active Step Metrics" metrics={[
              { label: 'Step', value: activeStep ? activeStep.iter + 1 : 0, format: 'number' },
              { label: 'x', value: activeStep?.x ?? 0, format: 'fixed4' },
              { label: 'Loss', value: activeStep?.loss ?? 0, format: 'fixed4', color: (activeStep?.loss ?? 99) < 0.05 ? 'green' : 'default' },
              { label: 'Gradient', value: activeStep?.gradient ?? 0, format: 'fixed4', color: Math.abs(activeStep?.gradient ?? 1) < 0.01 ? 'green' : 'default' },
            ]} />
            <Card title="Convergence Step Counter">
              <div className="space-y-2">
                {convergenceRows.map(row => (
                  <div key={row.optimizer} className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex items-center justify-between text-sm font-bold text-gray-900 dark:text-white">
                      <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} /> {row.optimizer}</span>
                      <span>{row.steps ? `${row.steps} steps` : 'not reached'}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Final loss {row.finalLoss.toFixed(5)}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card title="Optimizer Trail Table" collapsible>
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white dark:bg-gray-900">
                  <tr className="border-b border-gray-200 text-left dark:border-gray-700">
                    <th className="p-2">Step</th>
                    <th className="p-2 text-right">x</th>
                    <th className="p-2 text-right">loss</th>
                    <th className="p-2 text-right">grad</th>
                    <th className="p-2 text-right">update</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRun.steps.slice(0, Math.min(currentStep + 1, activeRun.steps.length)).map(step => (
                    <tr key={step.iter} className="border-b border-gray-100 font-mono dark:border-gray-800">
                      <td className="p-2">{step.iter + 1}</td>
                      <td className="p-2 text-right">{step.x.toFixed(5)}</td>
                      <td className="p-2 text-right">{step.loss.toFixed(5)}</td>
                      <td className="p-2 text-right">{step.gradient.toFixed(5)}</td>
                      <td className="p-2 text-right">{step.update.toFixed(5)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <LearningPanel sections={[
        {
          title: 'What changed from vanilla gradient descent?',
          content: <p>SGD estimates the gradient from a noisy mini-batch. Momentum keeps a velocity term so updates continue in consistent directions. Adam keeps bias-corrected first and second moments, then scales the update by estimated gradient variance.</p>,
        },
        {
          title: 'When to use each optimizer',
          content: <p>Vanilla GD is easiest to understand, SGD is useful for large datasets, Momentum helps with narrow valleys, and Adam is often a strong default when gradients vary widely by parameter.</p>,
        },
      ]} />
    </div>
  );
}
