import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Brain } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { Tabs } from '../../../components/common/Tabs';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { LearningPanel } from '../../../components/ml/LearningPanel';
import { trainGaussianNB } from '../../../../lib/algorithms/classification/naiveBayes';
import { irisDataset } from '../../../../data/sampleDatasets';

const CLASS_COLORS = ['#3b82f6', '#ef4444', '#10b981'];
const CLASS_NAMES = ['setosa', 'versicolor', 'virginica'];
const FEATURE_NAMES = ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'];
const FEATURE_LABELS = ['Sepal Length', 'Sepal Width', 'Petal Length', 'Petal Width'];

function gaussianPDF(x: number, mu: number, sigma2: number): number {
  if (sigma2 < 1e-9) return x === mu ? 1 : 0;
  return Math.exp(-((x - mu) ** 2) / (2 * sigma2)) / Math.sqrt(2 * Math.PI * sigma2);
}

export default function NaiveBayesPage() {
  const [selectedFeatures, setSelectedFeatures] = useState<[number, number]>([2, 3]); // petal_length, petal_width
  const [predInput, setPredInput] = useState({
    sepal_length: '5.5',
    sepal_width: '3.0',
    petal_length: '4.0',
    petal_width: '1.3',
  });

  // Parse iris data
  const { X, y } = useMemo(() => {
    const rawData = irisDataset.data as Record<string, unknown>[];
    return {
      X: rawData.map(d => FEATURE_NAMES.map(f => d[f] as number)),
      y: rawData.map(d => {
        const sp = d['species'] as string;
        return sp === 'setosa' ? 0 : sp === 'versicolor' ? 1 : 2;
      }),
    };
  }, []);

  const model = useMemo(() => trainGaussianNB(X, y), [X, y]);
  const featureMeans = useMemo(
    () => FEATURE_NAMES.map((_, j) => X.reduce((sum, row) => sum + row[j], 0) / X.length),
    [X]
  );

  // Accuracy
  const predictions = useMemo(() => X.map(xi => model.predict(xi)), [X, model]);
  const accuracy = useMemo(() => predictions.filter((p, i) => p === y[i]).length / y.length, [predictions, y]);

  // Per-class precision, recall
  const perClassMetrics = useMemo(() => {
    return model.classes.map(c => {
      const tp = predictions.filter((p, i) => p === c && y[i] === c).length;
      const fp = predictions.filter((p, i) => p === c && y[i] !== c).length;
      const fn = predictions.filter((p, i) => p !== c && y[i] === c).length;
      const precision = tp / (tp + fp) || 0;
      const recall = tp / (tp + fn) || 0;
      const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
      return { class: c, precision, recall, f1 };
    });
  }, [model, predictions, y]);

  const macroF1 = perClassMetrics.reduce((s, m) => s + m.f1, 0) / perClassMetrics.length;

  // Query point prediction
  const queryFeatures = FEATURE_NAMES.map(f => parseFloat(predInput[f as keyof typeof predInput]) || 0);
  const posteriors = useMemo(() => model.predictProba(queryFeatures), [model, queryFeatures]);
  const predictedClass = useMemo(() => model.predict(queryFeatures), [model, queryFeatures]);

  // Step-by-step Bayes calculation
  const bayesSteps = useMemo(() => {
    return model.classes.map(c => {
      const prior = model.priors[c];
      const likelihoods = queryFeatures.map((xi, j) => gaussianPDF(xi, model.means[c][j], model.variances[c][j]));
      const logLikelihood = likelihoods.reduce((s, l) => s + Math.log(l + 1e-300), 0);
      const logPosteriorUnnorm = Math.log(prior) + logLikelihood;
      return {
        class: c,
        prior,
        likelihoods,
        logLikelihood,
        logPosteriorUnnorm,
        posterior: posteriors[c],
      };
    });
  }, [model, queryFeatures, posteriors]);

  // Means bar chart data per feature
  const meanChartData = useMemo(() => FEATURE_LABELS.map((label, j) => {
    const entry: Record<string, string | number> = { feature: label };
    model.classes.forEach(c => {
      entry[CLASS_NAMES[c]] = parseFloat(model.means[c][j].toFixed(3));
    });
    return entry;
  }), [model]);

  // Gaussian PDF curve for selected feature per class
  const selectedFeatureIdx = selectedFeatures[0];
  const pdfCurveData = useMemo(() => {
    const allMeans = model.classes.map(c => model.means[c][selectedFeatureIdx]);
    const allVars = model.classes.map(c => model.variances[c][selectedFeatureIdx]);
    const xMin = Math.min(...allMeans) - 3 * Math.sqrt(Math.max(...allVars));
    const xMax = Math.max(...allMeans) + 3 * Math.sqrt(Math.max(...allVars));
    const steps = 80;
    const xStep = (xMax - xMin) / steps;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const xVal = xMin + i * xStep;
      const entry: Record<string, number> = { x: parseFloat(xVal.toFixed(3)) };
      model.classes.forEach(c => {
        entry[CLASS_NAMES[c]] = parseFloat(gaussianPDF(xVal, model.means[c][selectedFeatureIdx], model.variances[c][selectedFeatureIdx]).toFixed(5));
      });
      return entry;
    });
  }, [model, selectedFeatureIdx]);

  const boundaryView = useMemo(() => {
    const [xFeature, yFeature] = selectedFeatures;
    const xs = X.map(row => row[xFeature]);
    const ys = X.map(row => row[yFeature]);
    const xPadding = (Math.max(...xs) - Math.min(...xs)) * 0.12;
    const yPadding = (Math.max(...ys) - Math.min(...ys)) * 0.12;
    const xMin = Math.min(...xs) - xPadding;
    const xMax = Math.max(...xs) + xPadding;
    const yMin = Math.min(...ys) - yPadding;
    const yMax = Math.max(...ys) + yPadding;
    const size = 60;
    const cells = Array.from({ length: size * size }, (_, index) => {
      const gx = index % size;
      const gy = Math.floor(index / size);
      const sample = [...featureMeans];
      sample[xFeature] = xMin + (gx / (size - 1)) * (xMax - xMin);
      sample[yFeature] = yMax - (gy / (size - 1)) * (yMax - yMin);
      const probs = model.predictProba(sample);
      const predicted = model.predict(sample);
      return { gx, gy, predicted, confidence: Math.max(...Object.values(probs)) };
    });
    const projectedPoints = X.map((row, index) => ({
      xPct: ((row[xFeature] - xMin) / (xMax - xMin)) * 100,
      yPct: 100 - ((row[yFeature] - yMin) / (yMax - yMin)) * 100,
      label: y[index],
    }));
    return { cells, projectedPoints, size, xMin, xMax, yMin, yMax };
  }, [X, y, model, featureMeans, selectedFeatures]);

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      <PageHeader
        title="Gaussian Naïve Bayes"
        subtitle="Probabilistic classifier using Bayes' theorem with Gaussian likelihood per feature per class."
        badge="Beginner"
        category="Supervised Learning › Classification"
        icon={<Brain size={22} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <Card title="Model — Learned Parameters">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-1 text-gray-500">Class</th>
                    <th className="text-right py-1 text-gray-500">Prior P(C)</th>
                  </tr>
                </thead>
                <tbody>
                  {model.classes.map(c => (
                    <tr key={c} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-1.5 font-medium" style={{ color: CLASS_COLORS[c] }}>{CLASS_NAMES[c]}</td>
                      <td className="text-right font-mono">{(model.priors[c] * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <MetricsPanel
            title="Training Metrics"
            metrics={[
              { label: 'Train Accuracy', value: accuracy, format: 'percent', color: accuracy > 0.85 ? 'green' : 'default' },
              { label: 'Train Macro F1', value: macroF1, format: 'percent', color: 'blue' },
              ...perClassMetrics.map(m => ({ label: `Train F1 (${CLASS_NAMES[m.class]})`, value: m.f1, format: 'percent' as const })),
            ]}
          />

          {/* Gaussian PDF formula box */}
          <Card title="Gaussian PDF Formula">
            <pre className="font-mono text-xs bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{`P(xⱼ | C) = Gaussian(μ_jC, σ²_jC)

         1           (x - μ)²
= ─────────────── exp(- ───────)
  √(2π σ²)              2σ²

Bayes Rule:
P(C|x) ∝ P(C) · ∏ⱼ P(xⱼ|C)`}</pre>
            <InfoBox type="info" title="Independence Assumption">
              Naïve Bayes assumes all features are conditionally independent given the class. This is rarely true in practice, but the model often works well despite this.
            </InfoBox>
          </Card>
        </div>

        {/* Right charts */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs
            tabs={[
              { id: 'means', label: 'Feature Means' },
              { id: 'pdf', label: 'Gaussian PDFs' },
              { id: 'boundary', label: 'Decision Boundary' },
              { id: 'posteriors', label: 'Posterior Probs' },
              { id: 'predict', label: 'Prediction' },
            ]}
          >
            {(activeTab) => (
              <>
                {activeTab === 'means' && (
                  <Card title="Class Means per Feature" subtitle="How each class differs in feature values">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={meanChartData} margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="feature" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        {model.classes.map(c => (
                          <Bar key={c} dataKey={CLASS_NAMES[c]} fill={CLASS_COLORS[c]} radius={[3, 3, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-1 text-gray-500">Feature</th>
                            {CLASS_NAMES.map(n => <th key={n} className="text-right py-1 text-gray-500">{n} μ</th>)}
                            {CLASS_NAMES.map(n => <th key={n + 'v'} className="text-right py-1 text-gray-500">{n} σ²</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {FEATURE_LABELS.map((label, j) => (
                            <tr key={j} className="border-b border-gray-100 dark:border-gray-700">
                              <td className="py-1 text-gray-600 dark:text-gray-300">{label}</td>
                              {model.classes.map(c => (
                                <td key={c} className="text-right font-mono text-gray-700 dark:text-gray-300">{model.means[c][j].toFixed(3)}</td>
                              ))}
                              {model.classes.map(c => (
                                <td key={c + 'v'} className="text-right font-mono text-gray-500">{model.variances[c][j].toFixed(4)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {activeTab === 'pdf' && (
                  <Card title="Gaussian Likelihood per Class" subtitle="Select a feature to visualise P(xⱼ | class)">
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {FEATURE_LABELS.map((label, j) => (
                        <button
                          key={j}
                          onClick={() => setSelectedFeatures([j, selectedFeatures[1]])}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${selectedFeatureIdx === j ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={pdfCurveData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" tick={{ fontSize: 10 }} label={{ value: FEATURE_LABELS[selectedFeatureIdx], position: 'insideBottom', offset: -10, fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} label={{ value: 'P(x|class)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => v.toFixed(5)} />
                        <Legend />
                        {model.classes.map(c => (
                          <Bar key={c} dataKey={CLASS_NAMES[c]} fill={CLASS_COLORS[c]} opacity={0.7} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {activeTab === 'boundary' && (
                  <Card title="2D Decision Boundary" subtitle="Naive Bayes posterior regions for two selected features">
                    <div className="mb-4 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        Feature X axis
                        <select
                          value={selectedFeatures[0]}
                          onChange={event => {
                            const next = Number(event.target.value);
                            setSelectedFeatures([next, next === selectedFeatures[1] ? (next + 1) % FEATURE_NAMES.length : selectedFeatures[1]]);
                          }}
                          className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                        >
                          {FEATURE_LABELS.map((label, index) => <option key={label} value={index}>{label}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        Feature Y axis
                        <select
                          value={selectedFeatures[1]}
                          onChange={event => {
                            const next = Number(event.target.value);
                            setSelectedFeatures([next === selectedFeatures[0] ? (next + 1) % FEATURE_NAMES.length : selectedFeatures[0], next]);
                          }}
                          className="mt-1 w-full rounded border border-gray-200 bg-white px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                        >
                          {FEATURE_LABELS.map((label, index) => <option key={label} value={index}>{label}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="relative h-[420px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950">
                      <div
                        className="absolute inset-8 grid"
                        style={{ gridTemplateColumns: `repeat(${boundaryView.size}, minmax(0, 1fr))` }}
                      >
                        {boundaryView.cells.map(cell => (
                          <div
                            key={`${cell.gx}-${cell.gy}`}
                            title={`${CLASS_NAMES[cell.predicted]} (${(cell.confidence * 100).toFixed(1)}%)`}
                            style={{ backgroundColor: CLASS_COLORS[cell.predicted], opacity: 0.18 + cell.confidence * 0.22 }}
                          />
                        ))}
                      </div>
                      <div className="absolute inset-8">
                        {boundaryView.projectedPoints.map((point, index) => (
                          <span
                            key={index}
                            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm dark:border-gray-900"
                            style={{
                              left: `${point.xPct}%`,
                              top: `${point.yPct}%`,
                              backgroundColor: CLASS_COLORS[point.label],
                            }}
                          />
                        ))}
                      </div>
                      <span className="absolute bottom-2 left-8 text-xs text-gray-500">{FEATURE_LABELS[selectedFeatures[0]]}: {boundaryView.xMin.toFixed(1)} to {boundaryView.xMax.toFixed(1)}</span>
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-gray-500">{FEATURE_LABELS[selectedFeatures[1]]}: {boundaryView.yMin.toFixed(1)} to {boundaryView.yMax.toFixed(1)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {CLASS_NAMES.map((name, index) => (
                        <span key={name} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CLASS_COLORS[index] }} />
                          {name}
                        </span>
                      ))}
                    </div>
                  </Card>
                )}

                {activeTab === 'posteriors' && (
                  <Card title="Step-by-Step Bayes Calculation" subtitle="P(class|x) ∝ P(class) × ∏P(xⱼ|class)">
                    <div className="space-y-4">
                      {bayesSteps.map((step, idx) => (
                        <div
                          key={idx}
                          className={`border rounded-lg p-3 ${step.class === predictedClass ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm" style={{ color: CLASS_COLORS[step.class] }}>
                              {CLASS_NAMES[step.class]} {step.class === predictedClass && '← Predicted'}
                            </span>
                            <span className="font-mono text-sm font-bold text-blue-600 dark:text-blue-400">
                              {(step.posterior * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-xs font-mono text-gray-600 dark:text-gray-400 space-y-0.5">
                            <div>Prior: P(C) = {step.prior.toFixed(3)}</div>
                            {step.likelihoods.map((l, j) => (
                              <div key={j}>P(x{j + 1}={queryFeatures[j].toFixed(1)}|C) = {l.toFixed(5)}</div>
                            ))}
                            <div className="text-gray-500">log P(x|C) = {step.logLikelihood.toFixed(3)}</div>
                            <div className="text-yellow-500">Unnorm log posterior = {step.logPosteriorUnnorm.toFixed(3)}</div>
                          </div>
                          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full transition-all"
                              style={{ width: `${step.posterior * 100}%`, backgroundColor: CLASS_COLORS[step.class] }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {activeTab === 'predict' && (
                  <Card title="Custom Prediction" subtitle="Enter feature values to see posterior probabilities">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {FEATURE_NAMES.map((f, i) => (
                        <div key={f}>
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">
                            {FEATURE_LABELS[i]}
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={predInput[f as keyof typeof predInput]}
                            onChange={e => setPredInput(prev => ({ ...prev, [f]: e.target.value }))}
                            className="w-full text-xs font-mono bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-800 dark:text-gray-100"
                          />
                        </div>
                      ))}
                    </div>

                    <div
                      className="text-center py-3 rounded-xl mb-4 font-bold text-lg"
                      style={{ backgroundColor: CLASS_COLORS[predictedClass] + '33', color: CLASS_COLORS[predictedClass] }}
                    >
                      Predicted: {CLASS_NAMES[predictedClass]}
                    </div>

                    <div className="space-y-2">
                      {model.classes.map(c => (
                        <div key={c} className="flex items-center gap-3">
                          <span className="text-xs w-20 font-medium" style={{ color: CLASS_COLORS[c] }}>{CLASS_NAMES[c]}</span>
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-4 relative">
                            <div
                              className="h-4 rounded-full transition-all flex items-center justify-end pr-2"
                              style={{ width: `${posteriors[c] * 100}%`, backgroundColor: CLASS_COLORS[c] }}
                            >
                              <span className="text-white text-xs font-mono">{(posteriors[c] * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 font-mono text-xs bg-gray-900 text-green-400 rounded-lg p-3">
                      <div className="text-gray-400">// Input features</div>
                      {FEATURE_LABELS.map((label, i) => (
                        <div key={i}>{label}: {queryFeatures[i].toFixed(2)}</div>
                      ))}
                      <div className="text-yellow-400 mt-2">// Prediction: {CLASS_NAMES[predictedClass]}</div>
                      <div className="text-gray-400">P = [{model.classes.map(c => posteriors[c].toFixed(4)).join(', ')}]</div>
                    </div>
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
            title: 'Naïve Bayes Theorem',
            content: (
              <div className="space-y-2">
                <p>Naïve Bayes applies Bayes' theorem to compute the posterior probability of each class given the features:</p>
                <pre className="bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs">{`P(C|x) = P(C) · P(x|C) / P(x)
       ∝ P(C) · ∏ⱼ P(xⱼ|C)   (with independence assumption)`}</pre>
                <p>The "naïve" part is the assumption that features are conditionally independent given the class.</p>
              </div>
            ),
          },
          {
            title: 'Gaussian Likelihood',
            content: (
              <div className="space-y-2">
                <p>For continuous features, we assume P(xⱼ|C) follows a Gaussian distribution with class-specific mean μ and variance σ²:</p>
                <pre className="bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs">{`P(xⱼ|C) = 1/√(2πσ²) · exp(-(xⱼ - μ)² / (2σ²))

μ_jC  = sample mean of feature j in class C
σ²_jC = sample variance of feature j in class C`}</pre>
              </div>
            ),
          },
          {
            title: 'Why Naïve Bayes Works Well',
            content: (
              <div className="space-y-1">
                <p>Despite the strong independence assumption, GNB works well because:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Only mean and variance needed per class/feature — very data-efficient</li>
                  <li>Robust to irrelevant features</li>
                  <li>Works well for text classification, spam detection, medical diagnosis</li>
                  <li>Fast: O(nd) training, O(Cd) prediction</li>
                </ul>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
