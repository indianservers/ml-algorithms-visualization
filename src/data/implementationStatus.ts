import { navigationData } from './navigation';

export type ImplementationStatus = 'Implemented' | 'Educational' | 'Concept' | 'Scaffold';

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
  '/ml/deep-learning/transformer-attention',
  '/ml/evaluation/confusion-matrix',
  '/ml/evaluation/roc-auc',
  '/ml/evaluation/precision-recall-curve',
  '/ml/evaluation/regression-metrics',
  '/ml/evaluation/train-test-split',
  '/ml/preprocessing/missing-values',
  '/ml/preprocessing/scaling-normalization',
  '/ml/preprocessing/categorical-encoding',
  '/ml/preprocessing/outlier-detection',
  '/ml/nlp/bag-of-words',
  '/ml/nlp/tf-idf',
  '/ml/computer-vision/cnn-filter-explorer',
  '/ml/reinforcement-learning/q-learning-grid-world',
  '/ml/optimization/gradient-descent',
  '/ml/time-series/moving-average',
  '/ml/time-series/exponential-smoothing',
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
  const items = navigationData.flatMap(category => category.items.map(item => ({ ...item, category: category.category })));
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
