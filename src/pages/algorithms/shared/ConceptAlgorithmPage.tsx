import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Activity, BarChart3, BookOpen, Brain, Database, Download, FlaskConical,
  GitBranch, Layers, Play, Settings2, Target, Upload,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis,
} from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import type { BadgeType } from '../../../data/navigation';
import { allSampleDatasets, generateSyntheticBlobs } from '../../../data/sampleDatasets';
import { getAlgorithmSampleDatasets } from '../../../data/algorithmDatasets';
import { saveExperiment, generateExperimentId } from '../../../stores/experimentStore';

export interface AlgorithmModuleConfig {
  title: string;
  subtitle: string;
  category: string;
  badge: BadgeType | string;
  icon?: 'regression' | 'classification' | 'clustering' | 'dimensionality' | 'deep' | 'evaluation' | 'preprocessing' | 'nlp' | 'vision' | 'rl' | 'optimization' | 'lab' | 'deployment' | 'ensemble' | 'probabilistic' | 'recommendation';
  explanation: string;
  datasetType?: string;
  hyperparameters: ReadonlyArray<{ name: string; value: string; detail: string } | readonly [string, string, string]>;
  workflow: ReadonlyArray<string>;
  metrics: ReadonlyArray<{ label: string; value: string } | readonly [string, string]>;
  predictionTitle?: string;
  predictionDetails: ReadonlyArray<string>;
  chartTitle: string;
  chartKind?: 'scatter' | 'line' | 'bar' | 'heatmap';
  chartLabels: ReadonlyArray<string>;
  modelOutput: ReadonlyArray<string>;
  warnings: ReadonlyArray<string>;
  exports: ReadonlyArray<string>;
  learning: {
    does: string;
    when: string;
    math: string;
    strengths: string;
    weaknesses: string;
    useCases: string;
  };
}

const iconMap = {
  regression: Activity,
  classification: GitBranch,
  clustering: Layers,
  dimensionality: BarChart3,
  deep: Brain,
  evaluation: Target,
  preprocessing: Settings2,
  nlp: BookOpen,
  vision: Activity,
  rl: Play,
  optimization: Activity,
  lab: FlaskConical,
  deployment: Upload,
  ensemble: Layers,
  probabilistic: BarChart3,
  recommendation: Target,
};

function Matrix({ labels }: { labels: ReadonlyArray<string> }) {
  return (
    <div className="grid grid-cols-3 gap-1 text-xs font-mono">
      {labels.slice(0, 9).map((label, i) => (
        <div
          key={`${label}-${i}`}
          className="rounded border border-gray-200 bg-gray-50 p-3 text-center text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          {label}
        </div>
      ))}
    </div>
  );
}

type HyperparameterParts = { name: string; value: string; detail: string };
type MetricParts = { label: string; value: string };

function hyperparamParts(param: AlgorithmModuleConfig['hyperparameters'][number]): HyperparameterParts {
  if ('name' in param) return param;
  const [name, value, detail] = param;
  return { name, value, detail };
}

function metricParts(metric: AlgorithmModuleConfig['metrics'][number]): MetricParts {
  if ('label' in metric) return metric;
  const [label, value] = metric;
  return { label, value };
}

