import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Database, Download, Grid3X3, LineChart, Table2, Trash2, Upload } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { allSampleDatasets } from '../../../data/sampleDatasets';
import { getAlgorithmSampleDatasets } from '../../../data/algorithmDatasets';
import { getAllAlgorithms } from '../../../data/implementationStatus';
import { deleteDataset, loadDatasets, saveDataset, SavedDataset } from '../../../stores/experimentStore';

type Row = Record<string, unknown>;
const ACTIVE_DATASETS_KEY = 'mlSuite.activeAlgorithmDatasets';

function parseCSV(text: string): { columns: string[]; data: Row[] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const columns = lines[0]?.split(',').map(item => item.trim()) ?? [];
  const data = lines.slice(1).map(line => {
    const values = line.split(',');
    return Object.fromEntries(columns.map((col, i) => [col, values[i]?.trim() === '' ? null : values[i]?.trim() ?? null]));
  });
  return { columns, data };
}

function toCSV(columns: string[], data: Row[]) {
  return [columns.join(','), ...data.map(row => columns.map(col => row[col] ?? '').join(','))].join('\n');
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function DatasetManagerPage() {
  const navigate = useNavigate();
  const algorithms = useMemo(() => getAllAlgorithms(), []);
  const [algorithmRoute, setAlgorithmRoute] = useState('/ml/supervised/logistic-regression');
  const selectedAlgorithm = algorithms.find(item => item.route === algorithmRoute) ?? algorithms[0];
  const algorithmSamples = useMemo(() =>
    getAlgorithmSampleDatasets(selectedAlgorithm.route, selectedAlgorithm.category),
  [selectedAlgorithm]);
  const [saved, setSaved] = useState<SavedDataset[]>([]);
  const [selectedId, setSelectedId] = useState(algorithmSamples[0]?.id ?? allSampleDatasets[0].id);
  const [name, setName] = useState(algorithmSamples[0]?.name ?? allSampleDatasets[0].name);
  const [tags, setTags] = useState('sample, local');
  const [draft, setDraft] = useState<{ columns: string[]; data: Row[] }>({
    columns: algorithmSamples[0]?.columns ?? allSampleDatasets[0].columns,
    data: algorithmSamples[0]?.data ?? allSampleDatasets[0].data,
  });
  const [message, setMessage] = useState('');
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => setSaved(await loadDatasets());
  useEffect(() => {
    let active = true;
    loadDatasets().then(items => {
      if (active) setSaved(items);
    });
    return () => {
      active = false;
    };
  }, []);

  const profile = useMemo(() => {
    const missing = draft.data.reduce((sum, row) => sum + draft.columns.filter(col => row[col] === null || row[col] === undefined || row[col] === '').length, 0);
    const numeric = draft.columns.filter(col => draft.data.some(row => !Number.isNaN(Number(row[col])) && row[col] !== null && row[col] !== '')).length;
    return { rows: draft.data.length, columns: draft.columns.length, missing, numeric, categorical: draft.columns.length - numeric };
  }, [draft]);

  const loadSample = (id: string) => {
    const dataset = algorithmSamples.find(item => item.id === id) ?? allSampleDatasets.find(item => item.id === id) ?? allSampleDatasets[0];
    setSelectedId(id);
    setName(dataset.name);
    setDraft({ columns: dataset.columns, data: dataset.data });
  };

  const setActiveDataset = (dataset: SavedDataset, route = '/ml/lab/dataset-manager') => {
    const current = JSON.parse(localStorage.getItem(ACTIVE_DATASETS_KEY) ?? '{}') as Record<string, unknown>;
    current[route] = {
      id: dataset.id,
      name: dataset.name,
      description: `${dataset.data.length} saved rows from your browser storage.`,
      columns: dataset.columns,
      data: dataset.data,
      kind: 'upload',
    };
    localStorage.setItem(ACTIVE_DATASETS_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('ml:algorithm-dataset-loaded', { detail: { route, dataset } }));
    setActiveDatasetId(dataset.id);
  };

  const loadSavedDataset = (dataset: SavedDataset, shouldNavigate = false) => {
    setName(dataset.name);
    setTags(dataset.tags?.join(', ') || 'saved, local');
    setDraft({ columns: dataset.columns, data: dataset.data });
    setActiveDataset(dataset);
    setMessage(`${dataset.name} is active.`);
    if (shouldNavigate) navigate('/ml/lab/dataset-manager');
  };

  const loadAlgorithm = (route: string) => {
    const algorithm = algorithms.find(item => item.route === route) ?? algorithms[0];
    const samples = getAlgorithmSampleDatasets(algorithm.route, algorithm.category);
    const dataset = samples[0] ?? allSampleDatasets[0];
    setAlgorithmRoute(route);
    setSelectedId(dataset.id);
    setName(dataset.name);
    setTags(`${algorithm.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}, sample, local`);
    setDraft({ columns: dataset.columns, data: dataset.data });
  };

  const handleUpload = async (file: File) => {
    const text = await file.text();
    if (file.name.endsWith('.json')) {
      const parsed = JSON.parse(text);
      const data = Array.isArray(parsed) ? parsed : parsed.data;
      const columns = parsed.columns ?? Object.keys(data[0] ?? {});
      setDraft({ columns, data });
    } else {
      setDraft(parseCSV(text));
    }
    setName(file.name.replace(/\.(csv|json)$/i, ''));
  };

  const handleSave = async () => {
    await saveDataset({
      id: `dataset_${Date.now()}`,
      name,
      columns: draft.columns,
      data: draft.data,
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
      savedAt: Date.now(),
    });
    setMessage('Dataset saved to IndexedDB');
    await refresh();
  };

  const previewRows = draft.data.slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Dataset Manager" subtitle="Real local dataset upload, preview, profiling, IndexedDB save/delete, tags, and CSV/JSON export." badge="Beginner" category="Lab" icon={<Database size={22} />} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Saved Datasets">
            <div className="space-y-2">
              {saved.map(dataset => (
                <button
                  key={dataset.id}
                  onClick={() => loadSavedDataset(dataset, true)}
                  className={`flex min-h-10 w-full items-center justify-between gap-3 rounded border px-3 py-2 text-left text-sm transition-colors ${
                    activeDatasetId === dataset.id
                      ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:bg-blue-950/30'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{dataset.name}</span>
                    <span className="block text-xs text-gray-500">{dataset.data.length} rows, {dataset.columns.length} columns</span>
                  </span>
                  <Upload size={14} className="shrink-0" />
                </button>
              ))}
              {saved.length === 0 && (
                <p className="text-sm text-gray-500">No saved datasets yet. Upload a CSV/JSON file or save one of the samples below.</p>
              )}
            </div>
          </Card>

          <Card title="Upload and Save">
            <div className="space-y-3 text-sm">
              <select value={algorithmRoute} onChange={event => loadAlgorithm(event.target.value)} className="min-h-10 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                {algorithms.map(algorithm => <option key={algorithm.route} value={algorithm.route}>{algorithm.category} - {algorithm.label}</option>)}
              </select>
              <select value={selectedId} onChange={event => loadSample(event.target.value)} className="min-h-10 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                {algorithmSamples.map(dataset => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}
              </select>
              <input value={name} onChange={event => setName(event.target.value)} className="min-h-10 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900" />
              <input value={tags} onChange={event => setTags(event.target.value)} className="min-h-10 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900" placeholder="tags" />
              <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={event => event.target.files?.[0] && handleUpload(event.target.files[0])} />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => fileRef.current?.click()} className="flex min-h-10 items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 dark:border-gray-700"><Upload size={14} /> Upload</button>
                <button onClick={handleSave} className="min-h-10 rounded bg-blue-600 px-3 py-2 font-semibold text-white">Save</button>
              </div>
              {message && <p className="text-xs text-green-600">{message}</p>}
            </div>
          </Card>

          <Card title="Data Profile">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(profile).map(([key, value]) => (
                <div key={key} className="rounded bg-gray-50 p-2 dark:bg-gray-900">
                  <p className="text-xs capitalize text-gray-500">{key}</p>
                  <p className="font-mono text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Export">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button onClick={() => download(`${name}.csv`, toCSV(draft.columns, draft.data), 'text/csv')} className="flex min-h-10 items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 dark:border-gray-700"><Download size={14} /> CSV</button>
              <button onClick={() => download(`${name}.json`, JSON.stringify(draft, null, 2), 'application/json')} className="flex min-h-10 items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 dark:border-gray-700"><Download size={14} /> JSON</button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Next Steps">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: 'Visualize', to: selectedAlgorithm.route, icon: LineChart },
                { label: 'Dashboard', to: '/ml/lab/algorithm-comparison', icon: BarChart3 },
                { label: 'Statistics', to: '/ml/preprocessing/missing-values', icon: Table2 },
                { label: 'Data Grid', to: '/ml/lab/dataset-manager', icon: Grid3X3 },
              ].map(({ label, to, icon: Icon }) => (
                <Link key={label} to={to} className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:bg-blue-950/30">
                  <Icon size={15} />
                  {label}
                </Link>
              ))}
            </div>
          </Card>

          <Card title="Editable Preview Grid">
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>{draft.columns.map(col => <th key={col} className="border border-gray-200 p-2 text-left dark:border-gray-700">{col}</th>)}</tr>
                </thead>
                <tbody>
                  {previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {draft.columns.map(col => (
                        <td key={col} className={`border border-gray-200 p-2 dark:border-gray-700 ${row[col] === null || row[col] === '' ? 'bg-red-50 text-red-700 dark:bg-red-900/20' : ''}`}>{String(row[col] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Saved IndexedDB Datasets">
            <div className="space-y-2">
              {saved.map(dataset => (
                <div key={dataset.id} className="flex flex-col gap-3 rounded border border-gray-200 p-3 text-sm dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
                  <button onClick={() => loadSavedDataset(dataset)} className="min-w-0 text-left">
                    <p className="font-semibold">{dataset.name}</p>
                    <p className="text-xs text-gray-500">{dataset.data.length} rows, {dataset.columns.length} columns, tags: {dataset.tags?.join(', ') || 'none'}</p>
                  </button>
                  <button onClick={async () => { await deleteDataset(dataset.id); await refresh(); }} className="grid min-h-10 min-w-10 place-items-center self-start rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 sm:self-auto" aria-label={`Delete ${dataset.name}`}><Trash2 size={16} /></button>
                </div>
              ))}
              {saved.length === 0 && <p className="text-sm text-gray-500">No saved datasets yet.</p>}
            </div>
          </Card>

          <InfoBox type="info" title="Real Logic Cross-Check">
            CSV/JSON files are parsed in the browser, data is profiled from actual cells, saves go to IndexedDB through the shared store, and delete/export operations run locally.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
