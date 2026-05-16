import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Check, Copy, Database, Download, Grid3X3, LineChart, Table2, Upload } from 'lucide-react';
import {
  getAlgorithmDatasetSuggestions,
  loadAlgorithmDataset,
} from '../../data/algorithmDatasets';
import type { LoadedAlgorithmDataset } from '../../data/algorithmDatasets';
import { loadDatasets, type SavedDataset } from '../../stores/experimentStore';
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

function savedToLoadedDataset(dataset: SavedDataset): LoadedAlgorithmDataset {
  return {
    id: dataset.id,
    name: dataset.name,
    description: `${dataset.data.length} saved rows from your browser storage.`,
    columns: dataset.columns,
    data: dataset.data,
    kind: 'upload',
  };
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
  const [savedDatasets, setSavedDatasets] = useState<SavedDataset[]>([]);
  const [savedSearch, setSavedSearch] = useState('');
  const selected = suggestions.find(dataset => dataset.id === selectedId) ?? suggestions[0];
  const selectedSaved = savedDatasets.find(dataset => `saved:${dataset.id}` === selectedId);
  const loaded = useMemo(() => {
    if (selectedSaved) return savedToLoadedDataset(selectedSaved);
    return selected ? loadAlgorithmDataset(selected) : null;
  }, [selected, selectedSaved]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const filteredSavedDatasets = savedDatasets.filter(dataset => {
    const text = `${dataset.name} ${dataset.tags?.join(' ') ?? ''} ${dataset.columns.join(' ')}`.toLowerCase();
    return text.includes(savedSearch.toLowerCase());
  });

  useEffect(() => {
    let active = true;
    loadDatasets().then(items => {
      if (active) setSavedDatasets(items.sort((a, b) => b.savedAt - a.savedAt));
    });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) {
    return (
      <Card title="No dataset loaded" icon={<Database size={14} />}>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
          <p>This page needs data before its previews and statistics can be useful.</p>
          <Link to="/ml/lab/dataset-manager" className="inline-flex min-h-10 items-center rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Go to datasets page
          </Link>
        </div>
      </Card>
    );
  }

  const previewRows = loaded.data.slice(0, 4);
  const handleLoad = () => {
    persistLoadedDataset(route, loaded);
    setActiveId(loaded.id);
  };
  const handleSavedDatasetTap = (dataset: SavedDataset) => {
    const next = savedToLoadedDataset(dataset);
    persistLoadedDataset(route, next);
    setSelectedId(`saved:${dataset.id}`);
    setActiveId(next.id);
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
          <Link to="/ml/lab/dataset-manager" className="inline-flex min-h-10 items-center rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
            Open Dataset Manager
          </Link>
          {savedDatasets.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">Saved datasets</p>
                <span className="text-[11px] text-gray-400">{filteredSavedDatasets.length}/{savedDatasets.length}</span>
              </div>
              <input
                value={savedSearch}
                onChange={event => setSavedSearch(event.target.value)}
                placeholder="Search saved datasets"
                className="mb-2 min-h-10 w-full rounded border border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800"
              />
              <div className="space-y-2">
                {filteredSavedDatasets.slice(0, 4).map(dataset => (
                  <button
                    key={dataset.id}
                    onClick={() => handleSavedDatasetTap(dataset)}
                    className="flex min-h-10 w-full items-center justify-between gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-left text-xs hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-blue-950/30"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-gray-900 dark:text-white">{dataset.name}</span>
                      <span className="block text-gray-500">{dataset.data.length} rows, {dataset.columns.length} columns</span>
                    </span>
                    <Upload size={13} className="shrink-0 text-blue-600" />
                  </button>
                ))}
                {filteredSavedDatasets.length === 0 && <p className="text-xs text-gray-500">No saved datasets match this search.</p>}
              </div>
            </div>
          )}
          <select
            value={selectedSaved ? `saved:${selectedSaved.id}` : loaded.id}
            onChange={event => {
              setSelectedId(event.target.value);
              setActiveId(null);
            }}
            className="min-h-10 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
          >
            {savedDatasets.length > 0 && <optgroup label="Saved datasets">
              {savedDatasets.map(dataset => (
                <option key={dataset.id} value={`saved:${dataset.id}`}>{dataset.name}</option>
              ))}
            </optgroup>}
            <optgroup label="Samples">
            {suggestions.map(dataset => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name}{dataset.target ? ` -> ${dataset.target}` : ''}
              </option>
            ))}
            </optgroup>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400">{loaded.description}</p>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
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
          <div className="rounded bg-gray-50 p-2 text-xs dark:bg-gray-900">
            <p className="font-bold text-gray-700 dark:text-gray-200">Suggested schema</p>
            <p className="mt-1 text-gray-500">Target: <span className="font-mono">{loaded.target ?? loaded.columns.at(-1) ?? '-'}</span></p>
            <p className="mt-1 text-gray-500">Features: <span className="font-mono">{loaded.columns.filter(column => column !== (loaded.target ?? loaded.columns.at(-1))).slice(0, 5).join(', ') || '-'}</span></p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button onClick={handleLoad} className="flex min-h-10 items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">
              <Upload size={13} /> Load
            </button>
            <button onClick={handleCopy} className="flex min-h-10 items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs dark:border-gray-700">
              <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={() => downloadCSV(loaded)} className="flex min-h-10 items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs dark:border-gray-700">
              <Download size={13} /> CSV
            </button>
          </div>
          {activeId === loaded.id && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">Next steps</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Visualize', route, LineChart],
                  ['Dashboard', '/ml/lab/algorithm-comparison', BarChart3],
                  ['Statistics', '/ml/preprocessing/missing-values', Table2],
                  ['Data Grid', '/ml/lab/dataset-manager', Grid3X3],
                ].map(([label, to, Icon]) => (
                  <Link key={label as string} to={to as string} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded border border-emerald-200 bg-white px-2 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-gray-900 dark:text-emerald-100">
                    <Icon size={13} />
                    {label as string}
                  </Link>
                ))}
              </div>
            </div>
          )}
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
