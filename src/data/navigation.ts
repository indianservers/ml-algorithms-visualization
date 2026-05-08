export type BadgeType =
  | 'Beginner' | 'Intermediate' | 'Advanced' | 'Concept'
  | 'Browser Trainable' | 'Browser Inference' | 'Educational' | 'Educational Simplified';

export interface NavItem {
  label: string;
  route: string;
  badge: BadgeType;
  icon?: string;
}

export interface NavCategory {
  category: string;
  icon: string;
  items: NavItem[];
}

export const navigationData: NavCategory[] = [
  {
    category: 'Supervised - Regression',
    icon: 'TrendingUp',
    items: [
      { label: 'Simple Linear Regression', route: '/ml/supervised/simple-linear-regression', badge: 'Beginner' },
      { label: 'Multiple Linear Regression', route: '/ml/supervised/multiple-linear-regression', badge: 'Beginner' },
      { label: 'Polynomial Regression', route: '/ml/supervised/polynomial-regression', badge: 'Beginner' },
      { label: 'Ridge Regression', route: '/ml/supervised/ridge-regression', badge: 'Intermediate' },
      { label: 'Lasso Regression', route: '/ml/supervised/lasso-regression', badge: 'Intermediate' },
      { label: 'Elastic Net', route: '/ml/supervised/elastic-net-regression', badge: 'Intermediate' },
      { label: 'Decision Tree Regression', route: '/ml/supervised/decision-tree-regression', badge: 'Intermediate' },
      { label: 'Random Forest Regression', route: '/ml/supervised/random-forest-regression', badge: 'Intermediate' },
      { label: 'Gradient Boosting Regression', route: '/ml/supervised/gradient-boosting-regression', badge: 'Advanced' },
      { label: 'SVR', route: '/ml/supervised/support-vector-regression', badge: 'Advanced' },
    ],
  },
  {
    category: 'Supervised - Classification',
    icon: 'GitBranch',
    items: [
      { label: 'Logistic Regression', route: '/ml/supervised/logistic-regression', badge: 'Beginner' },
      { label: 'Multinomial Logistic', route: '/ml/supervised/multinomial-logistic-regression', badge: 'Intermediate' },
      { label: 'KNN Classification', route: '/ml/supervised/knn-classification', badge: 'Beginner' },
      { label: 'Naive Bayes', route: '/ml/supervised/naive-bayes', badge: 'Beginner' },
      { label: 'Decision Tree Classification', route: '/ml/supervised/decision-tree-classification', badge: 'Beginner' },
      { label: 'Random Forest Classification', route: '/ml/supervised/random-forest-classification', badge: 'Intermediate' },
      { label: 'SVM Classification', route: '/ml/supervised/svm-classification', badge: 'Advanced' },
      { label: 'Gradient Boosting Classification', route: '/ml/supervised/gradient-boosting-classification', badge: 'Advanced' },
      { label: 'AdaBoost', route: '/ml/supervised/adaboost-classification', badge: 'Advanced' },
      { label: 'XGBoost', route: '/ml/supervised/xgboost-concept', badge: 'Advanced' },
    ],
  },
  {
    category: 'Clustering',
    icon: 'Network',
    items: [
      { label: 'K-Means', route: '/ml/clustering/k-means', badge: 'Beginner' },
      { label: 'K-Medoids', route: '/ml/clustering/k-medoids', badge: 'Intermediate' },
      { label: 'Hierarchical Clustering', route: '/ml/clustering/hierarchical-clustering', badge: 'Intermediate' },
      { label: 'DBSCAN', route: '/ml/clustering/dbscan', badge: 'Intermediate' },
      { label: 'Mean Shift', route: '/ml/clustering/mean-shift', badge: 'Advanced' },
      { label: 'Gaussian Mixture Model', route: '/ml/clustering/gaussian-mixture-model', badge: 'Advanced' },
      { label: 'Spectral Clustering', route: '/ml/clustering/spectral-clustering', badge: 'Advanced' },
      { label: 'OPTICS', route: '/ml/clustering/optics', badge: 'Advanced' },
    ],
  },
  {
    category: 'Dimensionality Reduction',
    icon: 'Minimize2',
    items: [
      { label: 'PCA', route: '/ml/dimensionality-reduction/pca', badge: 'Intermediate' },
      { label: 'Kernel PCA', route: '/ml/dimensionality-reduction/kernel-pca', badge: 'Advanced' },
      { label: 't-SNE', route: '/ml/dimensionality-reduction/tsne', badge: 'Advanced' },
      { label: 'UMAP', route: '/ml/dimensionality-reduction/umap-concept', badge: 'Advanced' },
      { label: 'LDA', route: '/ml/dimensionality-reduction/lda', badge: 'Intermediate' },
      { label: 'Autoencoder Dim Reduction', route: '/ml/dimensionality-reduction/autoencoder', badge: 'Browser Trainable' },
    ],
  },
  {
    category: 'Deep Learning',
    icon: 'Brain',
    items: [
      { label: 'Perceptron', route: '/ml/deep-learning/perceptron', badge: 'Beginner' },
      { label: 'MLP', route: '/ml/deep-learning/mlp', badge: 'Intermediate' },
      { label: 'Neural Network Playground', route: '/ml/deep-learning/nn-playground', badge: 'Browser Trainable' },
      { label: 'CNN', route: '/ml/deep-learning/cnn', badge: 'Advanced' },
      { label: 'Convolution Visualizer', route: '/ml/deep-learning/convolution-visualizer', badge: 'Educational' },
      { label: 'RNN', route: '/ml/deep-learning/rnn', badge: 'Advanced' },
      { label: 'LSTM', route: '/ml/deep-learning/lstm', badge: 'Advanced' },
      { label: 'GRU', route: '/ml/deep-learning/gru', badge: 'Advanced' },
      { label: 'Transformer Attention', route: '/ml/deep-learning/transformer-attention', badge: 'Advanced' },
      { label: 'Multi-Head Attention', route: '/ml/deep-learning/multi-head-attention', badge: 'Advanced' },
      { label: 'Backpropagation Visualizer', route: '/ml/deep-learning/backpropagation-visualizer', badge: 'Educational' },
    ],
  },
  {
    category: 'Evaluation',
    icon: 'BarChart2',
    items: [
      { label: 'Train/Test Split', route: '/ml/evaluation/train-test-split', badge: 'Beginner' },
      { label: 'Cross Validation', route: '/ml/evaluation/cross-validation', badge: 'Intermediate' },
      { label: 'Confusion Matrix', route: '/ml/evaluation/confusion-matrix', badge: 'Beginner' },
      { label: 'ROC & AUC', route: '/ml/evaluation/roc-auc', badge: 'Intermediate' },
      { label: 'Precision-Recall Curve', route: '/ml/evaluation/precision-recall-curve', badge: 'Intermediate' },
      { label: 'Regression Metrics', route: '/ml/evaluation/regression-metrics', badge: 'Beginner' },
      { label: 'Bias-Variance Tradeoff', route: '/ml/evaluation/bias-variance-tradeoff', badge: 'Intermediate' },
    ],
  },
  {
    category: 'Preprocessing',
    icon: 'Filter',
    items: [
      { label: 'Missing Values', route: '/ml/preprocessing/missing-values', badge: 'Beginner' },
      { label: 'Scaling & Normalization', route: '/ml/preprocessing/scaling-normalization', badge: 'Beginner' },
      { label: 'Categorical Encoding', route: '/ml/preprocessing/categorical-encoding', badge: 'Beginner' },
      { label: 'Outlier Detection', route: '/ml/preprocessing/outlier-detection', badge: 'Intermediate' },
      { label: 'Feature Selection', route: '/ml/preprocessing/feature-selection', badge: 'Intermediate' },
      { label: 'Polynomial Features', route: '/ml/preprocessing/polynomial-features', badge: 'Intermediate' },
    ],
  },
  {
    category: 'Time Series',
    icon: 'Activity',
    items: [
      { label: 'Moving Average', route: '/ml/time-series/moving-average', badge: 'Beginner' },
      { label: 'Exponential Smoothing', route: '/ml/time-series/exponential-smoothing', badge: 'Intermediate' },
      { label: 'Holt-Winters', route: '/ml/time-series/holt-winters', badge: 'Intermediate' },
      { label: 'ARIMA', route: '/ml/time-series/arima-concept', badge: 'Advanced' },
      { label: 'Anomaly Detection', route: '/ml/time-series/anomaly-detection', badge: 'Intermediate' },
    ],
  },
  {
    category: 'NLP',
    icon: 'MessageSquare',
    items: [
      { label: 'Bag of Words', route: '/ml/nlp/bag-of-words', badge: 'Beginner' },
      { label: 'TF-IDF', route: '/ml/nlp/tf-idf', badge: 'Beginner' },
      { label: 'Text Classification', route: '/ml/nlp/text-classification', badge: 'Intermediate' },
      { label: 'Word Embedding', route: '/ml/nlp/word-embedding-concept', badge: 'Intermediate' },
      { label: 'Sentiment Analysis', route: '/ml/nlp/sentiment-analysis', badge: 'Intermediate' },
      { label: 'Naive Bayes Spam Classifier', route: '/ml/nlp/naive-bayes-spam', badge: 'Intermediate' },
      { label: 'Audio Classification', route: '/ml/nlp/audio-classification', badge: 'Browser Trainable' },
    ],
  },
  {
    category: 'Computer Vision',
    icon: 'Eye',
    items: [
      { label: 'Image Classification', route: '/ml/computer-vision/image-classification', badge: 'Browser Trainable' },
      { label: 'Hand Gesture Recognition', route: '/ml/computer-vision/hand-gesture-recognition', badge: 'Browser Trainable' },
      { label: 'Pose Detection', route: '/ml/computer-vision/pose-detection', badge: 'Browser Inference' },
      { label: 'Person Segmentation', route: '/ml/computer-vision/person-segmentation', badge: 'Browser Inference' },
      { label: 'CNN Filter Explorer', route: '/ml/computer-vision/cnn-filter-explorer', badge: 'Educational' },
      { label: 'K-Means Image Segmentation', route: '/ml/computer-vision/kmeans-image-segmentation', badge: 'Intermediate' },
      { label: 'Edge Detection', route: '/ml/computer-vision/edge-detection', badge: 'Beginner' },
      { label: 'Object Detection', route: '/ml/computer-vision/object-detection-demo', badge: 'Browser Trainable' },
    ],
  },
  {
    category: 'Recommendation',
    icon: 'Star',
    items: [
      { label: 'User-Based Collaborative Filtering', route: '/ml/recommendation/user-based-cf', badge: 'Intermediate' },
      { label: 'Item-Based Collaborative Filtering', route: '/ml/recommendation/item-based-cf', badge: 'Intermediate' },
      { label: 'Matrix Factorization', route: '/ml/recommendation/matrix-factorization', badge: 'Advanced' },
      { label: 'Content-Based Recommendation', route: '/ml/recommendation/content-based', badge: 'Intermediate' },
    ],
  },
  {
    category: 'Reinforcement Learning',
    icon: 'Play',
    items: [
      { label: 'Multi-Armed Bandit', route: '/ml/reinforcement-learning/multi-armed-bandit', badge: 'Intermediate' },
      { label: 'Q-Learning Grid World', route: '/ml/reinforcement-learning/q-learning-grid-world', badge: 'Intermediate' },
      { label: 'Markov Decision Process', route: '/ml/reinforcement-learning/markov-decision-process', badge: 'Advanced' },
    ],
  },
  {
    category: 'Explainability',
    icon: 'Lightbulb',
    items: [
      { label: 'Feature Importance', route: '/ml/explainability/feature-importance', badge: 'Intermediate' },
      { label: 'Partial Dependence Plot', route: '/ml/explainability/partial-dependence-plot', badge: 'Intermediate' },
      { label: 'SHAP', route: '/ml/explainability/shap-concept', badge: 'Advanced' },
      { label: 'LIME', route: '/ml/explainability/lime-concept', badge: 'Advanced' },
    ],
  },
  {
    category: 'Optimization',
    icon: 'Zap',
    items: [
      { label: 'Gradient Descent', route: '/ml/optimization/gradient-descent', badge: 'Beginner' },
      { label: 'Stochastic Gradient Descent', route: '/ml/optimization/sgd', badge: 'Intermediate' },
      { label: 'Momentum Optimizer', route: '/ml/optimization/momentum', badge: 'Intermediate' },
      { label: 'Adam Optimizer', route: '/ml/optimization/adam', badge: 'Intermediate' },
    ],
  },
  {
    category: 'Ensemble',
    icon: 'Layers',
    items: [
      { label: 'Bagging', route: '/ml/ensemble/bagging', badge: 'Intermediate' },
      { label: 'Boosting', route: '/ml/ensemble/boosting', badge: 'Intermediate' },
      { label: 'Stacking', route: '/ml/ensemble/stacking', badge: 'Advanced' },
    ],
  },
  {
    category: 'Probabilistic',
    icon: 'Sigma',
    items: [
      { label: 'Bayesian Linear Regression', route: '/ml/probabilistic/bayesian-linear-regression', badge: 'Advanced' },
      { label: 'Gaussian Process Regression', route: '/ml/probabilistic/gaussian-process-regression', badge: 'Advanced' },
      { label: 'Hidden Markov Model', route: '/ml/probabilistic/hidden-markov-model', badge: 'Advanced' },
    ],
  },
  {
    category: 'Deployment',
    icon: 'Upload',
    items: [
      { label: 'Browser Model Loader', route: '/ml/deployment/browser-model-loader', badge: 'Browser Inference' },
      { label: 'ONNX Runtime Web Demo', route: '/ml/deployment/onnx-runtime-demo', badge: 'Browser Inference' },
      { label: 'TensorFlow.js Training', route: '/ml/deployment/tensorflowjs-training', badge: 'Browser Trainable' },
      { label: 'Model Export', route: '/ml/deployment/model-export', badge: 'Intermediate' },
    ],
  },
  {
    category: 'Lab',
    icon: 'FlaskConical',
    items: [
      { label: 'Algorithm Comparison Lab', route: '/ml/lab/algorithm-comparison', badge: 'Advanced' },
      { label: 'Hyperparameter Tuning Lab', route: '/ml/lab/hyperparameter-tuning', badge: 'Advanced' },
      { label: 'AutoML Lab', route: '/ml/lab/automl-concept', badge: 'Advanced' },
      { label: 'Saved Experiments', route: '/ml/lab/saved-experiments', badge: 'Intermediate' },
      { label: 'Dataset Manager', route: '/ml/lab/dataset-manager', badge: 'Beginner' },
      { label: 'Report Builder', route: '/ml/lab/report-builder', badge: 'Intermediate' },
    ],
  },
];

