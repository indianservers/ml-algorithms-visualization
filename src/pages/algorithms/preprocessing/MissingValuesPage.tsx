import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Download, Upload, RotateCcw, Filter } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { Tabs } from '../../../components/common/Tabs';

// ─── Built-in dataset with intentional missing values ─────────────────────────
type Row = Record<string, string | number | null>;

const COLUMNS = ['age', 'income', 'job', 'credit_score', 'loan_amount', 'status'];

const BUILTIN_DATA: Row[] = [
  { age: 28, income: 52000, job: 'Engineer',   credit_score: 720, loan_amount: 15000, status: 'approved' },
  { age: null, income: 38000, job: 'Teacher',  credit_score: null, loan_amount: 8000,  status: 'approved' },
  { age: 45, income: null,  job: 'Manager',    credit_score: 680, loan_amount: null,   status: 'rejected' },
  { age: 33, income: 61000, job: null,         credit_score: 740, loan_amount: 20000,  status: 'approved' },
  { age: 52, income: 45000, job: 'Nurse',      credit_score: null, loan_amount: 12000, status: null       },
  { age: null, income: null, job: 'Driver',    credit_score: 590, loan_amount: 5000,   status: 'rejected' },
  { age: 29, income: 70000, job: 'Developer',  credit_score: 800, loan_amount: 25000,  status: 'approved' },
  { age: 41, income: 55000, job: null,         credit_score: 660, loan_amount: null,   status: 'approved' },
  { age: 36, income: 42000, job: 'Accountant', credit_score: 700, loan_amount: 10000,  status: null       },
  { age: null, income: 31000, job: 'Clerk',    credit_score: null, loan_amount: 6000,  status: 'rejected' },
  { age: 27, income: 58000, job: 'Analyst',    credit_score: 730, loan_amount: 18000,  status: 'approved' },
  { age: 60, income: null,  job: 'Retired',    credit_score: 650, loan_amount: 9000,   status: null       },
  { age: 38, income: 67000, job: 'Designer',   credit_score: null, loan_amount: 22000, status: 'approved' },
  { age: 49, income: 50000, job: null,         credit_score: 710, loan_amount: 13000,  status: 'rejected' },
  { age: 31, income: 44000, job: 'Sales',      credit_score: 680, loan_amount: null,   status: 'approved' },
];

const NUMERIC_COLS     = ['age', 'income', 'credit_score', 'loan_amount'];
// ─── Helpers ──────────────────────────────────────────────────────────────────
function isMissing(v: unknown): boolean {
  return v === null || v === undefined || v === '';
}

function computeStats(data: Row[], cols: string[]) {
  const total = data.length * cols.length;
  let missing = 0;
  const perCol: Record<string, { count: number; pct: number }> = {};
  cols.forEach(col => {
    const colMissing = data.filter(r => isMissing(r[col])).length;
    missing += colMissing;
    perCol[col] = { count: colMissing, pct: (colMissing / data.length) * 100 };
  });
  return { total, missing, pct: (missing / total) * 100, perCol };
}

function numericValues(data: Row[], col: string): number[] {
  return data.map(r => r[col]).filter(v => !isMissing(v)).map(Number);
}

