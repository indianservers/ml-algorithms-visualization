import { useMemo, useState } from 'react';
import { Scatter, ScatterChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { Filter } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { mean, std } from '../../../lib/math/statistics';

const values = [52,55,53,58,54,57,56,60,59,61,62,58,57,120,54,55,18,59,60,63,56,57];
const percentile = (arr: number[], p: number) => {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * p)];
};

export default function OutlierDetectionPage() {
  const [method, setMethod] = useState<'z' | 'iqr'>('z');
  const [threshold, setThreshold] = useState(2);
  const stats = useMemo(() => {
    const m = mean(values), s = std(values) || 1;
    const q1 = percentile(values, 0.25), q3 = percentile(values, 0.75), iqr = q3 - q1;
    return values.map((value, i) => {
      const z = (value - m) / s;
      const iqrOutlier = value < q1 - 1.5 * iqr || value > q3 + 1.5 * iqr;
      return { index: i + 1, value, z: Number(z.toFixed(3)), outlier: method === 'z' ? Math.abs(z) >= threshold : iqrOutlier };
    });
  }, [method, threshold]);
  const outlierCount = stats.filter(row => row.outlier).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Outlier Detection" subtitle="Real Z-score and IQR outlier flags with scatter visualization and removal preview." badge="Intermediate" category="Preprocessing" icon={<Filter size={22} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card title="Method Controls">
          <select value={method} onChange={e => setMethod(e.target.value as 'z' | 'iqr')} className="mb-4 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"><option value="z">Z-score</option><option value="iqr">IQR</option></select>
          {method === 'z' && <><label className="block text-xs font-semibold text-gray-500">Z threshold: {threshold.toFixed(1)}</label><input type="range" min={1} max={4} step={0.1} value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="w-full accent-blue-600" /></>}
          <p className="mt-4 font-mono text-sm">outliers={outlierCount}, kept={values.length - outlierCount}</p>
        </Card>
        <div className="space-y-4">
          <Card title="Scatter Plot with Outlier Highlights">
            <ResponsiveContainer width="100%" height={360}><ScatterChart><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="index" type="number" /><YAxis dataKey="value" type="number" /><Tooltip /><Scatter data={stats}>{stats.map((row, i) => <Cell key={i} fill={row.outlier ? '#dc2626' : '#2563eb'} />)}</Scatter></ScatterChart></ResponsiveContainer>
          </Card>
          <InfoBox type="info" title="Real Logic Cross-Check">Z-score uses (x - mean) / std; IQR uses Q1 - 1.5*IQR and Q3 + 1.5*IQR fences.</InfoBox>
        </div>
      </div>
    </div>
  );
}
