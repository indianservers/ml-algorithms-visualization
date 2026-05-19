import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Layers3 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { buildDecisionTree, predictTree } from '../../../lib/algorithms/classification/decisionTree';
import { generateSyntheticBlobs, generateSyntheticMoons } from '../../../data/sampleDatasets';

type Row = { x: number; y: number; label: number };
type Learner = 'tree' | 'knn' | 'logistic';

const learnerLabels: Record<Learner, string> = { tree: 'Decision Tree', knn: 'KNN', logistic: 'Logistic' };

function splitRows(rows: Row[]) {
  return { train: rows.slice(0, Math.floor(rows.length * 0.8)), test: rows.slice(Math.floor(rows.length * 0.8)) };
}

function knnPredict(train: Row[], row: Row, k = 7) {
  const neighbors = [...train].sort((a, b) => (a.x - row.x) ** 2 + (a.y - row.y) ** 2 - ((b.x - row.x) ** 2 + (b.y - row.y) ** 2)).slice(0, k);
  return neighbors.filter(item => item.label === 1).length >= k / 2 ? 1 : 0;
}

function logisticTrain(train: Row[]) {
  let wx = 0;
  let wy = 0;
  let b = 0;
  for (let epoch = 0; epoch < 120; epoch++) {
    train.forEach(row => {
      const p = 1 / (1 + Math.exp(-(wx * row.x + wy * row.y + b)));
      const error = row.label - p;
      wx += 0.04 * error * row.x;
      wy += 0.04 * error * row.y;
      b += 0.04 * error;
    });
  }
  return (row: Row) => (1 / (1 + Math.exp(-(wx * row.x + wy * row.y + b)))) >= 0.5 ? 1 : 0;
}

function confusion(actual: number[], predicted: number[]) {
  let tp = 0; let tn = 0; let fp = 0; let fn = 0;
  actual.forEach((label, index) => {
    if (label === 1 && predicted[index] === 1) tp += 1;
    else if (label === 0 && predicted[index] === 0) tn += 1;
    else if (label === 0) fp += 1;
    else fn += 1;
  });
  return { tp, tn, fp, fn, accuracy: (tp + tn) / actual.length };
}

function trainStack(rows: Row[], enabled: Record<Learner, boolean>, meta: 'weighted' | 'knn') {
  const { train, test } = splitRows(rows);
  const tree = buildDecisionTree(train.map(row => [row.x, row.y]), train.map(row => row.label), 4, 3, 'gini');
  const logistic = logisticTrain(train);
  const predictors: Record<Learner, (row: Row) => number> = {
    tree: row => predictTree(tree, [row.x, row.y]),
    knn: row => knnPredict(train, row),
    logistic,
  };
  const active = (Object.keys(enabled) as Learner[]).filter(key => enabled[key]);
  const actual = test.map(row => row.label);
  const base = active.map(key => {
    const predictions = test.map(row => predictors[key](row));
    return { key, predictions, confusion: confusion(actual, predictions) };
  });
  const weights = Object.fromEntries(base.map(item => [item.key, item.confusion.accuracy])) as Record<Learner, number>;
  const stackPredictions = test.map((row, rowIndex) => {
    if (meta === 'knn') return knnPredict(train, row, 9);
    const score = base.reduce((sum, item) => sum + weights[item.key] * (item.predictions[rowIndex] ? 1 : -1), 0);
    return score >= 0 ? 1 : 0;
  });
  return { train, test, actual, base, stackPredictions, stackConfusion: confusion(actual, stackPredictions), weights };
}

