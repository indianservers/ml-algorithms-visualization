import {
  allSampleDatasets,
  housingDataset,
  irisDataset,
  loanDataset,
  mallCustomersDataset,
  ratingsDataset,
  sentimentDataset,
  spamDataset,
  studentMarksDataset,
  timeSeriesSalesDataset,
  generateLinearData,
  generateSyntheticBlobs,
  generateSyntheticCircles,
  generateSyntheticMoons,
} from './sampleDatasets';
import type { Dataset } from './sampleDatasets';

export interface AlgorithmDatasetSuggestion {
  id: string;
  name: string;
  description: string;
  kind: 'sample' | 'synthetic' | 'upload';
  columns: string[];
  target?: string;
  dataset?: Dataset;
}

export interface LoadedAlgorithmDataset {
  id: string;
  name: string;
  description: string;
  columns: string[];
  data: Record<string, unknown>[];
  target?: string;
  kind: AlgorithmDatasetSuggestion['kind'];
}

const byId = Object.fromEntries(allSampleDatasets.map(dataset => [dataset.id, dataset]));

function sample(dataset: Dataset, target?: string): AlgorithmDatasetSuggestion {
  return {
    id: dataset.id,
    name: dataset.name,
    description: dataset.description,
    kind: 'sample',
    columns: dataset.columns,
    target,
    dataset,
  };
}

const synthetic = {
  linear: {
    id: 'synthetic-linear',
    name: 'Synthetic Linear Data',
    description: 'Generated x/y regression points for slope, intercept, residual, and optimizer demonstrations.',
    kind: 'synthetic' as const,
    columns: ['x', 'y'],
    target: 'y',
  },
  blobs: {
    id: 'synthetic-blobs',
    name: 'Synthetic Blobs',
    description: 'Generated 2-D class clusters for classification, clustering, and boundary visualization.',
    kind: 'synthetic' as const,
    columns: ['x', 'y', 'label'],
    target: 'label',
  },
  moons: {
    id: 'synthetic-moons',
    name: 'Synthetic Moons',
    description: 'Generated non-linear two-class data for SVM, KNN, neural nets, and density clustering.',
    kind: 'synthetic' as const,
    columns: ['x', 'y', 'label'],
    target: 'label',
  },
  circles: {
    id: 'synthetic-circles',
    name: 'Synthetic Circles',
    description: 'Generated concentric decision regions for non-linear neural-network classification.',
    kind: 'synthetic' as const,
    columns: ['x', 'y', 'label'],
    target: 'label',
  },
  imageGrid: {
    id: 'synthetic-image-grid',
    name: 'Synthetic Image Grid',
    description: 'Small pixel grids and kernels for convolution, edge detection, and segmentation lessons.',
    kind: 'synthetic' as const,
    columns: ['row', 'col', 'pixel', 'label'],
    target: 'label',
  },
  sequence: {
    id: 'synthetic-sequence',
    name: 'Synthetic Sequence Data',
    description: 'Generated sequences for RNN, LSTM, GRU, HMM, and forecasting behavior.',
    kind: 'synthetic' as const,
    columns: ['step', 'value', 'label'],
    target: 'value',
  },
  bandit: {
    id: 'synthetic-bandit',
    name: 'Synthetic Bandit Rewards',
    description: 'Generated arm rewards for exploration, exploitation, and regret tracking.',
    kind: 'synthetic' as const,
    columns: ['trial', 'arm', 'reward'],
    target: 'reward',
  },
  gridWorld: {
    id: 'synthetic-grid-world',
    name: 'Synthetic Grid World',
    description: 'Generated states, actions, rewards, and terminal cells for RL policies.',
    kind: 'synthetic' as const,
    columns: ['state', 'action', 'reward', 'next_state'],
    target: 'reward',
  },
};

