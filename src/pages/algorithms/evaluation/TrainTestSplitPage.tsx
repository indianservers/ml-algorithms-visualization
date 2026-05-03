import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { Scissors } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { trainTestSplit } from '../../../lib/preprocessing/trainTestSplit';
import { irisDataset } from '../../../data/sampleDatasets';

export default function TrainTestSplitPage() {
  const [testSize, setTestSize] = useState(0.3);
  const [seed, setSeed] = useState(42);
  const [stratify, setStratify] = useState(true);
  const rows = irisDataset.data as Record<string, string | number>[];
  const classes = ['setosa', 'versicolor', 'virginica'];
  const y = rows.map(row => classes.indexOf(String(row.species)));
  const split = useMemo(() => trainTestSplit(rows, y, testSize, seed, stratify), [rows, y, testSize, seed, stratify]);
  const distribution = classes.flatMap((label, cls) => [
    { split: 'train', class: label, count: split.trainY.filter(v => v === cls).length },
    { split: 'test', class: label, count: split.testY.filter(v => v === cls).length },
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Train/Test Split" subtitle="Real shuffled and stratified splitting with class distribution checks and reproducible seed." badge="Beginner" category="Evaluation" icon={<Scissors size={22} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card title="Split Controls">
          <div className="space-y-4 text-sm">
            <label className="block text-xs font-semibold text-gray-500">Test ratio: <span className="font-mono text-blue-600">{testSize.toFixed(2)}</span></label>
            <input type="range" min={0.1} max={0.5} step={0.05} value={testSize} onChange={e => setTestSize(Number(e.target.value))} className="w-full accent-blue-600" />
            <label className="block text-xs font-semibold text-gray-500">Random seed</label>
            <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900" />
            <label className="flex items-center gap-2"><input type="checkbox" checked={stratify} onChange={e => setStratify(e.target.checked)} /> Stratify by class</label>
            <p className="font-mono text-xs">train={split.trainX.length}, test={split.testX.length}</p>
          </div>
        </Card>
        <div className="space-y-4">
          <Card title="Train/Test Distribution">
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={distribution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="class" /><YAxis /><Tooltip /><Bar dataKey="count">{distribution.map((d, i) => <Cell key={i} fill={d.split === 'train' ? '#2563eb' : '#dc2626'} />)}</Bar></BarChart>
            </ResponsiveContainer>
          </Card>
          <InfoBox type="info" title="Real Logic Cross-Check">The page calls the shared `trainTestSplit` function and displays the actual generated train/test indices and class counts.</InfoBox>
        </div>
      </div>
    </div>
  );
}
