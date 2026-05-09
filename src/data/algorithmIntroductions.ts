import type { AlgorithmNavItem } from './implementationStatus';

export interface AlgorithmIntroduction {
  summary: string;
  useWhen: string;
  watchFor: string;
}

const categoryIntro: Record<string, Omit<AlgorithmIntroduction, 'summary'>> = {
  'Supervised - Regression': {
    useWhen: 'Use it when the target is a number and you have labeled examples to learn from.',
    watchFor: 'Watch residual patterns, feature scale, outliers, and whether validation error stays close to training error.',
  },
  'Supervised - Classification': {
    useWhen: 'Use it when the target is a category and each training example already has a label.',
    watchFor: 'Watch class balance, decision boundaries, threshold behavior, and confusion between similar classes.',
  },
  Clustering: {
    useWhen: 'Use it when you want to discover groups or structure without target labels.',
    watchFor: 'Watch feature scaling, distance assumptions, cluster size imbalance, and whether the discovered groups make practical sense.',
  },
  'Dimensionality Reduction': {
    useWhen: 'Use it when many features need to be compressed, visualized, denoised, or made easier for another model to consume.',
    watchFor: 'Watch how much structure is preserved and whether the reduced view hides information needed by the downstream task.',
  },
  'Deep Learning': {
    useWhen: 'Use it when patterns are complex enough that layered learned representations are useful.',
    watchFor: 'Watch training stability, validation loss, data volume, overfitting, and input normalization.',
  },
  Evaluation: {
    useWhen: 'Use it when you need to judge model behavior before trusting a result.',
    watchFor: 'Watch whether the metric matches the real cost of mistakes and whether the data split reflects the production setting.',
  },
  Preprocessing: {
    useWhen: 'Use it before modeling when raw data needs cleaning, transformation, scaling, or safer representation.',
    watchFor: 'Watch data leakage, train/test consistency, missing values, outliers, and transformations that change feature meaning.',
  },
  'Time Series': {
    useWhen: 'Use it when observations are ordered in time and the order carries predictive signal.',
    watchFor: 'Watch trend, seasonality, lagged effects, anomalies, and whether validation respects chronological order.',
  },
  NLP: {
    useWhen: 'Use it when text, tokens, documents, sentiment, or audio-derived language features need to become model inputs.',
    watchFor: 'Watch vocabulary choices, preprocessing, rare terms, context loss, and examples that use different wording.',
  },
  'Computer Vision': {
    useWhen: 'Use it when visual inputs need to be classified, detected, segmented, transformed, or summarized.',
    watchFor: 'Watch lighting, resolution, background, camera variation, preprocessing, and examples outside the training distribution.',
  },
  Recommendation: {
    useWhen: 'Use it when the goal is to rank items for a user, item, or context.',
    watchFor: 'Watch cold-start cases, popularity bias, sparse interactions, diversity, and whether the ranking is useful beyond top accuracy.',
  },
  'Reinforcement Learning': {
    useWhen: 'Use it when an agent must learn actions through rewards over repeated interaction.',
    watchFor: 'Watch exploration, delayed rewards, unstable policies, reward design, and whether learned behavior matches the intended goal.',
  },
  Explainability: {
    useWhen: 'Use it when you need to understand which features, examples, or model behaviors influenced a prediction.',
    watchFor: 'Watch the difference between explanation and causation, and compare local explanations with global behavior.',
  },
  Optimization: {
    useWhen: 'Use it when model parameters must be updated to reduce a loss or objective.',
    watchFor: 'Watch learning rate, convergence, noisy updates, local minima, and whether the objective matches the real task.',
  },
  Ensemble: {
    useWhen: 'Use it when combining multiple models can improve stability, accuracy, or robustness.',
    watchFor: 'Watch compute cost, interpretability, correlated model errors, and whether gains justify the added complexity.',
  },
  Probabilistic: {
    useWhen: 'Use it when uncertainty is part of the answer rather than a detail to ignore.',
    watchFor: 'Watch distribution assumptions, calibration, uncertainty intervals, and computational cost.',
  },
  Deployment: {
    useWhen: 'Use it when a trained model needs to run, load, export, or be tested in a browser or production-like environment.',
    watchFor: 'Watch model size, latency, preprocessing parity, unsupported operations, memory use, and output consistency.',
  },
  Lab: {
    useWhen: 'Use it when comparing experiments, managing datasets, saving results, or preparing reports.',
    watchFor: 'Watch reproducibility, consistent metrics, dataset versions, random seeds, and notes that explain why results changed.',
  },
};

