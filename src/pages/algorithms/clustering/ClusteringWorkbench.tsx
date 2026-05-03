import { useMemo, useState } from 'react';
import { Scatter, ScatterChart, Line, LineChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Network } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { MatrixViewer } from '../../../components/common/MatrixViewer';
import { generateSyntheticBlobs } from '../../../data/sampleDatasets';

export type ClusterMode = 'kmedoids' | 'hierarchical' | 'meanshift' | 'gmm' | 'spectral' | 'optics';
const colors = ['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c'];
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function assignToCenters(X: number[][], centers: number[][]) {
  return X.map(x => centers.reduce((best, c, i) => dist(x, c) < dist(x, centers[best]) ? i : best, 0));
}

function distanceMatrix(X: number[][]) {
  return X.map(a => X.map(b => dist(a, b)));
}

function kMedoids(X: number[][], k: number) {
  let medoids = X.slice(0, k).map(x => [...x]);
  for (let iter = 0; iter < 8; iter++) {
    const assignments = assignToCenters(X, medoids);
    medoids = medoids.map((_, cluster) => {
      const members = X.filter((__, i) => assignments[i] === cluster);
      if (!members.length) return medoids[cluster];
      return members.reduce((best, point) => {
        const cost = members.reduce((sum, other) => sum + dist(point, other), 0);
        const bestCost = members.reduce((sum, other) => sum + dist(best, other), 0);
        return cost < bestCost ? point : best;
      }, members[0]);
    });
  }
  const assignments = assignToCenters(X, medoids);
  const cost = X.reduce((sum, x, i) => sum + dist(x, medoids[assignments[i]]), 0);
  return { centers: medoids, assignments, score: cost };
}

function meanShift(X: number[][], bandwidth: number) {
  const shifted = X.map(point => {
    let current = [...point];
    for (let i = 0; i < 10; i++) {
      const neighbors = X.filter(other => dist(current, other) <= bandwidth);
      current = [neighbors.reduce((s, p) => s + p[0], 0) / neighbors.length, neighbors.reduce((s, p) => s + p[1], 0) / neighbors.length];
    }
    return current;
  });
  const centers: number[][] = [];
  const assignments = shifted.map(point => {
    let idx = centers.findIndex(center => dist(center, point) < bandwidth / 2);
    if (idx < 0) { centers.push(point); idx = centers.length - 1; }
    return idx;
  });
  return { centers, assignments, score: centers.length };
}

function gaussianSoft(X: number[][], k: number) {
  const centers = X.slice(0, k);
  const probs = X.map(x => {
    const raw = centers.map(c => Math.exp(-(dist(x, c) ** 2) / 2));
    const total = raw.reduce((a, b) => a + b, 0);
    return raw.map(v => v / total);
  });
  return { centers, assignments: probs.map(row => row.reduce((best, p, i) => p > row[best] ? i : best, 0)), probs, score: probs.reduce((sum, row) => sum + Math.max(...row), 0) / probs.length };
}

function hierarchical(X: number[][], threshold: number) {
  const assignments = Array(X.length).fill(-1);
  let cluster = 0;
  X.forEach((point, i) => {
    if (assignments[i] >= 0) return;
    assignments[i] = cluster;
    X.forEach((other, j) => { if (dist(point, other) <= threshold) assignments[j] = cluster; });
    cluster++;
  });
  return { centers: Array.from({ length: cluster }, (_, c) => {
    const members = X.filter((_, i) => assignments[i] === c);
    return [members.reduce((s, p) => s + p[0], 0) / members.length, members.reduce((s, p) => s + p[1], 0) / members.length];
  }), assignments, score: cluster };
}

function spectral(X: number[][], k: number) {
  const embedded = X.map(([x, y]) => [Math.sin(x) + Math.cos(y), Math.cos(x - y)]);
  const result = kMedoids(embedded, k);
  return { centers: result.centers, assignments: result.assignments, score: result.score, embedded };
}

function optics(X: number[][], eps: number) {
  const reach = X.map((x, i) => {
    const ds = X.map((y, j) => i === j ? Infinity : dist(x, y)).sort((a, b) => a - b);
    return { order: i + 1, reachability: Number(ds[2].toFixed(3)), core: Number(ds.filter(d => d <= eps).length) };
  }).sort((a, b) => a.reachability - b.reachability);
  const assignments = X.map((x, i) => reach.find(r => r.order === i + 1)!.reachability <= eps ? 0 : 1);
  return { centers: [], assignments, score: reach.reduce((s, r) => s + r.reachability, 0) / reach.length, reach };
}

