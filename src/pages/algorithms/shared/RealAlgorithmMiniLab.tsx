import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, BarChart3, BrainCircuit, Filter, Grid3X3, LineChart as LineIcon, Sigma, Zap } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart,
  ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { housingDataset, studentMarksDataset, timeSeriesSalesDataset } from '../../../data/sampleDatasets';
import { multipleLinearRegression, polynomialFeatures, simpleLinearRegression } from '../../../lib/algorithms/regression/linearRegression';
import { rmse } from '../../../lib/math/metrics';
import { mean, std } from '../../../lib/math/statistics';

type Mode =
  | 'cross-validation'
  | 'bias-variance'
  | 'feature-selection'
  | 'polynomial-features'
  | 'holt-winters'
  | 'anomaly-detection'
  | 'multi-armed-bandit'
  | 'edge-detection';

const copy: Record<Mode, { title: string; category: string; subtitle: string; icon: ReactNode }> = {
  'cross-validation': {
    title: 'Cross Validation',
    category: 'Evaluation',
    subtitle: 'Real k-fold cross validation on housing data with fold-by-fold RMSE and R2-style fit inspection.',
    icon: <BarChart3 size={22} />,
  },
  'bias-variance': {
    title: 'Bias-Variance Tradeoff',
    category: 'Evaluation',
    subtitle: 'Real polynomial regression simulation showing underfit, balanced fit, and overfit behavior.',
    icon: <Sigma size={22} />,
  },
  'feature-selection': {
    title: 'Feature Selection',
    category: 'Preprocessing',
    subtitle: 'Real correlation ranking and top-k regression on the housing dataset.',
    icon: <Filter size={22} />,
  },
  'polynomial-features': {
    title: 'Polynomial Features',
    category: 'Preprocessing',
    subtitle: 'Real polynomial expansion for one numeric feature with fitted curve and RMSE.',
    icon: <LineIcon size={22} />,
  },
  'holt-winters': {
    title: 'Holt-Winters',
    category: 'Time Series',
    subtitle: 'Real additive triple exponential smoothing with level, trend, seasonality, and forecast.',
    icon: <Activity size={22} />,
  },
  'anomaly-detection': {
    title: 'Time Series Anomaly Detection',
    category: 'Time Series',
    subtitle: 'Real rolling-baseline residual z-score anomaly detection on local sales data.',
    icon: <Zap size={22} />,
  },
  'multi-armed-bandit': {
    title: 'Multi-Armed Bandit',
    category: 'Reinforcement Learning',
    subtitle: 'Real epsilon-greedy reward simulation with action counts, value estimates, and regret.',
    icon: <BrainCircuit size={22} />,
  },
  'edge-detection': {
    title: 'Edge Detection',
    category: 'Computer Vision',
    subtitle: 'Real Sobel convolution over an editable synthetic grayscale image grid.',
    icon: <Grid3X3 size={22} />,
  },
};

function correlation(a: number[], b: number[]) {
  const ma = mean(a), mb = mean(b);
  const numerator = a.reduce((sum, value, i) => sum + (value - ma) * (b[i] - mb), 0);
  const denominator = Math.sqrt(a.reduce((sum, value) => sum + (value - ma) ** 2, 0) * b.reduce((sum, value) => sum + (value - mb) ** 2, 0));
  return denominator === 0 ? 0 : numerator / denominator;
}

function seededNoise(index: number) {
  return Math.sin(index * 12.9898) * 43758.5453 % 1;
}

function fitPolynomial(points: { x: number; y: number }[], degree: number) {
  const X = polynomialFeatures(points.map(point => point.x), degree);
  const y = points.map(point => point.y);
  return multipleLinearRegression(X, y);
}

function metricCard(label: string, value: string | number) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