const routeIntro: Record<string, Partial<AlgorithmIntroduction>> = {
  '/ml/clustering/k-means': {
    summary: 'K-Means partitions unlabeled data into K groups by repeatedly assigning points to the nearest centroid and moving each centroid to the middle of its assigned points.',
    useWhen: 'Use it for fast, interpretable grouping when clusters are roughly compact and numeric features can be scaled.',
    watchFor: 'Watch the chosen K, random initialization, outliers, and the important distinction from KNN: K-Means clusters unlabeled data, while KNN predicts from labeled neighbors.',
  },
  '/ml/supervised/knn-classification': {
    summary: 'K-Nearest Neighbors classifies a new point by looking at the labels of the closest training examples and letting them vote.',
    useWhen: 'Use it as a simple distance-based classifier when local similarity is meaningful and the dataset is not too large.',
    watchFor: 'Watch K, feature scaling, noisy labels, distance metric choice, and the distinction from K-Means: KNN is supervised prediction, not clustering.',
  },
  '/ml/supervised/simple-linear-regression': {
    summary: 'Simple linear regression learns the best straight-line relationship between one input feature and a continuous target.',
  },
  '/ml/supervised/multiple-linear-regression': {
    summary: 'Multiple linear regression estimates a continuous target from several input features at once.',
  },
  '/ml/supervised/polynomial-regression': {
    summary: 'Polynomial regression extends linear regression with curved feature terms so it can fit nonlinear trends.',
  },
  '/ml/supervised/logistic-regression': {
    summary: 'Logistic regression learns a linear scoring rule and turns it into class probabilities for classification.',
  },
  '/ml/supervised/naive-bayes': {
    summary: 'Naive Bayes predicts classes with probability rules and a simplifying assumption that features contribute independently given the class.',
  },
  '/ml/clustering/dbscan': {
    summary: 'DBSCAN discovers dense regions as clusters and marks isolated points as noise.',
  },
  '/ml/dimensionality-reduction/pca': {
    summary: 'PCA rotates features into directions of maximum variance, then keeps the most informative directions.',
  },
  '/ml/deep-learning/perceptron': {
    summary: 'A perceptron is the smallest useful neural classifier: it learns a linear boundary from mistakes.',
  },
  '/ml/deep-learning/nn-playground': {
    summary: 'The neural network playground shows how hidden layers, activations, and learning rate shape a learned decision boundary.',
  },
  '/ml/evaluation/confusion-matrix': {
    summary: 'A confusion matrix breaks classification results into correct and incorrect counts for each class.',
  },
  '/ml/evaluation/roc-auc': {
    summary: 'ROC and AUC evaluate how well a classifier ranks positives above negatives across possible thresholds.',
  },
  '/ml/evaluation/regression-metrics': {
    summary: 'Regression metrics summarize how far numeric predictions are from actual target values.',
  },
  '/ml/preprocessing/scaling-normalization': {
    summary: 'Scaling and normalization put features onto comparable numeric ranges so distance-based and gradient-based models behave better.',
  },
  '/ml/time-series/moving-average': {
    summary: 'Moving average smooths a time series by replacing each point with a local window average.',
  },
  '/ml/nlp/tf-idf': {
    summary: 'TF-IDF weights terms by how important they are in a document compared with how common they are across documents.',
  },
  '/ml/computer-vision/image-classification': {
    summary: 'Image classification assigns an entire image to one of several learned categories.',
  },
  '/ml/optimization/gradient-descent': {
    summary: 'Gradient descent improves model parameters by stepping in the direction that lowers the loss.',
  },
};

function defaultSummary(item: AlgorithmNavItem) {
  return `${item.label} is a ${item.category.toLowerCase()} technique. The interactive controls on this page are designed to show what the algorithm changes, what it measures, and where its assumptions matter.`;
}

export function getAlgorithmIntroduction(item: AlgorithmNavItem): AlgorithmIntroduction {
  const category = categoryIntro[item.category] ?? {
    useWhen: 'Use it when the method matches the data shape and the goal of the experiment.',
    watchFor: 'Watch the controls, metrics, and visualization together so the behavior is judged from more than one signal.',
  };
  const specific = routeIntro[item.route] ?? {};

  return {
    summary: specific.summary ?? defaultSummary(item),
    useWhen: specific.useWhen ?? category.useWhen,
    watchFor: specific.watchFor ?? category.watchFor,
  };
}
