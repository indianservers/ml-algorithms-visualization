import React, { useState, useEffect, useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, ReferenceLine, Legend,
} from 'recharts';
import { TrendingUp, AlertTriangle, Calculator, Target } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { Tabs } from '../../../components/common/Tabs';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { LearningPanel } from '../../../components/ml/LearningPanel';
import { simpleLinearRegression } from '../../../../lib/algorithms/regression/linearRegression';
import { studentMarksDataset, generateLinearData } from '../../../../data/sampleDatasets';
import { mse, rmse, mae, rSquared } from '../../../../lib/math/metrics';
import { linspace } from '../../../../lib/math/statistics';

export default function SimpleLinearRegressionPage() {
  const [xCol, setXCol] = useState<string>('study_hours');
  const [yCol, setYCol] = useState<string>('marks');
  const [predictionX, setPredictionX] = useState<string>('7');
  const [noiseLevel, setNoiseLevel] = useState<number>(1);

  const dataset = useMemo(() => {
    if (noiseLevel === 1) return studentMarksDataset.data as { study_hours: number; marks: number }[];
    const raw = generateLinearData(40, 8, 20, noiseLevel);
    return raw.map(d => ({ study_hours: d.x, marks: d.y }));
  }, [noiseLevel]);

  const columns = ['study_hours', 'marks'];

  const xs = useMemo(() => dataset.map(d => (d as Record<string, number>)[xCol]), [dataset, xCol]);
  const ys = useMemo(() => dataset.map(d => (d as Record<string, number>)[yCol]), [dataset, yCol]);

  const model = useMemo(() => simpleLinearRegression(xs, ys), [xs, ys]);

  const predicted = useMemo(() => xs.map(x => model.predict(x)), [xs, model]);

  const metricMSE = useMemo(() => mse(ys, predicted), [ys, predicted]);
  const metricRMSE = useMemo(() => rmse(ys, predicted), [ys, predicted]);
  const metricMAE = useMemo(() => mae(ys, predicted), [ys, predicted]);
  const metricR2 = useMemo(() => rSquared(ys, predicted), [ys, predicted]);

  const predXNum = parseFloat(predictionX) || 0;
  const predYNum = model.predict(predXNum);

  // Scatter data with regression line overlay
  const scatterData = useMemo(() => dataset.map((d, i) => ({
    x: xs[i],
    y: ys[i],
    yHat: predicted[i],
    residual: model.residuals[i],
  })), [dataset, xs, ys, predicted, model.residuals]);

  // Regression line endpoints
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const lineData = [
    { x: xMin, y: model.predict(xMin) },
    { x: xMax, y: model.predict(xMax) },
  ];

  // Loss surface: MSE vs slope variation
  const lossSurface = useMemo(() => {
    const slopes = linspace(model.slope - 4, model.slope + 4, 60);
    return slopes.map(s => {
      const intercept = ys.reduce((sum, y, i) => sum + y - s * xs[i], 0) / xs.length; // best intercept for this slope
      const preds = xs.map(x => s * x + intercept);
      return { slope: parseFloat(s.toFixed(3)), mse: parseFloat(mse(ys, preds).toFixed(4)) };
    });
  }, [model.slope, xs, ys]);

  // Residual plot data
  const residualData = useMemo(() => xs.map((x, i) => ({
    x,
    residual: model.residuals[i],
  })), [xs, model.residuals]);

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      <PageHeader
        title="Simple Linear Regression"
        subtitle="Model the relationship between two continuous variables using a best-fit straight line via least squares."
        badge="Beginner"
        category="Supervised Learning › Regression"
        icon={<TrendingUp size={22} />}
      />

      {/* Dataset selector row */}
      <Card title="Dataset & Feature Selection">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">X Feature</label>
            <select
              value={xCol}
              onChange={e => setXCol(e.target.value)}
              className="text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-700 dark:text-gray-200"
            >
              {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">Y Target</label>
            <select
              value={yCol}
              onChange={e => setYCol(e.target.value)}
              className="text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-700 dark:text-gray-200"
            >
              {columns.filter(c => c !== xCol).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">
              Noise Level: <span className="text-blue-500 font-mono">{noiseLevel}</span>
            </label>
            <input
              type="range" min={0.5} max={5} step={0.5} value={noiseLevel}
              onChange={e => setNoiseLevel(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Dataset: <strong>Student Marks</strong> ({dataset.length} samples)
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Model summary */}
        <div className="space-y-4">
          <Card title="Model Equation">
            <div className="font-mono text-sm bg-gray-900 text-green-400 rounded-lg p-4 space-y-1">
              <div>ŷ = β₁·x + β₀</div>
              <div className="text-yellow-400">
                ŷ = {model.slope.toFixed(4)}·x + {model.intercept.toFixed(4)}
              </div>
              <div className="text-gray-400 text-xs mt-2">Slope (β₁): {model.slope.toFixed(6)}</div>
              <div className="text-gray-400 text-xs">Intercept (β₀): {model.intercept.toFixed(6)}</div>
            </div>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div>• For every +1 unit in <strong>{xCol}</strong>, <strong>{yCol}</strong> changes by {model.slope.toFixed(3)}</div>
              <div>• When {xCol} = 0, predicted {yCol} ≈ {model.intercept.toFixed(2)}</div>
            </div>
          </Card>

          <MetricsPanel
            title="Regression Metrics"
            metrics={[
              { label: 'R²', value: metricR2, format: 'fixed4', color: metricR2 > 0.7 ? 'green' : 'red' },
              { label: 'MSE', value: metricMSE, format: 'fixed4' },
              { label: 'RMSE', value: metricRMSE, format: 'fixed4' },
              { label: 'MAE', value: metricMAE, format: 'fixed4' },
            ]}
          />

          {/* Prediction panel */}
          <Card title="Make a Prediction" icon={<Calculator size={14} />}>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-300 block mb-1">
                  Enter {xCol} value:
                </label>
                <input
                  type="number"
                  value={predictionX}
                  onChange={e => setPredictionX(e.target.value)}
                  className="w-full text-sm font-mono bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-3 py-2 text-gray-800 dark:text-gray-100"
                  placeholder="e.g. 7"
                />
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-600 dark:text-blue-300 font-medium">Predicted {yCol}:</p>
                <p className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-300">
                  {predYNum.toFixed(2)}
                </p>
                <p className="text-xs text-blue-400 mt-1">
                  = {model.slope.toFixed(3)} × {predXNum} + {model.intercept.toFixed(3)}
                </p>
              </div>
            </div>
          </Card>

          <InfoBox type="warning" title="Assumptions Check">
            <ul className="space-y-1 list-disc ml-4">
              <li>Linearity: Verify scatter plot looks linear</li>
              <li>Homoscedasticity: Residuals should be uniformly spread</li>
              <li>Independence: Observations should be independent</li>
              <li>Normality: Residuals should be approximately normal</li>
            </ul>
          </InfoBox>
        </div>

        {/* Right: Charts */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs
            tabs={[
              { id: 'scatter', label: 'Scatter + Regression Line' },
              { id: 'residuals', label: 'Residual Plot' },
              { id: 'loss', label: 'Loss Surface' },
            ]}
          >
            {(activeTab) => (
              <>
                {activeTab === 'scatter' && (
                  <Card title="Data Points & Regression Line">
                    <ResponsiveContainer width="100%" height={340}>
                      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          type="number" dataKey="x" name={xCol}
                          label={{ value: xCol, position: 'insideBottom', offset: -10, fontSize: 11 }}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          type="number" dataKey="y" name={yCol}
                          label={{ value: yCol, angle: -90, position: 'insideLeft', fontSize: 11 }}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          content={({ payload }) => {
                            if (!payload?.length) return null;
                            const d = payload[0]?.payload;
                            if (!d) return null;
                            return (
                              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 text-xs shadow">
                                <p>{xCol}: <strong>{d.x?.toFixed(2)}</strong></p>
                                <p>{yCol}: <strong>{d.y?.toFixed(2)}</strong></p>
                                <p>ŷ: <strong>{d.yHat?.toFixed(2)}</strong></p>
                                <p className="text-red-500">Residual: {d.residual?.toFixed(2)}</p>
                              </div>
                            );
                          }}
                        />
                        <Scatter name="Data Points" data={scatterData} fill="#3b82f6" opacity={0.7} />
                        <Scatter name="Regression Line" data={lineData} line fill="none" stroke="#ef4444" strokeWidth={2} />
                        {/* Prediction point */}
                        {!isNaN(predXNum) && (
                          <Scatter
                            name="Prediction"
                            data={[{ x: predXNum, y: predYNum }]}
                            fill="#f59e0b"
                            shape="star"
                          />
                        )}
                      </ScatterChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 text-xs text-gray-500 mt-2">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Data points</span>
                      <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-red-500 inline-block" /> Regression line</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 inline-block rounded-sm" /> Prediction</span>
                    </div>
                  </Card>
                )}

                {activeTab === 'residuals' && (
                  <Card title="Residual Plot (ŷ − y)" subtitle="Residuals should be randomly scattered around zero">
                    <ResponsiveContainer width="100%" height={340}>
                      <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          type="number" dataKey="x"
                          label={{ value: xCol, position: 'insideBottom', offset: -10, fontSize: 11 }}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          type="number" dataKey="residual"
                          label={{ value: 'Residual', angle: -90, position: 'insideLeft', fontSize: 11 }}
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip formatter={(v: number) => v.toFixed(4)} />
                        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={2} />
                        <Scatter data={residualData} fill="#8b5cf6" opacity={0.7} />
                      </ScatterChart>
                    </ResponsiveContainer>
                    <InfoBox type="info">
                      Random scatter around 0 indicates a good fit. Patterns (funnel, curve) indicate model violations.
                    </InfoBox>
                  </Card>
                )}

                {activeTab === 'loss' && (
                  <Card title="Loss Surface: MSE vs Slope" subtitle="Parabolic bowl — minimum is the optimal slope">
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart data={lossSurface} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="slope" tick={{ fontSize: 11 }} label={{ value: 'Slope (β₁)', position: 'insideBottom', offset: -10, fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} label={{ value: 'MSE', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => v.toFixed(4)} />
                        <ReferenceLine x={parseFloat(model.slope.toFixed(3))} stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'Optimal', fontSize: 10 }} />
                        <Line type="monotone" dataKey="mse" stroke="#3b82f6" dot={false} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Optimal slope: <strong className="text-red-500">{model.slope.toFixed(4)}</strong> minimises MSE to <strong>{metricMSE.toFixed(4)}</strong>
                    </p>
                  </Card>
                )}
              </>
            )}
          </Tabs>
        </div>
      </div>

      {/* Least squares explanation */}
      <LearningPanel
        sections={[
          {
            title: 'What is Simple Linear Regression?',
            content: (
              <div className="space-y-2">
                <p>Simple linear regression finds the best straight line through data by minimising the sum of squared differences between actual and predicted values.</p>
                <p>The model form is: <strong>ŷ = β₁x + β₀</strong></p>
                <p>Where β₁ is the slope and β₀ is the intercept.</p>
              </div>
            ),
          },
          {
            title: 'Least Squares Derivation',
            content: (
              <div className="space-y-2">
                <p>We minimise the Sum of Squared Residuals (SSR):</p>
                <pre className="bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs overflow-x-auto">SSR = Σ(yᵢ - ŷᵢ)² = Σ(yᵢ - β₁xᵢ - β₀)²</pre>
                <p>Taking partial derivatives and setting to zero gives closed-form solutions:</p>
                <pre className="bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs overflow-x-auto">
{`β₁ = Σ(xᵢ - x̄)(yᵢ - ȳ) / Σ(xᵢ - x̄)²
     = Cov(X,Y) / Var(X)

β₀ = ȳ - β₁·x̄`}
                </pre>
                <p>This is an analytical solution — no iterative optimisation needed.</p>
              </div>
            ),
          },
          {
            title: 'Interpreting R²',
            content: (
              <div className="space-y-2">
                <p>R² (coefficient of determination) measures the proportion of variance in Y explained by X:</p>
                <pre className="bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs overflow-x-auto">
{`R² = 1 - SS_res / SS_tot
   = 1 - Σ(yᵢ - ŷᵢ)² / Σ(yᵢ - ȳ)²`}
                </pre>
                <p>R² = 1: perfect fit. R² = 0: model explains nothing. Negative R²: worse than mean baseline.</p>
                <p>Current R² = <strong>{metricR2.toFixed(4)}</strong> — the model explains {(metricR2 * 100).toFixed(1)}% of variance.</p>
              </div>
            ),
          },
          {
            title: 'Model Assumptions',
            content: (
              <ul className="space-y-1 list-disc ml-4">
                <li><strong>Linearity:</strong> The relationship between X and Y must be approximately linear.</li>
                <li><strong>Independence:</strong> Each observation must be independent of others.</li>
                <li><strong>Homoscedasticity:</strong> Residual variance must be constant across all X values.</li>
                <li><strong>Normality of Errors:</strong> Residuals should be normally distributed (needed for inference).</li>
                <li><strong>No multicollinearity:</strong> (relevant for multiple regression; not applicable here).</li>
              </ul>
            ),
          },
        ]}
      />
    </div>
  );
}
