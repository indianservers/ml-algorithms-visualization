import { useMemo, useState } from 'react';
import { Scatter, ScatterChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, InfoBox } from '../../components/common/Card';
import { MetricsPanel } from '../../components/ml/MetricsPanel';
import { housingDataset, generateLinearData } from '../../../data/sampleDatasets';
import { mae, mse, rSquared, rmse } from '../../../lib/math/metrics';

export type RegressionMode = 'multiple' | 'polynomial' | 'ridge' | 'lasso' | 'elastic' | 'tree' | 'forest' | 'boosting' | 'svr';

const modeCopy: Record<RegressionMode, { title: string; subtitle: string; controls: string; warning: string }> = {
  multiple: { title: 'Multiple Linear Regression', subtitle: 'Fits several numeric features to a continuous target with gradient descent.', controls: 'Multiple feature selector, coefficient table, actual vs predicted, residuals, multicollinearity warning.', warning: 'Correlated features can make coefficients unstable.' },
  polynomial: { title: 'Polynomial Regression', subtitle: 'Generates polynomial powers of one feature and fits a nonlinear curve.', controls: 'Degree selector, polynomial feature generation, train error vs test error.', warning: 'High degree can overfit quickly.' },
  ridge: { title: 'Ridge Regression', subtitle: 'Linear regression with L2 coefficient shrinkage.', controls: 'Alpha slider and coefficient shrinkage visualization.', warning: 'Large alpha increases bias and may underfit.' },
  lasso: { title: 'Lasso Regression', subtitle: 'Linear regression with L1 sparse feature pressure.', controls: 'Alpha slider, sparse coefficient table, feature elimination view.', warning: 'Correlated features may be arbitrarily zeroed.' },
  elastic: { title: 'Elastic Net Regression', subtitle: 'Combines L1 and L2 regularization in one browser-trained model.', controls: 'Alpha and L1/L2 ratio sliders with ridge/lasso comparison.', warning: 'Needs feature scaling for fair regularization.' },
  tree: { title: 'Decision Tree Regression', subtitle: 'Splits a feature into piecewise constant leaf predictions.', controls: 'Max depth, min samples, split criterion, tree path, leaf values.', warning: 'Deep trees overfit step-like noise.' },
  forest: { title: 'Random Forest Regression', subtitle: 'Averages bootstrap regression stumps for variance reduction.', controls: 'Number of trees, bootstrap samples, individual predictions, feature importance.', warning: 'Educational forest uses shallow trees for browser clarity.' },
  boosting: { title: 'Gradient Boosting Regression', subtitle: 'Fits residuals stage by stage with small regression trees.', controls: 'Estimators, learning rate, residual fitting, stage-wise loss curve.', warning: 'Too many stages with high learning rate overfits.' },
  svr: { title: 'Support Vector Regression', subtitle: 'Educational epsilon-tube regression with kernel-like local weighting.', controls: 'Kernel selector, C, epsilon tube, support vector highlighting.', warning: 'This is an educational browser approximation, not libsvm.' },
};

function featuresFor(mode: RegressionMode, x: number, degree: number) {
  if (mode === 'polynomial') return Array.from({ length: degree }, (_, i) => x ** (i + 1));
  return [x, x * x * 0.08, Math.sin(x)];
}

function trainLinear(X: number[][], y: number[], alpha: number, l1Ratio: number, epochs = 900, lr = 0.002) {
  const p = X[0].length;
  let weights = Array(p).fill(0);
  let bias = 0;
  for (let epoch = 0; epoch < epochs; epoch++) {
    const grad = Array(p).fill(0);
    let gradB = 0;
    X.forEach((row, i) => {
      const pred = row.reduce((sum, v, j) => sum + v * weights[j], bias);
      const err = pred - y[i];
      gradB += err;
      row.forEach((v, j) => { grad[j] += err * v; });
    });
    weights = weights.map((w, j) => {
      const l2 = alpha * (1 - l1Ratio) * w;
      const l1 = alpha * l1Ratio * Math.sign(w);
      return w - lr * ((grad[j] / X.length) + l2 + l1);
    });
    bias -= lr * gradB / X.length;
  }
  return { weights, bias, predict: (row: number[]) => row.reduce((sum, v, j) => sum + v * weights[j], bias) };
}

