import type { LoadedAlgorithmDataset } from '../../data/algorithmDatasets';
import { profileDataset, type DatasetProfile } from './dataProfile';

type DatasetType = NonNullable<LoadedAlgorithmDataset['type']>;
type TaskKind =
  | 'classification'
  | 'regression'
  | 'clustering'
  | 'dimensionality'
  | 'timeSeries'
  | 'nlp'
  | 'recommendation'
  | 'reinforcement'
  | 'vision'
  | 'general';

export interface DatasetCompatibilityResult {
  errors: string[];
  warnings: string[];
  notes: string[];
  expectedTask: TaskKind;
  profile: DatasetProfile;
}

const NUMERIC_TARGET_TASKS: TaskKind[] = ['regression', 'timeSeries'];
const SUPERVISED_TASKS: TaskKind[] = ['classification', 'regression', 'nlp', 'vision'];

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function inferTask(route: string, category: string): TaskKind {
  const text = normalize(`${route} ${category}`);
  if (text.includes('recommendation') || text.includes('matrix factorization') || text.includes('collaborative')) return 'recommendation';
  if (text.includes('reinforcement') || text.includes('q learning') || text.includes('bandit') || text.includes('markov decision')) return 'reinforcement';
  if (text.includes('time series') || text.includes('arima') || text.includes('holt') || text.includes('forecast') || text.includes('moving average')) return 'timeSeries';
  if (text.includes('nlp') || text.includes('text') || text.includes('sentiment') || text.includes('spam') || text.includes('word')) return 'nlp';
  if (text.includes('computer vision') || text.includes('image') || text.includes('cnn') || text.includes('edge') || text.includes('segmentation')) return 'vision';
  if (text.includes('dimensionality') || text.includes('pca') || text.includes('tsne') || text.includes('umap') || text.includes('lda')) return 'dimensionality';
  if (text.includes('clustering') || text.includes('k means') || text.includes('dbscan') || text.includes('gaussian mixture') || text.includes('optics')) return 'clustering';
  if (text.includes('regression') || text.includes('svr') || text.includes('regression metrics')) return 'regression';
  if (text.includes('classification') || text.includes('classifier') || text.includes('logistic') || text.includes('confusion') || text.includes('roc') || text.includes('precision recall')) return 'classification';
  return 'general';
}

function compatibleTypesFor(task: TaskKind): DatasetType[] {
  switch (task) {
    case 'regression':
      return ['regression', 'timeSeries', 'synthetic'];
    case 'classification':
    case 'nlp':
    case 'vision':
      return ['classification', 'nlp', 'synthetic'];
    case 'clustering':
    case 'dimensionality':
      return ['clustering', 'classification', 'recommendation', 'synthetic'];
    case 'timeSeries':
      return ['timeSeries', 'synthetic'];
    case 'recommendation':
      return ['recommendation', 'synthetic'];
    case 'reinforcement':
      return ['synthetic'];
    default:
      return ['classification', 'regression', 'clustering', 'timeSeries', 'nlp', 'recommendation', 'synthetic'];
  }
}

function minimumRowsFor(task: TaskKind) {
  switch (task) {
    case 'clustering':
    case 'dimensionality':
      return { error: 8, warning: 20 };
    case 'timeSeries':
      return { error: 6, warning: 12 };
    case 'recommendation':
    case 'reinforcement':
      return { error: 6, warning: 15 };
    case 'nlp':
    case 'vision':
      return { error: 8, warning: 16 };
    case 'classification':
    case 'regression':
      return { error: 8, warning: 12 };
    default:
      return { error: 4, warning: 8 };
  }
}

function numericColumnsExcludingTarget(profile: DatasetProfile, target?: string) {
  return profile.numericColumns.filter(column => column !== target);
}

function hasColumns(columns: string[], expected: string[]) {
  const lower = new Set(columns.map(column => column.toLowerCase()));
  return expected.every(column => lower.has(column));
}

function findTextColumns(profile: DatasetProfile) {
  return profile.columnsProfile
    .filter(column => column.type === 'categorical' && /text|review|message|body|content|sentence|title/i.test(column.name))
    .map(column => column.name);
}

function targetValues(dataset: LoadedAlgorithmDataset) {
  if (!dataset.target) return [];
  return dataset.data
    .map(row => row[dataset.target as string])
    .filter(value => value !== null && value !== undefined && value !== '');
}

