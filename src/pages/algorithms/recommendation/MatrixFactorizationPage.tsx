import { useMemo, useState } from 'react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Grid3X3 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';

const users = ['User 1', 'User 2', 'User 3', 'User 4', 'User 5'];
const items = ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6'];
const ratings: Array<Array<number | null>> = [
  [5, 3, null, 1, null, 4],
  [4, null, 4, 1, 2, null],
  [null, 1, null, 5, 3, 4],
  [1, 1, null, 4, null, 5],
  [null, null, 5, 4, null, 3],
];

function initMatrix(rows: number, cols: number, offset: number) {
  return Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => 0.12 * Math.sin((row + 1) * (col + 2) + offset)));
}

function dot(a: number[], b: number[]) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function trainMF(k: number, learningRate: number, lambda: number, epochs: number) {
  const P = initMatrix(users.length, k, 0.3);
  const Q = initMatrix(items.length, k, 1.7);
  const known = ratings.flatMap((row, user) => row.map((rating, item) => rating === null ? null : { user, item, rating })).filter(Boolean) as Array<{ user: number; item: number; rating: number }>;
  const snapshots: Array<{ epoch: number; rmse: number; P: number[][]; Q: number[][]; reconstruction: number[][] }> = [];
  for (let epoch = 1; epoch <= epochs; epoch++) {
    known.forEach(entry => {
      const prediction = dot(P[entry.user], Q[entry.item]);
      const error = entry.rating - prediction;
      const oldP = [...P[entry.user]];
      for (let factor = 0; factor < k; factor++) {
        P[entry.user][factor] += learningRate * (error * Q[entry.item][factor] - lambda * P[entry.user][factor]);
        Q[entry.item][factor] += learningRate * (error * oldP[factor] - lambda * Q[entry.item][factor]);
      }
    });
    const reconstruction = P.map(row => Q.map(itemFactors => Math.max(1, Math.min(5, dot(row, itemFactors)))));
    const mse = known.reduce((sum, entry) => sum + (entry.rating - reconstruction[entry.user][entry.item]) ** 2, 0) / known.length;
    snapshots.push({ epoch, rmse: Math.sqrt(mse), P: P.map(row => [...row]), Q: Q.map(row => [...row]), reconstruction });
  }
  return snapshots;
}

function cellColor(value: number, known: boolean) {
  if (known) return 'bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100';
  if (value >= 4) return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100';
  if (value >= 3) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  return 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100';
}

export default function MatrixFactorizationPage() {
  const [k, setK] = useState(2);
  const [learningRate, setLearningRate] = useState(0.02);
  const [lambda, setLambda] = useState(0.03);
  const [epoch, setEpoch] = useState(80);
  const history = useMemo(() => trainMF(k, learningRate, lambda, 200), [k, learningRate, lambda]);
  const snapshot = history[Math.min(epoch - 1, history.length - 1)];
  const factorRange = Math.max(0.01, ...snapshot.P.flat().map(Math.abs), ...snapshot.Q.flat().map(Math.abs));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Matrix Factorization" subtitle="Train low-rank user and item factors with SGD, then watch blank ratings get reconstructed." badge="Intermediate" category="Recommendation" icon={<Grid3X3 size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[330px_1fr]">
        <div className="space-y-4">
          <Card title="Factorization Controls">
            <div className="space-y-4 text-sm">
              <label className="block font-semibold">Latent factors k: {k}<input className="w-full accent-blue-600" type="range" min={1} max={4} value={k} onChange={event => setK(Number(event.target.value))} /></label>
              <label className="block font-semibold">Learning rate: {learningRate.toFixed(3)}<input className="w-full accent-blue-600" type="range" min={0.001} max={0.05} step={0.001} value={learningRate} onChange={event => setLearningRate(Number(event.target.value))} /></label>
              <label className="block font-semibold">Lambda: {lambda.toFixed(3)}<input className="w-full accent-blue-600" type="range" min={0} max={0.1} step={0.001} value={lambda} onChange={event => setLambda(Number(event.target.value))} /></label>
              <label className="block font-semibold">Epoch: {epoch}<input className="w-full accent-blue-600" type="range" min={1} max={200} value={epoch} onChange={event => setEpoch(Number(event.target.value))} /></label>
            </div>
          </Card>
          <MetricsPanel title="Training Metrics" metrics={[
            { label: 'RMSE', value: snapshot.rmse, format: 'fixed4', color: snapshot.rmse < 0.8 ? 'green' : snapshot.rmse < 1.5 ? 'blue' : 'red' },
            { label: 'Epoch', value: snapshot.epoch, format: 'number' },
            { label: 'Known Ratings', value: ratings.flat().filter(value => value !== null).length, format: 'number' },
            { label: 'Latent Factors', value: k, format: 'number' },
          ]} />
          <InfoBox type="info" title="What factors learn">
            User factors P and item factors Q are small vectors. Their dot product reconstructs each rating, while regularization keeps the factors from growing too large.
          </InfoBox>
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Original Matrix">
              <MatrixGrid matrix={ratings.map(row => row.map(value => value ?? null))} />
            </Card>
            <Card title="Reconstructed Matrix">
              <MatrixGrid matrix={snapshot.reconstruction} knownMask={ratings.map(row => row.map(value => value !== null))} />
            </Card>
          </div>
          <Card title="RMSE Curve">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="epoch" />
                <YAxis />
                <Tooltip formatter={(value: number) => value.toFixed(4)} />
                <Line dataKey="rmse" stroke="#2563eb" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="User Factors P">
              <FactorGrid labels={users} matrix={snapshot.P} range={factorRange} />
            </Card>
            <Card title="Item Factors Q">
              <FactorGrid labels={items} matrix={snapshot.Q} range={factorRange} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatrixGrid({ matrix, knownMask }: { matrix: Array<Array<number | null>>; knownMask?: boolean[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-1 text-xs">
        <thead><tr><th /><>{items.map(item => <th key={item} className="rounded bg-gray-100 p-2 dark:bg-gray-800">{item}</th>)}</></tr></thead>
        <tbody>
          {matrix.map((row, user) => (
            <tr key={users[user]}>
              <th className="rounded bg-gray-100 p-2 text-left dark:bg-gray-800">{users[user]}</th>
              {row.map((value, item) => {
                const known = knownMask?.[user]?.[item] ?? value !== null;
                return <td key={item} className={`rounded p-2 text-center font-mono font-bold ${value === null ? 'bg-gray-50 text-gray-400 dark:bg-gray-900' : cellColor(value, known)}`}>{value === null ? '?' : value.toFixed(2)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FactorGrid({ labels, matrix, range }: { labels: string[]; matrix: number[][]; range: number }) {
  return (
    <div className="space-y-1">
      {matrix.map((row, rowIndex) => (
        <div key={labels[rowIndex]} className="grid items-center gap-1" style={{ gridTemplateColumns: `90px repeat(${row.length}, minmax(42px, 1fr))` }}>
          <span className="truncate text-xs font-bold text-gray-600 dark:text-gray-300">{labels[rowIndex]}</span>
          {row.map((value, col) => {
            const alpha = Math.min(0.9, Math.abs(value) / range);
            const color = value >= 0 ? `rgba(37, 99, 235, ${0.12 + alpha})` : `rgba(220, 38, 38, ${0.12 + alpha})`;
            return <span key={col} className="rounded px-2 py-1 text-center font-mono text-xs font-bold" style={{ backgroundColor: color }}>{value.toFixed(2)}</span>;
          })}
        </div>
      ))}
    </div>
  );
}
