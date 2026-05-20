import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Download, GitCompare, Table2 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { loadModelMetadata, type SavedModelMetadata } from '../../../stores/experimentStore';

type Tab = 'summary' | 'breakdown' | 'matrices' | 'report';

function accuracyOf(model: SavedModelMetadata) {
  return model.metrics?.accuracy ?? model.metrics?.acc ?? model.metrics?.f1 ?? 0;
}

function colorForAccuracy(value: number) {
  if (value >= 0.85) return '#059669';
  if (value >= 0.7) return '#d97706';
  return '#dc2626';
}

function download(filename: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ModelComparisonPage() {
  const [models, setModels] = useState<SavedModelMetadata[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('summary');

  useEffect(() => {
    void loadModelMetadata().then(items => {
      const sorted = items.sort((a, b) => b.savedAt - a.savedAt);
      setModels(sorted);
      setSelectedIds(sorted.slice(0, 2).map(model => model.id));
    });
  }, []);
  const selected = useMemo(() => models.filter(model => selectedIds.includes(model.id)).slice(0, 4), [models, selectedIds]);
  const chartData = selected.map(model => ({
    name: model.name.length > 18 ? `${model.name.slice(0, 18)}...` : model.name,
    accuracy: Number(accuracyOf(model).toFixed(4)),
    modality: String(model.parameters?.modality ?? model.algorithmName),
    classes: Number(model.parameters?.classCount ?? (Array.isArray(model.parameters?.labels) ? model.parameters.labels.length : 0)),
    samples: Number(model.parameters?.sampleCount ?? model.parameters?.samples ?? 0),
    epochs: Number(model.parameters?.epochs ?? 0),
  }));

  const toggleModel = (id: string) => {
    setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : current.length >= 4 ? current : [...current, id]);
  };

  const exportCsv = () => download('model-comparison.csv', [
    'model,modality,classes,samples,accuracy,epochs,saved',
    ...selected.map(model => [
      model.name,
      model.parameters?.modality ?? model.algorithmName,
      model.parameters?.classCount ?? '',
      model.parameters?.sampleCount ?? model.parameters?.samples ?? '',
      accuracyOf(model).toFixed(4),
      model.parameters?.epochs ?? '',
      new Date(model.savedAt).toISOString(),
    ].join(',')),
  ].join('\n'), 'text/csv');

  const exportReport = () => download('model-comparison-report.md', [
    '# Model Comparison Report',
    '',
    '| Model | Modality | Accuracy | Classes | Saved |',
    '|---|---:|---:|---:|---|',
    ...selected.map(model => `| ${model.name} | ${model.parameters?.modality ?? model.algorithmName} | ${(accuracyOf(model) * 100).toFixed(1)}% | ${model.parameters?.classCount ?? ''} | ${new Date(model.savedAt).toLocaleString()} |`),
    '',
    selected.length ? `Best overall: **${[...selected].sort((a, b) => accuracyOf(b) - accuracyOf(a))[0].name}**.` : 'No models selected.',
  ].join('\n'), 'text/markdown');

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Model Comparison" subtitle="Compare locally saved browser-trained models by accuracy, class count, training setup, and exportable reports." badge="Browser Trainable" category="Lab" icon={<GitCompare size={22} />} />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card title="Saved Models" subtitle="Select up to 4 models">
          <div className="space-y-2">
            {models.map(model => {
              const selectedModel = selectedIds.includes(model.id);
              return (
                <button
                  key={model.id}
                  onClick={() => toggleModel(model.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${selectedModel ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100 dark:bg-blue-950/30 dark:ring-blue-900' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'}`}
                >
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selectedModel} readOnly className="mt-1 accent-blue-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{model.name}</p>
                      <p className="text-xs text-gray-500">{model.algorithmName} · {new Date(model.savedAt).toLocaleDateString()}</p>
                      <span className="mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: colorForAccuracy(accuracyOf(model)) }}>
                        {(accuracyOf(model) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
            {!models.length && <p className="rounded border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700">Train an image, audio, pose, or object model first.</p>}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Comparison" icon={<BarChart3 size={14} />} actions={(
            <div className="flex flex-wrap gap-2">
              {(['summary', 'breakdown', 'matrices', 'report'] as Tab[]).map(item => (
                <button key={item} onClick={() => setTab(item)} className={`rounded px-3 py-1 text-xs font-bold ${tab === item ? 'bg-blue-600 text-white' : 'border border-gray-200 dark:border-gray-700'}`}>{item}</button>
              ))}
            </div>
          )}>
            {tab === 'summary' && (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 1]} tickFormatter={value => `${Math.round(Number(value) * 100)}%`} />
                    <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                    <Bar dataKey="accuracy" radius={[5, 5, 0, 0]}>
                      {chartData.map(item => <Cell key={item.name} fill={colorForAccuracy(item.accuracy)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase text-gray-500"><tr><th className="p-2">Model</th><th className="p-2">Modality</th><th className="p-2">Classes</th><th className="p-2">Samples</th><th className="p-2">Accuracy</th><th className="p-2">Epochs</th><th className="p-2">Saved</th></tr></thead>
                    <tbody>{selected.map(model => <tr key={model.id} className="border-t border-gray-100 dark:border-gray-800"><td className="p-2 font-semibold">{model.name}</td><td className="p-2">{String(model.parameters?.modality ?? model.algorithmName)}</td><td className="p-2">{String(model.parameters?.classCount ?? '')}</td><td className="p-2">{String(model.parameters?.sampleCount ?? model.parameters?.samples ?? '')}</td><td className="p-2">{(accuracyOf(model) * 100).toFixed(1)}%</td><td className="p-2">{String(model.parameters?.epochs ?? '')}</td><td className="p-2">{new Date(model.savedAt).toLocaleString()}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}
            {tab === 'breakdown' && (
              <div className="space-y-4">
                <InfoBox type="info" title="Per-Class Breakdown">Upload-driven per-class benchmarking will use the same labeled folder convention as training. For now this panel summarizes saved labels and model confidence metrics.</InfoBox>
                <div className="grid gap-3 md:grid-cols-2">
                  {selected.map(model => <div key={model.id} className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900"><p className="font-bold">{model.name}</p><p className="mt-1 text-sm text-gray-500">Labels: {Array.isArray(model.parameters?.labels) ? model.parameters.labels.join(', ') : 'not saved'}</p></div>)}
                </div>
              </div>
            )}
            {tab === 'matrices' && (
              <div className="grid gap-3 md:grid-cols-2">
                {selected.map(model => <div key={model.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"><p className="font-bold">{model.name}</p><div className="mt-3 grid grid-cols-2 gap-1 text-center text-xs"><span className="rounded bg-emerald-100 p-4 font-bold text-emerald-800">correct<br />{(accuracyOf(model) * 100).toFixed(0)}%</span><span className="rounded bg-red-100 p-4 font-bold text-red-800">errors<br />{((1 - accuracyOf(model)) * 100).toFixed(0)}%</span></div></div>)}
              </div>
            )}
            {tab === 'report' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={exportCsv} className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-3 text-sm font-bold text-white"><Download size={15} /> Download comparison CSV</button>
                <button onClick={exportReport} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-3 text-sm font-bold dark:border-gray-700"><Table2 size={15} /> Download Markdown report</button>
              </div>
            )}
          </Card>

          <Card title="Live Head-to-Head">
            <InfoBox type="warning" title="Model Artifacts">Saved metadata is available now. Live side-by-side prediction appears when the selected models include loadable IndexedDB or uploaded TFjs artifacts.</InfoBox>
          </Card>
        </div>
      </div>
    </div>
  );
}
