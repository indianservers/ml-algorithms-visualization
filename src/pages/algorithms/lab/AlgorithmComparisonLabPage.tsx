import React, { useState, useCallback, useMemo } from 'react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { LearningPanel } from '../../../components/ml/LearningPanel';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell as RCell,
} from 'recharts';
import { logisticRegression } from '../../../lib/algorithms/classification/logisticRegression';
import { knnClassifyAll } from '../../../lib/algorithms/classification/knn';
import { trainGaussianNB } from '../../../lib/algorithms/classification/naiveBayes';
import { buildDecisionTree, predictTree } from '../../../lib/algorithms/classification/decisionTree';
import { generateSyntheticBlobs, generateSyntheticMoons, irisDataset, loanDataset } from '../../../data/sampleDatasets';
import { mean } from '../../../lib/math/statistics';
import { Copy, Download, FlaskConical, CheckSquare, Square } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────
interface AlgoResult {
  name: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  trainingTimeMs: number;
  predictions: number[];
  decisionGrid?: number[][];  // 30×30 grid of predicted class
}

interface DatasetOption {
  id: string;
  label: string;
  generate: () => { X: number[][]; y: number[]; featureNames: string[] };
}

// ── Multi-class metrics helpers ───────────────────────────────────────────
function multiclassMetrics(actual: number[], predicted: number[]): {
  accuracy: number; precision: number; recall: number; f1: number;
} {
  const classes = [...new Set(actual)];
  const accuracy = actual.filter((a, i) => a === predicted[i]).length / actual.length;

  const perClass = classes.map(c => {
    const tp = actual.filter((a, i) => a === c && predicted[i] === c).length;
    const fp = actual.filter((a, i) => a !== c && predicted[i] === c).length;
    const fn = actual.filter((a, i) => a === c && predicted[i] !== c).length;
    const precision = tp / (tp + fp || 1);
    const recall = tp / (tp + fn || 1);
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    return { precision, recall, f1 };
  });

  return {
    accuracy,
    precision: mean(perClass.map(p => p.precision)),
    recall: mean(perClass.map(p => p.recall)),
    f1: mean(perClass.map(p => p.f1)),
  };
}

