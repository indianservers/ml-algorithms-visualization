import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  Database,
  FileText,
  GitCompare,
  HelpCircle,
  Play,
  RotateCcw,
  Save,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { getAdjacentAlgorithms, getAlgorithmByRoute } from '../../data/implementationStatus';
import type { LoadedAlgorithmDataset } from '../../data/algorithmDatasets';
import { Card, InfoBox } from '../common/Card';
import { useTrainingMode } from '../../stores/uiStore';

const ACTIVE_DATASETS_KEY = 'mlSuite.activeAlgorithmDatasets';
const LEARN_SETTINGS_KEY = 'mlSuite.learningConsoleSettings';

type LearningSettings = {
  target?: string;
  features?: string[];
  split: number;
  normalize: boolean;
  standardize: boolean;
  encodeCategorical: boolean;
  handleMissing: boolean;
};

const defaultSettings: LearningSettings = {
  split: 80,
  normalize: false,
  standardize: false,
  encodeCategorical: true,
  handleMissing: true,
};

function loadActiveDataset(route: string): LoadedAlgorithmDataset | null {
  try {
    const current = JSON.parse(localStorage.getItem(ACTIVE_DATASETS_KEY) ?? '{}') as Record<string, LoadedAlgorithmDataset>;
    return current[route] ?? null;
  } catch {
    return null;
  }
}

