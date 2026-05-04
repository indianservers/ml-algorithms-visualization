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

export default function SavedExperimentsPage() {
  const [items, setItems] = React.useState<Experiment[]>([]);
  const [query, setQuery] = React.useState('');

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
