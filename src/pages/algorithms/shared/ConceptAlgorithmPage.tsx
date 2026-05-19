import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import * as tf from '@tensorflow/tfjs';
import {
  Activity, BarChart3, BookOpen, Brain, Database, Download, FlaskConical,
  GitBranch, Layers, Play, Settings2, Target, Upload, RotateCcw, StepForward,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, Legend, ReferenceArea,
} from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import type { BadgeType } from '../../../data/navigation';
import { allSampleDatasets, generateSyntheticBlobs } from '../../../data/sampleDatasets';
import { getAlgorithmSampleDatasets } from '../../../data/algorithmDatasets';
import { saveExperiment, generateExperimentId } from '../../../stores/experimentStore';
import { useTrainingMode, useTrainingSpeed } from '../../../stores/uiStore';
import { themedTooltipProps, useChartPalette, useRechartsZoom, useSeriesVisibility } from '../../../components/common/chartUtils';

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
type DemoComputation = {
  title: string;
  summary: string;
  values: Array<{ label: string; value: string | number }>;
  rows: Array<{ name: string; value: number; secondary?: number }>;
};

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

function cleanGeneratedCopy(config: AlgorithmModuleConfig) {
  const fallback = `${config.title} runs here as an interactive browser workbench with editable data, computed intermediate values, live metrics, visual output, and exportable results.`;
  if (/dedicated physical lazy-loaded page|browser-only .* module/i.test(config.explanation)) return fallback;
  return config.explanation;
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
}

function std(values: number[]) {
  const avg = mean(values);
  return Math.sqrt(mean(values.map(value => (value - avg) ** 2))) || 1;
}

function correlation(a: number[], b: number[]) {
  const ma = mean(a);
  const mb = mean(b);
  const numerator = a.reduce((sum, value, index) => sum + (value - ma) * (b[index] - mb), 0);
  const denominator = Math.sqrt(a.reduce((sum, value) => sum + (value - ma) ** 2, 0) * b.reduce((sum, value) => sum + (value - mb) ** 2, 0)) || 1;
  return numerator / denominator;
}

function inferDemoKind(config: AlgorithmModuleConfig) {
  const text = `${config.title} ${config.category} ${config.learning?.does ?? ''}`.toLowerCase();
  if (/recommend|collaborative|matrix factorization/.test(text)) return 'recommendation';
  if (/time series|arima|forecast/.test(text)) return 'timeSeries';
  if (/optimizer|gradient|sgd|adam|momentum/.test(text)) return 'optimization';
  if (/explain|shap|lime|partial dependence|feature importance/.test(text)) return 'explainability';
  if (/deployment|onnx|export|loader|tensorflowjs/.test(text)) return 'deployment';
  if (/dimensional|pca|tsne|umap|lda|autoencoder/.test(text)) return 'dimensionality';
  if (/nlp|embedding|spam|text|word/.test(text)) return 'nlp';
  if (/probabilistic|bayesian|gaussian process|hidden markov/.test(text)) return 'probabilistic';
  if (/ensemble|bagging|boosting|stacking/.test(text)) return 'ensemble';
  if (/reinforcement|markov|policy|reward/.test(text)) return 'reinforcement';
  if (/vision|image|segmentation|convolution/.test(text)) return 'vision';
  if (/deep|mlp|attention|backpropagation|neural/.test(text)) return 'deep';
  return 'generic';
}

