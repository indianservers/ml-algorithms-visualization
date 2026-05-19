import { useMemo, useState } from 'react';
import { Line, Scatter, ComposedChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Brain, RotateCcw, Undo2 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { linspace } from '../../../lib/math/statistics';

type DataPoint = { x: number; y: number };
type PosteriorState = { step: number; mu: number; sigma: number };

function trueLine(x: number, index: number, noise: number) {
  return 1.35 * x + Math.sin(index * 1.9 + x * 2.3) * noise * 0.65;
}

function posterior(points: DataPoint[], priorSigma: number, noiseSigma: number) {
  const priorPrecision = 1 / (priorSigma ** 2);
  const noiseVariance = noiseSigma ** 2;
  const precision = points.reduce((sum, point) => sum + (point.x ** 2) / noiseVariance, priorPrecision);
  const weightedMean = points.reduce((sum, point) => sum + (point.x * point.y) / noiseVariance, 0);
  const mu = weightedMean / precision;
  const sigma = Math.sqrt(1 / precision);
  return { mu, sigma };
}

function posteriorHistory(points: DataPoint[], priorSigma: number, noiseSigma: number): PosteriorState[] {
  return [{ step: 0, mu: 0, sigma: priorSigma }, ...points.map((_, index) => {
    const state = posterior(points.slice(0, index + 1), priorSigma, noiseSigma);
    return { step: index + 1, ...state };
  })];
}

export default function BayesianLinearRegressionPage() {
  const [points, setPoints] = useState<DataPoint[]>([
    { x: -2.1, y: -2.6 },
    { x: -0.7, y: -1.0 },
    { x: 1.2, y: 1.7 },
  ]);
  const [noiseSigma, setNoiseSigma] = useState(0.6);
  const [priorSigma, setPriorSigma] = useState(1);

  const post = useMemo(() => posterior(points, priorSigma, noiseSigma), [points, priorSigma, noiseSigma]);
  const history = useMemo(() => posteriorHistory(points, priorSigma, noiseSigma), [points, priorSigma, noiseSigma]);
  const chartData = useMemo(() => linspace(-3, 3, 121).map(x => {
    const priorBand = 2 * priorSigma * Math.abs(x);
    const posteriorBand = 2 * post.sigma * Math.abs(x);
    const y = post.mu * x;
    return {
      x,
      prior: 0,
      priorUpper: priorBand,
      priorLower: -priorBand,
      posterior: y,
      posteriorUpper: y + posteriorBand,
      posteriorLower: y - posteriorBand,
    };
  }), [post, priorSigma]);

  const addPointAtX = (x: number) => {
    const clampedX = Math.max(-3, Math.min(3, x));
    const y = trueLine(clampedX, points.length + 1, noiseSigma);
    setPoints(current => [...current, { x: Number(clampedX.toFixed(2)), y: Number(y.toFixed(2)) }]);
  };

  const reset = () => setPoints([]);
  const undo = () => setPoints(current => current.slice(0, -1));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader
        title="Bayesian Linear Regression"
        subtitle="Click the plot to add observations and watch the slope posterior tighten around the regression line."
        badge="Intermediate"
        category="Probabilistic"
        icon={<Brain size={22} />}
      />

      <InfoBox type="info" title="Conjugate slope update">
        The model estimates only the slope. Prior: slope ~ N(0, sigma0^2). Each point updates precision with x^2 / noise^2 and shifts the posterior mean toward slopes that explain the data.
      </InfoBox>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Bayesian Controls">
            <div className="space-y-4 text-sm">
              <label className="block font-semibold text-gray-700 dark:text-gray-200">Noise sigma: {noiseSigma.toFixed(2)}
                <input className="w-full accent-blue-600" type="range" min={0.1} max={2} step={0.05} value={noiseSigma} onChange={event => setNoiseSigma(Number(event.target.value))} />
              </label>
              <label className="block font-semibold text-gray-700 dark:text-gray-200">Prior sigma0: {priorSigma.toFixed(2)}
                <input className="w-full accent-blue-600" type="range" min={0.1} max={3} step={0.05} value={priorSigma} onChange={event => setPriorSigma(Number(event.target.value))} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={undo} disabled={points.length === 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-gray-200 px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                  <Undo2 size={14} /> Remove last
                </button>
                <button onClick={reset} className="inline-flex min-h-10 items-center justify-center gap-2 rounded bg-gray-900 px-3 text-xs font-bold text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200">
                  <RotateCcw size={14} /> Reset
                </button>
              </div>
            </div>
          </Card>

          <MetricsPanel title="Posterior Summary" metrics={[
            { label: 'mu slope', value: post.mu, format: 'fixed4' },
            { label: 'sigma prior', value: priorSigma, format: 'fixed4' },
            { label: 'sigma posterior', value: post.sigma, format: 'fixed4', color: post.sigma < priorSigma ? 'green' : 'default' },
            { label: 'Data Points', value: points.length, format: 'number' },
          ]} />

          <Card title="Point History">
            <div className="max-h-52 space-y-2 overflow-auto">
              {points.length === 0 ? (
                <p className="rounded border border-dashed border-gray-200 p-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Click the chart to add data points.</p>
              ) : points.map((point, index) => (
                <button
                  key={`${point.x}-${point.y}-${index}`}
                  onClick={() => setPoints(current => current.filter((_, itemIndex) => itemIndex !== index))}
                  className="flex w-full items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-red-50 hover:text-red-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-red-950/30"
                >
                  <span>Point {index + 1}</span>
                  <span className="font-mono">({point.x.toFixed(2)}, {point.y.toFixed(2)})</span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Prior to Posterior Regression Band" subtitle="Click inside the plot to add a new observation. Light gray is prior uncertainty; blue is posterior predictive uncertainty.">
            <ResponsiveContainer width="100%" height={420}>
              <ComposedChart
                data={chartData}
                onClick={event => {
                  if (typeof event?.activeLabel === 'number') addPointAtX(event.activeLabel);
                }}
                margin={{ top: 20, right: 24, left: 4, bottom: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" type="number" domain={[-3, 3]} tick={{ fontSize: 11 }} />
                <YAxis domain={[-6, 6]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => value.toFixed(3)} labelFormatter={label => `x=${Number(label).toFixed(2)}`} />
                <Line dataKey="priorUpper" stroke="#cbd5e1" strokeWidth={1} dot={false} name="Prior +2 sigma" />
                <Line dataKey="priorLower" stroke="#cbd5e1" strokeWidth={1} dot={false} name="Prior -2 sigma" />
                <Line dataKey="prior" stroke="#94a3b8" strokeDasharray="4 4" dot={false} name="Prior mean" />
                <Line dataKey="posteriorUpper" stroke="#93c5fd" strokeWidth={1.5} dot={false} name="Posterior +2 sigma" />
                <Line dataKey="posteriorLower" stroke="#93c5fd" strokeWidth={1.5} dot={false} name="Posterior -2 sigma" />
                <Line dataKey="posterior" stroke="#2563eb" strokeWidth={3} dot={false} name="Posterior mean" />
                <Scatter data={points} dataKey="y" fill="#dc2626" name="Observed points" />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="mu History">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="step" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => value.toFixed(4)} />
                  <Line dataKey="mu" stroke="#2563eb" strokeWidth={2} name="posterior mu" />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
            <Card title="sigma History">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="step" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => value.toFixed(4)} />
                  <Line dataKey="sigma" stroke="#059669" strokeWidth={2} name="posterior sigma" />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
