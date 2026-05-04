import React, { useState, useCallback } from 'react';
import { Copy, Check, BarChart2, Database, Edit3 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { Tabs } from '../../../components/common/Tabs';
import { binaryMetrics } from '../../../lib/math/metrics';
import { loanDataset } from '../../../data/sampleDatasets';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ManualCM { tp: number; tn: number; fp: number; fn: number }

// ─── Multi-class toy data (iris-like, 3 classes) ─────────────────────────────
const MULTI_ACTUAL    = [0,0,0,0,0,1,1,1,1,1,2,2,2,2,2,0,1,2,0,1];
const MULTI_PREDICTED = [0,0,1,0,0,1,1,2,1,1,2,2,2,0,2,0,1,2,1,0];
const CLASS_LABELS    = ['Setosa', 'Versicolor', 'Virginica'];

function multiConfusionMatrix(actual: number[], predicted: number[], n: number): number[][] {
  const m = Array.from({ length: n }, () => Array(n).fill(0));
  actual.forEach((a, i) => { m[a][predicted[i]]++; });
  return m;
}

function maxInMatrix(m: number[][]): number {
  return Math.max(...m.flat());
}

// ─── Formula boxes ────────────────────────────────────────────────────────────
const FORMULAS = [
  { label: 'Accuracy',    formula: 'Accuracy    = (TP + TN) / (TP + TN + FP + FN)' },
  { label: 'Precision',   formula: 'Precision   = TP / (TP + FP)' },
  { label: 'Recall',      formula: 'Recall      = TP / (TP + FN)' },
  { label: 'Specificity', formula: 'Specificity = TN / (TN + FP)' },
  { label: 'F1-Score',    formula: 'F1          = 2 × Precision × Recall / (Precision + Recall)' },
];

// ─── Cell colour helpers ──────────────────────────────────────────────────────
function binaryCellStyle(type: 'TP'|'TN'|'FP'|'FN'): string {
  return {
    TP: 'bg-green-100 dark:bg-green-900/40 border-green-400 text-green-900 dark:text-green-200',
    TN: 'bg-blue-100  dark:bg-blue-900/40  border-blue-400  text-blue-900  dark:text-blue-200',
    FP: 'bg-red-100   dark:bg-red-900/40   border-red-400   text-red-900   dark:text-red-200',
    FN: 'bg-amber-100 dark:bg-amber-900/40 border-amber-400 text-amber-900 dark:text-amber-200',
  }[type];
}

function multiCellStyle(value: number, max: number, isMain: boolean): React.CSSProperties {
  const intensity = max > 0 ? value / max : 0;
  if (isMain) {
    return { backgroundColor: `rgba(34,197,94,${0.15 + intensity * 0.7})` };
  }
  return { backgroundColor: intensity > 0 ? `rgba(239,68,68,${0.1 + intensity * 0.6})` : 'transparent' };
}

// ─── Page component ───────────────────────────────────────────────────────────
export default function ConfusionMatrixPage() {
  // Manual mode state
  const [manual, setManual] = useState<ManualCM>({ tp: 50, tn: 40, fp: 10, fn: 8 });
  const [multiMode, setMultiMode] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dataset mode state
  const [threshold, setThreshold] = useState(0.5);

  // ── Derived: dataset-mode predictions using a simple scoring heuristic ──────
  const loanRows = loanDataset.data as Array<{
    income: number; credit_score: number; debt_ratio: number;
    employment_years: number; approved: number;
  }>;

  const scores = loanRows.map(r => {
    const s = (r.credit_score - 500) / 300 * 0.5
            + (r.income / 120000)      * 0.3
            + (1 - r.debt_ratio)       * 0.15
            + (r.employment_years / 15) * 0.05;
    return Math.min(1, Math.max(0, s));
  });
  const actual    = loanRows.map(r => r.approved);
  const predicted = scores.map(s => (s >= threshold ? 1 : 0));
  const dsMetrics = binaryMetrics(actual, predicted);

  // ── Derived: manual mode ─────────────────────────────────────────────────────
  const { tp, tn, fp, fn } = manual;
  const total   = tp + tn + fp + fn || 1;
  const manAcc  = (tp + tn) / total;
  const manPrec = tp / (tp + fp) || 0;
  const manRec  = tp / (tp + fn) || 0;
  const manSpec = tn / (tn + fp) || 0;
  const manF1   = manPrec + manRec > 0 ? 2 * manPrec * manRec / (manPrec + manRec) : 0;

  // ── Multi-class matrix ───────────────────────────────────────────────────────
  const multiMatrix = multiConfusionMatrix(MULTI_ACTUAL, MULTI_PREDICTED, 3);
  const multiMax    = maxInMatrix(multiMatrix);

  // ── Copy metrics to clipboard ────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    const lines = [
      `Mode: Manual Input`,
      `TP=${tp}  TN=${tn}  FP=${fp}  FN=${fn}`,
      `Accuracy    = ${manAcc.toFixed(4)}`,
      `Precision   = ${manPrec.toFixed(4)}`,
      `Recall      = ${manRec.toFixed(4)}`,
      `Specificity = ${manSpec.toFixed(4)}`,
      `F1-Score    = ${manF1.toFixed(4)}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [tp, tn, fp, fn, manAcc, manPrec, manRec, manSpec, manF1]);

  // ── Number input helper ──────────────────────────────────────────────────────
  const numInput = (key: keyof ManualCM, label: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
      <input
        type="number" min={0}
        value={manual[key]}
        onChange={e => setManual(m => ({ ...m, [key]: Math.max(0, parseInt(e.target.value) || 0) }))}
        className="w-24 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  // ── Metric row helper ────────────────────────────────────────────────────────
  const metricRow = (label: string, value: number, description: string) => (
    <div key={label} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div>
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <span className={`text-lg font-bold ${value >= 0.8 ? 'text-green-600' : value >= 0.6 ? 'text-amber-600' : 'text-red-600'}`}>
        {(value * 100).toFixed(1)}%
      </span>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Confusion Matrix"
        subtitle="Visualize classification results with TP, TN, FP, FN and derive key evaluation metrics."
        badge="evaluation"
        category="Model Evaluation"
        icon={<BarChart2 size={22} />}
      />

      {/* Mode toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Mode:</span>
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {[
            { id: 'manual',  label: 'Manual Input',  Icon: Edit3    },
            { id: 'dataset', label: 'Dataset',        Icon: Database },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setMultiMode(false)}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm transition-colors ${
                (id === 'manual' ? !multiMode : multiMode)  // handled separately
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 ml-4 cursor-pointer text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={multiMode}
            onChange={e => setMultiMode(e.target.checked)}
            className="w-4 h-4 rounded accent-purple-600"
          />
          Multi-class mode (3-class)
        </label>
      </div>

      {/* ── MULTI-CLASS MODE ── */}
      {multiMode ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="3-Class Confusion Matrix" subtitle="Iris toy data — rows=Actual, cols=Predicted">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-gray-400 text-xs font-normal">Actual ↓ / Pred →</th>
                    {CLASS_LABELS.map(l => (
                      <th key={l} className="p-2 text-xs font-semibold text-gray-700 dark:text-gray-300">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CLASS_LABELS.map((rowLabel, ri) => (
                    <tr key={ri}>
                      <td className="p-2 text-xs font-semibold text-gray-700 dark:text-gray-300">{rowLabel}</td>
                      {multiMatrix[ri].map((val, ci) => (
                        <td
                          key={ci}
                          className="p-0 border border-gray-200 dark:border-gray-600 text-center"
                          style={multiCellStyle(val, multiMax, ri === ci)}
                        >
                          <div className="p-3 font-bold text-lg text-gray-900 dark:text-white">{val}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-500">Green diagonal = correct predictions. Red off-diagonal = errors. Colour intensity scales with count.</p>
          </Card>

          <Card title="Per-Class Metrics">
            <div className="space-y-4">
              {CLASS_LABELS.map((label, i) => {
                const tp_i = multiMatrix[i][i];
                const fp_i = multiMatrix.reduce((s, r, ri) => s + (ri !== i ? r[i] : 0), 0);
                const fn_i = multiMatrix[i].reduce((s, v, ci) => s + (ci !== i ? v : 0), 0);
                const prec_i = tp_i / (tp_i + fp_i) || 0;
                const rec_i  = tp_i / (tp_i + fn_i) || 0;
                const f1_i   = prec_i + rec_i > 0 ? 2 * prec_i * rec_i / (prec_i + rec_i) : 0;
                return (
                  <div key={label} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{label}</p>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[['Precision', prec_i], ['Recall', rec_i], ['F1', f1_i], ['Support', tp_i + fn_i]].map(([k, v]) => (
                        <div key={String(k)}>
                          <p className="text-xs text-gray-500">{k}</p>
                          <p className="text-sm font-bold text-blue-600">{typeof v === 'number' && k !== 'Support' ? (v * 100).toFixed(1) + '%' : v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-xs text-gray-500 p-2 bg-gray-50 dark:bg-gray-700/30 rounded">
              Overall Accuracy: {(MULTI_ACTUAL.filter((a, i) => a === MULTI_PREDICTED[i]).length / MULTI_ACTUAL.length * 100).toFixed(1)}%
              &nbsp;({MULTI_ACTUAL.filter((a, i) => a === MULTI_PREDICTED[i]).length}/{MULTI_ACTUAL.length} correct)
            </div>
          </Card>
        </div>
      ) : (
        /* ── BINARY MODE ── */
        <Tabs tabs={[{ id: 'manual', label: 'Manual Input' }, { id: 'dataset', label: 'Loan Dataset' }]}>
          {(tab) => (
            <div className="space-y-6">
              {tab === 'manual' ? (
                /* Manual input controls */
                <Card title="Enter Confusion Matrix Values">
                  <div className="flex flex-wrap gap-6 mb-4">
                    {numInput('tp', 'True Positives (TP)')}
                    {numInput('tn', 'True Negatives (TN)')}
                    {numInput('fp', 'False Positives (FP)')}
                    {numInput('fn', 'False Negatives (FN)')}
                  </div>
                  <InfoBox type="info">
                    <strong>TP</strong> = correctly predicted positive &nbsp;|&nbsp;
                    <strong>TN</strong> = correctly predicted negative &nbsp;|&nbsp;
                    <strong>FP</strong> = predicted positive, actually negative (Type I error) &nbsp;|&nbsp;
                    <strong>FN</strong> = predicted negative, actually positive (Type II error)
                  </InfoBox>
                </Card>
              ) : (
                /* Dataset threshold control */
                <Card title="Loan Dataset — Threshold-based Classifier">
                  <div className="flex items-center gap-4 mb-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Threshold</label>
                    <input
                      type="range" min={0} max={1} step={0.01}
                      value={threshold}
                      onChange={e => setThreshold(parseFloat(e.target.value))}
                      className="flex-1 accent-blue-600"
                    />
                    <span className="text-sm font-bold text-blue-600 w-10 text-right">{threshold.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Score is a weighted heuristic of credit_score, income, debt_ratio, employment_years.
                    Samples: {loanRows.length}
                  </p>
                </Card>
              )}

              {/* 2×2 Matrix grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Confusion Matrix" actions={
                  <button onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600
                               hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
                    {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy Metrics'}
                  </button>
                }>
                  {(() => {
                    const m = tab === 'manual'
                      ? { tp, tn, fp, fn }
                      : { tp: dsMetrics.tp, tn: dsMetrics.tn, fp: dsMetrics.fp, fn: dsMetrics.fn };
                    const cells: Array<{ type: 'TP'|'TN'|'FP'|'FN'; label: string; value: number; desc: string }> = [
                      { type: 'TP', label: 'True Positive',  value: m.tp, desc: 'Predicted +, Actually +' },
                      { type: 'FP', label: 'False Positive', value: m.fp, desc: 'Predicted +, Actually −' },
                      { type: 'FN', label: 'False Negative', value: m.fn, desc: 'Predicted −, Actually +' },
                      { type: 'TN', label: 'True Negative',  value: m.tn, desc: 'Predicted −, Actually −' },
                    ];
                    return (
                      <div>
                        <div className="grid grid-cols-2 gap-0 border-2 border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden mb-3">
                          {cells.map(({ type, label, value, desc }) => (
                            <div key={type}
                              className={`flex flex-col items-center justify-center p-6 border border-gray-200 dark:border-gray-600 ${binaryCellStyle(type)}`}
                            >
                              <span className="text-3xl font-black mb-1">{value}</span>
                              <span className="text-sm font-bold">{type} — {label}</span>
                              <span className="text-xs opacity-70 mt-1 text-center">{desc}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 px-1">
                          <span>← Predicted Positive | Predicted Negative →</span>
                          <span>Actual + ↑ | Actual − ↓</span>
                        </div>
                      </div>
                    );
                  })()}
                </Card>

                {/* Derived metrics */}
                <Card title="Derived Metrics">
                  {(() => {
                    const m = tab === 'manual'
                      ? { accuracy: manAcc, precision: manPrec, recall: manRec, specificity: manSpec, f1: manF1 }
                      : { accuracy: dsMetrics.accuracy, precision: dsMetrics.precision, recall: dsMetrics.recall, specificity: dsMetrics.specificity, f1: dsMetrics.f1 };
                    return (
                      <div className="space-y-0">
                        {metricRow('Accuracy',    m.accuracy,    'Overall correct predictions')}
                        {metricRow('Precision',   m.precision,   'Of all predicted +, how many are actually +')}
                        {metricRow('Recall',      m.recall,      'Of all actual +, how many did we catch?')}
                        {metricRow('Specificity', m.specificity, 'Of all actual −, how many did we correctly reject?')}
                        {metricRow('F1-Score',    m.f1,          'Harmonic mean of Precision and Recall')}
                      </div>
                    );
                  })()}
                </Card>
              </div>

              {/* Formulas */}
              <Card title="Metric Formulas">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {FORMULAS.map(({ label, formula }) => (
                    <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-700/40 p-3 border border-gray-200 dark:border-gray-600">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{label}</p>
                      <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all">{formula}</pre>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </Tabs>
      )}

      {/* Interpretation guide */}
      <InfoBox type="warning" title="When do errors matter most?">
        <ul className="list-disc list-inside space-y-1">
          <li><strong>High Recall critical</strong> — medical diagnosis (minimise False Negatives)</li>
          <li><strong>High Precision critical</strong> — spam filters (minimise False Positives)</li>
          <li><strong>Balanced F1</strong> — imbalanced datasets where accuracy alone is misleading</li>
          <li><strong>Specificity</strong> — screening tests where true-negative rate matters</li>
        </ul>
      </InfoBox>
    </div>
  );
}