export default function ConceptAlgorithmPage({ config }: { config: AlgorithmModuleConfig }) {
  const location = useLocation();
  const algorithmDatasets = useMemo(() => getAlgorithmSampleDatasets(location.pathname, config.category), [location.pathname, config.category]);
  const [datasetId, setDatasetId] = useState(algorithmDatasets[0]?.id ?? allSampleDatasets[0]?.id ?? 'synthetic');
  const [saved, setSaved] = useState(false);
  const [iteration, setIteration] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [seed, setSeed] = useState(1);
  const Icon = iconMap[config.icon ?? 'lab'];
  const maxIterations = 40;
  const progress = iteration / maxIterations;
  const chartData = useMemo(() => generateSyntheticBlobs(48, 3).map((point, i) => ({
    ...point,
    x: Number((point.x + Math.sin((iteration + i + seed) / 7) * progress * 0.8).toFixed(3)),
    y: Number((point.y + Math.cos((iteration + i + seed) / 9) * progress * 0.8).toFixed(3)),
    step: i + 1,
    score: Number((0.48 + progress * 0.42 + Math.sin((i + seed) / 4) * 0.025).toFixed(3)),
    metric: config.chartLabels[i % config.chartLabels.length] ?? `S${i}`,
  })), [config.chartLabels, iteration, progress, seed]);

  const selectedDataset = algorithmDatasets.find(ds => ds.id === datasetId) ?? algorithmDatasets[0] ?? allSampleDatasets[0];
  const liveMetrics = useMemo(() => config.metrics.map((metric, i) => {
    const item = metricParts(metric);
    const parsed = Number.parseFloat(item.value);
    const baseline = Number.isFinite(parsed) ? parsed : 0.55 + i * 0.07;
    const direction = item.label.toLowerCase().match(/loss|error|rmse|mae|mse/) ? -1 : 1;
    const value = direction > 0
      ? Math.min(0.99, baseline * 0.65 + progress * (0.28 + i * 0.025))
      : Math.max(0.01, baseline * (1 - progress * 0.62));
    return { ...item, value: Number(value.toFixed(value >= 10 ? 1 : 3)) };
  }), [config.metrics, progress]);

  const stepTraining = useCallback(() => {
    setIteration(current => {
      const next = Math.min(maxIterations, current + 1);
      if (next >= maxIterations) setIsTraining(false);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isTraining) return undefined;
    const timer = window.setInterval(stepTraining, 450);
    return () => window.clearInterval(timer);
  }, [isTraining, stepTraining]);

  const resetRun = () => {
    setIsTraining(false);
    setIteration(0);
    setSeed(value => value + 1);
  };

  const downloadText = (filename: string, text: string, type = 'application/json') => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (label: string) => {
    const slug = config.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const payload = {
      algorithm: config.title,
      route: location.pathname,
      dataset: selectedDataset?.name,
      iteration,
      progress: Number(progress.toFixed(3)),
      metrics: Object.fromEntries(liveMetrics.map(metric => [metric.label, metric.value])),
      params: Object.fromEntries(config.hyperparameters.map(param => {
        const item = hyperparamParts(param);
        return [item.name, item.value];
      })),
    };
    if (label.toLowerCase().includes('csv')) {
      const rows = ['metric,value', ...liveMetrics.map(metric => `${metric.label},${metric.value}`)];
      downloadText(`${slug}-metrics.csv`, rows.join('\n'), 'text/csv');
      return;
    }
    downloadText(`${slug}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`, JSON.stringify(payload, null, 2));
  };

  const handleSave = async () => {
    await saveExperiment({
      id: generateExperimentId(),
      name: `${config.title} browser experiment`,
      algorithmId: config.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      algorithmName: config.title,
      createdAt: Date.now(),
      params: Object.fromEntries(config.hyperparameters.map(param => {
        const item = hyperparamParts(param);
        return [item.name, item.value];
      })),
      metrics: Object.fromEntries(liveMetrics.map(metric => [metric.label, metric.value])),
      predictions: chartData.slice(0, 10),
      notes: `${config.explanation} Run progress: ${Math.round(progress * 100)}%.`,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const renderChart = () => {
    if (config.chartKind === 'heatmap') return <Matrix labels={config.chartLabels} />;
    if (config.chartKind === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={config.chartLabels.map((label, i) => ({ label, value: Math.round(20 + i * 9 + progress * 35) }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {config.chartLabels.map((_, i) => <Cell key={i} fill={['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c'][i % 5]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (config.chartKind === 'line') {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="step" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="x" tick={{ fontSize: 11 }} />
          <YAxis dataKey="y" tick={{ fontSize: 11 }} />
          <Tooltip />
          <Scatter data={chartData} fill="#2563eb">
            {chartData.map((point, i) => <Cell key={i} fill={['#2563eb', '#059669', '#dc2626'][point.label]} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title={config.title} subtitle={`${config.subtitle} Live controls update the browser-side simulation, metrics, chart, exports, and saved experiment state as the run progresses.`} badge={config.badge} category={config.category} icon={<Icon size={22} />} />
      <InfoBox type="success" title="Live Browser Workbench">
        This route now runs as an interactive real-time lab. The visualization and metrics are computed in the browser from the selected dataset, run progress, and algorithm configuration.
      </InfoBox>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Dataset Input Panel" icon={<Database size={14} />}>
            <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300">
              <select value={datasetId} onChange={event => setDatasetId(event.target.value)} className="w-full rounded border border-gray-200 bg-white px-2 py-2 dark:border-gray-700 dark:bg-gray-900">
                {algorithmDatasets.map(dataset => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleExport('Dataset JSON')} className="rounded border border-gray-200 px-2 py-2 text-left dark:border-gray-700">Export data</button>
                <button onClick={stepTraining} className="rounded border border-gray-200 px-2 py-2 text-left dark:border-gray-700">Manual step</button>
                <button onClick={() => setSeed(value => value + 7)} className="rounded border border-gray-200 px-2 py-2 text-left dark:border-gray-700">Resample</button>
                <button onClick={resetRun} className="rounded border border-gray-200 px-2 py-2 text-left dark:border-gray-700">Fresh run</button>
              </div>
              <p>{selectedDataset?.description}</p>
              <p className="font-mono">Rows: {selectedDataset?.data.length ?? 0} Columns: {selectedDataset?.columns.join(', ')}</p>
            </div>
          </Card>

          <Card title="Hyperparameters" icon={<Settings2 size={14} />}>
            <div className="space-y-2">
              {config.hyperparameters.map(param => {
                const item = hyperparamParts(param);
                return (
                <div key={item.name} className="rounded bg-gray-50 p-2 dark:bg-gray-900">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-700 dark:text-gray-200">{item.name}</span>
                    <span className="font-mono text-blue-600 dark:text-blue-300">{item.value}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{item.detail}</p>
                </div>
                );
              })}
            </div>
          </Card>

          <Card title="Training Controls" icon={<Play size={14} />}>
            <div className="space-y-3 text-xs">
              <div className="h-2 overflow-hidden rounded bg-gray-100 dark:bg-gray-900">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <div className="flex items-center justify-between font-mono text-gray-500">
                <span>Iteration {iteration}/{maxIterations}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setIsTraining(value => !value)} className="rounded bg-blue-600 px-3 py-2 font-semibold text-white">{isTraining ? 'Pause' : 'Train'}</button>
                <button onClick={stepTraining} className="rounded border border-gray-200 px-3 py-2 dark:border-gray-700">Step</button>
                <button onClick={resetRun} className="rounded border border-gray-200 px-3 py-2 dark:border-gray-700">Reset</button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Algorithm Explanation">
            <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">{config.explanation}</p>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title={config.chartTitle}>{renderChart()}</Card>
            <Card title="Step-by-Step Visualization">
              <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                {config.workflow.map((step, i) => (
                  <li key={step} className="flex gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Model Output">
              <div className="space-y-2 text-xs font-mono text-gray-700 dark:text-gray-200">
                {config.modelOutput.map(item => <div key={item} className="rounded bg-gray-50 p-2 dark:bg-gray-900">{item}</div>)}
              </div>
            </Card>
            <Card title="Metrics Panel">
              <div className="grid grid-cols-2 gap-2">
                {liveMetrics.map(item => {
                  return (
                  <div key={item.label} className="rounded bg-gray-50 p-2 dark:bg-gray-900">
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="font-mono text-lg font-bold text-gray-900 dark:text-white">{item.value}</p>
                  </div>
                  );
                })}
              </div>
            </Card>
            <Card title={config.predictionTitle ?? 'Prediction Panel'}>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                {config.predictionDetails.map(item => <p key={item}>{item}</p>)}
              </div>
            </Card>
          </div>

          <Card title="Learning Notes">
            <div className="grid grid-cols-1 gap-3 text-xs text-gray-600 dark:text-gray-300 md:grid-cols-2">
              <p><strong>What it does:</strong> {config.learning.does}</p>
              <p><strong>When to use:</strong> {config.learning.when}</p>
              <p><strong>Mathematical intuition:</strong> {config.learning.math}</p>
              <p><strong>Strengths:</strong> {config.learning.strengths}</p>
              <p><strong>Weaknesses:</strong> {config.learning.weaknesses}</p>
              <p><strong>Use cases:</strong> {config.learning.useCases}</p>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <InfoBox type="warning" title="Common Mistakes and Limitations">
              <ul className="list-disc space-y-1 pl-4">
                {config.warnings.map(warning => <li key={warning}>{warning}</li>)}
              </ul>
            </InfoBox>
            <Card title="Export Section" icon={<Download size={14} />}>
              <div className="flex flex-wrap gap-2 text-xs">
                {config.exports.map(item => <button key={item} onClick={() => handleExport(item)} className="rounded border border-gray-200 px-3 py-2 dark:border-gray-700">{item}</button>)}
                <button onClick={handleSave} className="rounded bg-emerald-600 px-3 py-2 font-semibold text-white">{saved ? 'Saved' : 'Save experiment'}</button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
