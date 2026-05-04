import React, { useState, useCallback, useMemo } from 'react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { LearningPanel } from '../../../components/ml/LearningPanel';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Scatter, ComposedChart,
} from 'recharts';
import { optimizeGD, presetFunctions } from '../../../lib/algorithms/optimization/gradientDescent';
import type { GDStep } from '../../../lib/algorithms/optimization/gradientDescent';
import { linspace } from '../../../lib/math/statistics';
import { TrendingDown, Play, ChevronRight, AlertTriangle } from 'lucide-react';

type FnKey = keyof typeof presetFunctions;

const FN_COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

// ── Render the function curve as chart data ───────────────────────────────
function buildCurve(key: FnKey, n = 200) {
  const { fn, domain } = presetFunctions[key];
  return linspace(domain[0], domain[1], n).map(x => ({ x: parseFloat(x.toFixed(4)), y: fn(x) }));
}

// ── Divergence heuristic ──────────────────────────────────────────────────
function isDiverging(steps: GDStep[]): boolean {
  if (steps.length < 5) return false;
  const last = steps[steps.length - 1];
  return Math.abs(last.loss) > 1e6 || isNaN(last.loss) || !isFinite(last.loss);
}

function isStuck(steps: GDStep[]): boolean {
  if (steps.length < 30) return false;
  const recent = steps.slice(-10);
  const spread = Math.max(...recent.map(s => s.loss)) - Math.min(...recent.map(s => s.loss));
  return spread < 1e-8;
}