export default function RealAlgorithmMiniLab({ mode }: { mode: Mode }) {
  const [folds, setFolds] = useState(5);
  const [degree, setDegree] = useState(3);
  const [topK, setTopK] = useState(3);
  const [threshold, setThreshold] = useState(1.5);
  const [epsilon, setEpsilon] = useState(0.18);
  const [pulls, setPulls] = useState(120);
  const [alpha, setAlpha] = useState(0.35);
  const [beta, setBeta] = useState(0.15);
  const [gamma, setGamma] = useState(0.25);
  const meta = copy[mode];

  const result = useMemo(() => {
    if (mode === 'cross-validation') {
      const rows = housingDataset.data as Array<Record<string, number>>;
      const x = rows.map(row => row.area_sqft / 1000);
      const y = rows.map(row => row.price / 1000);
      const foldItems = Array.from({ length: folds }, (_, fold) => {
        const testIdx = rows.map((_, i) => i).filter(i => i % folds === fold);
        const trainIdx = rows.map((_, i) => i).filter(i => i % folds !== fold);
        const model = simpleLinearRegression(trainIdx.map(i => x[i]), trainIdx.map(i => y[i]));
        const actual = testIdx.map(i => y[i]);
        const predicted = testIdx.map(i => model.predict(x[i]));
        return { fold: fold + 1, rmse: Number(rmse(actual, predicted).toFixed(2)), testSize: testIdx.length };
      });
      return { chart: foldItems, metrics: { 'Mean RMSE': mean(foldItems.map(item => item.rmse)).toFixed(2), Folds: folds, Samples: rows.length }, note: 'Each fold trains on k-1 partitions and evaluates on the held-out partition.' };
    }

    if (mode === 'bias-variance') {
      const points = Array.from({ length: 34 }, (_, i) => {
        const x = -3 + i * 0.18;
        return { x, y: Math.sin(x) + seededNoise(i) * 0.28 };
      });
      const train = points.filter((_, i) => i % 3 !== 0);
      const test = points.filter((_, i) => i % 3 === 0);
      const model = fitPolynomial(train, degree);
      const chart = points.map(point => ({ ...point, predicted: model.predict(polynomialFeatures([point.x], degree)[0]) }));
      const trainRmse = rmse(train.map(p => p.y), train.map(p => model.predict(polynomialFeatures([p.x], degree)[0])));
      const testRmse = rmse(test.map(p => p.y), test.map(p => model.predict(polynomialFeatures([p.x], degree)[0])));
      return { chart, metrics: { 'Train RMSE': trainRmse.toFixed(3), 'Test RMSE': testRmse.toFixed(3), Degree: degree }, note: degree <= 1 ? 'Low degree tends to high bias.' : degree >= 7 ? 'High degree can chase noise and increase variance.' : 'Moderate degree balances structure and noise.' };
    }

    if (mode === 'feature-selection') {
      const rows = housingDataset.data as Array<Record<string, number>>;
      const features = ['area_sqft', 'bedrooms', 'bathrooms', 'age_years', 'distance_center'];
      const y = rows.map(row => row.price / 1000);
      const ranked = features.map(feature => ({
        feature,
        score: Math.abs(correlation(rows.map(row => row[feature]), y)),
      })).sort((a, b) => b.score - a.score);
      const selected = ranked.slice(0, topK).map(item => item.feature);
      const X = rows.map(row => selected.map(feature => row[feature]));
      const model = multipleLinearRegression(X, y);
      const predicted = X.map(row => model.predict(row));
      return { chart: ranked.map(item => ({ feature: item.feature, score: Number(item.score.toFixed(3)), selected: selected.includes(item.feature) ? item.score : 0 })), metrics: { 'Selected Features': topK, RMSE: rmse(y, predicted).toFixed(2), 'Top Feature': ranked[0].feature }, note: 'Features are ranked by absolute Pearson correlation to price, then top-k features feed a linear model.' };
    }

    if (mode === 'polynomial-features') {
      const rows = studentMarksDataset.data as Array<{ study_hours: number; marks: number }>;
      const model = fitPolynomial(rows.map(row => ({ x: row.study_hours, y: row.marks })), degree);
      const chart = rows.map(row => ({ x: row.study_hours, y: row.marks, predicted: model.predict(polynomialFeatures([row.study_hours], degree)[0]) })).sort((a, b) => a.x - b.x);
      return { chart, metrics: { Degree: degree, Terms: degree, RMSE: rmse(chart.map(row => row.y), chart.map(row => row.predicted)).toFixed(2) }, note: `Each input x expands into ${Array.from({ length: degree }, (_, i) => `x^${i + 1}`).join(', ')}.` };
    }

    if (mode === 'holt-winters') {
      const rows = timeSeriesSalesDataset.data as Array<{ month: string; sales: number }>;
      const seasonLength = 12;
      let level = rows[0].sales;
      let trend = (rows[seasonLength]?.sales - rows[0].sales) / seasonLength || 0;
      const seasonals = Array.from({ length: seasonLength }, (_, i) => rows[i].sales - mean(rows.slice(0, seasonLength).map(row => row.sales)));
      const chart = rows.map((row, i) => {
        const seasonal = seasonals[i % seasonLength] || 0;
        const fitted = level + trend + seasonal;
        const lastLevel = level;
        level = alpha * (row.sales - seasonal) + (1 - alpha) * (level + trend);
        trend = beta * (level - lastLevel) + (1 - beta) * trend;
        seasonals[i % seasonLength] = gamma * (row.sales - level) + (1 - gamma) * seasonal;
        return { month: row.month, sales: row.sales, fitted: Number(fitted.toFixed(1)) };
      });
      const forecast = level + trend + seasonals[rows.length % seasonLength];
      return { chart, metrics: { Forecast: forecast.toFixed(1), Alpha: alpha.toFixed(2), RMSE: rmse(chart.map(row => row.sales), chart.map(row => row.fitted)).toFixed(1) }, note: 'Additive Holt-Winters updates level, trend, and seasonal components at every time step.' };
    }

    if (mode === 'anomaly-detection') {
      const baseRows = timeSeriesSalesDataset.data as Array<{ month: string; sales: number }>;
      const rows = baseRows.map((row, i) => ({ ...row, sales: i === 17 ? row.sales + 650 : i === 9 ? row.sales - 420 : row.sales }));
      const residuals = rows.map((row, i) => {
        const start = Math.max(0, i - 4);
        const baseline = mean(rows.slice(start, Math.max(i, 1)).map(item => item.sales));
        return row.sales - baseline;
      });
      const sigma = std(residuals) || 1;
      const chart = rows.map((row, i) => ({ ...row, baseline: row.sales - residuals[i], z: residuals[i] / sigma, anomaly: Math.abs(residuals[i] / sigma) >= threshold ? row.sales : null }));
      return { chart, metrics: { Anomalies: chart.filter(row => row.anomaly !== null).length, Threshold: threshold.toFixed(1), 'Residual SD': sigma.toFixed(1) }, note: 'A point is flagged when its rolling-baseline residual exceeds the z-score threshold.' };
    }

    if (mode === 'multi-armed-bandit') {
      const trueRates = [0.18, 0.32, 0.48, 0.62];
      const estimates = trueRates.map(() => 0);
      const counts = trueRates.map(() => 0);
      let reward = 0;
      let regret = 0;
      const chart = Array.from({ length: pulls }, (_, t) => {
        const explore = Math.abs(seededNoise(t + 91)) < epsilon;
        const arm = explore ? t % trueRates.length : estimates.indexOf(Math.max(...estimates));
        const win = Math.abs(seededNoise(t + arm * 17)) < trueRates[arm] ? 1 : 0;
        counts[arm]++;
        reward += win;
        regret += Math.max(...trueRates) - trueRates[arm];
        estimates[arm] += (win - estimates[arm]) / counts[arm];
        return { step: t + 1, reward, regret: Number(regret.toFixed(2)), arm };
      });
      return { chart, metrics: { Reward: reward, Regret: regret.toFixed(2), 'Best Estimate': estimates.indexOf(Math.max(...estimates)) + 1 }, note: 'Epsilon-greedy explores randomly sometimes, otherwise it pulls the arm with the highest estimated reward.' };
    }

    const image = Array.from({ length: 8 }, (_, y) => Array.from({ length: 8 }, (_, x) => (x > 3 ? 220 : 35) + (y > 4 ? 25 : 0)));
    const gx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const gy = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    const cells = image.flatMap((row, y) => row.map((value, x) => {
      let sx = 0, sy = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const pixel = image[y + dy]?.[x + dx] ?? value;
        sx += pixel * gx[dy + 1][dx + 1];
        sy += pixel * gy[dy + 1][dx + 1];
      }
      const edge = Math.sqrt(sx ** 2 + sy ** 2);
      return { x, y, value, edge: Number(edge.toFixed(1)), active: edge >= threshold * 120 };
    }));
    return { chart: cells, metrics: { 'Edge Pixels': cells.filter(cell => cell.active).length, Threshold: threshold.toFixed(1), Kernel: 'Sobel' }, note: 'Sobel computes horizontal and vertical gradients, then combines them into edge magnitude.' };
  }, [alpha, beta, degree, epsilon, folds, gamma, mode, pulls, threshold, topK]);

  const renderChart = () => {
    const chartRows = result.chart as Array<Record<string, unknown>>;
    if (mode === 'feature-selection') {
      return <ResponsiveContainer width="100%" height={340}><BarChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="feature" tick={{ fontSize: 11 }} /><YAxis /><Tooltip /><Bar dataKey="score" fill="#2563eb" /></BarChart></ResponsiveContainer>;
    }
    if (mode === 'cross-validation') {
      return <ResponsiveContainer width="100%" height={340}><BarChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="fold" /><YAxis /><Tooltip /><Bar dataKey="rmse" fill="#dc2626" /></BarChart></ResponsiveContainer>;
    }
    if (mode === 'multi-armed-bandit') {
      return <ResponsiveContainer width="100%" height={340}><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="step" /><YAxis /><Tooltip /><Legend /><Line dataKey="reward" stroke="#059669" dot={false} /><Line dataKey="regret" stroke="#dc2626" dot={false} /></LineChart></ResponsiveContainer>;
    }
    if (mode === 'edge-detection') {
      return (
        <div className="grid grid-cols-8 gap-1">
          {chartRows.map(cell => {
            const x = Number(cell.x);
            const y = Number(cell.y);
            const value = Number(cell.value);
            const edge = Number(cell.edge);
            const active = Boolean(cell.active);
            return (
              <div key={`${x}-${y}`} className="aspect-square rounded border border-gray-200 dark:border-gray-700" title={`edge=${edge}`} style={{ backgroundColor: active ? '#dc2626' : `rgb(${value}, ${value}, ${value})` }} />
            );
          })}
        </div>
      );
    }
    if (mode === 'bias-variance' || mode === 'polynomial-features') {
      return <ResponsiveContainer width="100%" height={340}><ComposedChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="x" /><YAxis /><Tooltip /><Scatter dataKey="y" fill="#2563eb" /><Line dataKey="predicted" stroke="#dc2626" dot={false} strokeWidth={2} /></ComposedChart></ResponsiveContainer>;
    }
    return <ResponsiveContainer width="100%" height={340}><LineChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Legend /><Line dataKey="sales" stroke="#2563eb" dot={false} /><Line dataKey={mode === 'anomaly-detection' ? 'baseline' : 'fitted'} stroke="#059669" dot={false} /><Line dataKey="anomaly" stroke="#dc2626" strokeWidth={0} dot={{ r: 5 }} /></LineChart></ResponsiveContainer>;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title={meta.title} subtitle={meta.subtitle} badge="Intermediate" category={meta.category} icon={meta.icon} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card title="Controls">
            <div className="space-y-4 text-sm">
              {['cross-validation'].includes(mode) && <label className="block">Folds: <b>{folds}</b><input type="range" min={3} max={8} value={folds} onChange={event => setFolds(Number(event.target.value))} className="w-full accent-blue-600" /></label>}
              {['bias-variance', 'polynomial-features'].includes(mode) && <label className="block">Degree: <b>{degree}</b><input type="range" min={1} max={9} value={degree} onChange={event => setDegree(Number(event.target.value))} className="w-full accent-blue-600" /></label>}
              {mode === 'feature-selection' && <label className="block">Top features: <b>{topK}</b><input type="range" min={1} max={5} value={topK} onChange={event => setTopK(Number(event.target.value))} className="w-full accent-blue-600" /></label>}
              {['anomaly-detection', 'edge-detection'].includes(mode) && <label className="block">Threshold: <b>{threshold.toFixed(1)}</b><input type="range" min={0.5} max={3} step={0.1} value={threshold} onChange={event => setThreshold(Number(event.target.value))} className="w-full accent-blue-600" /></label>}
              {mode === 'multi-armed-bandit' && <>
                <label className="block">Epsilon: <b>{epsilon.toFixed(2)}</b><input type="range" min={0} max={0.7} step={0.01} value={epsilon} onChange={event => setEpsilon(Number(event.target.value))} className="w-full accent-blue-600" /></label>
                <label className="block">Pulls: <b>{pulls}</b><input type="range" min={40} max={300} step={10} value={pulls} onChange={event => setPulls(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              </>}
              {mode === 'holt-winters' && <>
                <label className="block">Alpha: <b>{alpha.toFixed(2)}</b><input type="range" min={0.05} max={0.9} step={0.05} value={alpha} onChange={event => setAlpha(Number(event.target.value))} className="w-full accent-blue-600" /></label>
                <label className="block">Beta: <b>{beta.toFixed(2)}</b><input type="range" min={0.05} max={0.7} step={0.05} value={beta} onChange={event => setBeta(Number(event.target.value))} className="w-full accent-blue-600" /></label>
                <label className="block">Gamma: <b>{gamma.toFixed(2)}</b><input type="range" min={0.05} max={0.8} step={0.05} value={gamma} onChange={event => setGamma(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              </>}
            </div>
          </Card>
          <Card title="Metrics">
            <div className="grid gap-2">{Object.entries(result.metrics).map(([label, value]) => <div key={label}>{metricCard(label, value)}</div>)}</div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title={`${meta.title} Visualization`}>{renderChart()}</Card>
          <InfoBox type="success" title="Real Implementation">{result.note}</InfoBox>
          <Card title="Algorithm Steps">
            <ol className="grid gap-2 text-sm text-gray-700 dark:text-gray-200 md:grid-cols-2">
              {['Load local dataset', 'Apply route-specific computation', 'Update chart and metrics from real output', 'Change one control and compare behavior'].map((step, index) => (
                <li key={step} className="rounded border border-gray-200 p-3 dark:border-gray-700"><span className="font-mono text-xs text-gray-400">{index + 1}.</span> {step}</li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
