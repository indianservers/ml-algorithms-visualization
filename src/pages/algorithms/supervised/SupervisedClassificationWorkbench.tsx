import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { GitBranch } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, InfoBox } from '../../components/common/Card';
import { MetricsPanel } from '../../components/ml/MetricsPanel';
import { binaryMetrics } from '../../../lib/math/metrics';
import { generateSyntheticBlobs, generateSyntheticMoons } from '../../../data/sampleDatasets';

export type ClassificationMode = 'multinomial' | 'forest' | 'svm' | 'boosting' | 'adaboost' | 'xgboost';

const copy: Record<ClassificationMode, { title: string; subtitle: string; warning: string }> = {
  multinomial: { title: 'Multinomial Logistic Regression', subtitle: 'Softmax-style multi-class probabilities from learned class centroids.', warning: 'Educational softmax uses centroid logits for browser clarity.' },
  forest: { title: 'Random Forest Classification', subtitle: 'Bootstrap CART trees with random feature subsets, majority voting, and OOB error.', warning: 'Browser forest is intentionally small, but each tree uses recursive CART splits and feature bagging.' },
  svm: { title: 'SVM Classification', subtitle: 'Linear/RBF-like margin classifier with C and gamma controls.', warning: 'Browser version is a simplified margin learner, not a full quadratic optimizer.' },
  boosting: { title: 'Gradient Boosting Classification', subtitle: 'Sequential weak learners that reduce classification errors stage by stage.', warning: 'High estimator count can overfit noisy points.' },
  adaboost: { title: 'AdaBoost Classification', subtitle: 'Weighted stumps update sample weights and vote by learner strength.', warning: 'Outliers receive increasing weight and can dominate later learners.' },
  xgboost: { title: 'XGBoost', subtitle: 'Educational gradient boosting tree stages with gain-like split scoring.', warning: 'Browser-sized implementation; no Python XGBoost dependency.' },
};

function centroidModel(points: { x: number; y: number; label: number }[]) {
  const classes = [...new Set(points.map(p => p.label))];
  const centroids = classes.map(label => {
    const rows = points.filter(p => p.label === label);
    return { label, x: rows.reduce((s, p) => s + p.x, 0) / rows.length, y: rows.reduce((s, p) => s + p.y, 0) / rows.length };
  });
  return (x: number, y: number) => {
    const logits = centroids.map(c => -((x - c.x) ** 2 + (y - c.y) ** 2));
    const max = Math.max(...logits);
    const exps = logits.map(v => Math.exp(v - max));
    const total = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map(v => v / total);
    const best = probs.reduce((bi, p, i) => p > probs[bi] ? i : bi, 0);
    return { label: centroids[best].label, probs, support: centroids };
  };
}

function stump(points: { x: number; y: number; label: number; weight?: number }[]) {
  const candidates = ['x', 'y'] as const;
  let best = { feature: 'x' as 'x' | 'y', threshold: 0, polarity: 1, error: Infinity };
  candidates.forEach(feature => {
    points.map(p => p[feature]).forEach(threshold => {
      [1, -1].forEach(polarity => {
        const error = points.reduce((sum, p) => {
          const side = p[feature] > threshold ? 1 : 0;
          const expectedSide = polarity === 1 ? 1 : 0;
          const pred = side === expectedSide ? 1 : 0;
          return sum + (pred === p.label ? 0 : (p.weight ?? 1));
        }, 0);
        if (error < best.error) best = { feature, threshold, polarity, error };
      });
    });
  });
  return best;
}

function stumpPredict(model: ReturnType<typeof stump>, point: { x: number; y: number }) {
  const side = point[model.feature] > model.threshold ? 1 : 0;
  const expectedSide = model.polarity === 1 ? 1 : 0;
  return side === expectedSide ? 1 : 0;
}

type Point = { x: number; y: number; label: number; weight?: number };
type Feature = 'x' | 'y';
type TreeNode = {
  prediction: number;
  samples: number;
  impurity: number;
  gain: number;
  feature?: Feature;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
};

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function gini(rows: Point[]) {
  if (!rows.length) return 0;
  const positive = rows.filter(row => row.label === 1).length / rows.length;
  return 1 - positive ** 2 - (1 - positive) ** 2;
}

