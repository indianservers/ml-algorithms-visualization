import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Scale } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { Tabs } from '../../../components/common/Tabs';
import { mean, median, quantile, std } from '../../../lib/math/statistics';

// ─── Built-in sample data ─────────────────────────────────────────────────────
interface DataRow { income: number; age: number; credit_score: number; debt_ratio: number }

const RAW_DATA: DataRow[] = [
  { income: 75000,  age: 34, credit_score: 720, debt_ratio: 0.25 },
  { income: 35000,  age: 22, credit_score: 580, debt_ratio: 0.55 },
  { income: 120000, age: 52, credit_score: 800, debt_ratio: 0.15 },
  { income: 45000,  age: 28, credit_score: 640, debt_ratio: 0.40 },
  { income: 28000,  age: 19, credit_score: 540, debt_ratio: 0.65 },
  { income: 95000,  age: 47, credit_score: 780, debt_ratio: 0.18 },
  { income: 52000,  age: 31, credit_score: 670, debt_ratio: 0.35 },
  { income: 31000,  age: 24, credit_score: 560, debt_ratio: 0.60 },
  { income: 68000,  age: 39, credit_score: 710, debt_ratio: 0.28 },
  { income: 22000,  age: 20, credit_score: 510, debt_ratio: 0.72 },
  { income: 85000,  age: 44, credit_score: 755, debt_ratio: 0.22 },
  { income: 40000,  age: 26, credit_score: 610, debt_ratio: 0.45 },
  { income: 150000, age: 58, credit_score: 820, debt_ratio: 0.12 },  // outlier
  { income: 60000,  age: 36, credit_score: 690, debt_ratio: 0.32 },
  { income: 33000,  age: 23, credit_score: 570, debt_ratio: 0.58 },
];

type FeatureKey = keyof DataRow;
const FEATURES: FeatureKey[] = ['income', 'age', 'credit_score', 'debt_ratio'];

// ─── Scaling functions ────────────────────────────────────────────────────────
function minMaxScale(vals: number[]): number[] {
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const r = mx - mn;
  return r === 0 ? vals.map(() => 0) : vals.map(v => (v - mn) / r);
}

function zscoreScale(vals: number[]): number[] {
  const m = mean(vals), s = std(vals);
  return s === 0 ? vals.map(() => 0) : vals.map(v => (v - m) / s);
}

function medianVal(vals: number[]): number {
  return median(vals);
}
function iqrVal(vals: number[]): number {
  return quantile(vals, 0.75) - quantile(vals, 0.25);
}
function robustScale(vals: number[]): number[] {
  const med = medianVal(vals), iq = iqrVal(vals);
  return iq === 0 ? vals.map(() => 0) : vals.map(v => (v - med) / iq);
}

type ScalingMethod = 'minmax' | 'zscore' | 'robust';

function applyScaling(vals: number[], method: ScalingMethod): number[] {
  if (method === 'minmax') return minMaxScale(vals);
  if (method === 'zscore') return zscoreScale(vals);
  return robustScale(vals);
}

function computeStats(vals: number[]) {
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const m  = mean(vals);
  const s  = std(vals);
  return { min: mn, max: mx, mean: m, std: s };
}

// ─── Histogram bins ───────────────────────────────────────────────────────────
function histogram(vals: number[], bins = 10): Array<{ bin: string; count: number }> {
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const width = (mx - mn) / bins || 1;
  const counts = Array(bins).fill(0);
  vals.forEach(v => {
    const idx = Math.min(Math.floor((v - mn) / width), bins - 1);
    counts[idx]++;
  });
  return counts.map((count, i) => ({
    bin: (mn + i * width).toFixed(2),
    count,
  }));
}