// ─────────────────────────────────────────────────────────────────────────
export default function GradientDescentPage() {
  const [fnKey, setFnKey] = useState<FnKey>('quadratic');
  const [lr, setLr] = useState(0.1);
  const [x0, setX0] = useState(3.0);
  const [maxIter, setMaxIter] = useState(50);
  const [steps, setSteps] = useState<GDStep[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [compareMode, setCompareMode] = useState(false);
  const [compareResults, setCompareResults] = useState<{ lr: number; steps: GDStep[] }[]>([]);

  const { fn, grad, domain, label } = presetFunctions[fnKey];
  const curve = useMemo(() => buildCurve(fnKey), [fnKey]);

  // Run full descent
  const runGD = useCallback(() => {
    const result = optimizeGD(fn, grad, x0, lr, maxIter);
    setSteps(result);
    setCurrentStep(result.length - 1);
  }, [fn, grad, x0, lr, maxIter]);

  // Step-by-step
  const runStep = useCallback(() => {
    if (steps.length === 0) {
      const result = optimizeGD(fn, grad, x0, lr, maxIter);
      setSteps(result);
      setCurrentStep(0);
    } else if (currentStep < steps.length - 1) {
      setCurrentStep(s => s + 1);
    }
  }, [steps, currentStep, fn, grad, x0, lr, maxIter]);

  const resetAll = () => {
    setSteps([]);
    setCurrentStep(-1);
    setCompareResults([]);
  };

  // Comparison mode
  const runComparison = useCallback(() => {
    const lrs = [0.001, lr, Math.min(lr * 5, 2.0)];
    const results = lrs.map(l => ({
      lr: l,
      steps: optimizeGD(fn, grad, x0, l, maxIter),
    }));
    setCompareResults(results);
  }, [fn, grad, x0, lr, maxIter]);

  const displayedSteps = steps.slice(0, currentStep + 1);
  const latestStep = displayedSteps[displayedSteps.length - 1];

  // Path dots for the loss surface chart (current run)
  const pathDots = displayedSteps.map(s => ({ x: s.x, y: s.y }));

  // Convergence chart
  const convergenceData = displayedSteps.map(s => ({ iter: s.iter, loss: s.loss }));

  // Warnings
  const divWarning = steps.length > 0 && isDiverging(steps);
  const slowWarning = steps.length > 0 && isStuck(steps) && !divWarning;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      <PageHeader
        title="Gradient Descent Explorer"
        subtitle="Visualise how gradient descent optimises 1-D functions — tune learning rate, starting point and iterations."
        badge="Beginner"
        category="Optimization"
        icon={<TrendingDown size={22} />}
      />

      <InfoBox type="info" title="Update Rule">
        <span className="font-mono">x_new = x − α · f′(x)</span>
        <span className="ml-4 text-gray-600 dark:text-gray-300">
          where α is the learning rate and f′(x) is the gradient.
        </span>
      </InfoBox>

      {divWarning && (
        <InfoBox type="error" title="Divergence detected!">
          The learning rate is too large. The optimiser is overshooting and the loss is exploding.
          Try reducing α.
        </InfoBox>
      )}
      {slowWarning && (
        <InfoBox type="warning" title="Slow convergence">
          The loss is barely changing. Try a larger learning rate or more iterations.
        </InfoBox>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Controls ── */}
        <div className="space-y-4">
          <Card title="Loss Function">
            {(Object.keys(presetFunctions) as FnKey[]).map(k => (
              <label key={k} className="flex items-center gap-2 py-1.5 cursor-pointer">
                <input
                  type="radio" name="fn" value={k}
                  checked={fnKey === k}
                  onChange={() => { setFnKey(k); resetAll(); }}
                  className="accent-blue-600"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {presetFunctions[k].label}
                </span>
              </label>
            ))}
          </Card>

          <Card title="Parameters">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Learning Rate (α) = {lr.toFixed(4)}
                </label>
                <input type="range" min={0.001} max={1.0} step={0.001} value={lr}
                  onChange={e => { setLr(Number(e.target.value)); resetAll(); }}
                  className="w-full accent-blue-600 mt-1" />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0.001</span><span>1.0</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Starting Point (x₀) = {x0.toFixed(2)}
                </label>
                <input
                  type="range"
                  min={domain[0]}
                  max={domain[1]}
                  step={0.1}
                  value={x0}
                  onChange={e => { setX0(Number(e.target.value)); resetAll(); }}
                  className="w-full accent-blue-600 mt-1"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>{domain[0]}</span><span>{domain[1]}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Max Iterations = {maxIter}
                </label>
                <input type="range" min={10} max={200} step={5} value={maxIter}
                  onChange={e => { setMaxIter(Number(e.target.value)); resetAll(); }}
                  className="w-full accent-blue-600 mt-1" />
              </div>
            </div>
          </Card>

          <Card title="Run Controls">
            <div className="space-y-2">
              <button
                onClick={runGD}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
              >
                <Play size={14} /> Run Full Descent
              </button>
              <button
                onClick={runStep}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg"
              >
                <ChevronRight size={14} /> Step ({currentStep + 1} / {steps.length || '?'})
              </button>
              <button
                onClick={resetAll}
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg"
              >
                Reset
              </button>
              <div className="pt-1 border-t border-gray-100 dark:border-gray-700">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={compareMode}
                    onChange={e => { setCompareMode(e.target.checked); setCompareResults([]); }}
                    className="accent-blue-600"
                  />
                  Comparison Mode (3 LRs)
                </label>
                {compareMode && (
                  <button
                    onClick={runComparison}
                    className="mt-2 w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded-lg"
                  >
                    <AlertTriangle size={12} /> Run Comparison
                  </button>
                )}
              </div>
            </div>
          </Card>

          {/* Step detail */}
          {latestStep && (
            <MetricsPanel
              title={`Step ${latestStep.iter + 1} Details`}
              metrics={[
                { label: 'x', value: latestStep.x, format: 'fixed4' },
                { label: 'f(x)', value: latestStep.loss, format: 'fixed4' },
                { label: 'Gradient f′(x)', value: latestStep.gradient, format: 'fixed4',
                  color: Math.abs(latestStep.gradient) < 0.01 ? 'green' : 'default' },
                { label: 'Iterations', value: displayedSteps.length, format: 'number' },
              ]}
            />
          )}
        </div>

        {/* ── Charts ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Loss surface + path */}
          <Card title={`Loss Surface: ${label}`} subtitle="Dots show the optimisation path">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={[domain[0], domain[1]]}
                  tick={{ fontSize: 10 }}
                  label={{ value: 'x', position: 'insideBottomRight', fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => v.toFixed(4)} labelFormatter={l => `x=${Number(l).toFixed(3)}`} />

                {/* Function curve */}
                <Line
                  data={curve}
                  type="monotone"
                  dataKey="y"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={false}
                  name={label}
                />

                {/* Path scatter */}
                {pathDots.length > 0 && (
                  <Scatter
                    data={pathDots}
                    fill="#3b82f6"
                    opacity={0.8}
                    name="Path"
                  />
                )}

                {/* Starting point vertical */}
                {steps.length > 0 && (
                  <ReferenceLine x={steps[0].x} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'x₀', fontSize: 9, fill: '#f59e0b' }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          {/* Convergence chart */}
          <Card title="Convergence: Loss vs Iteration">
            {convergenceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={convergenceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="iter" tick={{ fontSize: 10 }} label={{ value: 'Iteration', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => v.toFixed(4)} />
                  <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="loss" stroke="#3b82f6" strokeWidth={2} dot={false} name="Loss f(x)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm text-gray-400">
                Run gradient descent to see convergence.
              </div>
            )}
          </Card>

          {/* Comparison mode */}
          {compareMode && compareResults.length > 0 && (
            <Card title="Comparison: 3 Learning Rates" subtitle="Convergence curves overlaid">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="iter" type="number" tick={{ fontSize: 10 }} label={{ value: 'Iteration', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => v.toFixed(4)} />
                  {compareResults.map(({ lr: l, steps: s }, i) => (
                    <Line
                      key={l}
                      data={s.map(step => ({ iter: step.iter, loss: step.loss }))}
                      type="monotone"
                      dataKey="loss"
                      stroke={FN_COLORS[i]}
                      strokeWidth={2}
                      dot={false}
                      name={`α=${l.toFixed(3)}`}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 justify-center">
                {compareResults.map(({ lr: l }, i) => (
                  <span key={l} className="flex items-center gap-1 text-xs">
                    <span className="w-4 h-1 inline-block rounded" style={{ background: FN_COLORS[i] }} />
                    α={l.toFixed(3)}
                    {isDiverging(compareResults[i].steps) ? ' ⚠ diverged' : ''}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Step trail table */}
          {displayedSteps.length > 0 && (
            <Card title="Optimisation Trail" collapsible>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="text-xs w-full font-mono">
                  <thead className="sticky top-0 bg-white dark:bg-gray-800">
                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                      <th className="px-3 py-1.5 text-left">Iter</th>
                      <th className="px-3 py-1.5 text-right">x</th>
                      <th className="px-3 py-1.5 text-right">f(x)</th>
                      <th className="px-3 py-1.5 text-right">f′(x)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedSteps.map((s, i) => (
                      <tr
                        key={i}
                        className={`border-t border-gray-100 dark:border-gray-700/50 ${
                          i === displayedSteps.length - 1 ? 'bg-blue-50 dark:bg-blue-900/20 font-bold' : ''
                        }`}
                      >
                        <td className="px-3 py-1">{s.iter + 1}</td>
                        <td className="px-3 py-1 text-right">{s.x.toFixed(5)}</td>
                        <td className="px-3 py-1 text-right">{s.loss.toFixed(5)}</td>
                        <td className={`px-3 py-1 text-right ${Math.abs(s.gradient) < 0.01 ? 'text-green-600' : ''}`}>
                          {s.gradient.toFixed(5)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Learning Notes */}
      <LearningPanel
        sections={[
          {
            title: 'Gradient Descent Intuition',
            content: (
              <p>Gradient descent iteratively moves x in the direction opposite to the gradient (steepest descent) until it reaches a minimum. The update x ← x − α·f′(x) is repeated until convergence.</p>
            ),
          },
          {
            title: 'Learning Rate Effects',
            content: (
              <ul className="list-disc ml-4 space-y-1">
                <li><strong>Too small</strong>: many iterations needed, may get stuck near start.</li>
                <li><strong>Just right</strong>: smooth convergence to minimum.</li>
                <li><strong>Too large</strong>: overshoots the minimum, may oscillate or diverge.</li>
              </ul>
            ),
          },
          {
            title: 'Local vs Global Minima',
            content: (
              <p>Quadratic and bowl functions have a single global minimum. Cubic and sine functions have local minima — gradient descent may converge to a local minimum depending on the starting point x₀.</p>
            ),
          },
        ]}
      />
    </div>
  );
}
