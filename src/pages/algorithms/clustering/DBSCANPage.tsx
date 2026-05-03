import { useMemo, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Network } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { dbscan } from '../../../lib/algorithms/clustering/dbscan';
import { generateSyntheticBlobs, generateSyntheticMoons } from '../../../data/sampleDatasets';

const clusterColors = ['#2563eb', '#059669', '#9333ea', '#ea580c', '#0891b2'];
const typeColor = { core: '#16a34a', border: '#2563eb', noise: '#dc2626' };

export default function DBSCANPage() {
  const [eps, setEps] = useState(0.75);
  const [minPts, setMinPts] = useState(5);
  const [dataset, setDataset] = useState<'moons' | 'blobs'>('moons');
  const [selected, setSelected] = useState(10);

  const points = useMemo(() => dataset === 'moons' ? generateSyntheticMoons(110) : generateSyntheticBlobs(100, 3), [dataset]);
  const X = useMemo(() => points.map(point => [point.x, point.y]), [points]);
  const result = useMemo(() => dbscan(X, eps, minPts), [X, eps, minPts]);

  const plotData = points.map((point, index) => ({
    ...point,
    cluster: result.labels[index],
    pointType: result.pointTypes[index],
    index,
  }));
  const selectedPoint = plotData[selected] ?? plotData[0];
  const neighbors = selectedPoint
    ? plotData.filter(point => Math.hypot(point.x - selectedPoint.x, point.y - selectedPoint.y) <= eps)
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader
        title="DBSCAN"
        subtitle="Real density clustering with epsilon neighborhoods, MinPts, core points, border points, and noise."
        badge="Intermediate"
        category="Clustering"
        icon={<Network size={22} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Density Controls">
            <div className="space-y-4 text-sm">
              <select value={dataset} onChange={event => setDataset(event.target.value as 'moons' | 'blobs')} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                <option value="moons">Synthetic moons dataset</option>
                <option value="blobs">Synthetic blobs dataset</option>
              </select>
              <label className="block text-xs font-semibold text-gray-500">Epsilon radius: <span className="font-mono text-blue-600">{eps.toFixed(2)}</span></label>
              <input type="range" min={0.15} max={1.5} step={0.05} value={eps} onChange={event => setEps(Number(event.target.value))} className="w-full accent-blue-600" />
              <label className="block text-xs font-semibold text-gray-500">MinPts: <span className="font-mono text-blue-600">{minPts}</span></label>
              <input type="range" min={2} max={12} value={minPts} onChange={event => setMinPts(Number(event.target.value))} className="w-full accent-blue-600" />
              <label className="block text-xs font-semibold text-gray-500">Selected point index: <span className="font-mono text-blue-600">{selected}</span></label>
              <input type="range" min={0} max={points.length - 1} value={selected} onChange={event => setSelected(Number(event.target.value))} className="w-full accent-blue-600" />
            </div>
          </Card>

          <MetricsPanel
            title="Density Metrics"
            metrics={[
              { label: 'Clusters', value: result.numClusters, format: 'number', color: 'blue' },
              { label: 'Core Points', value: result.corePoints.length, format: 'number', color: 'green' },
              { label: 'Border Points', value: result.borderPoints.length, format: 'number' },
              { label: 'Noise Points', value: result.noisePoints.length, format: 'number', color: 'red' },
            ]}
          />

          <Card title="Neighborhood Circle">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Point {selected} has <span className="font-mono font-semibold">{neighbors.length}</span> neighbors inside epsilon.
              It is classified as <span className="font-semibold capitalize">{selectedPoint?.pointType}</span>.
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Core, Border, and Noise Points">
            <ResponsiveContainer width="100%" height={430}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="y" tick={{ fontSize: 11 }} />
                <Tooltip content={({ payload }) => {
                  const item = payload?.[0]?.payload;
                  if (!item) return null;
                  return <div className="rounded border border-gray-200 bg-white p-2 text-xs shadow dark:border-gray-700 dark:bg-gray-900">#{item.index} cluster {item.cluster} {item.pointType}</div>;
                }} />
                <Scatter name="DBSCAN labels" data={plotData}>
                  {plotData.map((point, index) => (
                    <Cell key={index} fill={point.cluster < 0 ? typeColor.noise : clusterColors[point.cluster % clusterColors.length]} />
                  ))}
                </Scatter>
                <Scatter name="Selected epsilon center" data={selectedPoint ? [selectedPoint] : []} fill="#111827" shape="star" />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card title="Point Type Counts">
              <div className="space-y-2 text-sm">
                {(['core', 'border', 'noise'] as const).map(type => (
                  <div key={type} className="flex items-center justify-between rounded bg-gray-50 p-2 dark:bg-gray-900">
                    <span className="capitalize" style={{ color: typeColor[type] }}>{type}</span>
                    <span className="font-mono">{result.pointTypes.filter(item => item === type).length}</span>
                  </div>
                ))}
              </div>
            </Card>
            <InfoBox type="info" title="Real Logic Cross-Check">
              Region query counts neighbors within epsilon. A point becomes core when neighbors are at least MinPts; border points are density-reachable from a core point; otherwise the point remains noise.
            </InfoBox>
          </div>
        </div>
      </div>
    </div>
  );
}
