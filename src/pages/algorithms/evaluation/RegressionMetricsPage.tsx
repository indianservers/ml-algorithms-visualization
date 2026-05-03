import { useMemo, useState } from 'react';
import { Line, LineChart, Scatter, ScatterChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { BarChart2 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { housingDataset } from '../../../data/sampleDatasets';
import { adjustedRSquared, mae, mape, mse, rSquared, rmse } from '../../../lib/math/metrics';

export default function RegressionMetricsPage() {
  const [bias, setBias] = useState(0);
  const [noise, setNoise] = useState(0.08);
  const actual = (housingDataset.data as { price: number }[]).map(row => row.price / 1000);
  const predicted = useMemo(() => actual.map((value, i) => value * (1 + Math.sin(i * 1.7) * noise) + bias), [actual, bias, noise]);
  const residuals = actual.map((value, i) => ({ index: i + 1, actual: value, predicted: predicted[i], residual: value - predicted[i] }));
  const comparison = residuals.map(row => ({ index: row.index, actual: Number(row.actual.toFixed(2)), predicted: Number(row.predicted.toFixed(2)) }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Regression Metrics" subtitle="Real MAE, MSE, RMSE, MAPE, R2, adjusted R2, actual-vs-predicted, and residual analysis." badge="Beginner" category="Evaluation" icon={<BarChart2 size={22} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card title="Prediction Error Controls">
            <label className="block text-xs font-semibold text-gray-500">Bias: <span className="font-mono text-blue-600">{bias.toFixed(1)}</span></label>
            <input type="range" min={-80} max={80} step={5} value={bias} onChange={e => setBias(Number(e.target.value))} className="mb-4 w-full accent-blue-600" />
            <label className="block text-xs font-semibold text-gray-500">Noise: <span className="font-mono text-blue-600">{noise.toFixed(2)}</span></label>
            <input type="range" min={0} max={0.35} step={0.01} value={noise} onChange={e => setNoise(Number(e.target.value))} className="w-full accent-blue-600" />
          </Card>
          <MetricsPanel title="Computed Metrics" metrics={[
            { label: 'MAE', value: mae(actual, predicted), format: 'fixed4' },
            { label: 'MSE', value: mse(actual, predicted), format: 'fixed4' },
            { label: 'RMSE', value: rmse(actual, predicted), format: 'fixed4', color: 'blue' },
            { label: 'MAPE', value: mape(actual, predicted), format: 'fixed2' },
            { label: 'R2', value: rSquared(actual, predicted), format: 'fixed4', color: 'green' },
            { label: 'Adjusted R2', value: adjustedRSquared(actual, predicted, 5), format: 'fixed4' },
          ]} />
        </div>
        <div className="space-y-4">
          <Card title="Actual vs Predicted">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={comparison}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="index" /><YAxis /><Tooltip /><Line dataKey="actual" stroke="#2563eb" /><Line dataKey="predicted" stroke="#dc2626" /></LineChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Residual Plot">
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" dataKey="predicted" /><YAxis type="number" dataKey="residual" /><Tooltip /><ReferenceLine y={0} stroke="#111827" /><Scatter data={residuals} fill="#9333ea" /></ScatterChart>
            </ResponsiveContainer>
          </Card>
          <InfoBox type="info" title="Real Logic Cross-Check">All metrics are recalculated from actual and predicted arrays on every slider change; residuals are actual minus predicted.</InfoBox>
        </div>
      </div>
    </div>
  );
}
