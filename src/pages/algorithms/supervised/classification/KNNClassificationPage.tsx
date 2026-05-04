import React, { useState, useMemo, useCallback } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { MapPin, Crosshair } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { Tabs } from '../../../components/common/Tabs';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { HyperparameterPanel, HyperparamDef } from '../../../components/ml/HyperparameterPanel';
import { LearningPanel } from '../../../components/ml/LearningPanel';
import { knnPredict, knnClassifyAll } from '../../../../lib/algorithms/classification/knn';
import { generateSyntheticBlobs } from '../../../../data/sampleDatasets';
import { irisDataset } from '../../../../data/sampleDatasets';

const CLASS_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
const CLASS_NAMES_IRIS = ['setosa', 'versicolor', 'virginica'];
const CLASS_NAMES_BLOB = ['Class 0', 'Class 1', 'Class 2'];

type DistanceMetric = 'euclidean' | 'manhattan' | 'cosine';

interface DataPoint { x: number; y: number; label: number }

function generateIrisData(): DataPoint[] {
  return irisDataset.data.map(d => {
    const row = d as { sepal_length: number; petal_length: number; species: string };
    const label = row.species === 'setosa' ? 0 : row.species === 'versicolor' ? 1 : 2;
    return { x: row.sepal_length, y: row.petal_length, label };
  });
}

