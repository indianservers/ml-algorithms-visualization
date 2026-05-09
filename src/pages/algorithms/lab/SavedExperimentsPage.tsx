import React from 'react';
import { Database, Download, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { deleteExperiment, loadExperiments, type Experiment } from '../../../stores/experimentStore';

function downloadText(filename: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function experimentMarkdown(experiment: Experiment) {
  return [
    `# ${experiment.name}`,
    '',
    `Algorithm: ${experiment.algorithmName}`,
    `Created: ${new Date(experiment.createdAt).toLocaleString()}`,
    '',
    '## Parameters',
    '```json',
    JSON.stringify(experiment.params, null, 2),
    '```',
    '',
    '## Metrics',
    '```json',
    JSON.stringify(experiment.metrics, null, 2),
    '```',
    '',
    '## Notes',
    experiment.notes || 'No notes saved.',
    '',
    '## Model Card',
    '- Intended use: learning, comparison, and browser-sized experimentation.',
    '- Limitations: local educational run, dataset-specific behavior, and no production monitoring.',
    '- Reproducibility: inspect parameters, metrics, and saved timestamp above.',
  ].join('\n');
}

function flattenRecord(record: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  return Object.entries(record).reduce<Record<string, unknown>>((flat, [key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(flat, flattenRecord(value as Record<string, unknown>, nextKey));
    } else {
      flat[nextKey] = value;
    }
    return flat;
  }, {});
}

function formatValue(value: unknown) {
  if (value === undefined) return 'missing';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null) return 'null';
  return String(value);
}

function diffRows(left: Record<string, unknown>, right: Record<string, unknown>) {
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
  return keys.map(key => {
    const before = left[key];
    const after = right[key];
    const bothNumeric = typeof before === 'number' && typeof after === 'number';
    const delta = bothNumeric ? after - before : undefined;
    const percent = bothNumeric && before !== 0 ? (delta / Math.abs(before)) * 100 : undefined;
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    return { key, before, after, delta, percent, changed };
  });
}

export default function SavedExperimentsPage() {
  const [items, setItems] = React.useState<Experiment[]>([]);
  const [query, setQuery] = React.useState('');
  const [leftId, setLeftId] = React.useState('');
  const [rightId, setRightId] = React.useState('');

  const refresh = React.useCallback(async () => {
    const experiments = await loadExperiments();
    setItems(experiments.sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  React.useEffect(() => {
    let active = true;
    loadExperiments()
      .then(experiments => {
        if (active) setItems(experiments.sort((a, b) => b.createdAt - a.createdAt));
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = items.filter(item =>
    `${item.name} ${item.algorithmName}`.toLowerCase().includes(query.toLowerCase())
  );

  React.useEffect(() => {
    if (!items.length) return;
    setLeftId(current => current && items.some(item => item.id === current) ? current : items[1]?.id ?? items[0].id);
    setRightId(current => current && items.some(item => item.id === current) ? current : items[0].id);
  }, [items]);

  const leftExperiment = React.useMemo(() => items.find(item => item.id === leftId), [items, leftId]);
  const rightExperiment = React.useMemo(() => items.find(item => item.id === rightId), [items, rightId]);
  const metricDiff = React.useMemo(() => {
    if (!leftExperiment || !rightExperiment) return [];
    return diffRows(leftExperiment.metrics, rightExperiment.metrics);
  }, [leftExperiment, rightExperiment]);
  const paramDiff = React.useMemo(() => {
    if (!leftExperiment || !rightExperiment) return [];
    return diffRows(flattenRecord(leftExperiment.params), flattenRecord(rightExperiment.params));
  }, [leftExperiment, rightExperiment]);
  const changedMetrics = metricDiff.filter(row => row.changed).length;
  const changedParams = paramDiff.filter(row => row.changed).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Saved Experiments" subtitle="Browse, audit, delete, and export every browser-local experiment saved from workbench pages." badge="Intermediate" category="Lab" icon={<Database size={22} />} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card title="Experiment Library" subtitle="IndexedDB-backed, local to this browser.">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="mb-3 w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="Search algorithm or experiment"
          />
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded bg-blue-50 p-3 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
              <p className="text-xl font-bold">{items.length}</p>
              <p>Saved</p>
            </div>
            <div className="rounded bg-green-50 p-3 text-green-900 dark:bg-green-950/30 dark:text-green-100">
              <p className="text-xl font-bold">{new Set(items.map(item => item.algorithmId)).size}</p>
              <p>Algorithms</p>
            </div>
          </div>
          <InfoBox type="info" title="Reproducibility">
            Export JSON for exact parameters and Markdown for a readable model-card style report.
          </InfoBox>
        </Card>
        <div className="space-y-3">
          {items.length >= 2 && (
            <Card title="Experiment Diff View" subtitle="Compare parameters and metrics between two saved runs. Right side is treated as the newer candidate.">
              <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Baseline
                  <select
                    value={leftId}
                    onChange={event => setLeftId(event.target.value)}
                    className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    {items.map(item => <option key={item.id} value={item.id}>{item.name} / {item.algorithmName}</option>)}
                  </select>
                </label>
                <button
                  onClick={() => { setLeftId(rightId); setRightId(leftId); }}
                  className="self-end rounded border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                >
                  Swap
                </button>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Candidate
                  <select
                    value={rightId}
                    onChange={event => setRightId(event.target.value)}
                    className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                  >
                    {items.map(item => <option key={item.id} value={item.id}>{item.name} / {item.algorithmName}</option>)}
                  </select>
                </label>
              </div>

              {leftExperiment && rightExperiment && (
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded bg-gray-50 p-3 dark:bg-gray-900">
                    <p className="text-xs text-gray-500">Baseline</p>
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{leftExperiment.name}</p>
                  </div>
                  <div className="rounded bg-gray-50 p-3 dark:bg-gray-900">
                    <p className="text-xs text-gray-500">Candidate</p>
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{rightExperiment.name}</p>
                  </div>
                  <div className="rounded bg-blue-50 p-3 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                    <p className="text-xs">Metric changes</p>
                    <p className="text-xl font-bold">{changedMetrics}</p>
                  </div>
                  <div className="rounded bg-purple-50 p-3 text-purple-900 dark:bg-purple-950/30 dark:text-purple-100">
                    <p className="text-xs">Param changes</p>
                    <p className="text-xl font-bold">{changedParams}</p>
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <DiffTable title="Metric Diff" rows={metricDiff} />
                <DiffTable title="Parameter Diff" rows={paramDiff} />
              </div>
            </Card>
          )}

          {visible.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-500">No saved experiments match the current search.</p>
            </Card>
          ) : visible.map(experiment => (
            <Card
              key={experiment.id}
              title={experiment.name}
              subtitle={`${experiment.algorithmName} / ${new Date(experiment.createdAt).toLocaleString()}`}
              actions={
                <>
                  <button
                    onClick={() => downloadText(`${experiment.name}.json`, JSON.stringify(experiment, null, 2), 'application/json')}
                    className="rounded border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                    title="Export JSON"
                  >
                    <Download size={15} />
                  </button>
                  <button
                    onClick={() => downloadText(`${experiment.name}.md`, experimentMarkdown(experiment), 'text/markdown')}
                    className="rounded border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                  >
                    MD
                  </button>
                  <button
                    onClick={async () => { await deleteExperiment(experiment.id); await refresh(); }}
                    className="rounded border border-red-200 p-2 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                    title="Delete experiment"
                  >
                    <Trash2 size={15} />
                  </button>
                </>
              }
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Metrics</p>
                  <pre className="max-h-44 overflow-auto rounded bg-gray-950 p-3 text-[11px] text-gray-100">{JSON.stringify(experiment.metrics, null, 2)}</pre>
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Parameters</p>
                  <pre className="max-h-44 overflow-auto rounded bg-gray-950 p-3 text-[11px] text-gray-100">{JSON.stringify(experiment.params, null, 2)}</pre>
                </div>
              </div>
              {experiment.notes && <p className="mt-3 rounded bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-300">{experiment.notes}</p>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiffTable({ title, rows }: { title: string; rows: ReturnType<typeof diffRows> }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{title}</p>
      {rows.length === 0 ? (
        <p className="rounded border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-700">No comparable values yet.</p>
      ) : (
        <div className="max-h-80 overflow-auto rounded border border-gray-200 dark:border-gray-700">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="sticky top-0 bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Baseline</th>
                <th className="px-3 py-2">Candidate</th>
                <th className="px-3 py-2 text-right">Delta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key} className={row.changed ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}>
                  <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-200">{row.key}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{formatValue(row.before)}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{formatValue(row.after)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${typeof row.delta === 'number' && row.delta > 0 ? 'text-green-600' : typeof row.delta === 'number' && row.delta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {typeof row.delta === 'number' ? `${row.delta > 0 ? '+' : ''}${formatValue(row.delta)}${typeof row.percent === 'number' ? ` (${row.percent > 0 ? '+' : ''}${row.percent.toFixed(1)}%)` : ''}` : row.changed ? 'changed' : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