const routeSpecific: Record<string, AlgorithmDatasetSuggestion[]> = {
  '/ml/supervised/simple-linear-regression': [sample(studentMarksDataset, 'marks'), synthetic.linear],
  '/ml/supervised/multiple-linear-regression': [sample(housingDataset, 'price')],
  '/ml/supervised/polynomial-regression': [synthetic.linear, sample(studentMarksDataset, 'marks')],
  '/ml/supervised/ridge-regression': [sample(housingDataset, 'price'), synthetic.linear],
  '/ml/supervised/lasso-regression': [sample(housingDataset, 'price'), synthetic.linear],
  '/ml/supervised/elastic-net-regression': [sample(housingDataset, 'price'), synthetic.linear],
  '/ml/supervised/decision-tree-regression': [sample(housingDataset, 'price')],
  '/ml/supervised/random-forest-regression': [sample(housingDataset, 'price')],
  '/ml/supervised/gradient-boosting-regression': [sample(housingDataset, 'price')],
  '/ml/supervised/support-vector-regression': [synthetic.linear, sample(studentMarksDataset, 'marks')],

  '/ml/supervised/logistic-regression': [sample(loanDataset, 'approved')],
  '/ml/supervised/multinomial-logistic-regression': [sample(irisDataset, 'species')],
  '/ml/supervised/knn-classification': [sample(irisDataset, 'species'), synthetic.blobs],
  '/ml/supervised/naive-bayes': [sample(irisDataset, 'species'), sample(spamDataset, 'label')],
  '/ml/supervised/decision-tree-classification': [sample(irisDataset, 'species')],
  '/ml/supervised/random-forest-classification': [sample(irisDataset, 'species'), sample(loanDataset, 'approved')],
  '/ml/supervised/svm-classification': [synthetic.moons, synthetic.blobs],
  '/ml/supervised/gradient-boosting-classification': [sample(loanDataset, 'approved'), sample(irisDataset, 'species')],
  '/ml/supervised/adaboost-classification': [sample(loanDataset, 'approved'), sample(irisDataset, 'species')],
  '/ml/supervised/xgboost-concept': [sample(loanDataset, 'approved'), sample(housingDataset, 'price')],

  '/ml/clustering/k-means': [sample(mallCustomersDataset), synthetic.blobs],
  '/ml/clustering/k-medoids': [sample(mallCustomersDataset), synthetic.blobs],
  '/ml/clustering/hierarchical-clustering': [sample(mallCustomersDataset), synthetic.blobs],
  '/ml/clustering/dbscan': [synthetic.moons, synthetic.blobs],
  '/ml/clustering/mean-shift': [sample(mallCustomersDataset), synthetic.blobs],
  '/ml/clustering/gaussian-mixture-model': [synthetic.blobs, sample(mallCustomersDataset)],
  '/ml/clustering/spectral-clustering': [synthetic.moons, synthetic.blobs],
  '/ml/clustering/optics': [synthetic.moons, sample(mallCustomersDataset)],

  '/ml/dimensionality-reduction/pca': [sample(irisDataset, 'species'), sample(housingDataset, 'price')],
  '/ml/dimensionality-reduction/kernel-pca': [sample(irisDataset, 'species'), synthetic.moons],
  '/ml/dimensionality-reduction/tsne': [sample(irisDataset, 'species'), synthetic.blobs],
  '/ml/dimensionality-reduction/umap-concept': [sample(irisDataset, 'species'), synthetic.blobs],
  '/ml/dimensionality-reduction/lda': [sample(irisDataset, 'species')],
  '/ml/dimensionality-reduction/autoencoder': [sample(irisDataset, 'species'), synthetic.imageGrid],

  '/ml/deep-learning/perceptron': [synthetic.blobs],
  '/ml/deep-learning/mlp': [synthetic.moons, synthetic.circles],
  '/ml/deep-learning/nn-playground': [synthetic.moons, synthetic.circles],
  '/ml/deep-learning/cnn': [synthetic.imageGrid],
  '/ml/deep-learning/convolution-visualizer': [synthetic.imageGrid],
  '/ml/deep-learning/rnn': [synthetic.sequence, sample(timeSeriesSalesDataset, 'sales')],
  '/ml/deep-learning/lstm': [synthetic.sequence, sample(timeSeriesSalesDataset, 'sales')],
  '/ml/deep-learning/gru': [synthetic.sequence, sample(timeSeriesSalesDataset, 'sales')],
  '/ml/deep-learning/transformer-attention': [sample(sentimentDataset, 'label'), sample(spamDataset, 'label')],
  '/ml/deep-learning/multi-head-attention': [sample(sentimentDataset, 'label'), sample(spamDataset, 'label')],
  '/ml/deep-learning/backpropagation-visualizer': [synthetic.blobs, synthetic.moons],

  '/ml/evaluation/train-test-split': [sample(irisDataset, 'species'), sample(loanDataset, 'approved')],
  '/ml/evaluation/cross-validation': [sample(housingDataset, 'price'), sample(loanDataset, 'approved')],
  '/ml/evaluation/confusion-matrix': [sample(loanDataset, 'approved'), sample(irisDataset, 'species')],
  '/ml/evaluation/roc-auc': [sample(loanDataset, 'approved')],
  '/ml/evaluation/precision-recall-curve': [sample(loanDataset, 'approved')],
  '/ml/evaluation/regression-metrics': [sample(housingDataset, 'price'), sample(studentMarksDataset, 'marks')],
  '/ml/evaluation/bias-variance-tradeoff': [synthetic.linear, sample(studentMarksDataset, 'marks')],

  '/ml/preprocessing/missing-values': [sample(housingDataset, 'price'), sample(loanDataset, 'approved')],
  '/ml/preprocessing/scaling-normalization': [sample(housingDataset, 'price'), sample(loanDataset, 'approved')],
  '/ml/preprocessing/categorical-encoding': [sample(loanDataset, 'approved')],
  '/ml/preprocessing/outlier-detection': [sample(mallCustomersDataset), sample(housingDataset, 'price')],
  '/ml/preprocessing/feature-selection': [sample(housingDataset, 'price'), sample(loanDataset, 'approved')],
  '/ml/preprocessing/polynomial-features': [sample(studentMarksDataset, 'marks'), synthetic.linear],

  '/ml/time-series/moving-average': [sample(timeSeriesSalesDataset, 'sales')],
  '/ml/time-series/exponential-smoothing': [sample(timeSeriesSalesDataset, 'sales')],
  '/ml/time-series/holt-winters': [sample(timeSeriesSalesDataset, 'sales')],
  '/ml/time-series/arima-concept': [sample(timeSeriesSalesDataset, 'sales'), synthetic.sequence],
  '/ml/time-series/anomaly-detection': [sample(timeSeriesSalesDataset, 'sales'), synthetic.sequence],

  '/ml/nlp/bag-of-words': [sample(sentimentDataset, 'label'), sample(spamDataset, 'label')],
  '/ml/nlp/tf-idf': [sample(sentimentDataset, 'label'), sample(spamDataset, 'label')],
  '/ml/nlp/text-classification': [sample(spamDataset, 'label'), sample(sentimentDataset, 'label')],
  '/ml/nlp/word-embedding-concept': [sample(sentimentDataset, 'label'), sample(spamDataset, 'label')],
  '/ml/nlp/sentiment-analysis': [sample(sentimentDataset, 'label')],
  '/ml/nlp/naive-bayes-spam': [sample(spamDataset, 'label')],

  '/ml/computer-vision/image-classification': [synthetic.imageGrid],
  '/ml/computer-vision/cnn-filter-explorer': [synthetic.imageGrid],
  '/ml/computer-vision/kmeans-image-segmentation': [synthetic.imageGrid],
  '/ml/computer-vision/edge-detection': [synthetic.imageGrid],
  '/ml/computer-vision/object-detection-demo': [synthetic.imageGrid],

  '/ml/recommendation/user-based-cf': [sample(ratingsDataset, 'rating')],
  '/ml/recommendation/item-based-cf': [sample(ratingsDataset, 'rating')],
  '/ml/recommendation/matrix-factorization': [sample(ratingsDataset, 'rating')],
  '/ml/recommendation/content-based': [sample(ratingsDataset, 'rating'), sample(sentimentDataset, 'label')],

  '/ml/reinforcement-learning/multi-armed-bandit': [synthetic.bandit],
  '/ml/reinforcement-learning/q-learning-grid-world': [synthetic.gridWorld],
  '/ml/reinforcement-learning/markov-decision-process': [synthetic.gridWorld],

  '/ml/explainability/feature-importance': [sample(housingDataset, 'price'), sample(loanDataset, 'approved')],
  '/ml/explainability/partial-dependence-plot': [sample(housingDataset, 'price'), sample(loanDataset, 'approved')],
  '/ml/explainability/shap-concept': [sample(housingDataset, 'price'), sample(loanDataset, 'approved')],
  '/ml/explainability/lime-concept': [sample(loanDataset, 'approved'), sample(sentimentDataset, 'label')],

  '/ml/optimization/gradient-descent': [synthetic.linear],
  '/ml/optimization/sgd': [sample(studentMarksDataset, 'marks'), synthetic.linear],
  '/ml/optimization/momentum': [synthetic.linear],
  '/ml/optimization/adam': [synthetic.linear],

  '/ml/ensemble/bagging': [sample(loanDataset, 'approved'), sample(housingDataset, 'price')],
  '/ml/ensemble/boosting': [sample(loanDataset, 'approved'), sample(housingDataset, 'price')],
  '/ml/ensemble/stacking': [sample(irisDataset, 'species'), sample(loanDataset, 'approved')],

  '/ml/probabilistic/bayesian-linear-regression': [sample(housingDataset, 'price'), synthetic.linear],
  '/ml/probabilistic/gaussian-process-regression': [synthetic.linear, sample(studentMarksDataset, 'marks')],
  '/ml/probabilistic/hidden-markov-model': [synthetic.sequence, sample(timeSeriesSalesDataset, 'sales')],

  '/ml/deployment/browser-model-loader': [sample(irisDataset, 'species'), synthetic.imageGrid],
  '/ml/deployment/onnx-runtime-demo': [sample(irisDataset, 'species'), synthetic.imageGrid],
  '/ml/deployment/tensorflowjs-training': [synthetic.moons, sample(irisDataset, 'species')],
  '/ml/deployment/model-export': [sample(loanDataset, 'approved'), sample(housingDataset, 'price')],

  '/ml/lab/algorithm-comparison': [sample(irisDataset, 'species'), sample(loanDataset, 'approved'), synthetic.blobs, synthetic.moons],
  '/ml/lab/hyperparameter-tuning': [sample(loanDataset, 'approved'), sample(housingDataset, 'price')],
  '/ml/lab/automl-concept': [sample(loanDataset, 'approved'), sample(housingDataset, 'price'), sample(irisDataset, 'species')],
  '/ml/lab/saved-experiments': [sample(loanDataset, 'approved'), sample(housingDataset, 'price')],
  '/ml/lab/dataset-manager': allSampleDatasets.map(dataset => sample(dataset)),
  '/ml/lab/report-builder': [sample(loanDataset, 'approved'), sample(housingDataset, 'price'), sample(irisDataset, 'species')],
};

