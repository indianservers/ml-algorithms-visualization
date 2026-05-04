import { getAlgorithmByRoute } from './implementationStatus';

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface LearningContent {
  objectives: string[];
  intuition: string;
  pseudocode: string[];
  formula: string;
  code: string;
  python: string;
  mistakes: string[];
  challenge: string;
  quiz: QuizQuestion[];
}

const categoryHints: Record<string, Pick<LearningContent, 'formula' | 'challenge'>> = {
  'Supervised - Regression': {
    formula: 'minimize mean squared error: J(theta) = (1/n) sum (y - y_hat)^2',
    challenge: 'Tune the model to reduce validation error without widening the train/test gap.',
  },
  'Supervised - Classification': {
    formula: 'optimize class probabilities and evaluate precision, recall, F1, ROC, or PR curves',
    challenge: 'Move the decision threshold and find a useful tradeoff between false positives and false negatives.',
  },
  Clustering: {
    formula: 'group points by distance, density, likelihood, or graph structure without labels',
    challenge: 'Change the data shape and hyperparameters until the clusters match the visible structure.',
  },
  'Dimensionality Reduction': {
    formula: 'project high-dimensional data into fewer dimensions while preserving variance or neighborhoods',
    challenge: 'Reduce dimensions while preserving class separation or neighborhood structure.',
  },
  'Deep Learning': {
    formula: 'forward pass -> loss -> backpropagation -> weight update',
    challenge: 'Adjust architecture and learning rate until loss falls smoothly without instability.',
  },
  Evaluation: {
    formula: 'measure generalization by comparing predictions, labels, thresholds, splits, and residuals',
    challenge: 'Find a metric setting that matches the business cost of different errors.',
  },
  Preprocessing: {
    formula: 'transform raw columns into clean, scaled, encoded, and leak-free model inputs',
    challenge: 'Create the cleanest version of the dataset while avoiding leakage from validation data.',
  },
  'Time Series': {
    formula: 'forecast future values from trend, seasonality, lagged values, and residual structure',
    challenge: 'Tune smoothing or window size to follow trend without chasing noise.',
  },
  NLP: {
    formula: 'convert text into tokens, counts, weights, embeddings, probabilities, or sequence states',
    challenge: 'Edit example text and inspect which tokens or weights drive the prediction.',
  },
  'Computer Vision': {
    formula: 'transform pixels through filters, features, embeddings, or learned convolutional layers',
    challenge: 'Alter the image or filter and explain which visual pattern becomes easier to detect.',
  },
  Recommendation: {
    formula: 'estimate user-item preference from similarity, content features, or latent factors',
    challenge: 'Create a cold-start case and compare content-based versus collaborative behavior.',
  },
  'Reinforcement Learning': {
    formula: 'learn value from reward: Q(s,a) <- Q(s,a) + alpha [r + gamma max Q(s\',a\') - Q(s,a)]',
    challenge: 'Tune exploration and discounting so the agent learns a stable policy.',
  },
  Explainability: {
    formula: 'attribute model behavior to feature changes, local perturbations, or marginal effects',
    challenge: 'Find one example where global importance and local explanation disagree.',
  },
  Optimization: {
    formula: 'theta <- theta - learning_rate * gradient(loss)',
    challenge: 'Find the fastest stable learning rate and compare it with momentum or Adam behavior.',
  },
  Ensemble: {
    formula: 'combine multiple learners by voting, averaging, boosting, or stacking',
    challenge: 'Compare one strong model with several weak models combined.',
  },
  Probabilistic: {
    formula: 'represent uncertainty with distributions, priors, likelihoods, posteriors, or hidden states',
    challenge: 'Change prior or noise assumptions and inspect how uncertainty changes.',
  },
  Deployment: {
    formula: 'package model artifacts, inputs, outputs, metadata, and runtime constraints for inference',
    challenge: 'Export a small model card with intended use and limitations.',
  },
  Lab: {
    formula: 'compare algorithms under identical data, splits, metrics, and reporting rules',
    challenge: 'Run at least three algorithms on the same dataset and defend the chosen winner.',
  },
};

function resolveHints(route: string) {
  const item = getAlgorithmByRoute(route);
  const hints = item ? categoryHints[item.category] : undefined;
  return {
    item,
    formula: hints?.formula ?? 'inspect data -> configure model -> compute output -> evaluate behavior',
    challenge: hints?.challenge ?? 'Run a controlled experiment and explain what changed.',
  };
}

export function getLearningContent(route: string): LearningContent {
  const { item, formula, challenge } = resolveHints(route);
  const label = item?.label ?? 'this algorithm';
  const category = item?.category ?? 'Machine Learning';
  return {
    objectives: [
      `Explain what ${label} is trying to optimize or reveal.`,
      `Identify the most important input data assumptions for ${category}.`,
      'Run one controlled experiment and interpret the metric or visualization change.',
    ],
    intuition: `${label} becomes easier to learn when you connect the controls to the visible behavior: data shape, parameter choice, model output, metric movement, and failure mode.`,
    pseudocode: [
      'Choose a dataset and inspect feature/label structure.',
      'Set one or two hyperparameters before running.',
      'Compute the model output in small visible steps.',
      'Evaluate the output with a metric and a chart.',
      'Change exactly one parameter and compare the new run.',
    ],
    formula,
    code: `const run = configure("${label}");\nconst result = run.fit(data, params);\nconst metrics = evaluate(result, validationData);\nsaveExperiment({ algorithm: "${label}", params, metrics });`,
    python: `# Equivalent learning workflow\nmodel = choose_model("${label}")\nmodel.fit(X_train, y_train)\nmetrics = evaluate(model, X_test, y_test)`,
    mistakes: [
      'Changing many parameters at once and losing the cause of the metric movement.',
      'Reading training performance as generalization performance.',
      'Ignoring whether the dataset shape matches the algorithm assumptions.',
    ],
    challenge,
    quiz: [
      {
        question: `What is the best first thing to inspect before trusting ${label}?`,
        options: ['Dataset shape and assumptions', 'Only the final metric', 'Only the prettiest chart'],
        answer: 0,
        explanation: 'The same metric can mean different things when data shape, leakage, imbalance, or assumptions change.',
      },
      {
        question: 'Why should you change one control at a time while learning?',
        options: ['It makes causal interpretation easier', 'It always improves accuracy', 'It removes the need for validation'],
        answer: 0,
        explanation: 'Controlled changes help connect parameter movement to model behavior.',
      },
      {
        question: 'What should a strong experiment export include?',
        options: ['Parameters, data context, metrics, notes, and limitations', 'Only a screenshot', 'Only the algorithm name'],
        answer: 0,
        explanation: 'A useful report needs enough context for another learner to reproduce and critique the result.',
      },
    ],
  };
}
