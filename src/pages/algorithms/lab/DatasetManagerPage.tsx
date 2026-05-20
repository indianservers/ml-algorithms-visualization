import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Database, Download, Grid3X3, LineChart, Table2, Trash2, Upload } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { allSampleDatasets } from '../../../data/sampleDatasets';
import { getAlgorithmSampleDatasets } from '../../../data/algorithmDatasets';
import { getAllAlgorithms } from '../../../data/implementationStatus';
import { deleteDataset, loadDatasets, saveDataset, SavedDataset } from '../../../stores/experimentStore';
import { EditableDataGrid } from '../../../components/dataset/EditableDataGrid';

type Row = Record<string, unknown>;
const ACTIVE_DATASETS_KEY = 'mlSuite.activeAlgorithmDatasets';
const DATASET_VERSION_KEY = 'mlSuite.datasetVersionHistory';

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

function isMissing(value: unknown) {
  return value === null || value === undefined || value === '' || (typeof value === 'number' && Number.isNaN(value));
}

function numericValues(rows: Row[], column: string) {
  return rows.map(row => Number(row[column])).filter(value => Number.isFinite(value));
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
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
  const [savedSearch, setSavedSearch] = useState('');
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

  const quality = useMemo(() => {
    const labelColumn = draft.columns.find(col => ['label', 'class', 'target', 'category'].includes(col.toLowerCase()));
    const classCounts = labelColumn
      ? Object.entries(draft.data.reduce<Record<string, number>>((counts, row) => {
        const key = String(row[labelColumn] ?? 'missing');
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {})).map(([label, count]) => ({ label, count }))
      : [];
    const missingCells = draft.data.reduce((sum, row) => sum + draft.columns.filter(col => isMissing(row[col])).length, 0);
    const totalCells = Math.max(1, draft.data.length * draft.columns.length);
    const duplicateMap = new Map<string, number>();
    draft.data.forEach(row => {
      const key = JSON.stringify(draft.columns.map(col => String(row[col] ?? '').trim()));
      duplicateMap.set(key, (duplicateMap.get(key) ?? 0) + 1);
    });
    const duplicateRows = [...duplicateMap.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
    const types = draft.columns.map(column => {
      const present = draft.data.map(row => row[column]).filter(value => !isMissing(value));
      const numeric = present.length > 0 && present.every(value => Number.isFinite(Number(value)));
      const datetime = present.length > 0 && present.every(value => !Number.isNaN(Date.parse(String(value))));
      const kind = numeric ? 'Numeric' : datetime ? 'DateTime' : present.some(value => String(value).length > 40) ? 'Text' : 'Categorical';
      const values = numericValues(draft.data, column);
      const q1 = percentile(values, 0.25);
      const q3 = percentile(values, 0.75);
      const iqr = q3 - q1;
      const outliers = values.filter(value => value < q1 - 1.5 * iqr || value > q3 + 1.5 * iqr).length;
      const suspicious = /age|price|amount|score|income|weight|height/i.test(column) && !numeric;
      return { column, kind, outliers, suspicious };
    });
    const counts = classCounts.map(item => item.count);
    const minClass = Math.min(...counts, Infinity);
    const maxClass = Math.max(...counts, 0);
    const imbalanceRatio = counts.length ? maxClass / Math.max(1, minClass) : 1;
    const missingRate = missingCells / totalCells;
    const duplicateRate = duplicateRows / Math.max(1, draft.data.length);
    const health = imbalanceRatio > 3 || missingRate > 0.15 || duplicateRate > 0.1
      ? 'Poor'
      : imbalanceRatio > 1.5 || missingRate > 0.05 || duplicateRate > 0.02 ? 'Fair' : 'Good';
    return { labelColumn, classCounts, missingCells, missingRate, duplicateRows, duplicateRate, types, imbalanceRatio, health };
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
    const dataset: SavedDataset = {
      id: `dataset_${Date.now()}`,
      name,
      columns: draft.columns,
      data: draft.data,
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
      savedAt: Date.now(),
    };
    await saveDataset(dataset);
    const versions = JSON.parse(localStorage.getItem(DATASET_VERSION_KEY) ?? '[]') as Array<{ id: string; name: string; rows: number; columns: number; savedAt: number }>;
    localStorage.setItem(DATASET_VERSION_KEY, JSON.stringify([{ id: dataset.id, name: dataset.name, rows: dataset.data.length, columns: dataset.columns.length, savedAt: dataset.savedAt }, ...versions].slice(0, 20)));
    setMessage('Dataset saved to IndexedDB');
    await refresh();
    return dataset;
  };

  const handleSaveAndLoad = async () => {
    const dataset = await handleSave();
    setActiveDataset(dataset, algorithmRoute);
    setActiveDatasetId(dataset.id);
    setMessage(`${dataset.name} saved and loaded for ${selectedAlgorithm.label}`);
  };

  const removeDuplicateRows = () => {
    const seen = new Set<string>();
    setDraft(previous => ({
      ...previous,
      data: previous.data.filter(row => {
        const key = JSON.stringify(previous.columns.map(col => String(row[col] ?? '').trim()));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    }));
    setMessage('Duplicate rows removed from the current draft.');
  };

  const filteredSaved = saved.filter(dataset => {
    const text = `${dataset.name} ${dataset.tags?.join(' ') ?? ''} ${dataset.columns.join(' ')}`.toLowerCase();
    return text.includes(savedSearch.toLowerCase());
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Dataset Manager" subtitle="Real local dataset upload, preview, profiling, IndexedDB save/delete, tags, and CSV/JSON export." badge="Beginner" category="Lab" icon={<Database size={22} />} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Saved Datasets">
            <div className="space-y-2">
              <input
                value={savedSearch}
                onChange={event => setSavedSearch(event.target.value)}
                placeholder="Search saved datasets"
                className="min-h-10 w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              />
              {filteredSaved.map(dataset => (
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
              {saved.length > 0 && filteredSaved.length === 0 && (
                <p className="text-sm text-gray-500">No saved datasets match this search.</p>
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
              <button onClick={handleSaveAndLoad} className="flex min-h-10 w-full items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 font-semibold text-white">
                Save & Load for Selected Algorithm
              </button>
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

          <Card title="Quality Inspector" subtitle="Class balance, missing values, duplicates, outliers, and inferred column types">
            <div className="grid gap-3 md:grid-cols-4">
              <div className={`rounded p-3 ${quality.health === 'Good' ? 'bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-200' : quality.health === 'Fair' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-200' : 'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-200'}`}>
                <p className="text-xs font-bold uppercase">Dataset Health</p>
                <p className="text-2xl font-black">{quality.health}</p>
              </div>
              <div className="rounded bg-gray-50 p-3 dark:bg-gray-900"><p className="text-xs text-gray-500">Missing cells</p><p className="text-2xl font-black">{quality.missingCells}</p><p className="text-xs">{(quality.missingRate * 100).toFixed(1)}%</p></div>
              <div className="rounded bg-gray-50 p-3 dark:bg-gray-900"><p className="text-xs text-gray-500">Duplicate rows</p><p className="text-2xl font-black">{quality.duplicateRows}</p><p className="text-xs">{(quality.duplicateRate * 100).toFixed(1)}%</p></div>
              <div className="rounded bg-gray-50 p-3 dark:bg-gray-900"><p className="text-xs text-gray-500">Class ratio</p><p className="text-2xl font-black">{quality.imbalanceRatio.toFixed(1)}x</p><p className="text-xs">{quality.labelColumn ?? 'no label column'}</p></div>
            </div>

            {quality.classCounts.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-bold">Class Balance</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={quality.classCounts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {quality.classCounts.map(item => {
                        const min = Math.min(...quality.classCounts.map(entry => entry.count));
                        const ratio = item.count / Math.max(1, min);
                        return <Cell key={item.label} fill={ratio <= 1.5 ? '#059669' : ratio <= 3 ? '#d97706' : '#dc2626'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {quality.imbalanceRatio > 1.5 && <InfoBox type="warning">Largest class has {quality.imbalanceRatio.toFixed(1)}x more rows than the smallest class. Consider augmentation, upsampling, or collecting more minority-class examples.</InfoBox>}
              </div>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-bold">Missing Value Heatmap</p>
                <div className="overflow-auto rounded border border-gray-200 p-2 dark:border-gray-700">
                  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${draft.columns.length}, minmax(18px, 1fr))` }}>
                    {draft.columns.map(col => <span key={col} className="truncate text-[10px] font-bold text-gray-500" title={col}>{col.slice(0, 3)}</span>)}
                    {draft.data.slice(0, 20).flatMap((row, rowIndex) => draft.columns.map(col => <span key={`${rowIndex}-${col}`} title={`${rowIndex + 1}: ${col}`} className={`h-4 rounded-sm ${isMissing(row[col]) ? 'bg-red-500' : 'bg-green-500'}`} />))}
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-bold">Column Types and Outliers</p>
                  <button onClick={removeDuplicateRows} disabled={quality.duplicateRows === 0} className="rounded border border-gray-200 px-2 py-1 text-xs font-bold disabled:opacity-50 dark:border-gray-700">Remove duplicates</button>
                </div>
                <div className="max-h-64 space-y-2 overflow-auto pr-1">
                  {quality.types.map(item => (
                    <div key={item.column} className="flex items-center justify-between gap-3 rounded bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900">
                      <span className="min-w-0 truncate font-semibold">{item.column}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.kind === 'Numeric' ? 'bg-blue-100 text-blue-700' : item.kind === 'DateTime' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-700'}`}>{item.kind}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${item.outliers ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{item.outliers} outliers</span>
                      {item.suspicious && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">check type</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Editable Data Grid">
            <EditableDataGrid
              columns={draft.columns}
              rows={draft.data}
              maxRows={draft.data.length}
              onColumnsChange={columns => setDraft(previous => ({ ...previous, columns }))}
              onChange={data => setDraft(previous => ({ ...previous, data }))}
            />
          </Card>

          <Card title="Saved IndexedDB Datasets">
            <div className="space-y-2">
              {filteredSaved.map(dataset => (
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
