import type { AlgorithmNavItem } from './implementationStatus';

export interface AlgorithmFaq {
  question: string;
  answer: string;
}

const categoryFocus: Record<string, string> = {
  'Supervised - Regression': 'predicting a continuous number from labeled examples',
  'Supervised - Classification': 'predicting a class label from labeled examples',
  Clustering: 'finding structure in unlabeled data',
  'Dimensionality Reduction': 'compressing features while preserving useful structure',
  'Deep Learning': 'learning layered representations from data',
  Evaluation: 'checking whether a model is trustworthy for the task',
  Preprocessing: 'making raw data easier and safer for models to learn from',
  'Time Series': 'modeling ordered observations where time matters',
  NLP: 'turning language or audio signals into useful model features',
  'Computer Vision': 'extracting patterns from images, video, or sensor frames',
  Recommendation: 'ranking items for a user or context',
  'Reinforcement Learning': 'learning actions from rewards over time',
  Explainability: 'understanding how model inputs influence outputs',
  Optimization: 'updating parameters to reduce an objective',
  Ensemble: 'combining models to improve stability or accuracy',
  Probabilistic: 'representing uncertainty directly in the model',
  Deployment: 'running, loading, exporting, or serving models in the browser',
  Lab: 'comparing, organizing, and reporting experiments',
};

const routeSpecificFaqs: Record<string, AlgorithmFaq[]> = {
  '/ml/clustering/k-means': [
    {
      question: 'How is K-Means clustering different from KNN?',
      answer: 'K-Means is unsupervised: it discovers groups without labels by moving centroids. KNN is supervised: it predicts a label or value for a new point by looking at nearby labeled examples.',
    },
    {
      question: 'Why does K-Means need K before training?',
      answer: 'K is the number of clusters the algorithm will search for. If K is too small, different groups get merged. If it is too large, one natural group can be split into artificial pieces.',
    },
    {
      question: 'When does K-Means work best?',
      answer: 'It works best when clusters are compact, roughly round, similarly sized, and measured on scaled numeric features.',
    },
  ],
  '/ml/supervised/knn-classification': [
    {
      question: 'How is KNN different from K-Means clustering?',
      answer: 'KNN uses labeled training examples to classify or predict new points. K-Means uses unlabeled data to form clusters, and its K means number of clusters rather than number of neighbors.',
    },
    {
      question: 'What does K control in KNN?',
      answer: 'K controls how many nearby labeled examples vote on the prediction. Smaller K reacts quickly to local patterns, while larger K is smoother but can hide small class regions.',
    },
    {
      question: 'Why is scaling important for KNN?',
      answer: 'KNN depends directly on distance. A feature measured in larger units can dominate the neighbor search unless features are scaled first.',
    },
  ],
  '/ml/supervised/logistic-regression': [
    {
      question: 'Why is logistic regression used for classification?',
      answer: 'It maps a linear score through a sigmoid or softmax function so the output can be interpreted as class probability.',
    },
  ],
  '/ml/supervised/simple-linear-regression': [
    {
      question: 'When is simple linear regression a good fit?',
      answer: 'Use it when one input feature has an approximately linear relationship with a continuous target and residuals do not show a strong pattern.',
    },
  ],
  '/ml/clustering/dbscan': [
    {
      question: 'How is DBSCAN different from K-Means?',
      answer: 'DBSCAN finds dense regions and labels sparse points as noise. It does not require choosing the number of clusters up front and can discover irregular shapes.',
    },
  ],
  '/ml/dimensionality-reduction/pca': [
    {
      question: 'What does PCA preserve?',
      answer: 'PCA preserves directions of maximum variance. That often keeps broad structure, but it does not automatically preserve class boundaries.',
    },
  ],
  '/ml/evaluation/roc-auc': [
    {
      question: 'What does AUC tell me?',
      answer: 'AUC summarizes how well scores rank positives above negatives across thresholds. It is about ranking quality, not one chosen cutoff.',
    },
  ],
  '/ml/evaluation/precision-recall-curve': [
    {
      question: 'When is a precision-recall curve better than ROC?',
      answer: 'It is often more revealing for imbalanced data because it focuses on positive predictions and missed positives.',
    },
  ],
  '/ml/optimization/gradient-descent': [
    {
      question: 'What does the learning rate control?',
      answer: 'It controls the step size for each update. Too small is slow, too large can overshoot or diverge.',
    },
  ],
};

const categorySpecificFaqs: Record<string, AlgorithmFaq[]> = {
  'Supervised - Regression': [
    {
      question: 'Which metric should I check first?',
      answer: 'Start with MAE or RMSE for prediction error, then inspect residuals to see whether the model misses patterns systematically.',
    },
    {
      question: 'How do I know the regression model is overfitting?',
      answer: 'If training error is low but validation or test error is much worse, the model is probably fitting noise or quirks in the training set.',
    },
  ],
  'Supervised - Classification': [
    {
      question: 'Should I optimize accuracy?',
      answer: 'Accuracy is fine for balanced classes, but imbalanced data usually needs precision, recall, F1, ROC-AUC, or PR-AUC depending on the cost of mistakes.',
    },
    {
      question: 'What should I tune first?',
      answer: 'Start with preprocessing and the main complexity control for the model, then tune thresholds if the classifier outputs probabilities or scores.',
    },
  ],
  Clustering: [
    {
      question: 'How do I validate clusters without labels?',
      answer: 'Use internal checks like silhouette score, inspect cluster sizes, and verify that the groups make sense in the original feature space.',
    },
    {
      question: 'Why do clustering results change after scaling?',
      answer: 'Most clustering methods depend on distance or similarity, so a large-scale feature can dominate the grouping unless features are normalized.',
    },
  ],
  Evaluation: [
    {
      question: 'Can I compare models with one metric?',
      answer: 'One headline metric is useful, but always pair it with diagnostics such as class errors, residuals, calibration, or threshold behavior.',
    },
  ],
  Preprocessing: [
    {
      question: 'Can preprocessing leak information?',
      answer: 'Yes. Fit preprocessing steps on training data only, then apply the learned transformation to validation, test, and production data.',
    },
  ],
  'Deep Learning': [
    {
      question: 'How do I reduce overfitting?',
      answer: 'Use validation data, regularization, dropout where appropriate, data augmentation, early stopping, or a smaller architecture.',
    },
  ],
};

function genericFaqs(item: AlgorithmNavItem): AlgorithmFaq[] {
  const focus = categoryFocus[item.category] ?? 'understanding the model behavior';
  return [
    {
      question: `What is ${item.label} used for?`,
      answer: `${item.label} is used for ${focus}. This page lets you adjust inputs and observe how the algorithm responds.`,
    },
    {
      question: `When should I choose ${item.label}?`,
      answer: `Choose ${item.label} when its assumptions match your data and the tradeoff shown in the visualization fits the goal of the problem.`,
    },
    {
      question: `What should I watch while tuning ${item.label}?`,
      answer: 'Watch the metric panel, the visual pattern, and whether small parameter changes produce stable behavior or sudden jumps.',
    },
  ];
}

export function getAlgorithmFaqs(item: AlgorithmNavItem): AlgorithmFaq[] {
  const specific = routeSpecificFaqs[item.route] ?? [];
  const category = categorySpecificFaqs[item.category] ?? [];
  const generic = genericFaqs(item);
  return [...specific, ...category, ...generic].slice(0, 6);
}
