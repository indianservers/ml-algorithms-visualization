import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { GitBranch } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { generateSyntheticMoons } from '../../../data/sampleDatasets';
import { binaryMetrics } from '../../../lib/math/metrics';

type Point = { x: number; y: number; label: number; weight?: number };
type Feature = 'x' | 'y';
type Stump = { feature: Feature; threshold: number; polarity: number; error: number };
type Round = { stump: Stump; alpha: number; weights: number[]; error: number; accuracy: number };

function trainStump(points: Point[]) {
  let best: Stump = { feature: 'x', threshold: 0, polarity: 1, error: Infinity };
  (['x', 'y'] as Feature[]).forEach(feature => {
    points.map(point => point[feature]).forEach(threshold => {
      [1, -1].forEach(polarity => {
        const error = points.reduce((sum, point) => {
          const side = point[feature] > threshold ? 1 : 0;
          const expected = polarity === 1 ? 1 : 0;
          const prediction = side === expected ? 1 : 0;
          return sum + (prediction === point.label ? 0 : point.weight ?? 0);
        }, 0);
        if (error < best.error) best = { feature, threshold, polarity, error };
      });
    });
  });
  return best;
}

function predictStump(stump: Stump, point: { x: number; y: number }) {
  const side = point[stump.feature] > stump.threshold ? 1 : 0;
  const expected = stump.polarity === 1 ? 1 : 0;
  return side === expected ? 1 : 0;
}

function trainBoosting(points: Point[], rounds: number) {
  let weighted = points.map(point => ({ ...point, weight: 1 / points.length }));
  const history: Round[] = [];
  for (let round = 0; round < rounds; round++) {
    const stump = trainStump(weighted);
    const error = Math.min(0.499, Math.max(0.001, stump.error));
    const alpha = 0.5 * Math.log((1 - error) / error);
    weighted = weighted.map(point => {
      const y = point.label === 1 ? 1 : -1;
      const prediction = predictStump(stump, point) === 1 ? 1 : -1;
      return { ...point, weight: (point.weight ?? 0) * Math.exp(-alpha * y * prediction) };
    });
    const total = weighted.reduce((sum, point) => sum + (point.weight ?? 0), 0) || 1;
    weighted = weighted.map(point => ({ ...point, weight: (point.weight ?? 0) / total }));
    const predictions = points.map(point => {
      const score = [...history, { stump, alpha, weights: [], error, accuracy: 0 }].reduce((sum, item) => sum + item.alpha * (predictStump(item.stump, point) ? 1 : -1), 0);
      return score >= 0 ? 1 : 0;
    });
    const accuracy = predictions.filter((label, index) => label === points[index].label).length / points.length;
    history.push({ stump, alpha, weights: weighted.map(point => point.weight ?? 0), error, accuracy });
  }
  return history;
}

export default function BoostingPage() {
  const [rounds, setRounds] = useState(8);
  const [activeRound, setActiveRound] = useState(3);
  const points = useMemo(() => generateSyntheticMoons(70), []);
  const history = useMemo(() => trainBoosting(points, rounds), [points, rounds]);
  const visibleRounds = history.slice(0, Math.min(activeRound, history.length));
  const predictions = points.map(point => {
    const score = visibleRounds.reduce((sum, round) => sum + round.alpha * (predictStump(round.stump, point) ? 1 : -1), 0);
    return { ...point, score, predicted: score >= 0 ? 1 : 0 };
  });
  const metrics = binaryMetrics(points.map(point => point.label), predictions.map(point => point.predicted));
  const current = history[Math.min(activeRound - 1, history.length - 1)];
  const weightBars = points.map((point, index) => ({ name: `${index + 1}`, weight: current?.weights[index] ?? 0, label: point.label }));
  const learnerBars = visibleRounds.map((round, index) => ({
    name: `Round ${index + 1}`,
    alpha: round.alpha,
    split: `${round.stump.feature} ${round.stump.polarity === 1 ? '>' : '<='} ${round.stump.threshold.toFixed(2)}`,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Boosting" subtitle="Train AdaBoost-style decision stumps round by round and watch sample weights shift toward mistakes." badge="Intermediate" category="Ensemble" icon={<GitBranch size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Boosting Controls">
            <div className="space-y-4 text-sm">
              <label className="block font-semibold">Total rounds: {rounds}<input className="w-full accent-blue-600" type="range" min={2} max={20} value={rounds} onChange={event => { const value = Number(event.target.value); setRounds(value); setActiveRound(Math.min(activeRound, value)); }} /></label>
              <label className="block font-semibold">Show through round: {activeRound}<input className="w-full accent-blue-600" type="range" min={1} max={rounds} value={activeRound} onChange={event => setActiveRound(Number(event.target.value))} /></label>
            </div>
          </Card>
          <MetricsPanel title="Weighted Vote Metrics" metrics={[
            { label: 'Accuracy', value: metrics.accuracy, format: 'percent', color: metrics.accuracy >= 0.8 ? 'green' : metrics.accuracy >= 0.6 ? 'blue' : 'red' },
            { label: 'Precision', value: metrics.precision, format: 'percent' },
            { label: 'Recall', value: metrics.recall, format: 'percent' },
            { label: 'Current Error', value: current?.error ?? 0, format: 'percent', color: (current?.error ?? 1) < 0.25 ? 'green' : 'red' },
          ]} />
          <InfoBox type="info" title="Boosting intuition">
            Each stump is weak by itself. After a stump misses examples, those examples get heavier so the next stump pays more attention to them.
          </InfoBox>
        </div>
        <div className="space-y-4">
          <Card title="Current Weighted Vote">
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" type="number" />
                <YAxis dataKey="y" type="number" />
                <Tooltip />
                <Scatter data={predictions}>
                  {predictions.map((point, index) => <Cell key={index} fill={point.predicted === point.label ? point.label ? '#059669' : '#2563eb' : '#dc2626'} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Sample Weight Distribution">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weightBars}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" interval={6} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="weight">
                    {weightBars.map((point, index) => <Cell key={index} fill={point.label ? '#059669' : '#2563eb'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Round Accuracy">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={history.map((round, index) => ({ round: index + 1, accuracy: round.accuracy, error: round.error }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="round" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="accuracy" stroke="#059669" />
                  <Line dataKey="error" stroke="#dc2626" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
          <Card title="Weak Learners and Vote Strength">
            <div className="grid gap-2 md:grid-cols-2">
              {learnerBars.map(item => (
                <div key={item.name} className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                  <div className="flex items-center justify-between text-sm font-bold text-gray-900 dark:text-white">
                    <span>{item.name}</span>
                    <span>alpha {item.alpha.toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Stump split: {item.split}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