export default function KNNClassificationPage() {
  const [dataSource, setDataSource] = useState<'blobs' | 'iris'>('blobs');
  const [k, setK] = useState(3);
  const [metric, setMetric] = useState<DistanceMetric>('euclidean');
  const [queryX, setQueryX] = useState('0');
  const [queryY, setQueryY] = useState('0');
  const [prediction, setPrediction] = useState<ReturnType<typeof knnPredict> | null>(null);
  const [showBoundary, setShowBoundary] = useState(false);

  const blobData = useMemo(() => generateSyntheticBlobs(90, 3), []);
  const irisData = useMemo(() => generateIrisData(), []);
  const data: DataPoint[] = dataSource === 'blobs' ? blobData : irisData;

  const classNames = dataSource === 'blobs' ? CLASS_NAMES_BLOB : CLASS_NAMES_IRIS;

  const trainX = data.map(d => [d.x, d.y]);
  const trainY = data.map(d => d.label);

  const classes = useMemo(() => [...new Set(trainY)].sort(), [trainY]);

  // Accuracy via leave-nothing-out (all train as test, just for display)
  const allPredictions = useMemo(() => knnClassifyAll(trainX, trainY, trainX, k, metric), [trainX, trainY, k, metric]);
  const accuracy = useMemo(() => allPredictions.filter((p, i) => p === trainY[i]).length / trainY.length, [allPredictions, trainY]);

  // Decision boundary grid
  const boundaryData = useMemo(() => {
    if (!showBoundary) return [];
    const xs = data.map(d => d.x);
    const ys = data.map(d => d.y);
    const xMin = Math.min(...xs) - 0.5, xMax = Math.max(...xs) + 0.5;
    const yMin = Math.min(...ys) - 0.5, yMax = Math.max(...ys) + 0.5;
    const steps = 20;
    const xStep = (xMax - xMin) / steps;
    const yStep = (yMax - yMin) / steps;
    const result: { x: number; y: number; label: number }[] = [];
    for (let xi = 0; xi <= steps; xi++) {
      for (let yi = 0; yi <= steps; yi++) {
        const px = xMin + xi * xStep;
        const py = yMin + yi * yStep;
        const pred = knnPredict(trainX, trainY, [px, py], k, metric);
        result.push({ x: parseFloat(px.toFixed(2)), y: parseFloat(py.toFixed(2)), label: pred.predictedClass });
      }
    }
    return result;
  }, [showBoundary, data, trainX, trainY, k, metric]);

  const handlePredict = useCallback(() => {
    const qx = parseFloat(queryX), qy = parseFloat(queryY);
    if (isNaN(qx) || isNaN(qy)) return;
    const result = knnPredict(trainX, trainY, [qx, qy], k, metric);
    setPrediction(result);
  }, [queryX, queryY, trainX, trainY, k, metric]);

  const hyperparamDefs: HyperparamDef[] = [
    { key: 'k', label: 'K (Neighbours)', type: 'range', min: 1, max: 15, step: 2, value: k },
    {
      key: 'metric', label: 'Distance Metric', type: 'select', value: metric,
      options: [
        { value: 'euclidean', label: 'Euclidean' },
        { value: 'manhattan', label: 'Manhattan' },
        { value: 'cosine', label: 'Cosine' },
      ],
    },
  ];

  const handleParamChange = useCallback((key: string, value: number | string | boolean) => {
    if (key === 'k') setK(value as number);
    if (key === 'metric') setMetric(value as DistanceMetric);
    setPrediction(null);
  }, []);

  // Vote bar chart data
  const voteData = useMemo(() => {
    if (!prediction) return [];
    return classes.map(c => ({
      name: classNames[c] ?? `Class ${c}`,
      votes: prediction.votes[c] ?? 0,
      color: CLASS_COLORS[c % CLASS_COLORS.length],
    }));
  }, [prediction, classes, classNames]);

  // Scatter data split by class
  const scatterByClass = useMemo(() =>
    classes.map(c => ({
      class: c,
      points: data.filter(d => d.label === c),
      color: CLASS_COLORS[c % CLASS_COLORS.length],
    })), [classes, data]);

  const neighborIndices = useMemo(() => new Set(prediction?.neighbors.map(n => n.index) ?? []), [prediction]);

  const queryPt = useMemo(() => {
    const qx = parseFloat(queryX), qy = parseFloat(queryY);
    return !isNaN(qx) && !isNaN(qy) ? { x: qx, y: qy } : null;
  }, [queryX, queryY]);

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      <PageHeader
        title="K-Nearest Neighbours"
        subtitle="Classify points by majority vote among the K closest training examples using distance metrics."
        badge="Beginner"
        category="Supervised Learning › Classification"
        icon={<MapPin size={22} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <Card title="Dataset">
            <div className="flex gap-2">
              {(['blobs', 'iris'] as const).map(src => (
                <button
                  key={src}
                  onClick={() => { setDataSource(src); setPrediction(null); }}
                  className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors ${dataSource === src ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}
                >
                  {src === 'blobs' ? 'Synthetic Blobs' : 'Iris Dataset'}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">{data.length} points · {classes.length} classes · Features: x₁, x₂</p>
          </Card>

          <HyperparameterPanel params={hyperparamDefs} onChange={handleParamChange} />

          <MetricsPanel
            title="Performance"
            metrics={[
              { label: 'Accuracy', value: accuracy, format: 'percent', color: accuracy > 0.8 ? 'green' : 'default' },
              { label: 'K', value: k, format: 'fixed2' },
              { label: 'Metric', value: metric },
              { label: 'Samples', value: data.length, format: 'fixed2' },
            ]}
          />

          <Card title="Query Point">
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">X₁</label>
                  <input
                    type="number" value={queryX}
                    onChange={e => { setQueryX(e.target.value); setPrediction(null); }}
                    className="w-full text-xs font-mono bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-800 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">X₂</label>
                  <input
                    type="number" value={queryY}
                    onChange={e => { setQueryY(e.target.value); setPrediction(null); }}
                    className="w-full text-xs font-mono bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-800 dark:text-gray-100"
                  />
                </div>
              </div>
              <button
                onClick={handlePredict}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg py-2 transition-colors"
              >
                <Crosshair size={14} /> Predict
              </button>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox" checked={showBoundary} onChange={e => setShowBoundary(e.target.checked)}
                  className="accent-blue-500"
                />
                Show decision boundary (slow for large K)
              </label>
            </div>
          </Card>

          {prediction && (
            <Card title="Prediction Result">
              <div className="text-center">
                <div
                  className="text-3xl font-bold py-2"
                  style={{ color: CLASS_COLORS[prediction.predictedClass % CLASS_COLORS.length] }}
                >
                  {classNames[prediction.predictedClass]}
                </div>
                <p className="text-xs text-gray-500">{k} nearest neighbours voted</p>
              </div>
              <div className="mt-3 space-y-1">
                {prediction.neighbors.map((n, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-700/50 rounded p-1.5">
                    <span className="font-mono text-gray-600 dark:text-gray-300">Neighbour #{i + 1}</span>
                    <span className="font-medium" style={{ color: CLASS_COLORS[n.label % CLASS_COLORS.length] }}>
                      {classNames[n.label]}
                    </span>
                    <span className="text-gray-400 font-mono">{n.distance.toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs
            tabs={[
              { id: 'scatter', label: 'Scatter Plot' },
              { id: 'votes', label: 'Vote Breakdown' },
              { id: 'boundary', label: 'Decision Boundary' },
            ]}
          >
            {(activeTab) => (
              <>
                {activeTab === 'scatter' && (
                  <Card title="Feature Space" subtitle="Click 'Predict' to see query point and its K nearest neighbours">
                    <ResponsiveContainer width="100%" height={380}>
                      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" dataKey="x" name="X₁" tick={{ fontSize: 11 }} label={{ value: 'X₁', position: 'insideBottom', offset: -10, fontSize: 11 }} />
                        <YAxis type="number" dataKey="y" name="X₂" tick={{ fontSize: 11 }} label={{ value: 'X₂', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                        <Tooltip
                          content={({ payload }) => {
                            if (!payload?.length) return null;
                            const d = payload[0]?.payload;
                            return (
                              <div className="bg-white dark:bg-gray-800 border border-gray-200 rounded p-2 text-xs shadow">
                                <p>X₁: {d?.x?.toFixed(3)}</p>
                                <p>X₂: {d?.y?.toFixed(3)}</p>
                                <p>Class: <strong>{classNames[d?.label]}</strong></p>
                              </div>
                            );
                          }}
                        />
                        {/* Background decision boundary */}
                        {showBoundary && boundaryData.length > 0 && classes.map(c => (
                          <Scatter
                            key={`bg-${c}`}
                            data={boundaryData.filter(d => d.label === c)}
                            fill={CLASS_COLORS[c % CLASS_COLORS.length]}
                            opacity={0.15}
                            shape="square"
                          />
                        ))}
                        {/* Data points per class */}
                        {scatterByClass.map(({ class: c, points, color }) => (
                          <Scatter
                            key={c}
                            name={classNames[c]}
                            data={points.map((p) => ({
                              ...p,
                              isNeighbor: neighborIndices.has(data.indexOf(p)),
                            }))}
                            fill={color}
                            opacity={0.8}
                          />
                        ))}
                        {/* Query point */}
                        {queryPt && prediction && (
                          <Scatter
                            name="Query"
                            data={[{ x: queryPt.x, y: queryPt.y }]}
                            fill="#f59e0b"
                            shape={(props: { cx?: number; cy?: number }) => {
                              const { cx = 0, cy = 0 } = props;
                              return (
                                <g>
                                  <circle cx={cx} cy={cy} r={10} fill="#f59e0b" opacity={0.3} />
                                  <circle cx={cx} cy={cy} r={5} fill="#f59e0b" />
                                </g>
                              );
                            }}
                          />
                        )}
                      </ScatterChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {classes.map(c => (
                        <span key={c} className="flex items-center gap-1 text-xs">
                          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: CLASS_COLORS[c % CLASS_COLORS.length] }} />
                          {classNames[c]}
                        </span>
                      ))}
                      {prediction && <span className="flex items-center gap-1 text-xs"><span className="w-3 h-3 rounded-full inline-block bg-yellow-400" /> Query Point</span>}
                    </div>
                  </Card>
                )}

                {activeTab === 'votes' && (
                  <Card title="Neighbour Votes" subtitle="Distribution of votes among K nearest neighbours">
                    {!prediction ? (
                      <InfoBox type="info">Run a prediction first to see vote breakdown.</InfoBox>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={voteData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} label={{ value: 'Votes', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
                              {voteData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="text-center mt-2">
                          <span className="text-sm font-bold">Winner: </span>
                          <span className="text-sm font-bold" style={{ color: CLASS_COLORS[prediction.predictedClass % CLASS_COLORS.length] }}>
                            {classNames[prediction.predictedClass]}
                          </span>
                          <span className="text-xs text-gray-400 ml-2">
                            with {prediction.votes[prediction.predictedClass]}/{k} votes
                          </span>
                        </div>
                      </>
                    )}
                  </Card>
                )}

                {activeTab === 'boundary' && (
                  <Card title="Decision Boundary" subtitle="Enable the checkbox to render the grid-based boundary">
                    {!showBoundary ? (
                      <InfoBox type="warning" title="Decision Boundary Disabled">
                        Enable "Show decision boundary" in the Query Point panel. Note: rendering a fine grid is computationally intensive in the browser.
                      </InfoBox>
                    ) : boundaryData.length === 0 ? (
                      <InfoBox type="info">Computing…</InfoBox>
                    ) : (
                      <ResponsiveContainer width="100%" height={380}>
                        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" dataKey="x" tick={{ fontSize: 11 }} />
                          <YAxis type="number" dataKey="y" tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => v.toFixed(3)} />
                          {classes.map(c => (
                            <Scatter
                              key={`bg-${c}`}
                              data={boundaryData.filter(d => d.label === c)}
                              fill={CLASS_COLORS[c % CLASS_COLORS.length]}
                              opacity={0.3}
                              shape="square"
                            />
                          ))}
                          {scatterByClass.map(({ class: c, points, color }) => (
                            <Scatter key={c} data={points} fill={color} opacity={0.9} />
                          ))}
                        </ScatterChart>
                      </ResponsiveContainer>
                    )}
                  </Card>
                )}
              </>
            )}
          </Tabs>
        </div>
      </div>

      <LearningPanel
        sections={[
          {
            title: 'How K-NN Works',
            content: (
              <div className="space-y-2">
                <p>K-Nearest Neighbours is a lazy, non-parametric classifier. It memorises all training examples and classifies new points by finding the K closest training points and taking a majority vote.</p>
                <p>Steps: (1) Compute distance from query to all training points. (2) Sort by distance. (3) Take K nearest. (4) Vote for the majority class.</p>
              </div>
            ),
          },
          {
            title: 'Distance Metrics',
            content: (
              <pre className="bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs overflow-x-auto">{`Euclidean: d = √(Σ(aᵢ - bᵢ)²)
Manhattan: d = Σ|aᵢ - bᵢ|
Cosine:    d = 1 - (a·b)/(|a||b|)`}</pre>
            ),
          },
          {
            title: 'Choosing K',
            content: (
              <div className="space-y-1">
                <p><strong>Small K (1-3):</strong> Very flexible, captures local patterns, high variance (overfitting).</p>
                <p><strong>Large K:</strong> Smoother boundary, lower variance, higher bias (underfitting).</p>
                <p>Use cross-validation to select the best K. Odd K avoids ties in binary classification.</p>
              </div>
            ),
          },
          {
            title: 'Computational Complexity',
            content: (
              <p>Training time: O(1) (just store data). Prediction time: O(n·d) per query where n = training size, d = dimensions. For large datasets, use KD-Trees or Ball-Trees to reduce prediction to O(log n).</p>
            ),
          },
        ]}
      />
    </div>
  );
}
