import React, { useState, useMemo, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { GitBranch, Play, RotateCcw } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { Tabs } from '../../../components/common/Tabs';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { HyperparameterPanel, HyperparamDef } from '../../../components/ml/HyperparameterPanel';
import { LearningPanel } from '../../../components/ml/LearningPanel';
import { TrainingLossChart } from '../../../components/ml/TrainingLossChart';
import { logisticRegression } from '../../../../lib/algorithms/classification/logisticRegression';
import { binaryMetrics, rocCurve } from '../../../../lib/math/metrics';
import { sigmoid, linspace, mean, std } from '../../../../lib/math/statistics';
import { loanDataset } from '../../../../data/sampleDatasets';

// Standardise a feature array
function standardise(arr: number[]): number[] {
  const m = mean(arr), s = std(arr) || 1;
  return arr.map(v => (v - m) / s);
}

export default function LogisticRegressionPage() {
  const [threshold, setThreshold] = useState<number>(0.5);
  const [trained, setTrained] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [model, setModel] = useState<ReturnType<typeof logisticRegression> | null>(null);

  // Hyperparams
  const [params, setParams] = useState<Record<string, number | string | boolean>>({
    lr: 0.1,
    maxIter: 500,
  });

  const handleParamChange = useCallback((key: string, value: number | string | boolean) => {
    setParams(prev => ({ ...prev, [key]: value }));
  }, []);

  const hyperparamDefs: HyperparamDef[] = [
    { key: 'lr', label: 'Learning Rate', type: 'select', value: params.lr, tooltip: 'Step size for each gradient descent update. Too high can overshoot; too low converges slowly.',
      options: [
        { value: 0.001, label: '0.001' }, { value: 0.01, label: '0.01' },
        { value: 0.05, label: '0.05' }, { value: 0.1, label: '0.1' },
        { value: 0.5, label: '0.5' },
      ],
    },
    { key: 'maxIter', label: 'Max Iterations', type: 'range', min: 50, max: 1000, step: 50, value: params.maxIter, tooltip: 'Maximum number of gradient descent passes over the training data.' },
  ];

  // Prepare data
  const rawData = loanDataset.data as { income: number; credit_score: number; debt_ratio: number; employment_years: number; approved: number }[];

  const featureNames = ['income', 'credit_score', 'debt_ratio', 'employment_years'];
  const incomeArr = rawData.map(d => d.income);
  const creditArr = rawData.map(d => d.credit_score);
  const debtArr = rawData.map(d => d.debt_ratio);
  const empArr = rawData.map(d => d.employment_years);

  const incomeStd = standardise(incomeArr);
  const creditStd = standardise(creditArr);
  const debtStd = standardise(debtArr);
  const empStd = standardise(empArr);

  const X = rawData.map((_, i) => [incomeStd[i], creditStd[i], debtStd[i], empStd[i]]);
  const y = rawData.map(d => d.approved);

  const handleTrain = useCallback(() => {
    setIsTraining(true);
    setTimeout(() => {
      const result = logisticRegression(X, y, params.lr as number, params.maxIter as number);
      setModel(result);
      setTrained(true);
      setIsTraining(false);
    }, 0);
  }, [X, y, params]);

  const handleReset = useCallback(() => {
    setModel(null);
    setTrained(false);
  }, []);

  // Predictions
  const probabilities = useMemo(() => model ? X.map(xi => model.predictProba(xi)) : [], [model, X]);
  const predictions = useMemo(() => probabilities.map(p => p >= threshold ? 1 : 0), [probabilities, threshold]);

  // Binary metrics
  const metrics = useMemo(() => trained && model ? binaryMetrics(y, predictions) : null, [trained, model, y, predictions]);

  // Log-loss
  const eps = 1e-15;
  const logLossVal = useMemo(() => {
    if (!model || probabilities.length === 0) return 0;
    return -mean(y.map((yi, i) => {
      const p = Math.min(Math.max(probabilities[i], eps), 1 - eps);
      return yi * Math.log(p) + (1 - yi) * Math.log(1 - p);
    }));
  }, [model, y, probabilities]);

  // ROC curve
  const roc = useMemo(() => trained && probabilities.length > 0 ? rocCurve(y, probabilities) : null, [trained, probabilities, y]);

  // Sigmoid curve data
  const sigmoidData = useMemo(() => linspace(-6, 6, 100).map(x => ({ x: parseFloat(x.toFixed(2)), y: parseFloat(sigmoid(x).toFixed(4)) })), []);

  // Loss history chart
  const lossChartData = useMemo(() => {
    if (!model) return [];
    const step = Math.max(1, Math.floor(model.lossHistory.length / 100));
    return model.lossHistory
      .filter((_, i) => i % step === 0)
      .map((loss, i) => ({ iter: i * step, loss: parseFloat(loss.toFixed(6)) }));
  }, [model]);

  // Prediction input state
  const [predInput, setPredInput] = useState({ income: '60000', credit_score: '700', debt_ratio: '0.3', employment_years: '5' });

  const predProba = useMemo(() => {
    if (!model) return null;
    const raw = [parseFloat(predInput.income), parseFloat(predInput.credit_score), parseFloat(predInput.debt_ratio), parseFloat(predInput.employment_years)];
    const featureArrays = [incomeArr, creditArr, debtArr, empArr];
    const stdVals = raw.map((v, i) => {
      const m = mean(featureArrays[i]), s = std(featureArrays[i]) || 1;
      return (v - m) / s;
    });
    return model.predictProba(stdVals);
  }, [model, predInput, incomeArr, creditArr, debtArr, empArr]);

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      <PageHeader
        title="Logistic Regression"
        subtitle="Binary classification using the sigmoid function and gradient descent to estimate probabilities."
        badge="Beginner"
        category="Supervised Learning › Classification"
        icon={<GitBranch size={22} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <HyperparameterPanel
            params={hyperparamDefs}
            onChange={handleParamChange}
            presets={[
              { name: 'Stable', values: { lr: 0.01, maxIter: 700 } },
              { name: 'Fast', values: { lr: 0.1, maxIter: 300 } },
              { name: 'Aggressive', values: { lr: 0.5, maxIter: 150 } },
            ]}
          />

          <Card title="Training Controls">
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={handleTrain}
                  disabled={isTraining}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                >
                  <Play size={14} /> {isTraining ? 'Training…' : 'Train Model'}
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2"
                >
                  <RotateCcw size={14} /> Reset
                </button>
              </div>
              {trained && (
                <div>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">
                    Decision Threshold: <span className="text-blue-500 font-mono">{threshold.toFixed(2)}</span>
                  </label>
                  <input
                    type="range" min={0.01} max={0.99} step={0.01} value={threshold}
                    onChange={e => setThreshold(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">P(y=1) ≥ {threshold.toFixed(2)} → predict 1</p>
                </div>
              )}
            </div>
          </Card>

          {trained && metrics && (
            <MetricsPanel
              title="Training Metrics"
              metrics={[
                { label: 'Train Accuracy', value: metrics.accuracy, format: 'percent', color: metrics.accuracy > 0.8 ? 'green' : 'default' },
                { label: 'Train Precision', value: metrics.precision, format: 'percent' },
                { label: 'Train Recall', value: metrics.recall, format: 'percent' },
                { label: 'Train F1 Score', value: metrics.f1, format: 'percent', color: 'blue' },
                { label: 'Train Log-Loss', value: logLossVal, format: 'fixed4' },
                { label: 'Train AUC', value: roc?.auc ?? 0, format: 'fixed4', color: 'green' },
              ]}
            />
          )}

          {trained && metrics && (
            <Card title="Confusion Matrix">
              <div className="grid grid-cols-3 gap-1 text-xs">
                <div />
                <div className="text-center font-semibold text-gray-500 py-1">Pred: 0</div>
                <div className="text-center font-semibold text-gray-500 py-1">Pred: 1</div>
                <div className="text-center font-semibold text-gray-500 py-1 self-center">Act: 0</div>
                <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-center py-3 font-bold text-lg">
                  {metrics.tn}
                  <div className="text-xs font-normal text-green-600">TN</div>
                </div>
                <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded text-center py-3 font-bold text-lg">
                  {metrics.fp}
                  <div className="text-xs font-normal text-red-600">FP</div>
                </div>
                <div className="text-center font-semibold text-gray-500 py-1 self-center">Act: 1</div>
                <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded text-center py-3 font-bold text-lg">
                  {metrics.fn}
                  <div className="text-xs font-normal text-orange-600">FN</div>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded text-center py-3 font-bold text-lg">
                  {metrics.tp}
                  <div className="text-xs font-normal text-green-600">TP</div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right charts */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs
            tabs={[
              { id: 'sigmoid', label: 'Sigmoid Curve' },
              { id: 'loss', label: 'Training Loss' },
              { id: 'roc', label: 'ROC Curve' },
              { id: 'predict', label: 'Predict' },
            ]}
          >
            {(activeTab) => (
              <>
                {activeTab === 'sigmoid' && (
                  <Card title="Sigmoid (Logistic) Function" subtitle="σ(z) = 1 / (1 + e⁻ᶻ)">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={sigmoidData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" tick={{ fontSize: 11 }} label={{ value: 'z = w·x + b', position: 'insideBottom', offset: -10, fontSize: 11 }} />
                        <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} label={{ value: 'σ(z)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => v.toFixed(4)} />
                        <ReferenceLine x={0} stroke="#9ca3af" strokeDasharray="3 3" />
                        <ReferenceLine y={0.5} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'threshold', fontSize: 9, position: 'right' }} />
                        <Line type="monotone" dataKey="y" stroke="#3b82f6" dot={false} strokeWidth={2.5} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-3 font-mono text-xs bg-gray-900 text-green-400 rounded-lg p-3">
                      <div>σ(z) = 1 / (1 + exp(-z))</div>
                      <div className="text-yellow-400 mt-1">z = w₁x₁ + w₂x₂ + ... + b</div>
                      <div className="text-gray-400 mt-1">Output ∈ (0, 1) → interpreted as P(y=1|x)</div>
                    </div>
                  </Card>
                )}

                {activeTab === 'loss' && (
                  <>
                    <TrainingLossChart
                      data={trained ? lossChartData : []}
                      title="Training Log-Loss"
                      subtitle="Cross-entropy loss over gradient descent iterations."
                      xKey="iter"
                      showAccuracy={false}
                      emptyText="Train the model first to see the loss curve."
                    />
                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      <strong>Binary Cross-Entropy:</strong>{' '}
                      <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">L = -1/n · Σ[y·log(p) + (1-y)·log(1-p)]</code>
                    </div>
                  </>
                )}

                {activeTab === 'roc' && (
                  <Card title="ROC Curve" subtitle="Receiver Operating Characteristic — FPR vs TPR at varying thresholds">
                    {!trained || !roc ? (
                      <InfoBox type="info">Train the model first to see the ROC curve.</InfoBox>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart
                            data={roc.fpr.map((fpr, i) => ({ fpr: parseFloat(fpr.toFixed(3)), tpr: parseFloat(roc.tpr[i].toFixed(3)) }))}
                            margin={{ top: 10, right: 20, bottom: 20, left: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="fpr" type="number" domain={[0, 1]} tick={{ fontSize: 11 }} label={{ value: 'FPR', position: 'insideBottom', offset: -10, fontSize: 11 }} />
                            <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} label={{ value: 'TPR', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                            <Tooltip formatter={(v: number) => v.toFixed(3)} />
                            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="#9ca3af" strokeDasharray="4 2" />
                            <Line type="monotone" dataKey="tpr" stroke="#3b82f6" dot={false} strokeWidth={2.5} />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-2 text-center">
                          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">AUC = {roc.auc.toFixed(4)}</span>
                          <span className="text-xs text-gray-400 ml-2">(1.0 = perfect, 0.5 = random)</span>
                        </div>
                      </>
                    )}
                  </Card>
                )}

                {activeTab === 'predict' && (
                  <Card title="Single Prediction" subtitle="Enter feature values to get a loan approval probability">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {Object.keys(predInput).map(key => (
                        <div key={key}>
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">{key.replace(/_/g, ' ')}</label>
                          <input
                            type="number"
                            value={predInput[key as keyof typeof predInput]}
                            onChange={e => setPredInput(prev => ({ ...prev, [key]: e.target.value }))}
                            className="w-full text-xs font-mono bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-800 dark:text-gray-100"
                          />
                        </div>
                      ))}
                    </div>
                    {!trained || predProba === null ? (
                      <InfoBox type="info">Train the model first to make predictions.</InfoBox>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <p className="text-xs text-blue-600 dark:text-blue-300 font-medium mb-1">P(Approved = 1):</p>
                          <p className="text-3xl font-bold font-mono text-blue-700 dark:text-blue-300">{(predProba * 100).toFixed(1)}%</p>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-2">
                            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${predProba * 100}%` }} />
                          </div>
                        </div>
                        <div className={`text-sm font-bold text-center py-2 rounded-lg ${predProba >= threshold ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                          {predProba >= threshold ? 'APPROVED ✓' : 'DENIED ✗'}
                          {' '}(threshold: {threshold.toFixed(2)})
                        </div>
                        <div className="font-mono text-xs bg-gray-900 text-green-400 rounded p-3">
                          <div>z = {model!.weights.map((w, i) => `${w.toFixed(3)}·x${i + 1}`).join(' + ')} + {model!.bias.toFixed(3)}</div>
                          <div className="text-yellow-400">P(y=1) = σ(z) = {predProba.toFixed(4)}</div>
                        </div>
                      </div>
                    )}
                  </Card>
                )}
              </>
            )}
          </Tabs>

          {trained && model && (
            <Card title="Learned Weights">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {featureNames.map((name, i) => (
                  <div key={name} className="bg-gray-50 dark:bg-gray-700/50 rounded p-2 text-center">
                    <p className="text-xs text-gray-500">{name.replace(/_/g, ' ')}</p>
                    <p className={`font-mono font-bold text-sm ${model.weights[i] > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {model.weights[i]?.toFixed(4) ?? '—'}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">Bias (intercept): <span className="font-mono">{model.bias.toFixed(4)}</span></p>
            </Card>
          )}
        </div>
      </div>

      <LearningPanel
        sections={[
          {
            title: 'How Logistic Regression Works',
            content: (
              <div className="space-y-2">
                <p>Logistic regression models P(y=1|x) using the sigmoid function applied to a linear combination of features:</p>
                <pre className="bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs">P(y=1|x) = σ(w·x + b) = 1 / (1 + e^(-(w·x+b)))</pre>
                <p>The model learns weights w and bias b to maximise the likelihood of the training labels.</p>
              </div>
            ),
          },
          {
            title: 'Gradient Descent for Logistic Regression',
            content: (
              <div className="space-y-2">
                <p>We minimise binary cross-entropy loss using gradient descent:</p>
                <pre className="bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs">{`L = -1/n Σ[y·log(p) + (1-y)·log(1-p)]

∂L/∂w = 1/n · Xᵀ(p - y)
∂L/∂b = 1/n · Σ(pᵢ - yᵢ)

w ← w - lr · ∂L/∂w
b ← b - lr · ∂L/∂b`}</pre>
              </div>
            ),
          },
          {
            title: 'Threshold & Decision Boundary',
            content: (
              <p>By default, predict class 1 when P(y=1|x) ≥ 0.5. Adjusting the threshold trades off precision vs recall. A lower threshold catches more positives (higher recall, lower precision). Use the ROC curve to find the optimal threshold for your use-case.</p>
            ),
          },
        ]}
      />
    </div>
  );
}