function categoryFallback(category: string): AlgorithmDatasetSuggestion[] {
  const normalized = category.toLowerCase();
  if (normalized.includes('regression')) return [sample(housingDataset, 'price'), sample(studentMarksDataset, 'marks'), synthetic.linear];
  if (normalized.includes('classification')) return [sample(irisDataset, 'species'), sample(loanDataset, 'approved'), synthetic.blobs];
  if (normalized.includes('clustering')) return [sample(mallCustomersDataset), synthetic.blobs, synthetic.moons];
  if (normalized.includes('dimensionality')) return [sample(irisDataset, 'species'), sample(housingDataset, 'price')];
  if (normalized.includes('deep')) return [synthetic.moons, synthetic.sequence, synthetic.imageGrid];
  if (normalized.includes('evaluation')) return [sample(loanDataset, 'approved'), sample(housingDataset, 'price')];
  if (normalized.includes('preprocessing')) return [sample(housingDataset, 'price'), sample(loanDataset, 'approved')];
  if (normalized.includes('time')) return [sample(timeSeriesSalesDataset, 'sales'), synthetic.sequence];
  if (normalized.includes('nlp')) return [sample(spamDataset, 'label'), sample(sentimentDataset, 'label')];
  if (normalized.includes('vision')) return [synthetic.imageGrid];
  if (normalized.includes('recommendation')) return [sample(ratingsDataset, 'rating')];
  if (normalized.includes('reinforcement')) return [synthetic.gridWorld, synthetic.bandit];
  if (normalized.includes('optimization')) return [synthetic.linear];
  return allSampleDatasets.slice(0, 3).map(dataset => sample(dataset));
}

