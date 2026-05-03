import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { rocCurve } from '../../../lib/math/metrics';
import { loanDataset } from '../../../data/sampleDatasets';

// ─── Synthetic classifiers ────────────────────────────────────────────────────
// Good classifier: scores well-separated
// Medium classifier: partial overlap
// Bad classifier: near-random
function syntheticScores(n = 50, quality: 'good' | 'medium' | 'bad'): { actual: number[]; scores: number[] } {
  const rng = (seed: number) => {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
  };
  const r = rng(quality === 'good' ? 1 : quality === 'medium' ? 2 : 3);
  const actual: number[] = [];
  const scores: number[] = [];
  for (let i = 0; i < n; i++) {
    const label = i % 2;
    actual.push(label);
    if (quality === 'good') {
      scores.push(label === 1 ? 0.5 + r() * 0.5 : r() * 0.5);
    } else if (quality === 'medium') {
      scores.push(label === 1 ? 0.35 + r() * 0.5 : r() * 0.65);
    } else {
      scores.push(r()); // random
    }
  }
  return { actual, scores };
}

// ─── Loan dataset scores (same heuristic as ConfusionMatrixPage) ───────────
const loanRows = loanDataset.data as Array<{
  income: number; credit_score: number; debt_ratio: number;
  employment_years: number; approved: number;
}>;

const LOAN_ACTUAL = loanRows.map(r => r.approved);
const LOAN_SCORES = loanRows.map(r =>
  Math.min(1, Math.max(0,
    (r.credit_score - 500) / 300 * 0.5
    + (r.income / 120000) * 0.3
    + (1 - r.debt_ratio) * 0.15
    + (r.employment_years / 15) * 0.05
  ))
);

// ─── Build combined ROC data for chart ───────────────────────────────────────
function buildRocData(
  fpr: number[], tpr: number[], label: string
): Array<Record<string, number>> {
  return fpr.map((f, i) => ({ fpr: parseFloat(f.toFixed(3)), [label]: parseFloat(tpr[i].toFixed(3)) }));
}

function mergeRocData(
  datasets: Array<{ fpr: number[]; tpr: number[]; label: string }>
): Array<Record<string, number | undefined>> {
  // Collect all unique FPR values across datasets, merge by FPR
  const allPoints: Array<Record<string, number | undefined>> = [];
  const maxLen = Math.max(...datasets.map(d => d.fpr.length));
  for (let i = 0; i < maxLen; i++) {
    const pt: Record<string, number | undefined> = {};
    datasets.forEach(({ fpr, tpr, label }) => {
      if (i < fpr.length) {
        pt['fpr'] = parseFloat(fpr[i].toFixed(3));
        pt[label] = parseFloat(tpr[i].toFixed(3));
      }
    });
    allPoints.push(pt);
  }
  return allPoints;
}