function majority(rows: Point[]) {
  return rows.filter(row => row.label === 1).length >= rows.length / 2 ? 1 : 0;
}

function featureSubset(random: () => number) {
  const features: Feature[] = ['x', 'y'];
  const first = random() > 0.5 ? 1 : 0;
  return [features[first]];
}

function bestCartSplit(rows: Point[], random: () => number) {
  const parentImpurity = gini(rows);
  let best: { feature: Feature; threshold: number; gain: number; left: Point[]; right: Point[] } | null = null;
  featureSubset(random).forEach(feature => {
    const sorted = [...new Set(rows.map(row => row[feature]))].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      const threshold = (sorted[i - 1] + sorted[i]) / 2;
      const left = rows.filter(row => row[feature] <= threshold);
      const right = rows.filter(row => row[feature] > threshold);
      if (left.length < 3 || right.length < 3) continue;
      const weightedImpurity = (left.length / rows.length) * gini(left) + (right.length / rows.length) * gini(right);
      const gain = parentImpurity - weightedImpurity;
      if (!best || gain > best.gain) best = { feature, threshold, gain, left, right };
    }
  });
  return best;
}

function buildCartTree(rows: Point[], maxDepth: number, random: () => number, depth = 0): TreeNode {
  const node: TreeNode = {
    prediction: majority(rows),
    samples: rows.length,
    impurity: gini(rows),
    gain: 0,
  };
  if (depth >= maxDepth || rows.length < 8 || node.impurity === 0) return node;
  const split = bestCartSplit(rows, random);
  if (!split || split.gain <= 0.002) return node;
  node.feature = split.feature;
  node.threshold = split.threshold;
  node.gain = split.gain;
  node.left = buildCartTree(split.left, maxDepth, random, depth + 1);
  node.right = buildCartTree(split.right, maxDepth, random, depth + 1);
  return node;
}

function predictTree(tree: TreeNode, point: { x: number; y: number }): number {
  if (!tree.feature || tree.threshold === undefined || !tree.left || !tree.right) return tree.prediction;
  return predictTree(point[tree.feature] <= tree.threshold ? tree.left : tree.right, point);
}

function collectImportance(tree: TreeNode, totals: Record<Feature, number>) {
  if (tree.feature) totals[tree.feature] += tree.gain * tree.samples;
  if (tree.left) collectImportance(tree.left, totals);
  if (tree.right) collectImportance(tree.right, totals);
}

function trainForest(points: Point[], estimators: number, maxDepth: number) {
  const trees: Array<{ tree: TreeNode; oob: number[] }> = [];
  for (let i = 0; i < estimators; i++) {
    const random = seededRandom(900 + i * 37 + maxDepth * 13);
    const sample: Point[] = [];
    const inBag = new Set<number>();
    for (let j = 0; j < points.length; j++) {
      const index = Math.floor(random() * points.length);
      sample.push(points[index]);
      inBag.add(index);
    }
    const oob = points.map((_, index) => index).filter(index => !inBag.has(index));
    trees.push({ tree: buildCartTree(sample, maxDepth, random), oob });
  }
  const importanceTotals: Record<Feature, number> = { x: 0, y: 0 };
  trees.forEach(item => collectImportance(item.tree, importanceTotals));
  const importanceSum = importanceTotals.x + importanceTotals.y || 1;
  let oobRows = 0;
  let oobMisses = 0;
  points.forEach((point, index) => {
    const votes = trees.filter(item => item.oob.includes(index)).map(item => predictTree(item.tree, point));
    if (!votes.length) return;
    oobRows += 1;
    const prediction = votes.filter(vote => vote === 1).length >= votes.length / 2 ? 1 : 0;
    if (prediction !== point.label) oobMisses += 1;
  });
  return {
    trees,
    oobError: oobRows ? oobMisses / oobRows : 0,
    importance: [
      { name: 'x feature', value: importanceTotals.x / importanceSum },
      { name: 'y feature', value: importanceTotals.y / importanceSum },
    ],
    predict: (x: number, y: number) => {
      const votes = trees.map(item => predictTree(item.tree, { x, y }));
      const positive = votes.filter(vote => vote === 1).length / votes.length;
      return { label: positive >= 0.5 ? 1 : 0, probs: [1 - positive, positive], support: trees };
    },
  };
}

