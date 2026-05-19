import { useMemo, useState } from 'react';
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GitBranch, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { buildDecisionTree, predictTree, type TreeNode } from '../../../lib/algorithms/classification/decisionTree';
import { generateSyntheticMoons } from '../../../data/sampleDatasets';

type Point = { x: number; y: number; label: number };
type BagTree = { tree: TreeNode; oob: number[] };

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function trainBag(points: Point[], count: number, maxDepth: number, seed: number): BagTree[] {
  return Array.from({ length: count }, (_, treeIndex) => {
    const random = seededRandom(seed * 97 + treeIndex * 31);
    const sample: Point[] = [];
    const inBag = new Set<number>();
    for (let i = 0; i < points.length; i++) {
      const index = Math.floor(random() * points.length);
      sample.push(points[index]);
      inBag.add(index);
    }
    return {
      tree: buildDecisionTree(sample.map(point => [point.x, point.y]), sample.map(point => point.label), maxDepth, 3, 'gini'),
      oob: points.map((_, index) => index).filter(index => !inBag.has(index)),
    };
  });
}

function vote(trees: BagTree[], x: number, y: number) {
  const positives = trees.reduce((sum, item) => sum + (predictTree(item.tree, [x, y]) === 1 ? 1 : 0), 0);
  return positives / trees.length;
}

function oobCurve(points: Point[], trees: BagTree[]) {
  return trees.map((_, endIndex) => {
    const active = trees.slice(0, endIndex + 1);
    let tested = 0;
    let misses = 0;
    points.forEach((point, pointIndex) => {
      const voters = active.filter(tree => tree.oob.includes(pointIndex));
      if (!voters.length) return;
      tested += 1;
      const prediction = vote(voters, point.x, point.y) >= 0.5 ? 1 : 0;
      if (prediction !== point.label) misses += 1;
    });
    return { estimators: endIndex + 1, oobError: tested ? misses / tested : 0 };
  });
}

export default function BaggingPage() {
  const [estimators, setEstimators] = useState(12);
  const [maxDepth, setMaxDepth] = useState(3);
  const [showIndividuals, setShowIndividuals] = useState(true);
  const [showEnsemble, setShowEnsemble] = useState(true);
  const [seed, setSeed] = useState(3);
  const points = useMemo(() => generateSyntheticMoons(100).map((point, index) => ({ x: point.x + Math.sin(seed + index) * 0.03, y: point.y + Math.cos(seed * 2 + index) * 0.03, label: point.label })), [seed]);
  const trees = useMemo(() => trainBag(points, estimators, maxDepth, seed), [points, estimators, maxDepth, seed]);
  const curve = useMemo(() => oobCurve(points, trees), [points, trees]);
  const finalOob = curve.at(-1)?.oobError ?? 0;
  const grid = useMemo(() => Array.from({ length: 30 }, (_, yi) => Array.from({ length: 30 }, (_, xi) => {
    const x = -2.4 + xi * (4.8 / 29);
    const y = -1.5 + yi * (3 / 29);
    const positiveShare = vote(trees, x, y);
    const individualSpread = trees.reduce((sum, tree) => sum + Math.abs((predictTree(tree.tree, [x, y]) ? 1 : 0) - positiveShare), 0) / trees.length;
    return { x, y, positiveShare, individualSpread };
  })).flat(), [trees]);
  const accuracy = points.filter(point => (vote(trees, point.x, point.y) >= 0.5 ? 1 : 0) === point.label).length / points.length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Bagging" subtitle="Bootstrap many decision trees, compare their noisy boundaries, and watch OOB error stabilize." badge="Intermediate" category="Ensemble" icon={<GitBranch size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[330px_1fr]">
        <div className="space-y-4">
          <Card title="Bagging Controls">
            <div className="space-y-4 text-sm">
              <label className="block font-semibold">Estimators: {estimators}<input className="w-full accent-blue-600" type="range" min={1} max={20} value={estimators} onChange={event => setEstimators(Number(event.target.value))} /></label>
              <label className="block font-semibold">Max depth: {maxDepth}<input className="w-full accent-blue-600" type="range" min={1} max={5} value={maxDepth} onChange={event => setMaxDepth(Number(event.target.value))} /></label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={showIndividuals} onChange={event => setShowIndividuals(event.target.checked)} /> Individual tree variance</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={showEnsemble} onChange={event => setShowEnsemble(event.target.checked)} /> Ensemble vote boundary</label>
              <button onClick={() => setSeed(value => value + 1)} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 text-sm font-bold text-white hover:bg-blue-700"><RefreshCw size={14} /> Regenerate dataset</button>
            </div>
          </Card>
          <MetricsPanel title="Bagging Metrics" metrics={[
            { label: 'Training Accuracy', value: accuracy, format: 'percent', color: accuracy >= 0.8 ? 'green' : accuracy >= 0.6 ? 'blue' : 'red' },
            { label: 'OOB Error', value: finalOob, format: 'percent', color: finalOob < 0.25 ? 'green' : 'red' },
            { label: 'Trees', value: estimators, format: 'number' },
          ]} />
          <InfoBox type="info" title="Variance lesson">
            Individual trees trained on bootstrap samples can disagree. Averaging their votes smooths the decision boundary and gives an out-of-bag validation estimate.
          </InfoBox>
        </div>
        <div className="space-y-4">
          <Card title="Decision Boundary: Individual Variance and Ensemble Vote">
            <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-950">
              <div className="grid aspect-[16/10] w-full" style={{ gridTemplateColumns: 'repeat(30, 1fr)' }}>
                {grid.map((cell, index) => {
                  const ensembleAlpha = showEnsemble ? 0.12 + Math.abs(cell.positiveShare - 0.5) * 0.6 : 0;
                  const varianceAlpha = showIndividuals ? cell.individualSpread * 0.65 : 0;
                  const color = cell.positiveShare >= 0.5 ? `rgba(5,150,105,${ensembleAlpha + varianceAlpha})` : `rgba(37,99,235,${ensembleAlpha + varianceAlpha})`;
                  return <div key={index} style={{ backgroundColor: color }} />;
                })}
              </div>
              <svg className="pointer-events-none absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)]" viewBox="-2.4 -1.5 4.8 3" preserveAspectRatio="none">
                {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="0.035" fill={point.label ? '#064e3b' : '#1d4ed8'} stroke="white" strokeWidth="0.015" />)}
              </svg>
            </div>
          </Card>
          <Card title="OOB Error vs Number of Estimators">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={curve}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="estimators" />
                <YAxis tickFormatter={value => `${Math.round(Number(value) * 100)}%`} />
                <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                <Line dataKey="oobError" stroke="#dc2626" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}