export function getAlgorithmDatasetSuggestions(route: string, category: string): AlgorithmDatasetSuggestion[] {
  return routeSpecific[route] ?? categoryFallback(category);
}

export function getAlgorithmSampleDatasets(route: string, category: string): Dataset[] {
  const samples = getAlgorithmDatasetSuggestions(route, category)
    .map(item => item.dataset ?? byId[item.id])
    .filter((dataset): dataset is Dataset => Boolean(dataset));
  return samples.length > 0 ? samples : allSampleDatasets;
}

function sequenceRows() {
  return Array.from({ length: 36 }, (_, step) => ({
    step,
    value: Number((60 + Math.sin(step / 3) * 12 + step * 0.7).toFixed(2)),
    label: step > 24 ? 'forecast' : 'history',
  }));
}

function imageGridRows() {
  return Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const edge = row === col || row + col === 7;
    return { row, col, pixel: edge ? 255 : (row + col) % 3 === 0 ? 120 : 20, label: edge ? 'edge' : 'background' };
  });
}

function banditRows() {
  return Array.from({ length: 60 }, (_, trial) => {
    const arm = trial % 4;
    const baseReward = [0.25, 0.45, 0.6, 0.35][arm];
    return { trial: trial + 1, arm, reward: Number((baseReward + ((trial * (arm + 3)) % 11) / 100).toFixed(2)) };
  });
}