function numMean(vals: number[]): number {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}
function numMedian(vals: number[]): number {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}
function numMode(vals: (string | number | null)[]): string | number {
  const freq: Map<string | number, number> = new Map();
  vals.filter(v => !isMissing(v)).forEach(v => { const k = v!; freq.set(k, (freq.get(k) ?? 0) + 1); });
  if (!freq.size) return '';
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function applyImputation(
  data: Row[],
  cols: string[],
  strategy: string,
  dropThreshold: number,
  customValue: string
): { result: Row[]; cols: string[] } {
  if (strategy === 'drop-rows') {
    return { result: data.filter(r => cols.every(c => !isMissing(r[c]))), cols };
  }

  if (strategy === 'drop-cols') {
    const stats = computeStats(data, cols);
    const keepCols = cols.filter(c => stats.perCol[c].pct <= dropThreshold);
    return { result: data, cols: keepCols };
  }

  // Compute fill values
  const fills: Record<string, string | number> = {};
  cols.forEach(col => {
    if (NUMERIC_COLS.includes(col)) {
      const vals = numericValues(data, col);
      if (strategy === 'mean')   fills[col] = parseFloat(numMean(vals).toFixed(2));
      if (strategy === 'median') fills[col] = parseFloat(numMedian(vals).toFixed(2));
      if (strategy === 'mode')   fills[col] = numMode(vals as unknown as string[]);
      if (strategy === 'custom') fills[col] = isNaN(Number(customValue)) ? customValue : Number(customValue);
    } else {
      if (strategy === 'custom') fills[col] = customValue;
      else fills[col] = numMode(data.map(r => r[col]));
    }
  });

  return {
    result: data.map(r => {
      const row = { ...r };
      cols.forEach(col => { if (isMissing(row[col])) row[col] = fills[col]; });
      return row;
    }),
    cols,
  };
}

function toCSV(data: Row[], cols: string[]): string {
  const header = cols.join(',');
  const rows = data.map(r => cols.map(c => (r[c] === null || r[c] === undefined ? '' : String(r[c]))).join(','));
  return [header, ...rows].join('\n');
}

function parseCSV(text: string): { data: Row[]; cols: string[] } {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { data: [], cols: [] };
  const cols = lines[0].split(',').map(c => c.trim());
  const data: Row[] = lines.slice(1).map(line => {
    const vals = line.split(',');
    const row: Row = {};
    cols.forEach((c, i) => { row[c] = vals[i]?.trim() === '' ? null : vals[i]?.trim() ?? null; });
    return row;
  });
  return { data, cols };
}

// ─── Matrix cell component ────────────────────────────────────────────────────
const MatrixCell: React.FC<{ value: unknown; col: string }> = ({ value }) => {
  const missing = isMissing(value);
  return (
    <td className={`border border-gray-200 dark:border-gray-600 px-2 py-1 text-xs text-center max-w-[80px] truncate
      ${missing ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-bold' : 'text-gray-700 dark:text-gray-300'}`}
      title={missing ? 'MISSING' : String(value)}
    >
      {missing ? '✕' : String(value)}
    </td>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MissingValuesPage() {
  const [sourceData, setSourceData]   = useState<Row[]>(BUILTIN_DATA);
  const [sourceCols, setSourceCols]   = useState<string[]>(COLUMNS);
  const [strategy, setStrategy]       = useState('mean');
  const [dropThreshold, setDropThreshold] = useState(40);
  const [customValue, setCustomValue] = useState('0');
  const [imputed, setImputed]         = useState<{ data: Row[]; cols: string[] } | null>(null);
  const fileRef                        = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => computeStats(sourceData, sourceCols), [sourceData, sourceCols]);

  const handleImpute = useCallback(() => {
    const next = applyImputation(sourceData, sourceCols, strategy, dropThreshold, customValue);
    setImputed({ data: next.result, cols: next.cols });
  }, [sourceData, sourceCols, strategy, dropThreshold, customValue]);

  const handleReset = () => {
    setSourceData(BUILTIN_DATA);
    setSourceCols(COLUMNS);
    setImputed(null);
  };

  const handleDownload = () => {
    if (!imputed) return;
    const csv = toCSV(imputed.data, imputed.cols);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'imputed_dataset.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const { data, cols } = parseCSV(ev.target?.result as string);
      if (cols.length) { setSourceData(data); setSourceCols(cols); setImputed(null); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="Missing Values"
        subtitle="Detect, visualise, and impute missing data using multiple strategies."
        badge="preprocessing"
        category="Data Preprocessing"
        icon={<Filter size={22} />}
      />

      {/* Controls */}
      <Card title="Dataset & Strategy"
        actions={
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600
                         hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
              <Upload size={12} /> Upload CSV
            </button>
            <button onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-600
                         hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors">
              <RotateCcw size={12} /> Reset
            </button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Strategy select */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Imputation Strategy</label>
            <select
              value={strategy}
              onChange={e => setStrategy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="drop-rows">Drop Rows (any missing)</option>
              <option value="drop-cols">Drop Columns (above threshold %)</option>
              <option value="mean">Mean Imputation (numeric)</option>
              <option value="median">Median Imputation (numeric)</option>
              <option value="mode">Mode Imputation (categorical)</option>
              <option value="custom">Custom Value</option>
            </select>
          </div>

          {/* Drop threshold */}
          {strategy === 'drop-cols' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Drop if missing &gt; {dropThreshold}%
              </label>
              <input type="range" min={0} max={100} step={5}
                value={dropThreshold}
                onChange={e => setDropThreshold(Number(e.target.value))}
                className="w-full accent-blue-600 mt-2"
              />
            </div>
          )}

          {/* Custom value */}
          {strategy === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Fill Value</label>
              <input type="text" value={customValue} onChange={e => setCustomValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                           bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Apply button */}
          <div className="flex items-end">
            <button onClick={handleImpute}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
              Apply Imputation
            </button>
          </div>
        </div>
      </Card>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Cells',    value: stats.total,                     color: 'text-gray-800 dark:text-gray-200' },
          { label: 'Missing Cells',  value: stats.missing,                   color: 'text-red-600' },
          { label: 'Complete Cells', value: stats.total - stats.missing,     color: 'text-green-600' },
          { label: '% Missing',      value: stats.pct.toFixed(1) + '%',      color: 'text-amber-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <Tabs tabs={[
        { id: 'matrix',  label: 'Missing Value Matrix' },
        { id: 'stats',   label: 'Column Statistics'    },
        { id: 'preview', label: 'Before / After'       },
      ]}>
        {(tab) => (
          <>
            {/* ── Missing Value Matrix ── */}
            {tab === 'matrix' && (
              <Card title="Missing Value Heatmap" subtitle="Red cells = missing values">
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse w-full">
                    <thead>
                      <tr>
                        <th className="border border-gray-200 dark:border-gray-600 px-2 py-1 bg-gray-50 dark:bg-gray-700 text-gray-500 font-normal">#</th>
                        {sourceCols.map(col => (
                          <th key={col} className="border border-gray-200 dark:border-gray-600 px-2 py-1 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sourceData.map((row, ri) => (
                        <tr key={ri} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-gray-400 text-center">{ri + 1}</td>
                          {sourceCols.map(col => (
                            <MatrixCell key={col} value={row[col]} col={col} />
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-4 mt-3 text-xs">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 inline-block" /> Missing (✕)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-gray-300 inline-block" /> Present</span>
                </div>
              </Card>
            )}

            {/* ── Column Statistics ── */}
            {tab === 'stats' && (
              <Card title="Per-Column Missing Statistics">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        {['Column', 'Type', 'Total Rows', 'Missing', '% Missing', 'Missing Bar'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sourceCols.map(col => {
                        const { count, pct } = stats.perCol[col];
                        const isNum = NUMERIC_COLS.includes(col);
                        return (
                          <tr key={col} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{col}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isNum ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'}`}>
                                {isNum ? 'numeric' : 'categorical'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{sourceData.length}</td>
                            <td className={`px-3 py-2 font-bold ${count > 0 ? 'text-red-600' : 'text-green-600'}`}>{count}</td>
                            <td className={`px-3 py-2 font-bold ${pct > 30 ? 'text-red-600' : pct > 10 ? 'text-amber-600' : 'text-green-600'}`}>
                              {pct.toFixed(1)}%
                            </td>
                            <td className="px-3 py-2 w-32">
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${pct > 30 ? 'bg-red-500' : pct > 10 ? 'bg-amber-400' : 'bg-green-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* ── Before / After ── */}
            {tab === 'preview' && (
              <div className="space-y-4">
                {imputed ? (
                  <>
                    <div className="flex items-center justify-between">
                      <InfoBox type="success" title="Imputation Applied">
                        Strategy: <strong>{strategy}</strong> — Rows: {sourceData.length} → {imputed.data.length} | Columns: {sourceCols.length} → {imputed.cols.length}
                      </InfoBox>
                      <button onClick={handleDownload}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors ml-4 shrink-0">
                        <Download size={14} /> Download CSV
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card title={`Before — ${sourceData.length} rows, ${sourceCols.length} cols`}>
                        <div className="overflow-x-auto max-h-64">
                          <table className="text-xs border-collapse w-full">
                            <thead>
                              <tr>
                                {sourceCols.map(c => (
                                  <th key={c} className="border border-gray-200 dark:border-gray-600 px-2 py-1 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold">{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sourceData.slice(0, 10).map((row, i) => (
                                <tr key={i}>
                                  {sourceCols.map(col => <MatrixCell key={col} value={row[col]} col={col} />)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>

                      <Card title={`After — ${imputed.data.length} rows, ${imputed.cols.length} cols`}>
                        <div className="overflow-x-auto max-h-64">
                          <table className="text-xs border-collapse w-full">
                            <thead>
                              <tr>
                                {imputed.cols.map(c => (
                                  <th key={c} className="border border-gray-200 dark:border-gray-600 px-2 py-1 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold">{c}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {imputed.data.slice(0, 10).map((row, i) => (
                                <tr key={i}>
                                  {imputed.cols.map(col => (
                                    <td key={col}
                                      className="border border-gray-200 dark:border-gray-600 px-2 py-1 text-xs text-center text-gray-700 dark:text-gray-300">
                                      {row[col] === null ? '' : String(row[col])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </div>
                  </>
                ) : (
                  <InfoBox type="info">
                    Select a strategy and click <strong>Apply Imputation</strong> to see before/after comparison.
                  </InfoBox>
                )}
              </div>
            )}
          </>
        )}
      </Tabs>

      {/* Strategy guide */}
      <Card title="Strategy Guide">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { name: 'Drop Rows',   desc: 'Removes entire rows with any missing value. Best for small % missing and row independence.', type: 'warning' as const },
            { name: 'Drop Cols',   desc: 'Removes columns above missing threshold. Use when a feature is mostly empty.',               type: 'warning' as const },
            { name: 'Mean',        desc: 'Fills numeric gaps with column mean. Sensitive to outliers. Good for normal distributions.',  type: 'info'    as const },
            { name: 'Median',      desc: 'Fills numeric gaps with column median. Robust to outliers. Best for skewed distributions.',   type: 'success' as const },
            { name: 'Mode',        desc: 'Fills with most frequent value. Ideal for categorical data.',                                 type: 'info'    as const },
            { name: 'Custom',      desc: 'Fill with a specific value. Useful when a domain-specific default makes sense (e.g., 0).',   type: 'info'    as const },
          ].map(({ name, desc, type }) => (
            <InfoBox key={name} type={type} title={name}>{desc}</InfoBox>
          ))}
        </div>
      </Card>
    </div>
  );
}