export default function StackingPage() {
  const [dataset, setDataset] = useState<'moons' | 'blobs'>('moons');
  const [meta, setMeta] = useState<'weighted' | 'knn'>('weighted');
  const [enabled, setEnabled] = useState<Record<Learner, boolean>>({ tree: true, knn: true, logistic: true });
  const rows = useMemo(() => dataset === 'moons'
    ? generateSyntheticMoons(120)
    : generateSyntheticBlobs(120, 2).map(point => ({ ...point, label: point.label ? 1 : 0 })),
  [dataset]);
  const result = useMemo(() => trainStack(rows, enabled, meta), [rows, enabled, meta]);
  const comparison = [
    ...result.base.map(item => ({ name: learnerLabels[item.key], accuracy: item.confusion.accuracy, key: item.key })),
    { name: 'Stack', accuracy: result.stackConfusion.accuracy, key: 'stack' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Stacking" subtitle="Train base learners, feed their predictions into a meta-learner, and compare ensemble accuracy." badge="Intermediate" category="Ensemble" icon={<Layers3 size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[330px_1fr]">
        <div className="space-y-4">
          <Card title="Stacking Controls">
            <div className="space-y-4 text-sm">
              <label className="block font-semibold">Dataset
                <select value={dataset} onChange={event => setDataset(event.target.value as 'moons' | 'blobs')} className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                  <option value="moons">Synthetic moons</option>
                  <option value="blobs">Synthetic blobs</option>
                </select>
              </label>
              <label className="block font-semibold">Meta-learner
                <select value={meta} onChange={event => setMeta(event.target.value as 'weighted' | 'knn')} className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                  <option value="weighted">Weighted logistic-style vote</option>
                  <option value="knn">KNN meta-learner</option>
                </select>
              </label>
              {(Object.keys(enabled) as Learner[]).map(key => <label key={key} className="flex items-center gap-2"><input type="checkbox" checked={enabled[key]} onChange={event => setEnabled(current => ({ ...current, [key]: event.target.checked }))} /> {learnerLabels[key]}</label>)}
            </div>
          </Card>
          <MetricsPanel title="Stack Metrics" metrics={[
            { label: 'Stack Accuracy', value: result.stackConfusion.accuracy, format: 'percent', color: result.stackConfusion.accuracy >= 0.8 ? 'green' : result.stackConfusion.accuracy >= 0.6 ? 'blue' : 'red' },
            { label: 'Train Rows', value: result.train.length, format: 'number' },
            { label: 'Test Rows', value: result.test.length, format: 'number' },
            { label: 'Base Learners', value: result.base.length, format: 'number' },
          ]} />
          <InfoBox type="info" title="Stacking lesson">
            Stacking turns base model predictions into new features. The meta-learner can trust stronger models more and correct some individual learner mistakes.
          </InfoBox>
        </div>
        <div className="space-y-4">
          <Card title="Accuracy Comparison">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={comparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={value => `${Math.round(Number(value) * 100)}%`} />
                <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                <Bar dataKey="accuracy">
                  {comparison.map(item => <Cell key={item.name} fill={item.key === 'stack' ? '#059669' : '#2563eb'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Base Learner Predictions">
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead><tr className="border-b border-gray-200 dark:border-gray-700"><th className="p-2 text-left">Row</th><th className="p-2">Truth</th>{result.base.map(item => <th key={item.key} className="p-2">{learnerLabels[item.key]}</th>)}<th className="p-2">Stack</th></tr></thead>
                  <tbody>
                    {result.test.slice(0, 14).map((row, index) => (
                      <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="p-2 font-mono">{index + 1}</td>
                        <td className="p-2 text-center font-bold">{row.label}</td>
                        {result.base.map(item => <td key={item.key} className={`p-2 text-center font-bold ${item.predictions[index] === row.label ? 'text-green-600' : 'text-red-600'}`}>{item.predictions[index]}</td>)}
                        <td className={`p-2 text-center font-bold ${result.stackPredictions[index] === row.label ? 'text-green-600' : 'text-red-600'}`}>{result.stackPredictions[index]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card title="Meta-Learner Weights">
              <div className="space-y-3">
                {result.base.map(item => (
                  <div key={item.key}>
                    <div className="mb-1 flex justify-between text-xs font-bold"><span>{learnerLabels[item.key]}</span><span>{result.weights[item.key].toFixed(2)}</span></div>
                    <div className="h-3 rounded bg-gray-100 dark:bg-gray-800"><div className="h-3 rounded bg-violet-600" style={{ width: `${result.weights[item.key] * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <Card title="Confusion Matrices">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[...result.base.map(item => ({ name: learnerLabels[item.key], cm: item.confusion })), { name: 'Stack', cm: result.stackConfusion }].map(item => (
                <div key={item.name} className="rounded border border-gray-200 p-3 dark:border-gray-700">
                  <p className="mb-2 text-xs font-bold">{item.name}</p>
                  <div className="grid grid-cols-2 gap-1 text-center text-xs font-bold">
                    <span className="rounded bg-green-100 p-2 text-green-900">TN {item.cm.tn}</span>
                    <span className="rounded bg-red-100 p-2 text-red-900">FP {item.cm.fp}</span>
                    <span className="rounded bg-red-100 p-2 text-red-900">FN {item.cm.fn}</span>
                    <span className="rounded bg-green-100 p-2 text-green-900">TP {item.cm.tp}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