// ─── Formula definitions ──────────────────────────────────────────────────────
const FORMULAS: Record<ScalingMethod, { title: string; formula: string; note: string }> = {
  minmax: {
    title: 'Min-Max Scaling',
    formula: "x' = (x - min(x)) / (max(x) - min(x))   →  range [0, 1]",
    note:  'Sensitive to outliers. Use for bounded outputs or when feature distribution is uniform.',
  },
  zscore: {
    title: 'Z-Score Standardization',
    formula: "x' = (x - mean(x)) / std(x)              →  mean=0, std=1",
    note:  'Assumes normal distribution. Recommended for neural networks and algorithms using gradient descent.',
  },
  robust: {
    title: 'Robust Scaling',
    formula: "x' = (x - median(x)) / IQR(x)            →  robust to outliers",
    note:  'Uses median and IQR instead of mean/std. Best when data has outliers.',
  },
};

const METHOD_COLORS: Record<ScalingMethod, string> = {
  minmax: '#3b82f6',
  zscore: '#8b5cf6',
  robust: '#10b981',
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ScalingNormalizationPage() {
  const [selectedFeature, setSelectedFeature] = useState<FeatureKey>('income');
  const [activeMethod, setActiveMethod]       = useState<ScalingMethod>('minmax');

  // Extract raw column
  const rawVals = useMemo(() => RAW_DATA.map(r => r[selectedFeature]), [selectedFeature]);

  // Scale with all 3 methods
  const scaled = useMemo(() => ({
    minmax: applyScaling(rawVals, 'minmax'),
    zscore: applyScaling(rawVals, 'zscore'),
    robust: applyScaling(rawVals, 'robust'),
  }), [rawVals]);

  // Stats before and after
  const rawStats    = useMemo(() => computeStats(rawVals),          [rawVals]);
  const scaledStats = useMemo(() => computeStats(scaled[activeMethod]), [scaled, activeMethod]);

  // Histogram data
  const rawHist    = useMemo(() => histogram(rawVals, 8),              [rawVals]);
  const scaledHist = useMemo(() => histogram(scaled[activeMethod], 8), [scaled, activeMethod]);

  // Side-by-side comparison: one point per row, showing x-axis value for each method
  const comparisonData = useMemo(() =>
    rawVals.map((raw, i) => ({
      idx: `r${i + 1}`,
      raw: parseFloat(raw.toFixed(4)),
      minmax: parseFloat(scaled.minmax[i].toFixed(4)),
      zscore: parseFloat(scaled.zscore[i].toFixed(4)),
      robust: parseFloat(scaled.robust[i].toFixed(4)),
    })),
    [rawVals, scaled]
  );

  // Statistics table for all features
  const allFeatureStats = useMemo(() =>
    FEATURES.map(feat => {
      const vals  = RAW_DATA.map(r => r[feat]);
      const after = applyScaling(vals, activeMethod);
      return {
        feature: feat,
        before:  computeStats(vals),
        after:   computeStats(after),
      };
    }),
    [activeMethod]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Scaling & Normalization"
        subtitle="Compare Min-Max, Z-Score, and Robust scaling methods with before/after visualisations."
        badge="preprocessing"
        category="Data Preprocessing"
        icon={<Scale size={22} />}
      />

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card title="Feature Selection">
          <div className="flex flex-wrap gap-2">
            {FEATURES.map(f => (
              <button key={f} onClick={() => setSelectedFeature(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  selectedFeature === f
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}>
                {f}
              </button>
            ))}
          </div>
        </Card>

        <Card title="Scaling Method">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FORMULAS) as ScalingMethod[]).map(m => (
              <button key={m} onClick={() => setActiveMethod(m)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                  activeMethod === m
                    ? 'text-white border-transparent'
                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
                style={activeMethod === m ? { backgroundColor: METHOD_COLORS[m] } : undefined}
              >
                {FORMULAS[m].title}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Formula display */}
      <Card title={`Formula — ${FORMULAS[activeMethod].title}`}>
        <pre className="font-mono text-sm bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
          {FORMULAS[activeMethod].formula}
        </pre>
        <InfoBox type="warning" title="When to use this?" >
          {FORMULAS[activeMethod].note}
        </InfoBox>
      </Card>

      <Tabs tabs={[
        { id: 'distribution', label: 'Before / After Distribution' },
        { id: 'comparison',   label: 'All Methods Comparison'      },
        { id: 'stats',        label: 'Statistics Table'            },
      ]}>
        {(tab) => (
          <>
            {/* ── Distribution histograms ── */}
            {tab === 'distribution' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title={`Before Scaling — ${selectedFeature}`}
                  subtitle={`mean=${rawStats.mean.toFixed(2)}  std=${rawStats.std.toFixed(2)}  min=${rawStats.min}  max=${rawStats.max}`}
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={rawHist} margin={{ top: 5, right: 10, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="bin" fontSize={10} angle={-20} textAnchor="end" />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Bar dataKey="count" name="Frequency" radius={[3, 3, 0, 0]}>
                        {rawHist.map((_, i) => <Cell key={i} fill="#94a3b8" />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card
                  title={`After ${FORMULAS[activeMethod].title} — ${selectedFeature}`}
                  subtitle={`mean=${scaledStats.mean.toFixed(4)}  std=${scaledStats.std.toFixed(4)}  min=${scaledStats.min.toFixed(4)}  max=${scaledStats.max.toFixed(4)}`}
                >
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={scaledHist} margin={{ top: 5, right: 10, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="bin" fontSize={10} angle={-20} textAnchor="end" />
                      <YAxis fontSize={10} />
                      <Tooltip />
                      <Bar dataKey="count" name="Frequency" radius={[3, 3, 0, 0]}>
                        {scaledHist.map((_, i) => <Cell key={i} fill={METHOD_COLORS[activeMethod]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}

            {/* ── All Methods Comparison ── */}
            {tab === 'comparison' && (
              <Card title={`All Three Methods — ${selectedFeature}`}
                subtitle="Per-row scaled values for each method. Shows how the same data is transformed differently."
              >
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={comparisonData} margin={{ top: 5, right: 20, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="idx" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={v => v.toFixed(1)} />
                    <Tooltip formatter={(v: number) => v.toFixed(4)} />
                    <Legend />
                    <Bar dataKey="minmax" name="Min-Max" fill={METHOD_COLORS.minmax} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="zscore" name="Z-Score" fill={METHOD_COLORS.zscore} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="robust" name="Robust"  fill={METHOD_COLORS.robust} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <InfoBox type="info" title="Key Observation">
                  Row 13 (income=150,000) is a clear outlier. Notice how Min-Max compresses all other values toward 0,
                  Z-Score shifts the outlier to ~3σ, while Robust Scaling uses median/IQR so the outlier's impact
                  on other values is much smaller.
                </InfoBox>
              </Card>
            )}

            {/* ── Statistics Table ── */}
            {tab === 'stats' && (
              <Card title={`Statistics Before / After ${FORMULAS[activeMethod].title}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Feature</th>
                        {['Mean', 'Std', 'Min', 'Max'].map(h => (
                          <React.Fragment key={h}>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Before {h}</th>
                            <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase">After {h}</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allFeatureStats.map(({ feature, before: b, after: a }) => (
                        <tr key={feature} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{feature}</td>
                          {(['mean', 'std', 'min', 'max'] as const).map(stat => (
                            <React.Fragment key={stat}>
                              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">{b[stat].toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-blue-600 dark:text-blue-400">{a[stat].toFixed(4)}</td>
                            </React.Fragment>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </Tabs>

      {/* When to use which */}
      <Card title="Method Selection Guide">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <p className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-2">Min-Max Scaling</p>
            <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>Image pixel normalisation (0–1)</li>
              <li>Neural network inputs (bounded)</li>
              <li>KNN / k-Means (distance-sensitive)</li>
              <li>Avoid with outliers present</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
            <p className="text-sm font-bold text-purple-700 dark:text-purple-300 mb-2">Z-Score Standardization</p>
            <ul className="text-xs text-purple-800 dark:text-purple-300 space-y-1 list-disc list-inside">
              <li>Gradient descent-based models</li>
              <li>PCA (assumes zero-mean)</li>
              <li>SVM / Logistic Regression</li>
              <li>Assumes roughly normal data</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-2">Robust Scaling</p>
            <ul className="text-xs text-emerald-800 dark:text-emerald-300 space-y-1 list-disc list-inside">
              <li>Data with many outliers</li>
              <li>Financial / income data</li>
              <li>Skewed distributions</li>
              <li>When outliers must be kept</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
