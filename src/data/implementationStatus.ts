import { navigationData } from './navigation';
import type { BadgeType } from './navigation';

export type ImplementationStatus = 'Implemented' | 'Educational' | 'Concept' | 'Scaffold';
export type AlgorithmNavItem = {
  label: string;
  route: string;
  badge: BadgeType;
  category: string;
  categoryIndex: number;
  itemIndex: number;
};
export type AlgorithmVisit = {
  route: string;
  visitedAt: number;
};

const implementedRoutes = new Set([
  '/ml/supervised/simple-linear-regression',
  '/ml/supervised/multiple-linear-regression',
  '/ml/supervised/polynomial-regression',
  '/ml/supervised/ridge-regression',
  '/ml/supervised/lasso-regression',
  '/ml/supervised/elastic-net-regression',
  '/ml/supervised/decision-tree-regression',
  '/ml/supervised/random-forest-regression',
  '/ml/supervised/gradient-boosting-regression',
  '/ml/supervised/support-vector-regression',
  '/ml/supervised/logistic-regression',
  '/ml/supervised/multinomial-logistic-regression',
  '/ml/supervised/knn-classification',
  '/ml/supervised/naive-bayes',
  '/ml/supervised/decision-tree-classification',
  '/ml/supervised/random-forest-classification',
  '/ml/supervised/svm-classification',
  '/ml/supervised/gradient-boosting-classification',
  '/ml/supervised/adaboost-classification',
  '/ml/supervised/xgboost-concept',
  '/ml/clustering/k-means',
  '/ml/clustering/k-medoids',
  '/ml/clustering/hierarchical-clustering',
  '/ml/clustering/dbscan',
  '/ml/clustering/mean-shift',
  '/ml/clustering/gaussian-mixture-model',
  '/ml/clustering/spectral-clustering',
  '/ml/clustering/optics',
  '/ml/dimensionality-reduction/pca',
  '/ml/dimensionality-reduction/kernel-pca',
  '/ml/dimensionality-reduction/tsne',
  '/ml/dimensionality-reduction/umap-concept',
  '/ml/dimensionality-reduction/lda',
  '/ml/dimensionality-reduction/autoencoder',
  '/ml/deep-learning/perceptron',
  '/ml/deep-learning/mlp',
  '/ml/deep-learning/nn-playground',
  '/ml/deep-learning/cnn',
  '/ml/deep-learning/convolution-visualizer',
  '/ml/deep-learning/rnn',
  '/ml/deep-learning/lstm',
  '/ml/deep-learning/gru',
  '/ml/deep-learning/transformer-attention',
  '/ml/deep-learning/multi-head-attention',
  '/ml/deep-learning/backpropagation-visualizer',
  '/ml/evaluation/confusion-matrix',
  '/ml/evaluation/roc-auc',
  '/ml/evaluation/precision-recall-curve',
  '/ml/evaluation/regression-metrics',
  '/ml/evaluation/train-test-split',
  '/ml/evaluation/cross-validation',
  '/ml/evaluation/bias-variance-tradeoff',
  '/ml/preprocessing/missing-values',
  '/ml/preprocessing/scaling-normalization',
  '/ml/preprocessing/categorical-encoding',
  '/ml/preprocessing/outlier-detection',
  '/ml/preprocessing/feature-selection',
  '/ml/preprocessing/polynomial-features',
  '/ml/nlp/bag-of-words',
  '/ml/nlp/tf-idf',
  '/ml/nlp/text-classification',
  '/ml/nlp/word-embedding-concept',
  '/ml/nlp/sentiment-analysis',
  '/ml/nlp/naive-bayes-spam',
  '/ml/nlp/audio-classification',
  '/ml/computer-vision/image-classification',
  '/ml/computer-vision/hand-gesture-recognition',
  '/ml/computer-vision/pose-detection',
  '/ml/computer-vision/person-segmentation',
  '/ml/computer-vision/cnn-filter-explorer',
  '/ml/computer-vision/kmeans-image-segmentation',
  '/ml/computer-vision/edge-detection',
  '/ml/computer-vision/object-detection-demo',
  '/ml/recommendation/user-based-cf',
  '/ml/recommendation/item-based-cf',
  '/ml/recommendation/matrix-factorization',
  '/ml/recommendation/content-based',
  '/ml/reinforcement-learning/q-learning-grid-world',
  '/ml/reinforcement-learning/multi-armed-bandit',
  '/ml/reinforcement-learning/markov-decision-process',
  '/ml/explainability/feature-importance',
  '/ml/explainability/partial-dependence-plot',
  '/ml/explainability/shap-concept',
  '/ml/explainability/lime-concept',
  '/ml/optimization/gradient-descent',
  '/ml/optimization/sgd',
  '/ml/optimization/momentum',
  '/ml/optimization/adam',
  '/ml/ensemble/bagging',
  '/ml/ensemble/boosting',
  '/ml/ensemble/stacking',
  '/ml/probabilistic/bayesian-linear-regression',
  '/ml/probabilistic/gaussian-process-regression',
  '/ml/probabilistic/hidden-markov-model',
  '/ml/deployment/browser-model-loader',
  '/ml/deployment/onnx-runtime-demo',
  '/ml/deployment/tensorflowjs-training',
  '/ml/deployment/model-export',
  '/ml/time-series/moving-average',
  '/ml/time-series/exponential-smoothing',
  '/ml/time-series/holt-winters',
  '/ml/time-series/arima-concept',
  '/ml/time-series/anomaly-detection',
  '/ml/lab/algorithm-comparison',
  '/ml/lab/hyperparameter-tuning',
  '/ml/lab/automl-concept',
  '/ml/lab/dataset-manager',
  '/ml/lab/saved-experiments',
  '/ml/lab/report-builder',
]);

