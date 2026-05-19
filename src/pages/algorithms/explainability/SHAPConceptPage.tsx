import { useMemo, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { buildDecisionTree, predictTree } from '../../../lib/algorithms/classification/decisionTree';

const featureNames = ['sepal length', 'sepal width', 'petal length', 'petal width'];
const classNames = ['setosa', 'versicolor', 'virginica'];

function makeIrisRows() {
  return Array.from({ length: 60 }, (_, index) => {
    const cls = Math.floor(index / 20);
    const within = index % 20;
    const wobble = Math.sin(index * 1.7) * 0.08;
    if (cls === 0) return { x: [4.8 + within * 0.025 + wobble, 3.2 + Math.cos(index) * 0.12, 1.25 + within * 0.012, 0.18 + Math.sin(index * 0.4) * 0.04], y: 0 };
    if (cls === 1) return { x: [5.5 + within * 0.035 + wobble, 2.5 + Math.cos(index) * 0.1, 3.6 + within * 0.025, 1.05 + Math.sin(index * 0.5) * 0.12], y: 1 };
    return { x: [6.2 + within * 0.045 + wobble, 2.8 + Math.cos(index) * 0.12, 4.9 + within * 0.03, 1.75 + Math.sin(index * 0.5) * 0.16], y: 2 };
  });
}

function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1);
}

function subsetHas(mask: number, feature: number) {
  return (mask & (1 << feature)) !== 0;
}

function maskedPoint(point: number[], means: number[], mask: number) {
  return point.map((value, index) => subsetHas(mask, index) ? value : means[index]);
}

export default function SHAPConceptPage() {
  const [sampleIndex, setSampleIndex] = useState(44);
  const [targetClass, setTargetClass] = useState(2);
  const rows = useMemo(() => makeIrisRows(), []);
  const X = rows.map(row => row.x);
  const y = rows.map(row => row.y);
  const means = featureNames.map((_, feature) => X.reduce((sum, row) => sum + row[feature], 0) / X.length);
  const tree = useMemo(() => buildDecisionTree(X, y, 4, 3, 'gini'), [X, y]);
  const sample = rows[sampleIndex] ?? rows[0];

  const explanation = useMemo(() => {
    const predictClassScore = (point: number[]) => predictTree(tree, point) === targetClass ? 1 : 0;
    const f = (mask: number) => predictClassScore(maskedPoint(sample.x, means, mask));
    const n = featureNames.length;
    const values = featureNames.map((name, feature) => {
      let phi = 0;
      for (let mask = 0; mask < (1 << n); mask++) {
        if (subsetHas(mask, feature)) continue;
        const size = featureNames.filter((_, index) => subsetHas(mask, index)).length;
        const weight = factorial(size) * factorial(n - size - 1) / factorial(n);
        phi += weight * (f(mask | (1 << feature)) - f(mask));
      }
      return { feature: name, value: sample.x[feature], phi };
    });
    const baseline = X.reduce((sum, point) => sum + predictClassScore(point), 0) / X.length;
    return { baseline, final: baseline + values.reduce((sum, item) => sum + item.phi, 0), values };
  }, [X, means, sample, targetClass, tree]);

  const maxAbs = Math.max(0.1, ...explanation.values.map(item => Math.abs(item.phi)), Math.abs(explanation.final - explanation.baseline));
  const waterfall = useMemo(() => {
    return explanation.values.reduce<Array<(typeof explanation.values)[number] & { before: number; after: number }>>((rows, item) => {
      const before = rows.at(-1)?.after ?? explanation.baseline;
      return [...rows, { ...item, before, after: before + item.phi }];
    }, []);
  }, [explanation]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="SHAP" subtitle="Compute exact Shapley feature attributions by enumerating all 16 feature subsets for an Iris-style decision tree." badge="Advanced" category="Explainability" icon={<GitBranch size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="SHAP Controls">
            <div className="space-y-4 text-sm">
              <label className="block font-semibold">Test point
                <select value={sampleIndex} onChange={event => setSampleIndex(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                  {rows.slice(0, 10).map((row, index) => <option key={index} value={index}>{index + 1}: {classNames[row.y]}</option>)}
                  {rows.slice(20, 30).map((row, index) => <option key={index + 20} value={index + 20}>{index + 21}: {classNames[row.y]}</option>)}
                  {rows.slice(40, 50).map((row, index) => <option key={index + 40} value={index + 40}>{index + 41}: {classNames[row.y]}</option>)}
                </select>
              </label>
              <label className="block font-semibold">Class to explain
                <select value={targetClass} onChange={event => setTargetClass(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                  {classNames.map((name, index) => <option key={name} value={index}>{name}</option>)}
                </select>
              </label>
            </div>
          </Card>
          <MetricsPanel title="Prediction Summary" metrics={[
            { label: 'Baseline', value: explanation.baseline, format: 'percent' },
            { label: 'Final Score', value: explanation.final, format: 'percent', color: explanation.final > explanation.baseline ? 'green' : 'red' },
            { label: 'Predicted Class', value: classNames[predictTree(tree, sample.x)] },
            { label: 'True Class', value: classNames[sample.y] },
          ]} />
          <InfoBox type="info" title="Exact Shapley enumeration">
            With four features there are only 16 coalitions, so this page can compute exact marginal contributions rather than sampling approximations.
          </InfoBox>
        </div>
        <div className="space-y-4">
          <Card title="SHAP Waterfall">
            <div className="space-y-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Baseline mean prediction for {classNames[targetClass]}</span>
                  <span>{(explanation.baseline * 100).toFixed(1)}%</span>
                </div>
              </div>
              {waterfall.map(item => {
                const width = `${Math.max(6, Math.abs(item.phi) / maxAbs * 100)}%`;
                const positive = item.phi >= 0;
                return (
                  <div key={item.feature} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-950">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-bold text-gray-900 dark:text-white">{item.feature} = {item.value.toFixed(2)}</span>
                      <span className={positive ? 'font-mono font-bold text-red-600 dark:text-red-400' : 'font-mono font-bold text-blue-600 dark:text-blue-400'}>{positive ? '+' : ''}{item.phi.toFixed(3)}</span>
                    </div>
                    <div className="h-7 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                      <div className={`h-full ${positive ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width }} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Running score: {(item.before * 100).toFixed(1)}% to {(item.after * 100).toFixed(1)}%</p>
                  </div>
                );
              })}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between text-sm font-bold text-emerald-900 dark:text-emerald-100">
                  <span>Final prediction score</span>
                  <span>{(explanation.final * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </Card>
          <Card title="Feature Values">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {featureNames.map((name, index) => (
                <div key={name} className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                  <p className="text-xs font-bold uppercase text-gray-500">{name}</p>
                  <p className="mt-1 font-mono text-lg font-bold text-gray-900 dark:text-white">{sample.x[index].toFixed(2)}</p>
                  <p className="text-xs text-gray-500">mean {means[index].toFixed(2)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
