import { useMemo, useState } from 'react';
import { Check, Copy, Database, Download, Upload } from 'lucide-react';
import {
  getAlgorithmDatasetSuggestions,
  loadAlgorithmDataset,
} from '../../data/algorithmDatasets';
import type { LoadedAlgorithmDataset } from '../../data/algorithmDatasets';
import { Card } from '../common/Card';

const ACTIVE_DATASETS_KEY = 'mlSuite.activeAlgorithmDatasets';

function escapeCSV(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCSV(dataset: LoadedAlgorithmDataset) {
  return [
    dataset.columns.join(','),
    ...dataset.data.map(row => dataset.columns.map(column => escapeCSV(row[column])).join(',')),
  ].join('\n');
}

function persistLoadedDataset(route: string, dataset: LoadedAlgorithmDataset) {
  if (typeof localStorage === 'undefined') return;
  const current = JSON.parse(localStorage.getItem(ACTIVE_DATASETS_KEY) ?? '{}') as Record<string, LoadedAlgorithmDataset>;
  current[route] = dataset;
  localStorage.setItem(ACTIVE_DATASETS_KEY, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent('ml:algorithm-dataset-loaded', { detail: { route, dataset } }));
}

function downloadCSV(dataset: LoadedAlgorithmDataset) {
  const url = URL.createObjectURL(new Blob([toCSV(dataset)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${dataset.id}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AlgorithmDatasetLoader({ route, category }: { route: string; category: string }) {
  const suggestions = useMemo(() => getAlgorithmDatasetSuggestions(route, category), [route, category]);
  const [selectedId, setSelectedId] = useState(suggestions[0]?.id ?? '');
  const selected = suggestions.find(dataset => dataset.id === selectedId) ?? suggestions[0];
  const loaded = useMemo(() => selected ? loadAlgorithmDataset(selected) : null, [selected]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!loaded) return null;

  const previewRows = loaded.data.slice(0, 4);
  const handleLoad = () => {
    persistLoadedDataset(route, loaded);
    setActiveId(loaded.id);
  };
  const handleCopy = async () => {
    await navigator.clipboard.writeText(toCSV(loaded));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <Card title="Load Dataset" icon={<Database size={14} />} actions={
      activeId === loaded.id ? (
        <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
          <Check size={13} /> Loaded
        </span>
      ) : null
    }>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3 text-sm">
          <select
            value={loaded.id}
            onChange={event => {
              setSelectedId(event.target.value);
              setActiveId(null);
            }}
            className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          >
            {suggestions.map(dataset => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name}{dataset.target ? ` -> ${dataset.target}` : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400">{loaded.description}</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded bg-gray-50 p-2 dark:bg-gray-900">
              <p className="text-gray-500">Rows</p>
              <p className="font-mono font-bold">{loaded.data.length}</p>
            </div>
            <div className="rounded bg-gray-50 p-2 dark:bg-gray-900">
              <p className="text-gray-500">Columns</p>
              <p className="font-mono font-bold">{loaded.columns.length}</p>
            </div>
            <div className="rounded bg-gray-50 p-2 dark:bg-gray-900">
              <p className="text-gray-500">Target</p>
              <p className="truncate font-mono font-bold">{loaded.target ?? '-'}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={handleLoad} className="flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
              <Upload size={13} /> Load
            </button>
            <button onClick={handleCopy} className="flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs dark:border-gray-700">
              <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={() => downloadCSV(loaded)} className="flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs dark:border-gray-700">
              <Download size={13} /> CSV
            </button>
          </div>
        </div>
        <div className="overflow-auto rounded border border-gray-200 dark:border-gray-700">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900">
                {loaded.columns.map(column => <th key={column} className="whitespace-nowrap p-2 text-left font-semibold">{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr key={index} className="border-t border-gray-100 dark:border-gray-800">
                  {loaded.columns.map(column => <td key={column} className="whitespace-nowrap p-2 font-mono">{String(row[column] ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