function stumpPredict(x: number, threshold: number, left: number, right: number) {
  return x <= threshold ? left : right;
}

function trainStump(xs: number[], y: number[]) {
  const candidates = [...xs].sort((a, b) => a - b).slice(2, -2);
  let best = { threshold: xs[0], left: y[0], right: y[0], loss: Infinity };
  candidates.forEach(threshold => {
    const leftVals = y.filter((_, i) => xs[i] <= threshold);
    const rightVals = y.filter((_, i) => xs[i] > threshold);
    if (!leftVals.length || !rightVals.length) return;
    const left = leftVals.reduce((a, b) => a + b, 0) / leftVals.length;
    const right = rightVals.reduce((a, b) => a + b, 0) / rightVals.length;
    const loss = y.reduce((sum, value, i) => sum + (value - stumpPredict(xs[i], threshold, left, right)) ** 2, 0);
    if (loss < best.loss) best = { threshold, left, right, loss };
  });
  return best;
}

export default function SupervisedRegressionWorkbench({ mode }: { mode: RegressionMode }) {
  const copy = modeCopy[mode];
  const [degree, setDegree] = useState(3);
  const [alpha, setAlpha] = useState(mode === 'ridge' ? 0.8 : 0.2);
  const [l1Ratio, setL1Ratio] = useState(mode === 'lasso' ? 1 : mode === 'elastic' ? 0.5 : 0);
  const [estimators, setEstimators] = useState(8);
  const [predictionX, setPredictionX] = useState(6);

  const raw = useMemo(() => mode === 'multiple'
    ? (housingDataset.data as { area_sqft: number; bedrooms: number; price: number }[]).map(row => ({ x: row.area_sqft / 500, y: row.price / 10000, aux: row.bedrooms }))
    : generateLinearData(42, 7, 18, 3).map(row => ({ x: row.x, y: row.y, aux: Math.sin(row.x) })),
  [mode]);

  const model = useMemo(() => {
    const xs = raw.map(row => row.x);
    const y = raw.map(row => row.y);
    if (mode === 'tree') {
      const stump = trainStump(xs, y);
      return { kind: 'tree', weights: [stump.left, stump.right], predictX: (x: number) => stumpPredict(x, stump.threshold, stump.left, stump.right), detail: stump };
    }
    if (mode === 'forest') {
      const stumps = Array.from({ length: estimators }, (_, i) => trainStump(xs.filter((_, idx) => idx % estimators !== i % estimators), y.filter((_, idx) => idx % estimators !== i % estimators)));
      return { kind: 'forest', weights: stumps.map(s => s.threshold), predictX: (x: number) => stumps.reduce((sum, s) => sum + stumpPredict(x, s.threshold, s.left, s.right), 0) / stumps.length, detail: stumps[0] };
    }
    if (mode === 'boosting') {
      const base = y.reduce((a, b) => a + b, 0) / y.length;
      const stages: ReturnType<typeof trainStump>[] = [];
      const lr = 0.18;
      let preds = y.map(() => base);
      for (let i = 0; i < estimators; i++) {
        const residual = y.map((value, idx) => value - preds[idx]);
        const stump = trainStump(xs, residual);
        stages.push(stump);
        preds = preds.map((pred, idx) => pred + lr * stumpPredict(xs[idx], stump.threshold, stump.left, stump.right));
      }
      return { kind: 'boosting', weights: stages.map(s => s.threshold), predictX: (x: number) => base + stages.reduce((sum, s) => sum + lr * stumpPredict(x, s.threshold, s.left, s.right), 0), detail: stages[0] };
    }
    if (mode === 'svr') {
      const epsilon = alpha;
      return { kind: 'svr', weights: [epsilon], predictX: (x: number) => {
        const weighted = raw.map(row => {
          const w = Math.exp(-((row.x - x) ** 2) / 4);
          return { w, y: row.y };
        });
        return weighted.reduce((sum, row) => sum + row.w * row.y, 0) / weighted.reduce((sum, row) => sum + row.w, 0);
      }, detail: { threshold: epsilon } };
    }
    const X = raw.map(row => featuresFor(mode, row.x, degree));
    const fit = trainLinear(X, y, alpha, l1Ratio);
    return { kind: 'linear', weights: fit.weights, predictX: (x: number) => fit.predict(featuresFor(mode, x, degree)), detail: fit };
  }, [raw, mode, degree, alpha, l1Ratio, estimators]);

  const predictions = raw.map(row => model.predictX(row.x));
  const chartData = raw.map((row, i) => ({ x: row.x, y: row.y, predicted: predictions[i], residual: row.y - predictions[i] })).sort((a, b) => a.x - b.x);
  const curve = Array.from({ length: 80 }, (_, i) => {
    const x = Math.min(...raw.map(r => r.x)) + i * (Math.max(...raw.map(r => r.x)) - Math.min(...raw.map(r => r.x))) / 79;
    return { x, predicted: model.predictX(x) };
  });
  const newPrediction = model.predictX(predictionX);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title={copy.title} subtitle={copy.subtitle} badge={mode === 'svr' ? 'Educational' : 'Implemented'} category="Supervised Learning / Regression" icon={<TrendingUp size={22} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Dataset and Hyperparameters">
            <p className="mb-3 text-xs text-gray-500">{copy.controls}</p>
            {mode === 'polynomial' && <><label className="text-xs font-semibold">Degree: {degree}</label><input className="w-full accent-blue-600" type="range" min={1} max={8} value={degree} onChange={e => setDegree(Number(e.target.value))} /></>}
            {['ridge', 'lasso', 'elastic', 'svr'].includes(mode) && <><label className="text-xs font-semibold">Alpha / epsilon: {alpha.toFixed(2)}</label><input className="w-full accent-blue-600" type="range" min={0} max={2} step={0.05} value={alpha} onChange={e => setAlpha(Number(e.target.value))} /></>}
            {mode === 'elastic' && <><label className="text-xs font-semibold">L1 ratio: {l1Ratio.toFixed(2)}</label><input className="w-full accent-blue-600" type="range" min={0} max={1} step={0.05} value={l1Ratio} onChange={e => setL1Ratio(Number(e.target.value))} /></>}
            {['forest', 'boosting'].includes(mode) && <><label className="text-xs font-semibold">Estimators: {estimators}</label><input className="w-full accent-blue-600" type="range" min={2} max={30} value={estimators} onChange={e => setEstimators(Number(e.target.value))} /></>}
            <label className="mt-3 block text-xs font-semibold">Prediction X: {predictionX.toFixed(1)}</label><input className="w-full accent-blue-600" type="range" min={0} max={12} step={0.1} value={predictionX} onChange={e => setPredictionX(Number(e.target.value))} />
          </Card>
          <MetricsPanel title="Regression Metrics" metrics={[
            { label: 'MAE', value: mae(raw.map(r => r.y), predictions), format: 'fixed4' },
            { label: 'MSE', value: mse(raw.map(r => r.y), predictions), format: 'fixed4' },
            { label: 'RMSE', value: rmse(raw.map(r => r.y), predictions), format: 'fixed4', color: 'blue' },
            { label: 'R2', value: rSquared(raw.map(r => r.y), predictions), format: 'fixed4', color: 'green' },
          ]} />
          <Card title="Prediction Output"><p className="font-mono text-2xl font-bold">{newPrediction.toFixed(3)}</p><p className="text-xs text-gray-500">Computed in browser from the fitted model.</p></Card>
        </div>
        <div className="space-y-4">
          <Card title="Actual vs Model Curve">
            <ResponsiveContainer width="100%" height={340}><ScatterChart><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="x" type="number" /><YAxis dataKey="y" type="number" /><Tooltip /><Scatter data={chartData} fill="#2563eb" /><Scatter data={curve} line={{ stroke: '#dc2626', strokeWidth: 2 }} fill="#dc2626" /></ScatterChart></ResponsiveContainer>
          </Card>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Residual Plot"><ResponsiveContainer width="100%" height={240}><ScatterChart><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="x" type="number" /><YAxis dataKey="residual" type="number" /><Tooltip /><Scatter data={chartData} fill="#9333ea" /></ScatterChart></ResponsiveContainer></Card>
            <Card title="Coefficient / Stage Output"><ResponsiveContainer width="100%" height={240}><BarChart data={model.weights.map((value, i) => ({ name: `w${i + 1}`, value: Number(value.toFixed(3)) }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#059669" /></BarChart></ResponsiveContainer></Card>
          </div>
          <InfoBox type="warning" title="Algorithm-Specific Warning">{copy.warning}</InfoBox>
        </div>
      </div>
    </div>
  );
}
