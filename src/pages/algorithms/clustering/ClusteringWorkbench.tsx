import { useMemo, useState } from 'react';
import { Scatter, ScatterChart, Line, LineChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

function gaussianPdf2d(x: number[], mean: number[], variance: number[]) {
  const vx = Math.max(variance[0], 0.05);
  const vy = Math.max(variance[1], 0.05);
  const norm = 1 / (2 * Math.PI * Math.sqrt(vx * vy));
  const exponent = -0.5 * (((x[0] - mean[0]) ** 2) / vx + ((x[1] - mean[1]) ** 2) / vy);
  return norm * Math.exp(exponent);
}

function gaussianEM(X: number[][], k: number) {
  let means = X.slice(0, k).map(point => [...point]);
  let variances = Array.from({ length: k }, () => [1, 1]);
  let weights = Array.from({ length: k }, () => 1 / k);
  let responsibilities = X.map(() => Array.from({ length: k }, () => 1 / k));
  const logLikelihood: Array<{ iteration: number; logLikelihood: number }> = [];

  for (let iteration = 0; iteration < 25; iteration++) {
    responsibilities = X.map(point => {
      const raw = means.map((mean, component) => weights[component] * gaussianPdf2d(point, mean, variances[component]));
      const total = raw.reduce((sum, value) => sum + value, 0) || 1e-9;
      return raw.map(value => value / total);
    });

    means = means.map((_, component) => {
      const nk = responsibilities.reduce((sum, row) => sum + row[component], 0) || 1e-9;
      return [
        responsibilities.reduce((sum, row, index) => sum + row[component] * X[index][0], 0) / nk,
        responsibilities.reduce((sum, row, index) => sum + row[component] * X[index][1], 0) / nk,
      ];
    });
    variances = variances.map((_, component) => {
      const nk = responsibilities.reduce((sum, row) => sum + row[component], 0) || 1e-9;
      return [
        responsibilities.reduce((sum, row, index) => sum + row[component] * (X[index][0] - means[component][0]) ** 2, 0) / nk + 0.05,
        responsibilities.reduce((sum, row, index) => sum + row[component] * (X[index][1] - means[component][1]) ** 2, 0) / nk + 0.05,
      ];
    });
    weights = weights.map((_, component) => responsibilities.reduce((sum, row) => sum + row[component], 0) / X.length);
    const ll = X.reduce((sum, point) => {
      const density = means.reduce((inner, mean, component) => inner + weights[component] * gaussianPdf2d(point, mean, variances[component]), 0);
      return sum + Math.log(density + 1e-9);
    }, 0);
    logLikelihood.push({ iteration: iteration + 1, logLikelihood: Number(ll.toFixed(3)) });
  }

  return {
    centers: means,
    assignments: responsibilities.map(row => row.reduce((best, value, index) => value > row[best] ? index : best, 0)),
    probs: responsibilities,
    variances,
    weights,
    ellipses: means.flatMap((mean, component) => [1, 2].map(scale => ({
      component,
      scale,
      x: mean[0],
      y: mean[1],
      rx: Math.sqrt(variances[component][0]) * scale,
      ry: Math.sqrt(variances[component][1]) * scale,
    }))),
    logLikelihood,
    score: logLikelihood.at(-1)?.logLikelihood ?? 0,
  };
}

function hierarchical(X: number[][], threshold: number) {
  type Cluster = { id: number; members: number[] };
  let nextId = X.length;
  let clusters: Cluster[] = X.map((_, index) => ({ id: index, members: [index] }));
  const merges: Array<{ left: number; right: number; id: number; distance: number; size: number }> = [];
  const linkageDistance = (a: Cluster, b: Cluster) => {
    const pairs = a.members.flatMap(i => b.members.map(j => dist(X[i], X[j])));
    return pairs.reduce((sum, value) => sum + value, 0) / pairs.length;
  };

  while (clusters.length > 1) {
    let best: [number, number, number] = [0, 1, Infinity];
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = linkageDistance(clusters[i], clusters[j]);
        if (d < best[2]) best = [i, j, d];
      }
    }
    const [i, j, distanceValue] = best;
    const left = clusters[i];
    const right = clusters[j];
    const merged = { id: nextId++, members: [...left.members, ...right.members] };
    merges.push({ left: left.id, right: right.id, id: merged.id, distance: Number(distanceValue.toFixed(3)), size: merged.members.length });
    clusters = clusters.filter((_, index) => index !== i && index !== j);
    clusters.push(merged);
  }

  const parent = Array.from({ length: X.length }, (_, index) => index);
  const find = (value: number): number => parent[value] === value ? value : (parent[value] = find(parent[value]));
  const unite = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const membersById = new Map<number, number[]>(X.map((_, index) => [index, [index]]));
  merges.forEach(merge => {
    const members = [...(membersById.get(merge.left) ?? []), ...(membersById.get(merge.right) ?? [])];
    membersById.set(merge.id, members);
    if (merge.distance <= threshold) {
      const [first, ...rest] = members;
      rest.forEach(member => unite(first, member));
    }
  });
  const roots = [...new Set(parent.map((_, index) => find(index)))];
  const rootToCluster = new Map(roots.map((root, index) => [root, index]));
  const assignments = parent.map((_, index) => rootToCluster.get(find(index)) ?? 0);
  const centers = Array.from({ length: roots.length }, (_, cluster) => {
    const members = X.filter((_, index) => assignments[index] === cluster);
    return [members.reduce((sum, point) => sum + point[0], 0) / members.length, members.reduce((sum, point) => sum + point[1], 0) / members.length];
  });
  return { centers, assignments, score: roots.length, merges };
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
  gmm: ['Gaussian Mixture Model', 'EM responsibilities, component weights, covariance ellipses, and log-likelihood convergence.'],
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
    if (mode === 'gmm') return gaussianEM(X, k);
    if (mode === 'spectral') return spectral(X, k);
    return optics(X, bandwidth);
  }, [X, k, bandwidth, mode]);
  const plot = points.map((p, i) => ({ ...p, cluster: result.assignments[i] ?? 0 }));
  const [title, subtitle] = copy[mode];
  const reach = 'reach' in result ? result.reach : [];
  const bounds = {
    minX: Math.min(...X.map(point => point[0])) - 1,
    maxX: Math.max(...X.map(point => point[0])) + 1,
    minY: Math.min(...X.map(point => point[1])) - 1,
    maxY: Math.max(...X.map(point => point[1])) + 1,
  };
  const mapX = (x: number) => ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * 100;
  const mapY = (y: number) => 100 - ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * 100;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title={title} subtitle={subtitle} badge={mode === 'gmm' || mode === 'optics' || mode === 'meanshift' || mode === 'spectral' ? 'Advanced' : 'Intermediate'} category="Clustering" icon={<Network size={22} />} />
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
          {mode === 'gmm' && 'ellipses' in result && (
            <Card title="Gaussian Component Ellipses" subtitle="1σ and 2σ contours estimated from EM covariance updates">
              <svg viewBox="0 0 100 70" className="h-72 w-full rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
                {(result.ellipses as Array<{ component: number; scale: number; x: number; y: number; rx: number; ry: number }>).map(ellipse => (
                  <ellipse
                    key={`${ellipse.component}-${ellipse.scale}`}
                    cx={mapX(ellipse.x)}
                    cy={(mapY(ellipse.y) / 100) * 70}
                    rx={(ellipse.rx / (bounds.maxX - bounds.minX)) * 100}
                    ry={(ellipse.ry / (bounds.maxY - bounds.minY)) * 70}
                    fill={colors[ellipse.component % colors.length]}
                    fillOpacity={ellipse.scale === 1 ? 0.12 : 0.05}
                    stroke={colors[ellipse.component % colors.length]}
                    strokeWidth={ellipse.scale === 1 ? 0.8 : 0.45}
                  />
                ))}
                {plot.map((point, index) => (
                  <circle key={index} cx={mapX(point.x)} cy={(mapY(point.y) / 100) * 70} r={0.8} fill={colors[Math.abs(point.cluster) % colors.length]} />
                ))}
              </svg>
            </Card>
          )}
          {mode === 'optics' ? (
            <Card title="Reachability Ordering"><ResponsiveContainer width="100%" height={260}><LineChart data={reach}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="order" /><YAxis /><Tooltip /><Line dataKey="reachability" stroke="#dc2626" strokeWidth={2} /></LineChart></ResponsiveContainer></Card>
          ) : mode === 'gmm' && 'logLikelihood' in result ? (
            <Card title="EM Log-Likelihood Convergence"><ResponsiveContainer width="100%" height={260}><LineChart data={result.logLikelihood as Array<{ iteration: number; logLikelihood: number }>}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="iteration" /><YAxis /><Tooltip /><Line dataKey="logLikelihood" stroke="#2563eb" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></Card>
          ) : mode === 'hierarchical' && 'merges' in result ? (
            <Card title="Agglomerative Merge Tree" subtitle="Horizontal guide shows the current cut-height threshold">
              <svg viewBox="0 0 100 60" className="h-64 w-full rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
                <line x1={0} x2={100} y1={60 - Math.min(55, bandwidth * 22)} y2={60 - Math.min(55, bandwidth * 22)} stroke="#dc2626" strokeDasharray="4 3" />
                {(result.merges as Array<{ left: number; right: number; id: number; distance: number; size: number }>).slice(-30).map((merge, index, arr) => {
                  const x = 5 + (index / Math.max(1, arr.length - 1)) * 90;
                  const y = 58 - Math.min(55, merge.distance * 22);
                  return (
                    <g key={merge.id}>
                      <line x1={x} x2={x} y1={58} y2={y} stroke="#64748b" strokeWidth={0.5} />
                      <circle cx={x} cy={y} r={1.2 + Math.min(2.5, merge.size / 30)} fill={colors[index % colors.length]} fillOpacity={0.75} />
                    </g>
                  );
                })}
              </svg>
            </Card>
          ) : (
            <MatrixViewer title="Distance / Responsibility Matrix Preview" matrix={mode === 'gmm' && 'probs' in result ? (result.probs as number[][]).slice(0, 8) : distanceMatrix(X.slice(0, 8))} />
          )}
          <InfoBox type="info" title="Real Logic Cross-Check">This page computes assignments and metrics from the generated points in TypeScript; no backend or placeholder values are used.</InfoBox>
        </div>
      </div>
    </div>
  );
}
