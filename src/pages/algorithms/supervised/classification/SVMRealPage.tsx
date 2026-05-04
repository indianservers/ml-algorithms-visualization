import { useMemo, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../../components/common/Card';
import { MetricsPanel } from '../../../../components/ml/MetricsPanel';
import { generateSyntheticMoons, generateSyntheticBlobs } from '../../../../data/sampleDatasets';
import { binaryMetrics } from '../../../../lib/math/metrics';

type Kernel = 'linear' | 'rbf';

function centers() {
  return [
    [-1.2, -0.6], [-0.4, 0.7], [0.3, -0.8], [1.1, 0.6], [1.8, -0.2],
  ];
}

function features(point: { x: number; y: number }, kernel: Kernel, gamma: number) {
  if (kernel === 'linear') return [point.x, point.y];
  return centers().map(([cx, cy]) => Math.exp(-gamma * ((point.x - cx) ** 2 + (point.y - cy) ** 2)));
}

function trainSvm(points: { x: number; y: number; label: number }[], kernel: Kernel, cValue: number, gamma: number, epochs: number) {
  const X = points.map(point => features(point, kernel, gamma));
  const y = points.map(point => point.label === 1 ? 1 : -1);
  const weights = Array(X[0].length).fill(0);
  let bias = 0;
  const lr = 0.04;
  const lossHistory: Array<{ epoch: number; loss: number; accuracy: number }> = [];
  for (let epoch = 0; epoch < epochs; epoch++) {
    let loss = 0;
    let correct = 0;
    for (let i = 0; i < X.length; i++) {
      const score = X[i].reduce((sum, value, j) => sum + value * weights[j], bias);
      const margin = y[i] * score;
      weights.forEach((_, j) => { weights[j] *= (1 - lr * 0.02); });
      if (margin < 1) {
        for (let j = 0; j < weights.length; j++) weights[j] += lr * cValue * y[i] * X[i][j];
        bias += lr * cValue * y[i];
        loss += 1 - margin;
      }
      correct += (score >= 0 ? 1 : 0) === points[i].label ? 1 : 0;
    }
    if (epoch % 5 === 0 || epoch === epochs - 1) {
      lossHistory.push({ epoch: epoch + 1, loss: Number((loss / X.length).toFixed(4)), accuracy: Number((correct / X.length).toFixed(4)) });
    }
  }
  const score = (point: { x: number; y: number }) => features(point, kernel, gamma).reduce((sum, value, j) => sum + value * weights[j], bias);
  return { weights, bias, score, lossHistory };
}

export default function SVMRealPage() {
  const [kernel, setKernel] = useState<Kernel>('rbf');
  const [dataset, setDataset] = useState<'moons' | 'blobs'>('moons');
  const [cValue, setCValue] = useState(1.2);
  const [gamma, setGamma] = useState(1.4);
  const [epochs, setEpochs] = useState(90);

  const points = useMemo(() => dataset === 'moons'
    ? generateSyntheticMoons(120)
    : generateSyntheticBlobs(120, 2).map(point => ({ ...point, label: point.label === 0 ? 0 : 1 })),
  [dataset]);

  const model = useMemo(() => trainSvm(points, kernel, cValue, gamma, epochs), [points, kernel, cValue, gamma, epochs]);
  const chartPoints = points.map(point => {
    const score = model.score(point);
    return { ...point, score, predicted: score >= 0 ? 1 : 0, support: Math.abs(score) <= 1 };
  });
  const metrics = binaryMetrics(points.map(point => point.label), chartPoints.map(point => point.predicted));
  const boundary = Array.from({ length: 32 }, (_, xi) => Array.from({ length: 28 }, (_, yi) => {
    const x = -2.5 + xi * 0.16;
    const y = -1.8 + yi * 0.14;
    const score = model.score({ x, y });
    return { x, y, score, region: score >= 0 ? 1 : 0 };
  })).flat();

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="SVM Classification" subtitle="Real browser-side hinge-loss support vector classifier with linear and RBF feature maps." badge="Implemented" category="Supervised Learning / Classification" icon={<GitBranch size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="SVM Controls">
            <div className="space-y-4 text-sm">
              <select value={dataset} onChange={event => setDataset(event.target.value as 'moons' | 'blobs')} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                <option value="moons">Synthetic moons</option>
                <option value="blobs">Synthetic blobs</option>
              </select>
              <select value={kernel} onChange={event => setKernel(event.target.value as Kernel)} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                <option value="rbf">RBF feature map</option>
                <option value="linear">Linear margin</option>
              </select>
              <label className="block">C: <b>{cValue.toFixed(1)}</b><input type="range" min={0.2} max={4} step={0.1} value={cValue} onChange={event => setCValue(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              <label className="block">Gamma: <b>{gamma.toFixed(1)}</b><input type="range" min={0.2} max={4} step={0.1} value={gamma} onChange={event => setGamma(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              <label className="block">Epochs: <b>{epochs}</b><input type="range" min={20} max={180} step={10} value={epochs} onChange={event => setEpochs(Number(event.target.value))} className="w-full accent-blue-600" /></label>
            </div>
          </Card>
          <MetricsPanel title="SVM Metrics" metrics={[
            { label: 'Accuracy', value: metrics.accuracy, format: 'percent', color: 'green' },
            { label: 'Precision', value: metrics.precision, format: 'percent' },
            { label: 'Recall', value: metrics.recall, format: 'percent' },
            { label: 'Support Vectors', value: chartPoints.filter(point => point.support).length, format: 'number', color: 'blue' },
          ]} />
        </div>
        <div className="space-y-4">
          <Card title="Decision Boundary, Margin, and Support Vectors">
            <ResponsiveContainer width="100%" height={390}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" />
                <YAxis type="number" dataKey="y" />
                <Tooltip />
                <Scatter data={boundary} opacity={0.18}>
                  {boundary.map((point, index) => <Cell key={index} fill={point.region ? '#059669' : '#2563eb'} />)}
                </Scatter>
                <Scatter data={chartPoints}>
                  {chartPoints.map((point, index) => <Cell key={index} fill={point.support ? '#dc2626' : point.label ? '#065f46' : '#1d4ed8'} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Hinge Loss and Accuracy">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={model.lossHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="epoch" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line dataKey="loss" stroke="#dc2626" dot={false} />
                <Line dataKey="accuracy" stroke="#059669" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <InfoBox type="success" title="Real SVM Logic">
            This page optimizes hinge loss with L2 regularization. The RBF option maps points through radial basis features before fitting the separating margin.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