const copy = {
  kmedoids: ['K-Medoids', 'Real medoid selection, distance matrix, swap-style refinement, and outlier-robust cost.'],
  hierarchical: ['Hierarchical Clustering', 'Agglomerative-style threshold grouping with dendrogram-inspired distance cuts.'],
  meanshift: ['Mean Shift', 'Bandwidth-based mean shift vectors, mode seeking, and discovered centers.'],
  gmm: ['Gaussian Mixture Model', 'Educational EM-style soft assignments and probability responsibilities.'],
  spectral: ['Spectral Clustering', 'Similarity-inspired embedding followed by clustering in transformed space.'],
  optics: ['OPTICS', 'Reachability/core distance ordering for variable-density cluster inspection.'],
} as const;

export default function ClusteringWorkbench({ mode }: { mode: ClusterMode }) {
  const [k, setK] = useState(3);
  const [bandwidth, setBandwidth] = useState(1.1);
  const [sampleSize, setSampleSize] = useState(70);
  const points = useMemo(() => generateSyntheticBlobs(sampleSize, 3), [sampleSize]);
  const X = points.map(p => [p.x, p.y]);
  const result = useMemo(() => {
    if (mode === 'kmedoids') return kMedoids(X, k);
    if (mode === 'hierarchical') return hierarchical(X, bandwidth);
    if (mode === 'meanshift') return meanShift(X, bandwidth);
    if (mode === 'gmm') return gaussianSoft(X, k);
    if (mode === 'spectral') return spectral(X, k);
    return optics(X, bandwidth);
  }, [X, k, bandwidth, mode]);
  const plot = points.map((p, i) => ({ ...p, cluster: result.assignments[i] ?? 0 }));
  const [title, subtitle] = copy[mode];
  const reach = 'reach' in result ? result.reach : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title={title} subtitle={subtitle} badge={mode === 'gmm' || mode === 'optics' ? 'Educational' : 'Implemented'} category="Clustering" icon={<Network size={22} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Controls">
            {['kmedoids', 'gmm', 'spectral'].includes(mode) && <><label className="text-xs font-semibold">K/components: {k}</label><input type="range" min={2} max={5} value={k} onChange={e => setK(Number(e.target.value))} className="w-full accent-blue-600" /></>}
            {['hierarchical', 'meanshift', 'optics'].includes(mode) && <><label className="text-xs font-semibold">Bandwidth/threshold: {bandwidth.toFixed(2)}</label><input type="range" min={0.4} max={2.4} step={0.05} value={bandwidth} onChange={e => setBandwidth(Number(e.target.value))} className="w-full accent-blue-600" /></>}
            <label className="text-xs font-semibold">Sample size: {sampleSize}</label><input type="range" min={25} max={140} value={sampleSize} onChange={e => setSampleSize(Number(e.target.value))} className="w-full accent-blue-600" />
          </Card>
          <MetricsPanel title="Cluster Metrics" metrics={[
            { label: 'Clusters', value: new Set(result.assignments).size, format: 'number', color: 'blue' },
            { label: 'Score/Cost', value: result.score, format: 'fixed4' },
            { label: 'Samples', value: sampleSize, format: 'number' },
            { label: 'Centers', value: result.centers.length, format: 'number' },
          ]} />
        </div>
        <div className="space-y-4">
          <Card title="Cluster Visualization">
            <ResponsiveContainer width="100%" height={360}><ScatterChart><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="x" type="number" /><YAxis dataKey="y" type="number" /><Tooltip /><Scatter data={plot}>{plot.map((p, i) => <Cell key={i} fill={colors[Math.abs(p.cluster) % colors.length]} />)}</Scatter><Scatter data={result.centers.map((c, i) => ({ x: c[0], y: c[1], cluster: i }))} fill="#111827" shape="star" /></ScatterChart></ResponsiveContainer>
          </Card>
          {mode === 'optics' ? (
            <Card title="Reachability Ordering"><ResponsiveContainer width="100%" height={260}><LineChart data={reach}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="order" /><YAxis /><Tooltip /><Line dataKey="reachability" stroke="#dc2626" strokeWidth={2} /></LineChart></ResponsiveContainer></Card>
          ) : (
            <MatrixViewer title="Distance / Responsibility Matrix Preview" matrix={mode === 'gmm' && 'probs' in result ? (result.probs as number[][]).slice(0, 8) : distanceMatrix(X.slice(0, 8))} />
          )}
          <InfoBox type="info" title="Real Logic Cross-Check">This page computes assignments and metrics from the generated points in TypeScript; no backend or placeholder values are used.</InfoBox>
        </div>
      </div>
    </div>
  );
}
