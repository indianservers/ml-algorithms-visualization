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
  '/ml/supervised/logistic-regression',
  '/ml/supervised/multinomial-logistic-regression',
  '/ml/supervised/knn-classification',
  '/ml/supervised/naive-bayes',
  '/ml/supervised/decision-tree-classification',
  '/ml/supervised/random-forest-classification',
  '/ml/supervised/svm-classification',
  '/ml/supervised/gradient-boosting-classification',
  '/ml/supervised/adaboost-classification',
  '/ml/clustering/k-means',
  '/ml/clustering/k-medoids',
  '/ml/clustering/hierarchical-clustering',
  '/ml/clustering/dbscan',
  '/ml/clustering/mean-shift',
  '/ml/clustering/spectral-clustering',
  '/ml/dimensionality-reduction/pca',
  '/ml/deep-learning/perceptron',
  '/ml/deep-learning/nn-playground',
  '/ml/deep-learning/cnn',
  '/ml/deep-learning/rnn',
  '/ml/deep-learning/lstm',
  '/ml/deep-learning/gru',
  '/ml/deep-learning/transformer-attention',
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
  '/ml/nlp/sentiment-analysis',
  '/ml/computer-vision/cnn-filter-explorer',
  '/ml/computer-vision/edge-detection',
  '/ml/reinforcement-learning/q-learning-grid-world',
  '/ml/reinforcement-learning/multi-armed-bandit',
  '/ml/optimization/gradient-descent',
  '/ml/time-series/moving-average',
  '/ml/time-series/exponential-smoothing',
  '/ml/time-series/holt-winters',
  '/ml/time-series/anomaly-detection',
  '/ml/lab/algorithm-comparison',
  '/ml/lab/dataset-manager',
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
}

export function getRecentRoutes() {
  if (typeof localStorage === 'undefined') return [];
  return JSON.parse(localStorage.getItem('recentAlgorithms') ?? '[]') as string[];
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
