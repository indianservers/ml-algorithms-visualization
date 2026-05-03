import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { timeSeriesSalesDataset } from '../../../data/sampleDatasets';

export default function MovingAveragePage() {
  const [windowSize, setWindowSize] = useState(3);
  const rows = timeSeriesSalesDataset.data as { month: string; sales: number }[];
  const chart = useMemo(() => rows.map((row, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const slice = rows.slice(start, i + 1);
    const movingAverage = slice.reduce((sum, item) => sum + item.sales, 0) / slice.length;
    return { month: row.month, sales: row.sales, movingAverage: Number(movingAverage.toFixed(2)) };
  }), [rows, windowSize]);
  const forecast = chart.slice(-windowSize).reduce((sum, row) => sum + row.sales, 0) / windowSize;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Moving Average" subtitle="Real rolling-window smoothing and next-value forecast from local time-series data." badge="Beginner" category="Time Series" icon={<Activity size={22} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card title="Window and Forecast">
          <label className="block text-xs font-semibold text-gray-500">Window size: <span className="font-mono text-blue-600">{windowSize}</span></label>
          <input type="range" min={2} max={8} value={windowSize} onChange={e => setWindowSize(Number(e.target.value))} className="w-full accent-blue-600" />
          <div className="mt-4 rounded bg-blue-50 p-3 dark:bg-blue-900/20"><p className="text-xs text-blue-700 dark:text-blue-300">Forecast next value</p><p className="font-mono text-2xl font-bold">{forecast.toFixed(2)}</p></div>
        </Card>
        <div className="space-y-4">
          <Card title="Sales and Smoothing Line">
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Line dataKey="sales" stroke="#2563eb" dot={false} /><Line dataKey="movingAverage" stroke="#dc2626" strokeWidth={2} dot={false} /></LineChart>
            </ResponsiveContainer>
          </Card>
          <InfoBox type="info" title="Real Logic Cross-Check">Each smoothed point is the arithmetic mean of the last N observed sales values; the forecast uses the last complete window.</InfoBox>
        </div>
      </div>
    </div>
  );
}
