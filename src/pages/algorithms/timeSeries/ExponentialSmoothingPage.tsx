import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { timeSeriesSalesDataset } from '../../../data/sampleDatasets';

export default function ExponentialSmoothingPage() {
  const [alpha, setAlpha] = useState(0.35);
  const rows = timeSeriesSalesDataset.data as { month: string; sales: number }[];
  const chart = useMemo(() => {
    let smooth = rows[0].sales;
    return rows.map((row, i) => {
      smooth = i === 0 ? row.sales : alpha * row.sales + (1 - alpha) * smooth;
      return { month: row.month, sales: row.sales, smoothed: Number(smooth.toFixed(2)) };
    });
  }, [rows, alpha]);
  const forecast = chart[chart.length - 1].smoothed;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Exponential Smoothing" subtitle="Real alpha-weighted smoothing with a browser-computed forecast line." badge="Intermediate" category="Time Series" icon={<Activity size={22} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card title="Alpha Parameter">
          <label className="block text-xs font-semibold text-gray-500">Alpha: <span className="font-mono text-blue-600">{alpha.toFixed(2)}</span></label>
          <input type="range" min={0.05} max={0.95} step={0.05} value={alpha} onChange={e => setAlpha(Number(e.target.value))} className="w-full accent-blue-600" />
          <p className="mt-3 font-mono text-xs">S_t = alpha*y_t + (1-alpha)*S_(t-1)</p>
          <div className="mt-4 rounded bg-blue-50 p-3 dark:bg-blue-900/20"><p className="text-xs">Forecast next value</p><p className="font-mono text-2xl font-bold">{forecast.toFixed(2)}</p></div>
        </Card>
        <div className="space-y-4">
          <Card title="Forecast Chart">
            <ResponsiveContainer width="100%" height={380}><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line dataKey="sales" stroke="#2563eb" dot={false} /><Line dataKey="smoothed" stroke="#059669" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
          </Card>
          <InfoBox type="info" title="Real Logic Cross-Check">The smoothed value is recursively calculated from actual observations and the previous smoothed value.</InfoBox>
        </div>
      </div>
    </div>
  );
}
