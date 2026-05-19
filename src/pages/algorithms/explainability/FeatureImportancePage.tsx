import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GitBranch } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';

type Row = {
  income: number;
  age: number;
  visits: number;
  discount: number;
  label: number;
};

type Feature = 'income' | 'age' | 'visits' | 'discount';
type TreeNode = {
  prediction: number;
  impurity: number;
  samples: number;
  gain: number;
  feature?: Feature;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
};

const features: Feature[] = ['income', 'age', 'visits', 'discount'];

function makeRows(size: number, noise: number): Row[] {
  return Array.from({ length: size }, (_, index) => {
    const angle = index * 1.71;
    const income = 35 + ((Math.sin(angle) + 1) * 35) + (index % 7);
    const age = 20 + ((Math.cos(angle * 0.7) + 1) * 24);
    const visits = 1 + (index * 3) % 12;
    const discount = (index * 11) % 30;
    const score = income * 0.045 + visits * 0.36 + discount * 0.05 - age * 0.028 + Math.sin(index * 0.9) * noise;
    return { income, age, visits, discount, label: score > 3.9 ? 1 : 0 };
  });
}

function gini(rows: Row[]) {
  if (!rows.length) return 0;
  const positive = rows.filter(row => row.label === 1).length / rows.length;
  return 1 - positive ** 2 - (1 - positive) ** 2;
}

function majority(rows: Row[]) {
  return rows.filter(row => row.label === 1).length >= rows.length / 2 ? 1 : 0;
}

function bestSplit(rows: Row[]) {
  const parent = gini(rows);
  let best: { feature: Feature; threshold: number; gain: number; left: Row[]; right: Row[] } | null = null;
  features.forEach(feature => {
    const values = [...new Set(rows.map(row => row[feature]))].sort((a, b) => a - b);
    for (let index = 1; index < values.length; index++) {
      const threshold = (values[index - 1] + values[index]) / 2;
      const left = rows.filter(row => row[feature] <= threshold);
      const right = rows.filter(row => row[feature] > threshold);
      if (left.length < 4 || right.length < 4) continue;
      const weighted = (left.length / rows.length) * gini(left) + (right.length / rows.length) * gini(right);
      const gain = parent - weighted;
      if (!best || gain > best.gain) best = { feature, threshold, gain, left, right };
    }
  });
  return best;
}

function buildTree(rows: Row[], maxDepth: number, depth = 0): TreeNode {
  const node: TreeNode = { prediction: majority(rows), impurity: gini(rows), samples: rows.length, gain: 0 };
  if (depth >= maxDepth || rows.length < 8 || node.impurity === 0) return node;
  const split = bestSplit(rows);
  if (!split || split.gain <= 0.001) return node;
  node.feature = split.feature;
  node.threshold = split.threshold;
  node.gain = split.gain;
  node.left = buildTree(split.left, maxDepth, depth + 1);
  node.right = buildTree(split.right, maxDepth, depth + 1);
  return node;
}

function predict(tree: TreeNode, row: Row): number {
  if (!tree.feature || tree.threshold === undefined || !tree.left || !tree.right) return tree.prediction;
  return predict(row[tree.feature] <= tree.threshold ? tree.left : tree.right, row);
}

function collectImportance(tree: TreeNode, totals: Record<Feature, number>) {
  if (tree.feature) totals[tree.feature] += tree.gain * tree.samples;
  if (tree.left) collectImportance(tree.left, totals);
  if (tree.right) collectImportance(tree.right, totals);
}

export default function FeatureImportancePage() {
  const [maxDepth, setMaxDepth] = useState(4);
  const [sampleSize, setSampleSize] = useState(90);
  const [noise, setNoise] = useState(0.45);
  const rows = useMemo(() => makeRows(sampleSize, noise), [sampleSize, noise]);
  const model = useMemo(() => buildTree(rows, maxDepth), [rows, maxDepth]);
  const totals = useMemo(() => {
    const values: Record<Feature, number> = { income: 0, age: 0, visits: 0, discount: 0 };
    collectImportance(model, values);
    const total = features.reduce((sum, feature) => sum + values[feature], 0) || 1;
    return features
      .map(feature => ({ feature, importance: values[feature] / total }))
      .sort((a, b) => b.importance - a.importance);
  }, [model]);
  const predictions = rows.map(row => predict(model, row));
  const accuracy = predictions.filter((label, index) => label === rows[index].label).length / rows.length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Feature Importance" subtitle="Train a browser-side decision tree and compute Gini importance for each feature." badge="Intermediate" category="Explainability" icon={<GitBranch size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card title="Tree Controls">
            <div className="space-y-4 text-sm">
              <label className="block font-semibold">Max depth: {maxDepth}<input className="w-full accent-blue-600" type="range" min={1} max={7} value={maxDepth} onChange={event => setMaxDepth(Number(event.target.value))} /></label>
              <label className="block font-semibold">Samples: {sampleSize}<input className="w-full accent-blue-600" type="range" min={40} max={160} step={10} value={sampleSize} onChange={event => setSampleSize(Number(event.target.value))} /></label>
              <label className="block font-semibold">Noise: {noise.toFixed(2)}<input className="w-full accent-blue-600" type="range" min={0} max={1.4} step={0.05} value={noise} onChange={event => setNoise(Number(event.target.value))} /></label>
            </div>
          </Card>
          <MetricsPanel title="Tree Metrics" metrics={[
            { label: 'Training Accuracy', value: accuracy, format: 'percent', color: accuracy >= 0.8 ? 'green' : accuracy >= 0.6 ? 'blue' : 'red' },
            { label: 'Root Impurity', value: model.impurity, format: 'number' },
            { label: 'Rows', value: rows.length, format: 'number' },
          ]} />
          <InfoBox type="info" title="How to read it">
            Gini importance adds up impurity reduction from every split. A larger bar means the tree relied on that feature more often or made stronger splits with it.
          </InfoBox>
        </div>
        <Card title="Gini Importance by Feature">
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={totals} layout="vertical" margin={{ left: 24, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={value => `${Math.round(Number(value) * 100)}%`} />
              <YAxis type="category" dataKey="feature" width={80} />
              <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
              <Bar dataKey="importance">
                {totals.map((item, index) => <Cell key={item.feature} fill={['#2563eb', '#7c3aed', '#059669', '#f59e0b'][index]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