const conceptRoutes = new Set(
  navigationData.flatMap(category => category.items)
    .filter(item => item.badge === 'Concept' || item.label.toLowerCase().includes('concept'))
    .map(item => item.route)
);

export function getImplementationStatus(route: string): ImplementationStatus {
  if (implementedRoutes.has(route)) return 'Implemented';
  if (route === '/ml/clustering/gaussian-mixture-model' || route === '/ml/clustering/optics') return 'Educational';
  if (conceptRoutes.has(route)) return 'Concept';
  if (route.includes('tensorflow') || route.includes('onnx') || route.includes('image-classification') || route.includes('object-detection')) return 'Educational';
  return 'Scaffold';
}

export function implementationSummary() {
  const items = getAllAlgorithms();
  const counts: Record<ImplementationStatus, number> = {
    Implemented: 0,
    Educational: 0,
    Concept: 0,
    Scaffold: 0,
  };
  items.forEach(item => {
    counts[getImplementationStatus(item.route)]++;
  });
  return { total: items.length, counts, items };
}

export function getAllAlgorithms(): AlgorithmNavItem[] {
  return navigationData.flatMap((category, categoryIndex) =>
    category.items.map((item, itemIndex) => ({
      ...item,
      category: category.category,
      categoryIndex,
      itemIndex,
    }))
  );
}

export function getAlgorithmByRoute(route: string) {
  return getAllAlgorithms().find(item => item.route === route);
}

export function getAdjacentAlgorithms(route: string) {
  const items = getAllAlgorithms();
  const index = items.findIndex(item => item.route === route);
  if (index < 0) return { previous: undefined, next: undefined };
  return {
    previous: items[index - 1],
    next: items[index + 1],
  };
}

export function getCategoryProgress(categoryName: string) {
  const category = navigationData.find(item => item.category === categoryName);
  const items = category?.items ?? [];
  const implemented = items.filter(item => getImplementationStatus(item.route) === 'Implemented').length;
  return { implemented, total: items.length };
}

export function rememberRoute(route: string) {
  if (typeof localStorage === 'undefined') return;
  const current = JSON.parse(localStorage.getItem('recentAlgorithms') ?? '[]') as string[];
  const next = [route, ...current.filter(item => item !== route)].slice(0, 8);
  localStorage.setItem('recentAlgorithms', JSON.stringify(next));
  const visits = JSON.parse(localStorage.getItem('algorithmVisitHistory') ?? '[]') as AlgorithmVisit[];
  localStorage.setItem('algorithmVisitHistory', JSON.stringify([{ route, visitedAt: Date.now() }, ...visits].slice(0, 500)));
  window.dispatchEvent(new CustomEvent('ml:algorithm-visited'));
}

export function getRecentRoutes() {
  if (typeof localStorage === 'undefined') return [];
  return JSON.parse(localStorage.getItem('recentAlgorithms') ?? '[]') as string[];
}

export function getAlgorithmVisitStats() {
  if (typeof localStorage === 'undefined') return { visitedCount: 0, streakDays: 0 };
  let visits: AlgorithmVisit[];
  try {
    visits = JSON.parse(localStorage.getItem('algorithmVisitHistory') ?? '[]') as AlgorithmVisit[];
  } catch {
    visits = [];
  }
  const routeSet = new Set(visits.map(visit => visit.route));
  const daySet = new Set(visits.map(visit => new Date(visit.visitedAt).toDateString()));
  const today = new Date();
  let streakDays = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    if (!daySet.has(day.toDateString())) break;
    streakDays += 1;
  }
  return { visitedCount: routeSet.size, streakDays };
}

const FAVORITES_KEY = 'favoriteAlgorithms';

export function getFavoriteRoutes() {
  if (typeof localStorage === 'undefined') return [];
  return JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]') as string[];
}

export function isFavoriteRoute(route: string) {
  return getFavoriteRoutes().includes(route);
}

export function toggleFavoriteRoute(route: string) {
  if (typeof localStorage === 'undefined') return [];
  const current = getFavoriteRoutes();
  const next = current.includes(route)
    ? current.filter(item => item !== route)
    : [route, ...current].slice(0, 12);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('ml:favorites-changed'));
  return next;
}

export function getLearningPath(level: 'Beginner' | 'Intermediate' | 'Advanced') {
  return getAllAlgorithms()
    .filter(item => item.badge === level && getImplementationStatus(item.route) !== 'Scaffold')
    .slice(0, level === 'Beginner' ? 12 : 10);
}
