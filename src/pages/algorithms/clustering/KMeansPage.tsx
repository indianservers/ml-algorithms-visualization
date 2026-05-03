import { useMemo, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { Network, Play, RotateCcw } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { kmeans, elbowMethod } from '../../../lib/algorithms/clustering/kmeans';
import { generateSyntheticBlobs, mallCustomersDataset } from '../../../data/sampleDatasets';

const colors = ['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];

export default function KMeansPage() {
  const [k, setK] = useState(3);
  const [init, setInit] = useState<'random' | 'kmeans++'>('kmeans++');
  const [maxIter, setMaxIter] = useState(25);
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<'synthetic' | 'mall'>('synthetic');
  const [seed, setSeed] = useState(1);

  const data = useMemo(() => {
    if (source === 'mall') {
      return (mallCustomersDataset.data as { annual_income: number; spending_score: number }[])
        .map(row => ({ x: row.annual_income / 20 - 2, y: row.spending_score / 20 - 2, label: 0 }));
    }
    return generateSyntheticBlobs(90, 3 + (seed % 2));
  }, [source, seed]);

  const X = useMemo(() => data.map(point => [point.x, point.y]), [data]);
  const result = useMemo(() => kmeans(X, k, maxIter, init), [X, k, maxIter, init]);
  const activeStep = result.steps[Math.min(step, result.steps.length - 1)] ?? result.steps[0];
  const elbow = useMemo(() => elbowMethod(X, 8).map((inertia, i) => ({ k: i + 2, inertia: Number(inertia.toFixed(2)) })), [X]);

  const plotData = data.map((point, index) => ({
    ...point,
    cluster: activeStep?.assignments[index] ?? result.assignments[index],
  }));
  const centroids = (activeStep?.centroids ?? result.centroids).map((centroid, index) => ({
    x: centroid[0],
    y: centroid[1],
    cluster: index,
  }));
  const movement = result.steps.map(item => ({ iteration: item.iteration, inertia: Number(item.inertia.toFixed(3)) }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader
        title="K-Means Clustering"
        subtitle="Real browser-side K-Means with centroid initialization, assignment/update steps, inertia, and elbow analysis."
        badge="Beginner"
        category="Clustering"
        icon={<Network size={22} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Dataset and Hyperparameters">
            <div className="space-y-4 text-sm">
              <label className="block text-xs font-semibold text-gray-500">Built-in sample dataset</label>
              <select value={source} onChange={event => setSource(event.target.value as 'synthetic' | 'mall')} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                <option value="synthetic">Synthetic blobs dataset</option>
                <option value="mall">Mall customers clustering dataset</option>
              </select>
              <label className="block text-xs font-semibold text-gray-500">K: <span className="font-mono text-blue-600">{k}</span></label>
              <input type="range" min={2} max={6} value={k} onChange={event => { setK(Number(event.target.value)); setStep(0); }} className="w-full accent-blue-600" />
              <label className="block text-xs font-semibold text-gray-500">Initialization</label>
              <select value={init} onChange={event => { setInit(event.target.value as 'random' | 'kmeans++'); setStep(0); }} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                <option value="kmeans++">K-means++</option>
                <option value="random">Random centroid initialization</option>
              </select>
              <label className="block text-xs font-semibold text-gray-500">Max iterations: <span className="font-mono text-blue-600">{maxIter}</span></label>
              <input type="range" min={3} max={60} value={maxIter} onChange={event => setMaxIter(Number(event.target.value))} className="w-full accent-blue-600" />
            </div>
          </Card>

          <Card title="Training Controls">
            <div className="flex gap-2">
              <button onClick={() => setStep(s => Math.min(s + 1, result.steps.length - 1))} className="flex flex-1 items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white"><Play size={14} /> Step</button>
              <button onClick={() => { setStep(0); setSeed(s => s + 1); }} className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"><RotateCcw size={14} /> Reset</button>
            </div>
            <p className="mt-3 text-xs text-gray-500">Current iteration: {activeStep?.iteration ?? 0} / {Math.max(result.steps.length - 1, 0)}</p>
          </Card>

          <MetricsPanel
            title="Cluster Metrics"
            metrics={[
              { label: 'Inertia/SSE', value: result.inertia, format: 'fixed4', color: 'blue' },
              { label: 'Iterations', value: result.steps.length, format: 'number' },
              { label: 'Clusters', value: k, format: 'number' },
              { label: 'Converged', value: result.converged ? 'Yes' : 'No' },
            ]}
          />
        </div>

        <div className="space-y-4">
          <Card title="Centroids, Assignments, and Movement Path">
            <ResponsiveContainer width="100%" height={390}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="y" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Scatter name="Assigned points" data={plotData}>
                  {plotData.map((point, index) => <Cell key={index} fill={colors[point.cluster % colors.length]} />)}
                </Scatter>
                <Scatter name="Centroids" data={centroids} fill="#111827" shape="star" />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Inertia by Iteration">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={movement}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="iteration" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="inertia" stroke="#2563eb" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Elbow Method">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={elbow}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="k" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="inertia" stroke="#059669" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <InfoBox type="info" title="Real Logic Cross-Check">
            Assignments are recomputed from Euclidean distance to centroids; centroids are recomputed as cluster means; inertia is the sum of squared distances to assigned centroids.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
