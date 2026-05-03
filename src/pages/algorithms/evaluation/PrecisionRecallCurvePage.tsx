import { useMemo, useState } from 'react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import { BarChart2 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { precisionRecallCurve, binaryMetrics } from '../../../lib/math/metrics';

const actual = [1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0];
const scores = [0.97,0.91,0.84,0.73,0.62,0.66,0.54,0.49,0.41,0.35,0.31,0.23,0.17,0.11,0.05,0.58,0.44,0.38,0.27,0.19];

export default function PrecisionRecallCurvePage() {
  const [threshold, setThreshold] = useState(0.5);
  const curve = useMemo(() => precisionRecallCurve(actual, scores), []);
  const chart = curve.precision.map((precision, i) => ({ recall: Number(curve.recall[i].toFixed(3)), precision: Number(precision.toFixed(3)), threshold: curve.thresholds[i] }));
  const predicted = scores.map(score => score >= threshold ? 1 : 0);
  const metrics = binaryMetrics(actual, predicted);
  const avgPrecision = curve.precision.reduce((sum, precision, i) => sum + precision * (i === 0 ? curve.recall[i] : Math.max(0, curve.recall[i] - curve.recall[i - 1])), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Precision-Recall Curve" subtitle="Real threshold sweep for precision, recall, F1, and average precision on an imbalanced classifier." badge="Intermediate" category="Evaluation" icon={<BarChart2 size={22} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card title="Threshold Slider">
            <label className="block text-xs font-semibold text-gray-500">Threshold: <span className="font-mono text-blue-600">{threshold.toFixed(2)}</span></label>
            <input type="range" min={0.01} max={0.99} step={0.01} value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="w-full accent-blue-600" />
          </Card>
          <MetricsPanel title="Current Threshold Metrics" metrics={[
            { label: 'Precision', value: metrics.precision, format: 'percent', color: 'blue' },
            { label: 'Recall', value: metrics.recall, format: 'percent', color: 'green' },
            { label: 'F1', value: metrics.f1, format: 'percent' },
            { label: 'Avg Precision', value: avgPrecision, format: 'fixed4' },
          ]} />
          <InfoBox type="warning" title="Imbalanced Dataset Note">Precision-recall is often more informative than ROC when positives are rare, because false positives strongly affect precision.</InfoBox>
        </div>
        <Card title="Precision vs Recall">
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="recall" domain={[0,1]} /><YAxis domain={[0,1]} /><Tooltip /><ReferenceLine y={metrics.precision} stroke="#2563eb" strokeDasharray="3 3" /><ReferenceLine x={metrics.recall} stroke="#059669" strokeDasharray="3 3" /><Line dataKey="precision" stroke="#dc2626" strokeWidth={2} dot /></LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