function gridWorldRows() {
  const actions = ['up', 'right', 'down', 'left'];
  return Array.from({ length: 25 }, (_, state) => {
    const action = actions[state % actions.length];
    const terminal = state === 24;
    return { state, action, reward: terminal ? 1 : state % 7 === 0 ? -0.2 : -0.04, next_state: terminal ? state : Math.min(24, state + 1) };
  });
}

function syntheticRows(suggestion: AlgorithmDatasetSuggestion): Record<string, unknown>[] {
  if (suggestion.id === 'synthetic-linear') return generateLinearData(40, 2.8, 8, 2);
  if (suggestion.id === 'synthetic-blobs') return generateSyntheticBlobs(90, 3);
  if (suggestion.id === 'synthetic-moons') return generateSyntheticMoons(90);
  if (suggestion.id === 'synthetic-circles') return generateSyntheticCircles(90);
  if (suggestion.id === 'synthetic-image-grid') return imageGridRows();
  if (suggestion.id === 'synthetic-sequence') return sequenceRows();
  if (suggestion.id === 'synthetic-bandit') return banditRows();
  if (suggestion.id === 'synthetic-grid-world') return gridWorldRows();
  return [];
}

export function loadAlgorithmDataset(suggestion: AlgorithmDatasetSuggestion): LoadedAlgorithmDataset {
  const data = suggestion.dataset?.data ?? syntheticRows(suggestion);
  return {
    id: suggestion.id,
    name: suggestion.name,
    description: suggestion.description,
    columns: suggestion.columns,
    data,
    target: suggestion.target,
    kind: suggestion.kind,
  };
}
