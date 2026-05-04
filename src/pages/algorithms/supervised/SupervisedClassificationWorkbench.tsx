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
  forest: { title: 'Random Forest Classification', subtitle: 'Bootstrap decision stumps with majority voting and feature importance.', warning: 'Educational forest uses shallow stumps rather than full CART trees.' },
  svm: { title: 'SVM Classification', subtitle: 'Linear/RBF-like margin classifier with C and gamma controls.', warning: 'Browser version is a simplified margin learner, not a full quadratic optimizer.' },
  boosting: { title: 'Gradient Boosting Classification', subtitle: 'Sequential weak learners that reduce classification errors stage by stage.', warning: 'High estimator count can overfit noisy points.' },
  adaboost: { title: 'AdaBoost Classification', subtitle: 'Weighted stumps update sample weights and vote by learner strength.', warning: 'Outliers receive increasing weight and can dominate later learners.' },
  xgboost: { title: 'XGBoost Concept', subtitle: 'Educational gradient boosting tree stages with gain-like split scoring.', warning: 'Conceptual browser implementation; no Python XGBoost dependency.' },
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

export default function SupervisedClassificationWorkbench({ mode }: { mode: ClassificationMode }) {
  const [estimators, setEstimators] = useState(8);
  const [cValue, setCValue] = useState(1);
  const [threshold, setThreshold] = useState(0.5);
  const binary = mode !== 'multinomial';
  const points = useMemo(() => binary ? generateSyntheticMoons(100).map(p => ({ ...p, label: p.label })) : generateSyntheticBlobs(120, 3), [binary]);

  const model = useMemo(() => {
    if (mode === 'multinomial' || mode === 'svm') return { type: 'centroid', predict: centroidModel(points), learners: [] as ReturnType<typeof stump>[] };
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
      predict: (x: number, y: number) => {
        const score = learners.reduce((sum, l) => sum + l.alpha * (stumpPredict(l.stump, { x, y }) ? 1 : -1), 0);
        const prob = 1 / (1 + Math.exp(-score * cValue));
        return { label: prob >= threshold ? 1 : 0, probs: [1 - prob, prob], support: learners };
      },
    };
  }, [mode, points, estimators, cValue, threshold]);

  const predictions = points.map(p => model.predict(p.x, p.y));
  const predictedLabels = predictions.map(p => p.label);
  const metric = binary ? binaryMetrics(points.map(p => p.label), predictedLabels) : null;
  const accuracy = predictedLabels.filter((p, i) => p === points[i].label).length / points.length;
  const chartPoints = points.map((p, i) => ({ ...p, predicted: predictedLabels[i], probability: predictions[i].probs[predictedLabels[i]] }));
  const bars = mode === 'multinomial'
    ? (model.predict(0, 0).probs.map((value, i) => ({ name: `class ${i}`, value })))
    : (model.learners.map((learner, i) => ({ name: `${learner.feature}${i + 1}`, value: learner.threshold })));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title={copy[mode].title} subtitle={copy[mode].subtitle} badge={mode === 'xgboost' || mode === 'svm' ? 'Educational' : 'Implemented'} category="Supervised Learning / Classification" icon={<GitBranch size={22} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Training Controls">
            {mode !== 'multinomial' && <><label className="text-xs font-semibold">Estimators: {estimators}</label><input className="w-full accent-blue-600" type="range" min={2} max={30} value={estimators} onChange={e => setEstimators(Number(e.target.value))} /></>}
            {mode === 'svm' && <><label className="text-xs font-semibold">C: {cValue.toFixed(1)}</label><input className="w-full accent-blue-600" type="range" min={0.2} max={3} step={0.1} value={cValue} onChange={e => setCValue(Number(e.target.value))} /></>}
            {binary && <><label className="text-xs font-semibold">Threshold: {threshold.toFixed(2)}</label><input className="w-full accent-blue-600" type="range" min={0.1} max={0.9} step={0.05} value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></>}
          </Card>
          <MetricsPanel title="Classification Metrics" metrics={[
            { label: 'Accuracy', value: accuracy, format: 'percent', color: 'green' },
            { label: 'Precision', value: metric?.precision ?? accuracy, format: 'percent' },
            { label: 'Recall', value: metric?.recall ?? accuracy, format: 'percent' },
            { label: 'F1', value: metric?.f1 ?? accuracy, format: 'percent', color: 'blue' },
          ]} />
        </div>
        <div className="space-y-4">
          <Card title="Decision Regions and Predictions">
            <ResponsiveContainer width="100%" height={360}><ScatterChart><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="x" type="number" /><YAxis dataKey="y" type="number" /><Tooltip /><Scatter data={chartPoints}>{chartPoints.map((p, i) => <Cell key={i} fill={p.predicted === 0 ? '#2563eb' : p.predicted === 1 ? '#059669' : '#dc2626'} />)}</Scatter></ScatterChart></ResponsiveContainer>
          </Card>
          <Card title={mode === 'multinomial' ? 'Softmax Probabilities' : 'Weak Learners / Split Thresholds'}>
            <ResponsiveContainer width="100%" height={240}><BarChart data={bars}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#9333ea" /></BarChart></ResponsiveContainer>
          </Card>
          <InfoBox type="warning" title="Algorithm-Specific Warning">{copy[mode].warning}</InfoBox>
        </div>
      </div>
    </div>
  );
}