// ── Dataset options ───────────────────────────────────────────────────────
const DATASET_OPTIONS: DatasetOption[] = [
  {
    id: 'blobs',
    label: 'Synthetic Blobs (3 classes)',
    generate: () => {
      const raw = generateSyntheticBlobs(120, 3);
      const X = raw.map(p => [p.x, p.y]);
      const y = raw.map(p => p.label);
      return { X, y, featureNames: ['x', 'y'] };
    },
  },
  {
    id: 'moons',
    label: 'Synthetic Moons (2 classes)',
    generate: () => {
      const raw = generateSyntheticMoons(120);
      const X = raw.map(p => [p.x, p.y]);
      const y = raw.map(p => p.label);
      return { X, y, featureNames: ['x', 'y'] };
    },
  },
  {
    id: 'iris',
    label: 'Iris Dataset (3 classes)',
    generate: () => {
      const labelMap: Record<string, number> = { setosa: 0, versicolor: 1, virginica: 2 };
      const X = irisDataset.data.map(row => [
        row.sepal_length as number,
        row.sepal_width as number,
        row.petal_length as number,
        row.petal_width as number,
      ]);
      const y = irisDataset.data.map(row => labelMap[row.species as string]);
      return { X, y, featureNames: ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'] };
    },
  },
  {
    id: 'loan',
    label: 'Loan Approval (binary)',
    generate: () => {
      const X = loanDataset.data.map(row => [
        (row.income as number) / 100000,
        (row.credit_score as number) / 800,
        row.debt_ratio as number,
        (row.employment_years as number) / 15,
      ]);
      const y = loanDataset.data.map(row => row.approved as number);
      return { X, y, featureNames: ['income', 'credit_score', 'debt_ratio', 'employment_years'] };
    },
  },
];

// ── Train/test split ──────────────────────────────────────────────────────
function trainTestSplit(X: number[][], y: number[], testRatio = 0.25): {
  trainX: number[][]; trainY: number[]; testX: number[][]; testY: number[];
} {
  const n = X.length;
  const indices = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
  const split = Math.floor(n * (1 - testRatio));
  const trainIdx = indices.slice(0, split);
  const testIdx = indices.slice(split);
  return {
    trainX: trainIdx.map(i => X[i]),
    trainY: trainIdx.map(i => y[i]),
    testX: testIdx.map(i => X[i]),
    testY: testIdx.map(i => y[i]),
  };
}

// ── Decision boundary grid ────────────────────────────────────────────────
function buildDecisionGrid(
  predictFn: (x: number[]) => number,
  xRange: [number, number],
  yRange: [number, number],
  res = 30
): number[][] {
  return Array.from({ length: res }, (_, r) => {
    const y = yRange[0] + (r / (res - 1)) * (yRange[1] - yRange[0]);
    return Array.from({ length: res }, (_, c) => {
      const x = xRange[0] + (c / (res - 1)) * (xRange[1] - xRange[0]);
      return predictFn([x, y]);
    });
  });
}

// ── Color palette ─────────────────────────────────────────────────────────
const CLASS_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const ALG_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

const ALGO_KEYS = ['LogisticRegression', 'KNN', 'NaiveBayes', 'DecisionTree'] as const;
type AlgoKey = typeof ALGO_KEYS[number];

// ── Main page component ───────────────────────────────────────────────────
export default function AlgorithmComparisonLabPage() {
  const [datasetId, setDatasetId] = useState('blobs');
  const [selectedAlgos, setSelectedAlgos] = useState<Set<AlgoKey>>(new Set(ALGO_KEYS));
  const [results, setResults] = useState<AlgoResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [showBoundaries, setShowBoundaries] = useState(false);

  const dsOption = DATASET_OPTIONS.find(d => d.id === datasetId)!;

  const toggleAlgo = (key: AlgoKey) => {
    setSelectedAlgos(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const run = useCallback(() => {
    setIsRunning(true);
    setStatus('Generating dataset...');
    setResults([]);

    setTimeout(() => {
      const { X, y } = dsOption.generate();
      const { trainX, trainY, testX, testY } = trainTestSplit(X, y);
      const is2D = X[0].length === 2;

      // Compute grid extent for decision boundaries
      const xs = X.map(r => r[0]);
      const ys = X.map(r => r[1] ?? 0);
      const pad = 0.5;
      const xRange: [number, number] = [Math.min(...xs) - pad, Math.max(...xs) + pad];
      const yRange: [number, number] = [Math.min(...ys) - pad, Math.max(...ys) + pad];

      const newResults: AlgoResult[] = [];

      // ── Logistic Regression ──
      if (selectedAlgos.has('LogisticRegression')) {
        setStatus('Training Logistic Regression…');
        const t0 = Date.now();
        const model = logisticRegression(trainX, trainY.map(v => v === 0 ? 0 : 1), 0.1, 300);
        // Multi-class: train one-vs-rest per class label
        const classes = [...new Set(trainY)].sort();
        let predictions: number[];

        if (classes.length === 2) {
          const binaryTrainY = trainY.map(v => (v === classes[1] ? 1 : 0));
          const m = logisticRegression(trainX, binaryTrainY, 0.1, 300);
          predictions = testX.map(x => m.predict(x) === 1 ? classes[1] : classes[0]);
        } else {
          // OvR
          const models = classes.map(c =>
            logisticRegression(trainX, trainY.map(v => v === c ? 1 : 0), 0.1, 300)
          );
          predictions = testX.map(x => {
            const probas = models.map(m => m.predictProba(x));
            const best = probas.indexOf(Math.max(...probas));
            return classes[best];
          });
        }

        const t1 = Date.now();
        const metrics = multiclassMetrics(testY, predictions);
        const decisionGrid = is2D && showBoundaries
          ? (() => {
              const predictFn = (x: number[]) => {
                if (classes.length === 2) {
                  const bm = logisticRegression(trainX, trainY.map(v => (v === classes[1] ? 1 : 0)), 0.1, 300);
                  return bm.predict(x) === 1 ? classes[1] : classes[0];
                }
                const ms = classes.map(c =>
                  logisticRegression(trainX, trainY.map(v => v === c ? 1 : 0), 0.1, 300)
                );
                const probas = ms.map(m => m.predictProba(x));
                return classes[probas.indexOf(Math.max(...probas))];
              };
              return buildDecisionGrid(predictFn, xRange, yRange);
            })()
          : undefined;

        newResults.push({ name: 'Logistic Regression', ...metrics, trainingTimeMs: t1 - t0, predictions, decisionGrid });
      }

      // ── KNN ──
      if (selectedAlgos.has('KNN')) {
        setStatus('Training KNN (k=5)…');
        const t0 = Date.now();
        const predictions = knnClassifyAll(trainX, trainY, testX, 5);
        const t1 = Date.now();
        const metrics = multiclassMetrics(testY, predictions);
        const decisionGrid = is2D && showBoundaries
          ? buildDecisionGrid(x => knnClassifyAll(trainX, trainY, [x], 5)[0], xRange, yRange)
          : undefined;
        newResults.push({ name: 'KNN (k=5)', ...metrics, trainingTimeMs: t1 - t0, predictions, decisionGrid });
      }

      // ── Naive Bayes ──
      if (selectedAlgos.has('NaiveBayes')) {
        setStatus('Training Naive Bayes…');
        const t0 = Date.now();
        const nbModel = trainGaussianNB(trainX, trainY);
        const predictions = testX.map(x => nbModel.predict(x));
        const t1 = Date.now();
        const metrics = multiclassMetrics(testY, predictions);
        const decisionGrid = is2D && showBoundaries
          ? buildDecisionGrid(x => nbModel.predict(x), xRange, yRange)
          : undefined;
        newResults.push({ name: 'Naive Bayes', ...metrics, trainingTimeMs: t1 - t0, predictions, decisionGrid });
      }

      // ── Decision Tree ──
      if (selectedAlgos.has('DecisionTree')) {
        setStatus('Training Decision Tree…');
        const t0 = Date.now();
        const tree = buildDecisionTree(trainX, trainY, 6, 2);
        const predictions = testX.map(x => predictTree(tree, x));
        const t1 = Date.now();
        const metrics = multiclassMetrics(testY, predictions);
        const decisionGrid = is2D && showBoundaries
          ? buildDecisionGrid(x => predictTree(tree, x), xRange, yRange)
          : undefined;
        newResults.push({ name: 'Decision Tree', ...metrics, trainingTimeMs: t1 - t0, predictions, decisionGrid });
      }

      setResults(newResults);
      setStatus('Done!');
      setIsRunning(false);
    }, 20);
  }, [datasetId, selectedAlgos, showBoundaries, dsOption]);

  // Find best per metric
  const bestIdx = useMemo(() => {
    const metrics: (keyof AlgoResult)[] = ['accuracy', 'precision', 'recall', 'f1'];
    const map: Record<string, number> = {};
    metrics.forEach(m => {
      let best = -1, bestVal = -Infinity;
      results.forEach((r, i) => {
        if ((r[m] as number) > bestVal) { bestVal = r[m] as number; best = i; }
      });
      map[m] = best;
    });
    return map;
  }, [results]);

  // Export
  const exportJSON = () => {
    const data = results.map(r => ({
      algorithm: r.name,
      accuracy: r.accuracy.toFixed(4),
      precision: r.precision.toFixed(4),
      recall: r.recall.toFixed(4),
      f1: r.f1.toFixed(4),
      trainingTimeMs: r.trainingTimeMs,
    }));
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'comparison.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const copyJSON = () => {
    const data = results.map(r => ({
      algorithm: r.name,
      accuracy: r.accuracy.toFixed(4),
      precision: r.precision.toFixed(4),
      recall: r.recall.toFixed(4),
      f1: r.f1.toFixed(4),
    }));
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const barData = results.map(r => ({
    name: r.name.replace('Logistic Regression', 'LR').replace('Decision Tree', 'DT').replace('Naive Bayes', 'NB'),
    Accuracy: parseFloat((r.accuracy * 100).toFixed(1)),
    F1: parseFloat((r.f1 * 100).toFixed(1)),
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      <PageHeader
        title="Algorithm Comparison Lab"
        subtitle="Run multiple classification algorithms on the same dataset and compare their performance side by side."
        badge="Advanced"
        category="Lab"
        icon={<FlaskConical size={22} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ── Controls ── */}
        <div className="space-y-4">
          <Card title="Dataset">
            <div className="space-y-1">
              {DATASET_OPTIONS.map(ds => (
                <label key={ds.id} className="flex items-center gap-2 py-1.5 cursor-pointer">
                  <input
                    type="radio" name="dataset" value={ds.id}
                    checked={datasetId === ds.id}
                    onChange={() => { setDatasetId(ds.id); setResults([]); }}
                    className="accent-blue-600"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{ds.label}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card title="Algorithms">
            <div className="space-y-1">
              {ALGO_KEYS.map(key => (
                <button
                  key={key}
                  onClick={() => toggleAlgo(key)}
                  className="w-full flex items-center gap-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:text-blue-600 text-left"
                >
                  {selectedAlgos.has(key)
                    ? <CheckSquare size={14} className="text-blue-600 shrink-0" />
                    : <Square size={14} className="text-gray-400 shrink-0" />}
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </button>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBoundaries}
                  onChange={e => setShowBoundaries(e.target.checked)}
                  className="accent-blue-600"
                />
                Show decision boundaries (2D only)
              </label>
            </div>
          </Card>

          <button
            onClick={run}
            disabled={isRunning || selectedAlgos.size === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isRunning
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {status}</>
              : 'Run Comparison'}
          </button>

          {results.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={exportJSON}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              >
                <Download size={12} /> Export JSON
              </button>
              <button
                onClick={copyJSON}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
          )}
        </div>

        {/* ── Results ── */}
        <div className="lg:col-span-3 space-y-4">
          {results.length === 0 ? (
            <Card title="Results">
              <div className="h-40 flex items-center justify-center text-sm text-gray-400">
                Select algorithms and a dataset, then click Run.
              </div>
            </Card>
          ) : (
            <>
              {/* Metrics table */}
              <Card title="Metrics Comparison" actions={
                <span className="text-xs text-gray-400">Green = best per metric</span>
              }>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50">
                        <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400">Metric</th>
                        {results.map(r => (
                          <th key={r.name} className="px-3 py-2 text-center font-semibold text-gray-600 dark:text-gray-400">
                            {r.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(['accuracy', 'precision', 'recall', 'f1'] as const).map((metric, mi) => (
                        <tr key={metric} className="border-t border-gray-100 dark:border-gray-700/50">
                          <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300 capitalize">
                            {metric === 'f1' ? 'F1 Score' : metric.charAt(0).toUpperCase() + metric.slice(1)}
                          </td>
                          {results.map((r, ri) => (
                            <td
                              key={r.name}
                              className={`px-3 py-2 text-center font-mono font-semibold ${
                                bestIdx[metric] === ri
                                  ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {(r[metric] * 100).toFixed(1)}%
                            </td>
                          ))}
                        </tr>
                      ))}
                      <tr className="border-t border-gray-200 dark:border-gray-700">
                        <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">Train Time</td>
                        {results.map(r => (
                          <td key={r.name} className="px-3 py-2 text-center font-mono text-gray-500">
                            {r.trainingTimeMs}ms
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Bar chart */}
              <Card title="Accuracy & F1 Comparison">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="Accuracy" fill="#3b82f6" radius={[3, 3, 0, 0]}>
                      {barData.map((_, i) => (
                        <RCell key={i} fill={ALG_COLORS[i % ALG_COLORS.length]} />
                      ))}
                    </Bar>
                    <Bar dataKey="F1" fill="#10b981" radius={[3, 3, 0, 0]} fillOpacity={0.6}>
                      {barData.map((_, i) => (
                        <RCell key={i} fill={ALG_COLORS[i % ALG_COLORS.length]} fillOpacity={0.5} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Decision boundaries */}
              {showBoundaries && results.some(r => r.decisionGrid) && (
                <Card title="Decision Boundaries (30×30 grid)">
                  <div className="flex flex-wrap gap-4">
                    {results
                      .filter(r => r.decisionGrid)
                      .map((r, ri) => (
                        <div key={r.name} className="flex-1 min-w-[180px]">
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 text-center">
                            {r.name}
                          </p>
                          <div
                            className="inline-grid border border-gray-200 dark:border-gray-600 rounded overflow-hidden"
                            style={{ gridTemplateColumns: `repeat(30, 6px)` }}
                          >
                            {r.decisionGrid!.map((row, rr) =>
                              row.map((cls, cc) => (
                                <div
                                  key={`${rr}-${cc}`}
                                  style={{
                                    width: 6, height: 6,
                                    background: CLASS_COLORS[cls % CLASS_COLORS.length] + '88',
                                  }}
                                />
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    Each pixel shows the predicted class label for that (x, y) region.
                  </p>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* Learning Notes */}
      <LearningPanel
        sections={[
          {
            title: 'Why Compare Algorithms?',
            content: (
              <p>No single algorithm dominates all datasets. Comparing on the same train/test split reveals trade-offs in accuracy, recall, training speed, and interpretability.</p>
            ),
          },
          {
            title: 'Metrics Explained',
            content: (
              <ul className="list-disc ml-4 space-y-1">
                <li><strong>Accuracy</strong>: fraction of correct predictions.</li>
                <li><strong>Precision</strong>: of all predicted positives, how many were correct.</li>
                <li><strong>Recall</strong>: of all actual positives, how many were found.</li>
                <li><strong>F1</strong>: harmonic mean of precision and recall — robust for imbalanced classes.</li>
              </ul>
            ),
          },
          {
            title: 'Algorithm Strengths',
            content: (
              <ul className="list-disc ml-4 space-y-1">
                <li><strong>Logistic Regression</strong>: fast, interpretable, linear boundaries.</li>
                <li><strong>KNN</strong>: non-parametric, flexible, slow at inference.</li>
                <li><strong>Naive Bayes</strong>: very fast, works well with small data, assumes feature independence.</li>
                <li><strong>Decision Tree</strong>: human-readable rules, prone to overfitting without pruning.</li>
              </ul>
            ),
          },
        ]}
      />
    </div>
  );
}