function classCounts(values: unknown[]) {
  return Array.from(
    values.reduce<Map<string, number>>((map, value) => {
      const key = String(value);
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  );
}

export function checkDatasetCompatibility(
  dataset: LoadedAlgorithmDataset,
  route: string,
  category: string,
): DatasetCompatibilityResult {
  const task = inferTask(route, category);
  const profile = profileDataset(dataset.data, dataset.target);
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const minimumRows = minimumRowsFor(task);
  const numericFeatures = numericColumnsExcludingTarget(profile, dataset.target);
  const targetColumn = dataset.target ? profile.columnsProfile.find(column => column.name === dataset.target) : undefined;
  const values = targetValues(dataset);

  if (profile.rows < minimumRows.error) {
    errors.push(`Only ${profile.rows} rows found. ${task} demos need at least ${minimumRows.error} rows to train safely.`);
  } else if (profile.rows < minimumRows.warning) {
    warnings.push(`${profile.rows} rows is small for ${task}. Results may swing a lot between runs.`);
  }

  if (dataset.type && !compatibleTypesFor(task).includes(dataset.type)) {
    warnings.push(`This looks like a ${dataset.type} dataset, while this page expects ${task} data.`);
  }

  if (SUPERVISED_TASKS.includes(task)) {
    if (!dataset.target) {
      errors.push('No label/target column is selected. Supervised algorithms need known answers for training.');
    } else if (!targetColumn) {
      errors.push(`Target column "${dataset.target}" was not found in the dataset.`);
    }
  }

  if (dataset.target && NUMERIC_TARGET_TASKS.includes(task) && targetColumn && targetColumn.type !== 'numeric') {
    errors.push(`Target "${dataset.target}" should be numeric for ${task} training.`);
  }

  if (dataset.target && (task === 'classification' || task === 'nlp' || task === 'vision')) {
    const counts = classCounts(values);
    if (counts.length < 2) {
      errors.push(`Target "${dataset.target}" needs at least two classes.`);
    } else {
      const sizes = counts.map(([, count]) => count).sort((a, b) => a - b);
      const minority = sizes[0];
      const majority = sizes[sizes.length - 1];
      if (minority < 3 || majority / Math.max(1, minority) >= 4) {
        warnings.push(`Class balance is uneven: smallest class has ${minority} row(s), largest has ${majority}.`);
      }
    }
  }

  if ((task === 'classification' || task === 'regression') && numericFeatures.length < 1) {
    errors.push('At least one numeric feature column is needed for browser-side training.');
  }

  if ((task === 'clustering' || task === 'dimensionality') && numericFeatures.length < 2) {
    errors.push(`${task} pages need at least two numeric columns to show distances or projections.`);
  }

  if (task === 'timeSeries') {
    if (!profile.numericColumns.length) errors.push('Time-series pages need at least one numeric value column.');
    if (!/date|time|day|month|step|trial/i.test(dataset.columns.join(' '))) {
      warnings.push('No obvious date, time, or step column was found for sequence ordering.');
    }
  }

  if (task === 'nlp' && !findTextColumns(profile).length) {
    warnings.push('No obvious text column was found. NLP pages work best with review, message, text, or content fields.');
  }

  if (task === 'recommendation' && !hasColumns(dataset.columns, ['user_id', 'item_id', 'rating'])) {
    warnings.push('Recommendation pages work best with user_id, item_id, and rating columns.');
  }

  if (task === 'reinforcement' && !hasColumns(dataset.columns, ['state', 'action', 'reward']) && !hasColumns(dataset.columns, ['trial', 'arm', 'reward'])) {
    warnings.push('Reinforcement demos expect state/action/reward transitions or trial/arm/reward bandit logs.');
  }

  if (profile.missing > 0) {
    warnings.push(`${profile.missing} missing value(s) detected. Fill or drop them before comparing model scores.`);
  }

  const idColumns = profile.columnsProfile.filter(column => column.likelyId).map(column => column.name);
  if (idColumns.length > 0) {
    warnings.push(`Likely ID column(s) detected: ${idColumns.slice(0, 3).join(', ')}. IDs can cause memorization.`);
  }

  if (errors.length === 0 && warnings.length === 0) {
    notes.push('Dataset shape looks compatible with this algorithm page.');
  } else if (errors.length === 0) {
    notes.push('Usable, but review these warnings before trusting the result.');
  }

  return { errors, warnings, notes, expectedTask: task, profile };
}
