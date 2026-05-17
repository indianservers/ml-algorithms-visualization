import React from 'react';
import { Link } from 'react-router-dom';
import { Database, ExternalLink, Search, Table2 } from 'lucide-react';
import { allSampleDatasets } from '../data/sampleDatasets';
import type { Dataset } from '../data/sampleDatasets';
import { getAlgorithmDatasetSuggestions } from '../data/algorithmDatasets';
import { getAllAlgorithms } from '../data/implementationStatus';
import { Badge } from '../components/common/Badge';

type DatasetPreset = {
  dataset: Dataset;
  targetVariables: string[];
  compatibleAlgorithms: Array<{ label: string; route: string; category: string }>;
};

const typeLabels: Record<Dataset['type'], string> = {
  regression: 'Regression',
  classification: 'Classification',
  clustering: 'Clustering',
  timeSeries: 'Time Series',
  nlp: 'NLP',
  recommendation: 'Recommendation',
};

const typeUseCases: Record<Dataset['type'], string> = {
  regression: 'Predict continuous outcomes, compare residuals, and test feature importance.',
  classification: 'Train class predictors, inspect confusion matrices, ROC curves, and explainability.',
  clustering: 'Segment records, compare cluster shapes, and explore unsupervised structure.',
  timeSeries: 'Smooth trends, forecast sequential signals, and inspect anomalies over time.',
  nlp: 'Vectorize text, classify labels, and compare bag-of-words or TF-IDF behavior.',
  recommendation: 'Explore user-item preference patterns and collaborative filtering demos.',
};

const inferTarget = (dataset: Dataset) => {
  if (dataset.type === 'clustering' || dataset.type === 'recommendation') return undefined;
  return dataset.columns[dataset.columns.length - 1];
};

function buildDatasetPresets(): DatasetPreset[] {
  const algorithms = getAllAlgorithms();

  return allSampleDatasets.map(dataset => {
    const targetVariables = new Set<string>();
    const compatibleAlgorithms: DatasetPreset['compatibleAlgorithms'] = [];

    algorithms.forEach(algorithm => {
      const suggestions = getAlgorithmDatasetSuggestions(algorithm.route, algorithm.category);
      suggestions.forEach(suggestion => {
        if (suggestion.id !== dataset.id) return;
        if (suggestion.target) targetVariables.add(suggestion.target);
        compatibleAlgorithms.push({
          label: algorithm.label,
          route: algorithm.route,
          category: algorithm.category,
        });
      });
    });

    const fallbackTarget = inferTarget(dataset);
    if (targetVariables.size === 0 && fallbackTarget) targetVariables.add(fallbackTarget);

    return {
      dataset,
      targetVariables: [...targetVariables],
      compatibleAlgorithms: compatibleAlgorithms
        .filter((algorithm, index, items) => items.findIndex(item => item.route === algorithm.route) === index)
        .slice(0, 10),
    };
  });
}

export default function DatasetLibraryPage() {
  const [query, setQuery] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<'All' | Dataset['type']>('All');
  const presets = React.useMemo(() => buildDatasetPresets(), []);
  const filteredPresets = presets.filter(preset => {
    const search = query.trim().toLowerCase();
    const matchesType = typeFilter === 'All' || preset.dataset.type === typeFilter;
    const matchesSearch = !search
      || preset.dataset.name.toLowerCase().includes(search)
      || preset.dataset.description.toLowerCase().includes(search)
      || preset.dataset.columns.some(column => column.toLowerCase().includes(search))
      || preset.compatibleAlgorithms.some(algorithm => algorithm.label.toLowerCase().includes(search));
    return matchesType && matchesSearch;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 border-b border-gray-200 pb-5 dark:border-gray-800">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
          <Database size={14} />
          Dataset Presets
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-950 dark:text-white">Dataset Preset Library</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              Central index of sample datasets, target variables, use cases, columns, and compatible algorithm modules.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-lg font-bold text-gray-950 dark:text-white">{presets.length}</p>
              <p className="text-gray-500">datasets</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-lg font-bold text-gray-950 dark:text-white">{new Set(presets.map(item => item.dataset.type)).size}</p>
              <p className="text-gray-500">types</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-lg font-bold text-gray-950 dark:text-white">{presets.reduce((sum, item) => sum + item.compatibleAlgorithms.length, 0)}</p>
              <p className="text-gray-500">links</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search datasets, columns, or compatible algorithms..."
            className="min-h-11 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-blue-950"
          />
        </div>
        <select
          value={typeFilter}
          onChange={event => setTypeFilter(event.target.value as 'All' | Dataset['type'])}
          className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-blue-950"
        >
          <option value="All">All dataset types</option>
          {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="grid gap-4">
        {filteredPresets.map(({ dataset, targetVariables, compatibleAlgorithms }) => (
          <article key={dataset.id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-950 dark:text-white">{dataset.name}</h2>
                  <Badge type={typeLabels[dataset.type]} />
                </div>
                <p className="max-w-4xl text-sm leading-6 text-gray-600 dark:text-gray-300">{dataset.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-64">
                <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                  <p className="font-bold text-gray-900 dark:text-white">{dataset.data.length}</p>
                  <p className="text-gray-500">rows</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800">
                  <p className="font-bold text-gray-900 dark:text-white">{dataset.columns.length}</p>
                  <p className="text-gray-500">columns</p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
              <div className="space-y-3">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Use Cases</p>
                  <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">{typeUseCases[dataset.type]}</p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Target Variables</p>
                  <div className="flex flex-wrap gap-2">
                    {targetVariables.length > 0
                      ? targetVariables.map(target => <code key={target} className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{target}</code>)
                      : <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">Unsupervised / matrix data</span>}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Columns</p>
                  <div className="flex flex-wrap gap-1.5">
                    {dataset.columns.map(column => <code key={column} className="rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">{column}</code>)}
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <Table2 size={13} />
                  Compatible Algorithms
                </p>
                <div className="space-y-2">
                  {compatibleAlgorithms.length > 0 ? compatibleAlgorithms.map(algorithm => (
                    <Link key={algorithm.route} to={algorithm.route} className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:bg-blue-950/30">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-gray-900 dark:text-white">{algorithm.label}</span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{algorithm.category}</span>
                      </span>
                      <ExternalLink size={13} className="shrink-0 text-gray-400" />
                    </Link>
                  )) : (
                    <p className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Available from the Dataset Manager.</p>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