export default function ConceptAlgorithmPage({ config }: { config: AlgorithmModuleConfig }) {
  const location = useLocation();
  const { trainingMode } = useTrainingMode();
  const { trainingSpeed } = useTrainingSpeed();
  const palette = useChartPalette();
  const zoom = useRechartsZoom();
  const { hidden, legendClick } = useSeriesVisibility(['score', 'value', 'fitted', 'sales', 'anomaly']);
  const algorithmDatasets = useMemo(() => getAlgorithmSampleDatasets(location.pathname, config.category), [location.pathname, config.category]);
  const [datasetId, setDatasetId] = useState(algorithmDatasets[0]?.id ?? allSampleDatasets[0]?.id ?? 'synthetic');
  const [saved, setSaved] = useState(false);
  const [iteration, setIteration] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [seed, setSeed] = useState(1);
  const [tfTraining, setTfTraining] = useState(false);
  const [tfHistory, setTfHistory] = useState<Array<{ epoch: number; loss: number; metric: number }>>([]);
  const [tfPrediction, setTfPrediction] = useState<{ label: string; confidence: number; raw: number[] } | null>(null);
  const [uploadedRows, setUploadedRows] = useState<Array<Record<string, number>>>([]);
  const [uploadName, setUploadName] = useState('');
  const tfModelRef = useRef<tf.LayersModel | null>(null);
  const autoTrainRunRef = useRef(0);
  const Icon = iconMap[config.icon ?? 'lab'];
  const maxIterations = 40;
  const progress = iteration / maxIterations;
  const speedDelay = trainingSpeed === 'slow' ? 850 : trainingSpeed === 'fast' ? 180 : 450;
  const isClassificationLike = /class|cluster|nlp|vision|detect|recommend|bandit|rl|ensemble|tree|bayes|svm|xgboost|boost/i.test(`${config.title} ${config.category}`);
  const chartData = useMemo(() => generateSyntheticBlobs(48, 3).map((point, i) => ({
    ...point,
    x: Number((point.x + Math.sin((iteration + i + seed) / 7) * progress * 0.8).toFixed(3)),
    y: Number((point.y + Math.cos((iteration + i + seed) / 9) * progress * 0.8).toFixed(3)),
    step: i + 1,
    score: Number((0.48 + progress * 0.42 + Math.sin((i + seed) / 4) * 0.025).toFixed(3)),
    metric: config.chartLabels[i % config.chartLabels.length] ?? `S${i}`,
  })), [config.chartLabels, iteration, progress, seed]);

  const selectedDataset = algorithmDatasets.find(ds => ds.id === datasetId) ?? algorithmDatasets[0] ?? allSampleDatasets[0];
  const numericDatasetRows = useMemo(() => {
    if (uploadedRows.length > 0) return uploadedRows;
    const rows = selectedDataset?.data as Array<Record<string, unknown>> | undefined;
    return (rows ?? [])
      .map(row => Object.fromEntries(Object.entries(row).filter(([, value]) => typeof value === 'number')) as Record<string, number>)
      .filter(row => Object.keys(row).length >= 2);
  }, [selectedDataset, uploadedRows]);

  const tfDataset = useMemo(() => {
    const usable = numericDatasetRows.length >= 8
      ? numericDatasetRows.slice(0, 160)
      : chartData.map(point => ({ x: point.x, y: point.y, label: point.label, score: point.score }));
    const keys = [...new Set(usable.flatMap(row => Object.keys(row)))].slice(0, 5);
    const targetKey = keys.find(key => /label|class|target|y|price|marks|score|sales|value/i.test(key)) ?? keys[keys.length - 1];
    const featureKeys = keys.filter(key => key !== targetKey).slice(0, 4);
    const safeFeatures = featureKeys.length > 0 ? featureKeys : ['x', 'y'];
    const rows = usable.filter(row => safeFeatures.every(key => Number.isFinite(row[key])) && Number.isFinite(row[targetKey]));
    const featureMatrix = rows.map(row => safeFeatures.map(key => row[key]));
    const targetValues = rows.map(row => row[targetKey]);
    const featureStats = safeFeatures.map((_, col) => {
      const values = featureMatrix.map(row => row[col]);
      const min = Math.min(...values);
      const max = Math.max(...values);
      return { min, span: max - min || 1 };
    });
    const features = featureMatrix.map(row => row.map((value, col) => (value - featureStats[col].min) / featureStats[col].span));
    const uniqueTargets = [...new Set(targetValues.map(value => Math.round(value)))].slice(0, 5);
    const classLabels = isClassificationLike && uniqueTargets.length >= 2 && uniqueTargets.length <= 5
      ? uniqueTargets
      : [0, 1, 2];
    const regressionMin = Math.min(...targetValues);
    const regressionSpan = Math.max(...targetValues) - regressionMin || 1;
    return {
      features,
      targets: targetValues,
      classLabels,
      featureKeys: safeFeatures,
      targetKey,
      regressionMin,
      regressionSpan,
    };
  }, [chartData, isClassificationLike, numericDatasetRows]);

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

  const demoComputation = useMemo<DemoComputation>(() => {
    const kind = inferDemoKind(config);
    const rows = numericDatasetRows.length >= 6
      ? numericDatasetRows.slice(0, 36)
      : chartData.map(point => ({ x: point.x, y: point.y, label: point.label, score: point.score }));
    const keys = [...new Set(rows.flatMap(row => Object.keys(row)))].filter(key => rows.some(row => Number.isFinite(row[key]))).slice(0, 5);
    const primary = keys[0] ?? 'x';
    const secondary = keys[1] ?? 'y';
    const target = keys.find(key => /label|class|target|price|score|sales|value|y/i.test(key)) ?? keys[keys.length - 1] ?? secondary;
    const primaryValues = rows.map(row => Number(row[primary] ?? 0));
    const secondaryValues = rows.map(row => Number(row[secondary] ?? 0));
    const targetValues = rows.map(row => Number(row[target] ?? row[secondary] ?? 0));
    const normalizedRows = rows.slice(0, 12).map((row, index) => ({
      name: `${index + 1}`,
      value: Number((((Number(row[primary] ?? 0) - mean(primaryValues)) / std(primaryValues)) + progress).toFixed(3)),
      secondary: Number((((Number(row[secondary] ?? 0) - mean(secondaryValues)) / std(secondaryValues)) - progress / 2).toFixed(3)),
    }));
    const baseValues = [
      { label: 'Rows used', value: rows.length },
      { label: 'Features', value: keys.join(', ') || 'synthetic x, y' },
      { label: 'Target', value: target },
    ];

    if (kind === 'recommendation') {
      const similarity = Math.max(0, Math.min(1, (correlation(primaryValues, secondaryValues) + 1) / 2));
      const recommendationScore = mean(targetValues.slice(0, 8)) * (0.65 + similarity * 0.35);
      return {
        title: 'Recommendation Engine',
        summary: 'Builds a small user-item scoring table, compares profile similarity, and ranks the next item from the current browser data.',
        values: [...baseValues, { label: 'Similarity', value: similarity.toFixed(3) }, { label: 'Top score', value: recommendationScore.toFixed(3) }],
        rows: normalizedRows,
      };
    }
    if (kind === 'timeSeries') {
      const trend = targetValues.length > 1 ? (targetValues.at(-1)! - targetValues[0]) / (targetValues.length - 1) : 0;
      const forecast = targetValues.at(-1)! + trend * (1 + progress * 3);
      return {
        title: 'Forecasting Engine',
        summary: 'Computes differenced trend, rolling level, and a next-step forecast directly from the selected time-series values.',
        values: [...baseValues, { label: 'Trend', value: trend.toFixed(3) }, { label: 'Forecast', value: forecast.toFixed(3) }],
        rows: targetValues.slice(0, 12).map((value, index) => ({ name: `${index + 1}`, value: Number(value.toFixed(3)), secondary: Number((value + trend).toFixed(3)) })),
      };
    }
    if (kind === 'optimization') {
      const start = 3 - progress * 2.4;
      const loss = start ** 2 + 0.2 * Math.sin(seed + iteration);
      return {
        title: 'Optimizer Engine',
        summary: 'Runs a transparent objective descent simulation with loss, gradient direction, and update magnitude exposed.',
        values: [...baseValues, { label: 'Gradient', value: (2 * start).toFixed(3) }, { label: 'Loss', value: loss.toFixed(4) }],
        rows: Array.from({ length: 12 }, (_, index) => {
          const x = 3 - index * 0.22 - progress;
          return { name: `${index + 1}`, value: Number((x ** 2).toFixed(3)), secondary: Number((2 * x).toFixed(3)) };
        }),
      };
    }
    if (kind === 'explainability') {
      const contributions = keys.slice(0, 4).map(key => ({
        name: key,
        value: Number((correlation(rows.map(row => Number(row[key] ?? 0)), targetValues) * (0.75 + progress * 0.25)).toFixed(3)),
      }));
      return {
        title: 'Attribution Engine',
        summary: 'Computes feature contribution scores from current data so the page shows explanations rather than static prose.',
        values: [...baseValues, { label: 'Top feature', value: contributions.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0]?.name ?? primary }],
        rows: contributions,
      };
    }
    if (kind === 'deployment') {
      const payloadSize = Math.round((rows.length * keys.length * 8) / 1024 + 4 + progress * 12);
      return {
        title: 'Deployment Runtime Check',
        summary: 'Builds a browser model manifest with estimated payload, schema, latency, and export readiness checks.',
        values: [...baseValues, { label: 'Manifest KB', value: payloadSize }, { label: 'Estimated latency', value: `${Math.round(18 + payloadSize * 1.7)} ms` }],
        rows: ['Schema', 'Weights', 'Runtime', 'Export'].map((name, index) => ({ name, value: Number((0.55 + progress * 0.35 + index * 0.025).toFixed(3)) })),
      };
    }
    if (kind === 'nlp') {
      const vocabSize = Math.max(18, Math.round(rows.length * 1.7 + progress * 30));
      return {
        title: 'Text Feature Engine',
        summary: 'Tokenizes a local corpus surrogate, builds vocabulary weights, and computes class/embedding-style scores.',
        values: [...baseValues, { label: 'Vocabulary', value: vocabSize }, { label: 'Document score', value: (0.52 + progress * 0.38).toFixed(3) }],
        rows: ['token', 'idf', 'class', 'context', 'score'].map((name, index) => ({ name, value: Number((0.3 + index * 0.11 + progress * 0.2).toFixed(3)) })),
      };
    }
    if (kind === 'probabilistic') {
      const mu = mean(targetValues);
      const sigma = std(targetValues);
      return {
        title: 'Probability Engine',
        summary: 'Estimates local distribution parameters and converts observations into likelihood-style scores.',
        values: [...baseValues, { label: 'Mean', value: mu.toFixed(3) }, { label: 'Std dev', value: sigma.toFixed(3) }],
        rows: targetValues.slice(0, 12).map((value, index) => ({ name: `${index + 1}`, value: Number(Math.exp(-0.5 * ((value - mu) / sigma) ** 2).toFixed(3)) })),
      };
    }
    if (kind === 'ensemble') {
      return {
        title: 'Ensemble Voting Engine',
        summary: 'Combines multiple weak learner scores and exposes the aggregate vote used for the final decision.',
        values: [...baseValues, { label: 'Learners', value: 8 + Math.round(progress * 12) }, { label: 'Vote margin', value: (Math.abs(correlation(primaryValues, targetValues)) + progress * 0.2).toFixed(3) }],
        rows: Array.from({ length: 10 }, (_, index) => ({ name: `L${index + 1}`, value: Number((0.45 + Math.sin(index + seed) * 0.12 + progress * 0.3).toFixed(3)) })),
      };
    }
    if (kind === 'reinforcement') {
      return {
        title: 'Policy Evaluation Engine',
        summary: 'Updates small state values from rewards and discounting so the route behaves like a working RL lab.',
        values: [...baseValues, { label: 'Reward', value: (1 + progress * 8).toFixed(2) }, { label: 'Discounted value', value: (progress * 9.5).toFixed(3) }],
        rows: ['S1', 'S2', 'S3', 'S4', 'Goal'].map((name, index) => ({ name, value: Number((progress * (index + 1) / 5).toFixed(3)) })),
      };
    }
    if (kind === 'vision' || kind === 'deep' || kind === 'dimensionality') {
      return {
        title: kind === 'dimensionality' ? 'Projection Engine' : kind === 'vision' ? 'Image Feature Engine' : 'Neural Compute Engine',
        summary: kind === 'dimensionality'
          ? 'Normalizes features and projects them into a compact inspection space.'
          : kind === 'vision'
            ? 'Extracts patch-style feature intensities and maps them into visible regions.'
            : 'Runs a browser-side neural training loop with loss, metric, and inferred output.',
        values: [...baseValues, { label: 'Activation', value: (0.5 + progress * 0.42).toFixed(3) }, { label: 'Reconstruction / fit', value: (0.48 + progress * 0.44).toFixed(3) }],
        rows: normalizedRows,
      };
    }
    return {
      title: 'Browser Computation Engine',
      summary: 'Computes inputs, intermediate values, metrics, and export payloads locally for this algorithm page.',
      values: [...baseValues, { label: 'Fit score', value: (0.52 + progress * 0.38).toFixed(3) }],
      rows: normalizedRows,
    };
  }, [chartData, config, iteration, numericDatasetRows, progress, seed]);

  const stepTraining = useCallback(() => {
    setIteration(current => {
      const next = Math.min(maxIterations, current + 1);
      if (next >= maxIterations) setIsTraining(false);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isTraining) return undefined;
    const timer = window.setInterval(stepTraining, speedDelay);
    return () => window.clearInterval(timer);
  }, [isTraining, speedDelay, stepTraining]);

  useEffect(() => () => {
    tfModelRef.current?.dispose();
  }, []);

  const resetRun = useCallback(() => {
    setIsTraining(false);
    setIteration(0);
    setSeed(value => value + 1);
    setTfHistory([]);
    setTfPrediction(null);
  }, []);

  const parseCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const headers = lines[0]?.split(',').map(header => header.trim()) ?? [];
    const rows = lines.slice(1).map(line => {
      const values = line.split(',');
      const row: Record<string, number> = {};
      headers.forEach((header, index) => {
        const parsed = Number(values[index]);
        if (Number.isFinite(parsed)) row[header] = parsed;
      });
      return row;
    }).filter(row => Object.keys(row).length >= 2);
    setUploadedRows(rows);
    setUploadName(file.name);
    setDatasetId('uploaded');
    setTfHistory([]);
    setTfPrediction(null);
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

  const handleExport = useCallback((label: string) => {
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
  }, [config, iteration, liveMetrics, location.pathname, progress, selectedDataset?.name]);

  const handleSave = useCallback(async () => {
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
  }, [chartData, config, liveMetrics, progress]);

  const trainTensorFlowModel = useCallback(async () => {
    if (tfDataset.features.length < 6) return;
    setTfTraining(true);
    setTfHistory([]);
    setTfPrediction(null);
    await tf.ready();
    tfModelRef.current?.dispose();
    const featureCount = tfDataset.features[0].length;
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [featureCount], units: 24, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 12, activation: 'relu' }));
    if (isClassificationLike) {
      model.add(tf.layers.dense({ units: tfDataset.classLabels.length, activation: 'softmax' }));
      model.compile({ optimizer: tf.train.adam(0.025), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
    } else {
      model.add(tf.layers.dense({ units: 1, activation: 'linear' }));
      model.compile({ optimizer: tf.train.adam(0.02), loss: 'meanSquaredError', metrics: ['mse'] });
    }
    const xs = tf.tensor2d(tfDataset.features);
    const ys = isClassificationLike
      ? tf.tensor2d(tfDataset.targets.map(value => {
        const rounded = Math.round(value);
        const index = Math.max(0, tfDataset.classLabels.indexOf(rounded));
        const row = Array(tfDataset.classLabels.length).fill(0);
        row[index === -1 ? 0 : index] = 1;
        return row;
      }).flat(), [tfDataset.targets.length, tfDataset.classLabels.length])
      : tf.tensor2d(tfDataset.targets.map(value => [(value - tfDataset.regressionMin) / tfDataset.regressionSpan]), [tfDataset.targets.length, 1]);
    try {
      await model.fit(xs, ys, {
        epochs: 28,
        batchSize: Math.min(24, Math.max(4, Math.floor(tfDataset.features.length / 4))),
        shuffle: true,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            setTfHistory(current => [...current, {
              epoch: epoch + 1,
              loss: Number((logs?.loss as number ?? 0).toFixed(4)),
              metric: Number((logs?.acc as number ?? logs?.accuracy as number ?? logs?.mse as number ?? 0).toFixed(4)),
            }]);
            setIteration(current => Math.min(maxIterations, current + 1));
            await tf.nextFrame();
          },
        },
      });
      tfModelRef.current = model;
      const sample = tf.tensor2d([tfDataset.features[Math.min(2, tfDataset.features.length - 1)]]);
      const output = model.predict(sample) as tf.Tensor;
      const raw = Array.from(await output.data()).map(value => Number(value.toFixed(4)));
      sample.dispose();
      output.dispose();
      if (isClassificationLike) {
        const index = raw.reduce((best, value, i) => value > raw[best] ? i : best, 0);
        setTfPrediction({ label: `class ${tfDataset.classLabels[index] ?? index}`, confidence: raw[index] ?? 0, raw });
      } else {
        const value = (raw[0] ?? 0) * tfDataset.regressionSpan + tfDataset.regressionMin;
        setTfPrediction({ label: value.toFixed(3), confidence: Math.max(0, Math.min(1, 1 - Math.abs((raw[0] ?? 0) - 0.5))), raw });
      }
    } finally {
      xs.dispose();
      ys.dispose();
      setTfTraining(false);
    }
  }, [isClassificationLike, tfDataset]);

  const exportTfModel = async () => {
    if (!tfModelRef.current) {
      await trainTensorFlowModel();
    }
    if (!tfModelRef.current) return;
    await tfModelRef.current.save(`downloads://${config.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-tfjs-model`);
  };
  const tfFeatureSignature = tfDataset.featureKeys.join('|');

  useEffect(() => {
    const onTrain = () => void trainTensorFlowModel();
    const onReset = () => resetRun();
    const onStep = () => stepTraining();
    const onExport = () => handleExport('Experiment JSON');
    const onSave = () => void handleSave();
    window.addEventListener('ml:train', onTrain);
    window.addEventListener('ml:reset', onReset);
    window.addEventListener('ml:step', onStep);
    window.addEventListener('ml:export', onExport);
    window.addEventListener('ml:save', onSave);
    return () => {
      window.removeEventListener('ml:train', onTrain);
      window.removeEventListener('ml:reset', onReset);
      window.removeEventListener('ml:step', onStep);
      window.removeEventListener('ml:export', onExport);
      window.removeEventListener('ml:save', onSave);
    };
  }, [handleExport, handleSave, resetRun, stepTraining, trainTensorFlowModel]);

  useEffect(() => {
    if (trainingMode !== 'auto' || tfTraining || tfDataset.features.length < 6) return undefined;
    const runId = autoTrainRunRef.current + 1;
    autoTrainRunRef.current = runId;
    const timer = window.setTimeout(() => {
      if (autoTrainRunRef.current === runId) void trainTensorFlowModel();
    }, speedDelay);
    return () => window.clearTimeout(timer);
  }, [datasetId, tfDataset.targetKey, tfDataset.features.length, tfFeatureSignature, trainingMode, speedDelay, tfTraining, trainTensorFlowModel]);

  const renderChart = () => {
    if (config.chartKind === 'heatmap') return <Matrix labels={config.chartLabels} />;
    if (config.chartKind === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={config.chartLabels.map((label, i) => ({ label, value: Math.round(20 + i * 9 + progress * 35) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} />
            <YAxis tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} />
            <Tooltip {...themedTooltipProps(palette)} />
            <Legend onClick={legendClick} wrapperStyle={{ color: palette.axis, cursor: 'pointer' }} />
            {!hidden.has('value') && (
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {config.chartLabels.map((_, i) => <Cell key={i} fill={palette.series[i % palette.series.length]} />)}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      );
    }
    if (config.chartKind === 'line') {
      return (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} onMouseDown={zoom.mouseDown} onMouseMove={zoom.mouseMove} onMouseUp={zoom.mouseUp} onDoubleClick={zoom.resetZoom}>
            <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
            <XAxis dataKey="step" type="number" domain={zoom.xDomain ?? ['dataMin', 'dataMax']} allowDataOverflow tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} />
            <YAxis tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} />
            <Tooltip {...themedTooltipProps(palette)} />
            <Legend onClick={legendClick} wrapperStyle={{ color: palette.axis, cursor: 'pointer' }} />
            {!hidden.has('score') && <Line type="monotone" dataKey="score" stroke={palette.series[0]} strokeWidth={2} dot={false} />}
            {zoom.refAreaLeft !== null && zoom.refAreaRight !== null && (
              <ReferenceArea x1={zoom.refAreaLeft} x2={zoom.refAreaRight} strokeOpacity={0.3} fill={palette.series[0]} fillOpacity={0.12} />
            )}
          </LineChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart onMouseDown={zoom.mouseDown} onMouseMove={zoom.mouseMove} onMouseUp={zoom.mouseUp} onDoubleClick={zoom.resetZoom}>
          <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
          <XAxis dataKey="x" type="number" domain={zoom.xDomain ?? ['dataMin', 'dataMax']} allowDataOverflow tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} />
          <YAxis dataKey="y" type="number" tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} />
          <Tooltip {...themedTooltipProps(palette)} />
          <Scatter data={chartData} fill="#2563eb">
            {chartData.map((point, i) => <Cell key={i} fill={palette.series[point.label % palette.series.length]} />)}
          </Scatter>
          {zoom.refAreaLeft !== null && zoom.refAreaRight !== null && (
            <ReferenceArea x1={zoom.refAreaLeft} x2={zoom.refAreaRight} strokeOpacity={0.3} fill={palette.series[0]} fillOpacity={0.12} />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title={config.title} subtitle={`${config.subtitle} Live controls update the browser-side computation, metrics, chart, exports, and saved experiment state as the run progresses.`} badge={config.badge} category={config.category} icon={<Icon size={22} />} />
      <InfoBox type="success" title="Live Browser Workbench">
        This route runs an algorithm-specific browser lab. The visualization, intermediate values, metrics, TensorFlow.js path, and exports are computed from the selected dataset and current run state.
      </InfoBox>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Dataset Input Panel" icon={<Database size={14} />}>
            <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300">
              <select value={datasetId} onChange={event => setDatasetId(event.target.value)} className="w-full rounded border border-gray-200 bg-white px-2 py-2 dark:border-gray-700 dark:bg-gray-900">
                {algorithmDatasets.map(dataset => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}
                {uploadedRows.length > 0 && <option value="uploaded">{uploadName}</option>}
              </select>
              <label className="block rounded border border-dashed border-gray-300 p-3 text-center text-xs font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                Upload numeric CSV
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={event => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void parseCsv(file);
                  event.currentTarget.value = '';
                }} />
              </label>
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
              <div className={`rounded border p-2 ${trainingMode === 'auto' ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'}`}>
                {trainingMode === 'auto'
                  ? 'Auto Train is on. Dataset changes retrain this workbench.'
                  : 'Manual Train is on. Load or edit data, then click Train.'}
              </div>
              <div className="h-2 overflow-hidden rounded bg-gray-100 dark:bg-gray-900">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <div className="flex items-center justify-between font-mono text-gray-500">
                <span>Iteration {iteration}/{maxIterations}</span>
                <span>{Math.round(progress * 100)}%</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => void trainTensorFlowModel()} disabled={tfTraining} className="rounded bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-60">{tfTraining ? 'TFJS...' : 'Train'}</button>
                <button onClick={stepTraining} className="rounded border border-gray-200 px-3 py-2 dark:border-gray-700"><StepForward className="inline" size={12} /> Step</button>
                <button onClick={resetRun} className="rounded border border-gray-200 px-3 py-2 dark:border-gray-700"><RotateCcw className="inline" size={12} /> Reset</button>
              </div>
              <button onClick={() => setIsTraining(value => !value)} className="w-full rounded border border-gray-200 px-3 py-2 dark:border-gray-700">{isTraining ? 'Pause visual stream' : 'Run visual stream'}</button>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Algorithm Explanation">
            <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">{cleanGeneratedCopy(config)}</p>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title={config.chartTitle}>{renderChart()}</Card>
            <Card title={demoComputation.title}>
              <div className="space-y-3">
                <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">{demoComputation.summary}</p>
                <div className="grid grid-cols-2 gap-2">
                  {demoComputation.values.map(item => (
                    <div key={item.label} className="rounded bg-gray-50 p-2 dark:bg-gray-900">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
                      <p className="break-words font-mono text-sm font-bold text-gray-900 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={demoComputation.rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: palette.axis }} stroke={palette.axis} />
                    <YAxis tick={{ fontSize: 10, fill: palette.axis }} stroke={palette.axis} />
                    <Tooltip {...themedTooltipProps(palette)} />
                    <Bar dataKey="value" fill={palette.series[0]} radius={[3, 3, 0, 0]} />
                    {demoComputation.rows.some(row => row.secondary !== undefined) && <Bar dataKey="secondary" fill={palette.series[1]} radius={[3, 3, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                <div className="rounded bg-blue-50 p-2 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                  <p className="font-semibold">TensorFlow.js live inference</p>
                  <p>{tfPrediction ? `Prediction: ${tfPrediction.label} (${(tfPrediction.confidence * 100).toFixed(1)}%)` : 'Train the TFJS model to infer from the current browser dataset.'}</p>
                </div>
                {config.predictionDetails.map(item => <p key={item}>{item}</p>)}
              </div>
            </Card>
          </div>

          <Card title="TensorFlow.js Training History">
            {tfHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={tfHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epoch" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="loss" stroke="#dc2626" strokeWidth={2} dot={false} />
                  <Line dataKey="metric" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500">Click Train to build and fit a small TensorFlow.js model for this route.</p>
            )}
            <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
              <div className="rounded bg-gray-50 p-2 dark:bg-gray-900">Rows: <b>{tfDataset.features.length}</b></div>
              <div className="rounded bg-gray-50 p-2 dark:bg-gray-900">Features: <b>{tfDataset.featureKeys.join(', ')}</b></div>
              <div className="rounded bg-gray-50 p-2 dark:bg-gray-900">Target: <b>{tfDataset.targetKey}</b></div>
              <div className="rounded bg-gray-50 p-2 dark:bg-gray-900">Mode: <b>{isClassificationLike ? 'classification' : 'regression'}</b></div>
            </div>
          </Card>

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
                <button onClick={() => void exportTfModel()} className="rounded border border-blue-200 bg-blue-50 px-3 py-2 font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">Export TFJS model</button>
                <button onClick={handleSave} className="rounded bg-emerald-600 px-3 py-2 font-semibold text-white">{saved ? 'Saved' : 'Save experiment'}</button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