function trainLinearSvm(points: Point[], cValue: number, epochs = 90) {
  let wx = 0;
  let wy = 0;
  let bias = 0;
  const learningRate = 0.03;
  for (let epoch = 0; epoch < epochs; epoch++) {
    points.forEach(point => {
      const y = point.label === 1 ? 1 : -1;
      const margin = y * (wx * point.x + wy * point.y + bias);
      wx *= 1 - learningRate * 0.02;
      wy *= 1 - learningRate * 0.02;
      if (margin < 1) {
        wx += learningRate * cValue * y * point.x;
        wy += learningRate * cValue * y * point.y;
        bias += learningRate * cValue * y;
      }
    });
  }
  const score = (x: number, y: number) => wx * x + wy * y + bias;
  return {
    weights: [{ name: 'w_x', value: wx }, { name: 'w_y', value: wy }, { name: 'bias', value: bias }],
    supportVectors: points.filter(point => Math.abs(score(point.x, point.y)) <= 1.05),
    predict: (x: number, y: number) => {
      const raw = score(x, y);
      const prob = 1 / (1 + Math.exp(-raw));
      return { label: raw >= 0 ? 1 : 0, probs: [1 - prob, prob], support: raw };
    },
  };
}

export default function SupervisedClassificationWorkbench({ mode }: { mode: ClassificationMode }) {
  const [estimators, setEstimators] = useState(8);
  const [maxDepth, setMaxDepth] = useState(4);
  const [cValue, setCValue] = useState(1);
  const [threshold, setThreshold] = useState(0.5);
  const binary = mode !== 'multinomial';
  const points = useMemo(() => binary ? generateSyntheticMoons(100).map(p => ({ ...p, label: p.label })) : generateSyntheticBlobs(120, 3), [binary]);

  const model = useMemo(() => {
    if (mode === 'multinomial') return { type: 'centroid', predict: centroidModel(points), learners: [] as ReturnType<typeof stump>[], bars: [] as Array<{ name: string; value: number }>, oobError: null as number | null, supportCount: null as number | null };
    if (mode === 'forest') {
      const forest = trainForest(points, estimators, maxDepth);
      return { type: 'forest', predict: forest.predict, learners: forest.trees.map(item => item.tree), bars: forest.importance, oobError: forest.oobError, supportCount: null };
    }
    if (mode === 'svm') {
      const svm = trainLinearSvm(points, cValue);
      return { type: 'svm', predict: svm.predict, learners: [], bars: svm.weights, oobError: null, supportCount: svm.supportVectors.length };
    }
    let weighted = points.map(p => ({ ...p, weight: 1 / points.length }));
    const learners: { stump: ReturnType<typeof stump>; alpha: number }[] = [];
    for (let i = 0; i < estimators; i++) {
      const s = stump(weighted);
      const error = Math.min(0.499, Math.max(0.001, weighted.reduce((sum, p) => sum + (stumpPredict(s, p) === p.label ? 0 : p.weight ?? 0), 0)));
      const alpha = mode === 'adaboost' ? 0.5 * Math.log((1 - error) / error) : 0.35;
      learners.push({ stump: s, alpha });
      weighted = weighted.map(p => {
        const miss = stumpPredict(s, p) === p.label ? -1 : 1;
        return { ...p, weight: (p.weight ?? 0) * Math.exp(alpha * miss) };
      });
      const total = weighted.reduce((sum, p) => sum + (p.weight ?? 0), 0) || 1;
      weighted = weighted.map(p => ({ ...p, weight: (p.weight ?? 0) / total }));
    }
    return {
      type: 'ensemble',
      learners: learners.map(l => l.stump),
      bars: learners.map((learner, i) => ({ name: `${learner.stump.feature}${i + 1}`, value: learner.stump.threshold })),
      oobError: null as number | null,
      supportCount: null as number | null,
      predict: (x: number, y: number) => {
        const score = learners.reduce((sum, l) => sum + l.alpha * (stumpPredict(l.stump, { x, y }) ? 1 : -1), 0);
        const prob = 1 / (1 + Math.exp(-score * cValue));
        return { label: prob >= threshold ? 1 : 0, probs: [1 - prob, prob], support: learners };
      },
    };
  }, [mode, points, estimators, maxDepth, cValue, threshold]);

  const predictions = points.map(p => model.predict(p.x, p.y));
  const predictedLabels = predictions.map(p => p.label);
  const metric = binary ? binaryMetrics(points.map(p => p.label), predictedLabels) : null;
  const accuracy = predictedLabels.filter((p, i) => p === points[i].label).length / points.length;
  const chartPoints = points.map((p, i) => ({ ...p, predicted: predictedLabels[i], probability: predictions[i].probs[predictedLabels[i]] }));
  const bars = mode === 'multinomial'
    ? (model.predict(0, 0).probs.map((value, i) => ({ name: `class ${i}`, value })))
    : model.bars;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title={copy[mode].title} subtitle={copy[mode].subtitle} badge={mode === 'xgboost' || mode === 'svm' || mode === 'boosting' || mode === 'adaboost' ? 'Advanced' : 'Intermediate'} category="Supervised Learning / Classification" icon={<GitBranch size={22} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Training Controls">
            {mode !== 'multinomial' && mode !== 'svm' && <><label className="text-xs font-semibold">Estimators: {estimators}</label><input className="w-full accent-blue-600" type="range" min={2} max={30} value={estimators} onChange={e => setEstimators(Number(e.target.value))} /></>}
            {mode === 'forest' && <><label className="text-xs font-semibold">Max tree depth: {maxDepth}</label><input className="w-full accent-blue-600" type="range" min={2} max={8} value={maxDepth} onChange={e => setMaxDepth(Number(e.target.value))} /></>}
            {mode === 'svm' && <><label className="text-xs font-semibold">C: {cValue.toFixed(1)}</label><input className="w-full accent-blue-600" type="range" min={0.2} max={3} step={0.1} value={cValue} onChange={e => setCValue(Number(e.target.value))} /></>}
            {binary && <><label className="text-xs font-semibold">Threshold: {threshold.toFixed(2)}</label><input className="w-full accent-blue-600" type="range" min={0.1} max={0.9} step={0.05} value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></>}
          </Card>
          <MetricsPanel title="Training Metrics" metrics={[
            { label: 'Train Accuracy', value: accuracy, format: 'percent', color: 'green' },
            { label: 'Train Precision', value: metric?.precision ?? accuracy, format: 'percent' },
            { label: 'Train Recall', value: metric?.recall ?? accuracy, format: 'percent' },
            { label: 'Train F1', value: metric?.f1 ?? accuracy, format: 'percent', color: 'blue' },
            ...(model.oobError !== null ? [{ label: 'OOB Error', value: model.oobError, format: 'percent' as const, color: model.oobError < 0.2 ? 'green' as const : 'red' as const }] : []),
            ...(model.supportCount !== null ? [{ label: 'Support Vectors', value: model.supportCount, format: 'number' as const, color: 'blue' as const }] : []),
          ]} />
        </div>
        <div className="space-y-4">
          <Card title="Decision Regions and Predictions">
            <ResponsiveContainer width="100%" height={360}><ScatterChart><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="x" type="number" /><YAxis dataKey="y" type="number" /><Tooltip /><Scatter data={chartPoints}>{chartPoints.map((p, i) => <Cell key={i} fill={p.predicted === 0 ? '#2563eb' : p.predicted === 1 ? '#059669' : '#dc2626'} />)}</Scatter></ScatterChart></ResponsiveContainer>
          </Card>
          <Card title={mode === 'multinomial' ? 'Softmax Probabilities' : mode === 'forest' ? 'Feature Bagging Importance' : mode === 'svm' ? 'Linear Margin Weights' : 'Weak Learners / Split Thresholds'}>
            <ResponsiveContainer width="100%" height={240}><BarChart data={bars}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#9333ea" /></BarChart></ResponsiveContainer>
          </Card>
          <InfoBox type="warning" title="Algorithm-Specific Warning">{copy[mode].warning}</InfoBox>
        </div>
      </div>
    </div>
  );
}