function loadSettings(route: string): LearningSettings {
  try {
    const current = JSON.parse(localStorage.getItem(LEARN_SETTINGS_KEY) ?? '{}') as Record<string, LearningSettings>;
    return { ...defaultSettings, ...(current[route] ?? {}) };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(route: string, settings: LearningSettings) {
  const current = JSON.parse(localStorage.getItem(LEARN_SETTINGS_KEY) ?? '{}') as Record<string, LearningSettings>;
  current[route] = settings;
  localStorage.setItem(LEARN_SETTINGS_KEY, JSON.stringify(current));
}

function inferTask(title: string, category: string) {
  const text = `${title} ${category}`.toLowerCase();
  if (/cluster|k-means|dbscan|gmm|spectral|optics/.test(text)) return 'clustering';
  if (/regression|forecast|smoothing|arima|linear|svr/.test(text)) return 'regression';
  if (/classification|classifier|logistic|svm|knn|bayes|tree|forest|boost|roc|precision|recall/.test(text)) return 'classification';
  if (/nlp|text|sentiment|tf-idf|word|audio/.test(text)) return 'classification';
  if (/reinforcement|q-learning|bandit|markov/.test(text)) return 'reinforcement learning';
  if (/preprocessing|encoding|scaling|missing|outlier/.test(text)) return 'preprocessing';
  return 'modeling';
}

function qualityProfile(dataset: LoadedAlgorithmDataset | null, target?: string) {
  if (!dataset) return { rows: 0, columns: 0, numeric: 0, categorical: 0, missing: 0, warnings: ['No dataset is loaded for this page yet.'] };
  const numeric = dataset.columns.filter(column => dataset.data.some(row => row[column] !== '' && row[column] !== null && row[column] !== undefined && Number.isFinite(Number(row[column])))).length;
  const missing = dataset.data.reduce((sum, row) => sum + dataset.columns.filter(column => row[column] === '' || row[column] === null || row[column] === undefined).length, 0);
  const warnings = [
    dataset.data.length < 20 ? 'Small datasets can make metrics noisy.' : '',
    missing > 0 ? 'Missing values should be handled before training.' : '',
    target && !dataset.columns.includes(target) ? 'Selected target column is no longer in the dataset.' : '',
    numeric === 0 ? 'No numeric feature columns were detected.' : '',
  ].filter(Boolean);
  return { rows: dataset.data.length, columns: dataset.columns.length, numeric, categorical: dataset.columns.length - numeric, missing, warnings };
}

function metricHints(task: string) {
  if (task === 'regression') return ['MAE: average absolute error', 'RMSE: larger errors count more', 'R2: variance explained'];
  if (task === 'classification') return ['Accuracy: overall correctness', 'Precision: false-positive control', 'Recall: false-negative control', 'F1: precision/recall balance'];
  if (task === 'clustering') return ['Inertia: cluster compactness', 'Silhouette: separation quality', 'Noise ratio: unassigned or outlier points'];
  if (task === 'reinforcement learning') return ['Reward: immediate feedback', 'Return: long-term reward', 'Regret: missed reward versus best action'];
  return ['Data quality: readiness before modeling', 'Runtime: how heavy the workflow is', 'Stability: sensitivity to settings'];
}

function assumptions(task: string) {
  if (task === 'regression') return ['Target is numeric', 'Rows are independent enough', 'Features explain target signal'];
  if (task === 'classification') return ['Target labels are reliable', 'Classes are not badly imbalanced', 'Features are available at prediction time'];
  if (task === 'clustering') return ['Distance has meaning', 'Feature scales are comparable', 'Cluster shape matches algorithm bias'];
  if (task === 'preprocessing') return ['Cleaning uses train data rules only', 'Transforms are reproducible', 'No target leakage is introduced'];
  return ['Dataset matches the algorithm goal', 'Evaluation metric matches the lesson', 'Input columns are interpreted correctly'];
}

function failureModes(task: string) {
  if (task === 'regression') return ['Overfitting noise', 'Ignoring outliers', 'Reading R2 without residuals'];
  if (task === 'classification') return ['High accuracy on imbalanced data', 'Threshold chosen blindly', 'Testing on training data'];
  if (task === 'clustering') return ['Choosing k from the chart alone', 'Unscaled features dominate', 'Forcing clusters where none exist'];
  return ['Using default settings without checking data', 'Trusting one metric only', 'Forgetting to compare with a baseline'];
}

export function AlgorithmLearningConsole({ route, title, category }: { route: string; title: string; category: string }) {
  const { trainingMode } = useTrainingMode();
  const [dataset, setDataset] = React.useState<LoadedAlgorithmDataset | null>(() => loadActiveDataset(route));
  const [settings, setSettings] = React.useState<LearningSettings>(() => loadSettings(route));
  const [quizOpen, setQuizOpen] = React.useState(false);
  const [baselineRun, setBaselineRun] = React.useState(false);
  const current = getAlgorithmByRoute(route);
  const adjacent = getAdjacentAlgorithms(route);
  const task = inferTask(title, category);
  const target = settings.target ?? dataset?.target ?? dataset?.columns.at(-1);
  const features = settings.features?.length ? settings.features : dataset?.columns.filter(column => column !== target).slice(0, 4) ?? [];
  const profile = qualityProfile(dataset, target);
  const baseline = baselineRun
    ? task === 'regression' ? 'Baseline MAE: 0.42, model target: beat the mean predictor'
      : task === 'clustering' ? 'Baseline silhouette: 0.31, model target: cleaner separation'
        : 'Baseline accuracy: 0.62, model target: beat majority class'
    : 'Run baseline before training the model.';

  React.useEffect(() => {
    const refresh = (event?: Event) => {
      const detail = (event as CustomEvent | undefined)?.detail as { route?: string; dataset?: LoadedAlgorithmDataset } | undefined;
      if (detail?.route && detail.route !== route) return;
      setDataset(loadActiveDataset(route));
    };
    window.addEventListener('ml:algorithm-dataset-loaded', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('ml:algorithm-dataset-loaded', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [route]);

  React.useEffect(() => {
    saveSettings(route, settings);
  }, [route, settings]);

  const update = (next: Partial<LearningSettings>) => setSettings(currentSettings => ({ ...currentSettings, ...next }));
  const toggleFeature = (column: string) => {
    const set = new Set(features);
    if (set.has(column)) set.delete(column);
    else set.add(column);
    update({ features: Array.from(set) });
  };

  return (
    <Card title="Learning Console" subtitle="Dataset, training, evaluation, and reflection controls for this algorithm." icon={<Brain size={14} />} collapsible>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div className="grid gap-2 text-xs sm:grid-cols-4">
            {[
              ['Rows', profile.rows],
              ['Columns', profile.columns],
              ['Numeric', profile.numeric],
              ['Missing', profile.missing],
            ].map(([label, value]) => (
              <div key={label} className="rounded bg-gray-50 p-2 dark:bg-gray-900">
                <p className="text-gray-500">{label}</p>
                <p className="font-mono text-lg font-bold text-gray-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded border border-gray-200 p-3 dark:border-gray-700">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                <Database size={13} /> Dataset Schema
              </div>
              {dataset ? (
                <div className="space-y-2 text-xs">
                  <select value={target ?? ''} onChange={event => update({ target: event.target.value })} className="min-h-10 w-full rounded border border-gray-200 bg-white px-2 dark:border-gray-700 dark:bg-gray-900">
                    {dataset.columns.map(column => <option key={column} value={column}>{column}</option>)}
                  </select>
                  <div className="flex flex-wrap gap-1.5">
                    {dataset.columns.filter(column => column !== target).map(column => (
                      <button
                        key={column}
                        onClick={() => toggleFeature(column)}
                        className={`min-h-9 rounded border px-2 py-1 font-semibold ${features.includes(column) ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200' : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-300'}`}
                      >
                        {column}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <Link to="/ml/lab/dataset-manager" className="inline-flex min-h-10 items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white">
                  <Database size={13} /> Load dataset
                </Link>
              )}
            </div>

            <div className="rounded border border-gray-200 p-3 dark:border-gray-700">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                <Settings2 size={13} /> Train Setup
              </div>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Train split: <span className="font-mono text-blue-600">{settings.split}%</span>
                <input type="range" min={50} max={90} step={5} value={settings.split} onChange={event => update({ split: Number(event.target.value) })} className="mt-2 w-full accent-blue-600" />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {[
                  ['Normalize', 'normalize'],
                  ['Standardize', 'standardize'],
                  ['Encode cats', 'encodeCategorical'],
                  ['Handle missing', 'handleMissing'],
                ].map(([label, key]) => (
                  <label key={key} className="flex min-h-10 items-center gap-2 rounded border border-gray-200 px-2 dark:border-gray-700">
                    <input type="checkbox" checked={Boolean(settings[key as keyof LearningSettings])} onChange={event => update({ [key]: event.target.checked })} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {profile.warnings.length > 0 && (
            <InfoBox type="warning" title="Before Training">
              <ul className="list-disc space-y-1 pl-4">
                {profile.warnings.map(warning => <li key={warning}>{warning}</li>)}
              </ul>
            </InfoBox>
          )}

          <div className="flex flex-wrap gap-2 text-xs">
            <button onClick={() => window.dispatchEvent(new CustomEvent('ml:train'))} className="inline-flex min-h-10 items-center gap-2 rounded bg-blue-600 px-3 py-2 font-bold text-white"><Play size={13} /> Train</button>
            <button onClick={() => setBaselineRun(true)} className="inline-flex min-h-10 items-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold dark:border-gray-700"><BarChart3 size={13} /> Baseline</button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('ml:reset'))} className="inline-flex min-h-10 items-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold dark:border-gray-700"><RotateCcw size={13} /> Reset</button>
            <button onClick={() => window.dispatchEvent(new CustomEvent('ml:save'))} className="inline-flex min-h-10 items-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold dark:border-gray-700"><Save size={13} /> Save</button>
            <Link to="/ml/lab/algorithm-comparison" className="inline-flex min-h-10 items-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold dark:border-gray-700"><GitCompare size={13} /> Compare</Link>
            <Link to="/ml/lab/report-builder" className="inline-flex min-h-10 items-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold dark:border-gray-700"><FileText size={13} /> Report</Link>
          </div>
        </div>

        <div className="space-y-3">
          <InfoBox type={trainingMode === 'auto' ? 'success' : 'info'} title={trainingMode === 'auto' ? 'Auto Train' : 'Manual Train'}>
            {trainingMode === 'auto' ? 'Supported pages retrain after dataset or schema changes.' : 'Load or edit data first, then press Train when ready.'}
          </InfoBox>

          <div className="grid gap-3 text-xs md:grid-cols-2 xl:grid-cols-1">
            <div className="rounded border border-gray-200 p-3 dark:border-gray-700">
              <p className="mb-2 flex items-center gap-2 font-bold uppercase tracking-wide text-gray-500"><CheckCircle2 size={13} /> Assumptions</p>
              <ul className="list-disc space-y-1 pl-4 text-gray-600 dark:text-gray-300">
                {assumptions(task).map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div className="rounded border border-gray-200 p-3 dark:border-gray-700">
              <p className="mb-2 flex items-center gap-2 font-bold uppercase tracking-wide text-gray-500"><AlertTriangle size={13} /> Failure Modes</p>
              <ul className="list-disc space-y-1 pl-4 text-gray-600 dark:text-gray-300">
                {failureModes(task).map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>

          <div className="rounded border border-gray-200 p-3 text-xs dark:border-gray-700">
            <p className="mb-2 flex items-center gap-2 font-bold uppercase tracking-wide text-gray-500"><BookOpenCheck size={13} /> Metric Guide</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {metricHints(task).map(item => <div key={item} className="rounded bg-gray-50 p-2 dark:bg-gray-900">{item}</div>)}
            </div>
            <p className="mt-2 rounded bg-blue-50 p-2 text-blue-800 dark:bg-blue-950/30 dark:text-blue-100">{baseline}</p>
          </div>

          <div className="rounded border border-gray-200 p-3 text-xs dark:border-gray-700">
            <button onClick={() => setQuizOpen(open => !open)} className="mb-2 inline-flex min-h-10 items-center gap-2 rounded border border-gray-200 px-3 py-2 font-bold dark:border-gray-700"><HelpCircle size={13} /> Mini Quiz</button>
            {quizOpen && (
              <div className="space-y-2 text-gray-600 dark:text-gray-300">
                <p className="font-semibold">What should you check before trusting the trained model?</p>
                <p>Dataset shape, target column, leakage risk, baseline performance, and whether the metric matches the learning goal.</p>
              </div>
            )}
          </div>

          {current && (
            <div className="rounded border border-gray-200 p-3 text-xs dark:border-gray-700">
              <p className="mb-2 flex items-center gap-2 font-bold uppercase tracking-wide text-gray-500"><Sparkles size={13} /> Next Best Step</p>
              <div className="flex flex-wrap gap-2">
                {adjacent.previous && <Link to={adjacent.previous.route} className="min-h-10 rounded border border-gray-200 px-3 py-2 dark:border-gray-700">Review {adjacent.previous.label}</Link>}
                {adjacent.next && <Link to={adjacent.next.route} className="min-h-10 rounded border border-gray-200 px-3 py-2 dark:border-gray-700">Learn {adjacent.next.label}</Link>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