// ─── Interpretation guide ────────────────────────────────────────────────────
const AUC_GUIDE = [
  { range: '0.90 – 1.00', label: 'Excellent',    color: 'text-green-600' },
  { range: '0.80 – 0.90', label: 'Good',          color: 'text-blue-600'  },
  { range: '0.70 – 0.80', label: 'Fair',          color: 'text-yellow-600'},
  { range: '0.60 – 0.70', label: 'Poor',          color: 'text-orange-600'},
  { range: '0.50 – 0.60', label: 'Fail (Random)', color: 'text-red-600'   },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ROCAUCPage() {
  const [threshold, setThreshold] = useState(0.5);
  const [showComparison, setShowComparison] = useState(false);

  // ── Primary ROC (Loan dataset) ───────────────────────────────────────────
  const loanRoc = useMemo(() => rocCurve(LOAN_ACTUAL, LOAN_SCORES), []);

  // ── Find operating point at current threshold ────────────────────────────
  const operatingPoint = useMemo(() => {
    // Closest threshold index
    let bestIdx = 0;
    let bestDiff = Infinity;
    loanRoc.thresholds.forEach((t, i) => {
      const d = Math.abs(t - threshold);
      if (d < bestDiff) { bestDiff = d; bestIdx = i; }
    });
    return { fpr: loanRoc.fpr[bestIdx], tpr: loanRoc.tpr[bestIdx], idx: bestIdx };
  }, [loanRoc, threshold]);

  // ── Confusion matrix at threshold ────────────────────────────────────────
  const { tp, tn, fp, fn, precision, recall, accuracy, f1 } = useMemo(() => {
    let tp = 0, tn = 0, fp = 0, fn = 0;
    LOAN_ACTUAL.forEach((a, i) => {
      const p = LOAN_SCORES[i] >= threshold ? 1 : 0;
      if (a === 1 && p === 1) tp++;
      else if (a === 0 && p === 0) tn++;
      else if (a === 0 && p === 1) fp++;
      else fn++;
    });
    const precision = tp / (tp + fp) || 0;
    const recall    = tp / (tp + fn) || 0;
    const accuracy  = (tp + tn) / (tp + tn + fp + fn) || 0;
    const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    return { tp, tn, fp, fn, precision, recall, accuracy, f1 };
  }, [threshold]);

  // ── Comparison classifiers ───────────────────────────────────────────────
  const goodRoc   = useMemo(() => { const s = syntheticScores(50, 'good');   return rocCurve(s.actual, s.scores); }, []);
  const mediumRoc = useMemo(() => { const s = syntheticScores(50, 'medium'); return rocCurve(s.actual, s.scores); }, []);
  const badRoc    = useMemo(() => { const s = syntheticScores(50, 'bad');    return rocCurve(s.actual, s.scores); }, []);

  // ── Chart data ───────────────────────────────────────────────────────────
  const primaryData = useMemo(() => {
    const pts = loanRoc.fpr.map((f, i) => ({
      fpr: parseFloat(f.toFixed(3)),
      tpr: parseFloat(loanRoc.tpr[i].toFixed(3)),
    }));
    // Diagonal reference line
    return pts;
  }, [loanRoc]);

  const comparisonData = useMemo(() => {
    const g = goodRoc.fpr.map((f, i) => ({ fpr: parseFloat(f.toFixed(3)), good: parseFloat(goodRoc.tpr[i].toFixed(3)) }));
    const m = mediumRoc.fpr.map((f, i) => ({ fpr: parseFloat(f.toFixed(3)), medium: parseFloat(mediumRoc.tpr[i].toFixed(3)) }));
    const b = badRoc.fpr.map((f, i) => ({ fpr: parseFloat(f.toFixed(3)), bad: parseFloat(badRoc.tpr[i].toFixed(3)) }));
    // Pad to same length
    const maxL = Math.max(g.length, m.length, b.length);
    return Array.from({ length: maxL }, (_, i) => ({
      fpr: g[i]?.fpr ?? m[i]?.fpr ?? b[i]?.fpr ?? 0,
      good:   g[i]?.good,
      medium: m[i]?.medium,
      bad:    b[i]?.bad,
    }));
  }, [goodRoc, mediumRoc, badRoc]);

  // ── Diagonal data ────────────────────────────────────────────────────────
  const diagonal = [{ fpr: 0, diagonal: 0 }, { fpr: 1, diagonal: 1 }];

  // ── Custom dot for operating point ──────────────────────────────────────
  const OpDot = (props: { cx?: number; cy?: number; fpr?: number; tpr?: number }) => {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) return null;
    const isOp = Math.abs((props.fpr ?? -1) - operatingPoint.fpr) < 0.015
              && Math.abs((props.tpr ?? -1) - operatingPoint.tpr) < 0.015;
    if (!isOp) return null;
    return <circle cx={cx} cy={cy} r={7} fill="#ef4444" stroke="white" strokeWidth={2} />;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="ROC Curve & AUC"
        subtitle="Receiver Operating Characteristic curve — visualise classifier performance across all thresholds."
        badge="evaluation"
        category="Model Evaluation"
        icon={<TrendingUp size={22} />}
      />

      {/* Threshold control */}
      <Card title="Classification Threshold">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-20">Threshold</span>
          <input
            type="range" min={0} max={1} step={0.01}
            value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
            className="flex-1 accent-blue-600"
          />
          <span className="text-lg font-black text-blue-600 w-14 text-right">{threshold.toFixed(2)}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'TPR (Recall)', value: operatingPoint.tpr, color: 'text-green-600' },
            { label: 'FPR',          value: operatingPoint.fpr, color: 'text-red-600'   },
            { label: 'Precision',    value: precision,           color: 'text-blue-600'  },
            { label: 'Accuracy',     value: accuracy,            color: 'text-purple-600'},
          ].map(({ label, value, color }) => (
            <div key={label} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 text-center">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-xl font-black ${color}`}>{(value * 100).toFixed(1)}%</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ROC Chart + Confusion Matrix side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title={`ROC Curve — Loan Dataset  (AUC = ${loanRoc.auc.toFixed(4)})`}
            subtitle="Red dot = current operating point at selected threshold"
          >
            {/* AUC badge */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">AUC:</span>
              <span className={`text-2xl font-black ${loanRoc.auc >= 0.9 ? 'text-green-600' : loanRoc.auc >= 0.8 ? 'text-blue-600' : 'text-orange-600'}`}>
                {loanRoc.auc.toFixed(4)}
              </span>
              <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${loanRoc.auc >= 0.9 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                {loanRoc.auc >= 0.9 ? 'Excellent' : loanRoc.auc >= 0.8 ? 'Good' : 'Fair'}
              </span>
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <LineChart margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="fpr" type="number" domain={[0, 1]}
                  label={{ value: 'FPR (1 - Specificity)', position: 'insideBottom', offset: -12, fontSize: 11 }}
                  tickFormatter={v => v.toFixed(1)} fontSize={11}
                />
                <YAxis
                  dataKey="tpr" type="number" domain={[0, 1]}
                  label={{ value: 'TPR (Recall)', angle: -90, position: 'insideLeft', offset: 5, fontSize: 11 }}
                  tickFormatter={v => v.toFixed(1)} fontSize={11}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [`${(v * 100).toFixed(1)}%`, name.toUpperCase()]}
                  labelFormatter={v => `FPR: ${(Number(v) * 100).toFixed(1)}%`}
                />

                {/* Diagonal reference */}
                <Line data={diagonal} dataKey="diagonal" dot={false} stroke="#9ca3af"
                  strokeDasharray="6 4" strokeWidth={1.5} name="Random (diagonal)" />

                {/* ROC curve */}
                <Line
                  data={primaryData} dataKey="tpr" dot={(p) => <OpDot {...p} />}
                  stroke="#3b82f6" strokeWidth={2.5} name="Loan Classifier"
                  activeDot={{ r: 5, fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>

            <p className="text-xs text-gray-500 mt-2 text-center">
              Dashed line = random classifier (AUC=0.5). Area under blue curve = AUC.
            </p>
          </Card>
        </div>

        {/* Confusion matrix at threshold */}
        <Card title="Confusion Matrix" subtitle={`At threshold = ${threshold.toFixed(2)}`}>
          <div className="grid grid-cols-2 gap-1 mb-4">
            {[
              { label: 'TP', value: tp, color: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 border-green-300' },
              { label: 'FP', value: fp, color: 'bg-red-100   dark:bg-red-900/40   text-red-800   dark:text-red-200   border-red-300'   },
              { label: 'FN', value: fn, color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300' },
              { label: 'TN', value: tn, color: 'bg-blue-100  dark:bg-blue-900/40  text-blue-800  dark:text-blue-200  border-blue-300'  },
            ].map(({ label, value, color }) => (
              <div key={label} className={`flex flex-col items-center justify-center p-4 rounded-lg border ${color}`}>
                <span className="text-2xl font-black">{value}</span>
                <span className="text-xs font-bold mt-1">{label}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Accuracy',  value: accuracy  },
              { label: 'Precision', value: precision  },
              { label: 'Recall',    value: recall     },
              { label: 'F1-Score',  value: f1         },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">{label}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${value * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200 w-10 text-right">
                    {(value * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Comparison toggle */}
      <Card title="Multi-Classifier Comparison"
        actions={
          <button
            onClick={() => setShowComparison(c => !c)}
            className="px-3 py-1 text-xs rounded-lg border border-blue-400 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            {showComparison ? 'Hide' : 'Show'} Comparison
          </button>
        }
      >
        {showComparison ? (
          <div>
            <div className="flex gap-4 mb-3 flex-wrap text-xs">
              {[
                { label: `Good Classifier   AUC=${goodRoc.auc.toFixed(3)}`,   color: '#22c55e' },
                { label: `Medium Classifier AUC=${mediumRoc.auc.toFixed(3)}`, color: '#f59e0b' },
                { label: `Bad Classifier    AUC=${badRoc.auc.toFixed(3)}`,    color: '#ef4444' },
                { label: 'Random Baseline',                                     color: '#9ca3af' },
              ].map(({ label, color }) => (
                <span key={label} className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                  <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={comparisonData} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="fpr" type="number" domain={[0, 1]}
                  label={{ value: 'FPR', position: 'insideBottom', offset: -12, fontSize: 11 }}
                  tickFormatter={v => v.toFixed(1)} fontSize={11}
                />
                <YAxis domain={[0, 1]}
                  label={{ value: 'TPR', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  tickFormatter={v => v.toFixed(1)} fontSize={11}
                />
                <Tooltip formatter={(v: number) => [`${(v * 100).toFixed(1)}%`]} />
                <Line data={diagonal} dataKey="diagonal" dot={false} stroke="#9ca3af" strokeDasharray="6 4" strokeWidth={1} name="Random" />
                <Line dataKey="good"   dot={false} stroke="#22c55e" strokeWidth={2.5} name="Good"   />
                <Line dataKey="medium" dot={false} stroke="#f59e0b" strokeWidth={2.5} name="Medium" />
                <Line dataKey="bad"    dot={false} stroke="#ef4444" strokeWidth={2}   name="Bad"    />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Click "Show Comparison" to overlay Good / Medium / Bad classifiers on the same ROC chart.</p>
        )}
      </Card>

      {/* AUC interpretation guide */}
      <Card title="AUC Interpretation Guide">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {AUC_GUIDE.map(({ range, label, color }) => (
            <div key={range} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40 text-center border border-gray-200 dark:border-gray-600">
              <p className={`text-sm font-bold ${color}`}>{label}</p>
              <p className="text-xs text-gray-500 mt-1">{range}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoBox type="success" title="AUC > 0.90 — Excellent">
            Classifier strongly separates classes. Suitable for high-stakes decisions like medical diagnosis or fraud detection.
          </InfoBox>
          <InfoBox type="info" title="AUC = 0.50 — Random Classifier">
            Classifier has no discriminative ability. Its ROC curve follows the diagonal. Re-examine features and model.
          </InfoBox>
        </div>
      </Card>
    </div>
  );
}
