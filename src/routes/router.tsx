import React, { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';

const HomePage = lazy(() => import('../pages/HomePage'));
const ImplementationMatrixPage = lazy(() => import('../pages/ImplementationMatrixPage'));
const DocumentationPage = lazy(() => import('../pages/DocumentationPage'));
const DatasetLibraryPage = lazy(() => import('../pages/DatasetLibraryPage'));
const SitemapPage = lazy(() => import('../pages/SitemapPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

// Supervised – Regression
const SimpleLinearRegressionPage = lazy(() => import('../pages/algorithms/supervised/regression/SimpleLinearRegressionPage'));
const MultipleLinearRegressionPage = lazy(() => import('../pages/algorithms/supervised/regression/MultipleLinearRegressionPage'));
const PolynomialRegressionPage = lazy(() => import('../pages/algorithms/supervised/regression/PolynomialRegressionPage'));
const RidgeRegressionPage = lazy(() => import('../pages/algorithms/supervised/regression/RidgeRegressionPage'));
const LassoRegressionPage = lazy(() => import('../pages/algorithms/supervised/regression/LassoRegressionPage'));
const ElasticNetRegressionPage = lazy(() => import('../pages/algorithms/supervised/regression/ElasticNetRegressionPage'));
const DecisionTreeRegressionPage = lazy(() => import('../pages/algorithms/supervised/regression/DecisionTreeRegressionPage'));
const RandomForestRegressionPage = lazy(() => import('../pages/algorithms/supervised/regression/RandomForestRegressionPage'));
const GradientBoostingRegressionPage = lazy(() => import('../pages/algorithms/supervised/regression/GradientBoostingRegressionPage'));
const SupportVectorRegressionPage = lazy(() => import('../pages/algorithms/supervised/regression/SupportVectorRegressionPage'));

// Supervised – Classification
const LogisticRegressionPage = lazy(() => import('../pages/algorithms/supervised/classification/LogisticRegressionPage'));
const MultinomialLogisticRegressionPage = lazy(() => import('../pages/algorithms/supervised/classification/MultinomialLogisticRegressionPage'));
const KNNClassificationPage = lazy(() => import('../pages/algorithms/supervised/classification/KNNClassificationPage'));
const NaiveBayesPage = lazy(() => import('../pages/algorithms/supervised/classification/NaiveBayesPage'));
const DecisionTreeClassificationPage = lazy(() => import('../pages/algorithms/supervised/classification/DecisionTreeClassificationPage'));
const RandomForestClassificationPage = lazy(() => import('../pages/algorithms/supervised/classification/RandomForestClassificationPage'));
const SVMClassificationPage = lazy(() => import('../pages/algorithms/supervised/classification/SVMClassificationPage'));
const GradientBoostingClassificationPage = lazy(() => import('../pages/algorithms/supervised/classification/GradientBoostingClassificationPage'));
const AdaBoostClassificationPage = lazy(() => import('../pages/algorithms/supervised/classification/AdaBoostClassificationPage'));
const XGBoostConceptPage = lazy(() => import('../pages/algorithms/supervised/classification/XGBoostConceptPage'));

// Clustering
const KMeansPage = lazy(() => import('../pages/algorithms/clustering/KMeansPage'));
const KMedoidsPage = lazy(() => import('../pages/algorithms/clustering/KMedoidsPage'));
const HierarchicalClusteringPage = lazy(() => import('../pages/algorithms/clustering/HierarchicalClusteringPage'));
const DBSCANPage = lazy(() => import('../pages/algorithms/clustering/DBSCANPage'));
const MeanShiftPage = lazy(() => import('../pages/algorithms/clustering/MeanShiftPage'));
const GaussianMixtureModelPage = lazy(() => import('../pages/algorithms/clustering/GaussianMixtureModelPage'));
const SpectralClusteringPage = lazy(() => import('../pages/algorithms/clustering/SpectralClusteringPage'));
const OPTICSPage = lazy(() => import('../pages/algorithms/clustering/OPTICSPage'));

// Dimensionality Reduction
const PCAPage = lazy(() => import('../pages/algorithms/dimensionality/PCAPage'));
const KernelPCAPage = lazy(() => import('../pages/algorithms/dimensionality/KernelPCAPage'));
const TSNEPage = lazy(() => import('../pages/algorithms/dimensionality/TSNEPage'));
const UMAPConceptPage = lazy(() => import('../pages/algorithms/dimensionality/UMAPConceptPage'));
const LDAPage = lazy(() => import('../pages/algorithms/dimensionality/LDAPage'));
const AutoencoderDimensionalityPage = lazy(() => import('../pages/algorithms/dimensionality/AutoencoderDimensionalityPage'));

// Deep Learning
const PerceptronPage = lazy(() => import('../pages/algorithms/deepLearning/PerceptronPage'));
const MLPPage = lazy(() => import('../pages/algorithms/deepLearning/MLPPage'));
const NeuralNetworkPlaygroundPage = lazy(() => import('../pages/algorithms/deepLearning/NeuralNetworkPlaygroundPage'));
const CNNPage = lazy(() => import('../pages/algorithms/deepLearning/CNNPage'));
const ConvolutionVisualizerPage = lazy(() => import('../pages/algorithms/deepLearning/ConvolutionVisualizerPage'));
const RNNPage = lazy(() => import('../pages/algorithms/deepLearning/RNNPage'));
const LSTMPage = lazy(() => import('../pages/algorithms/deepLearning/LSTMPage'));
const GRUPage = lazy(() => import('../pages/algorithms/deepLearning/GRUPage'));
const TransformerAttentionPage = lazy(() => import('../pages/algorithms/deepLearning/TransformerAttentionPage'));
const MultiHeadAttentionPage = lazy(() => import('../pages/algorithms/deepLearning/MultiHeadAttentionPage'));
const BackpropagationVisualizerPage = lazy(() => import('../pages/algorithms/deepLearning/BackpropagationVisualizerPage'));

// Evaluation
const TrainTestSplitPage = lazy(() => import('../pages/algorithms/evaluation/TrainTestSplitPage'));
const CrossValidationPage = lazy(() => import('../pages/algorithms/evaluation/CrossValidationPage'));
const ConfusionMatrixPage = lazy(() => import('../pages/algorithms/evaluation/ConfusionMatrixPage'));
const ROCAUCPage = lazy(() => import('../pages/algorithms/evaluation/ROCAUCPage'));
const PrecisionRecallCurvePage = lazy(() => import('../pages/algorithms/evaluation/PrecisionRecallCurvePage'));
const RegressionMetricsPage = lazy(() => import('../pages/algorithms/evaluation/RegressionMetricsPage'));
const BiasVarianceTradeoffPage = lazy(() => import('../pages/algorithms/evaluation/BiasVarianceTradeoffPage'));

// Preprocessing
const MissingValuesPage = lazy(() => import('../pages/algorithms/preprocessing/MissingValuesPage'));
const ScalingNormalizationPage = lazy(() => import('../pages/algorithms/preprocessing/ScalingNormalizationPage'));
const CategoricalEncodingPage = lazy(() => import('../pages/algorithms/preprocessing/CategoricalEncodingPage'));
const OutlierDetectionPage = lazy(() => import('../pages/algorithms/preprocessing/OutlierDetectionPage'));
const FeatureSelectionPage = lazy(() => import('../pages/algorithms/preprocessing/FeatureSelectionPage'));
const PolynomialFeaturesPage = lazy(() => import('../pages/algorithms/preprocessing/PolynomialFeaturesPage'));

// Time Series
const MovingAveragePage = lazy(() => import('../pages/algorithms/timeSeries/MovingAveragePage'));
const ExponentialSmoothingPage = lazy(() => import('../pages/algorithms/timeSeries/ExponentialSmoothingPage'));
const HoltWintersPage = lazy(() => import('../pages/algorithms/timeSeries/HoltWintersPage'));
const ARIMAConceptPage = lazy(() => import('../pages/algorithms/timeSeries/ARIMAConceptPage'));
const TimeSeriesAnomalyDetectionPage = lazy(() => import('../pages/algorithms/timeSeries/TimeSeriesAnomalyDetectionPage'));

// NLP
const BagOfWordsPage = lazy(() => import('../pages/algorithms/nlp/BagOfWordsPage'));
const TFIDFPage = lazy(() => import('../pages/algorithms/nlp/TFIDFPage'));
const TextClassificationPage = lazy(() => import('../pages/algorithms/nlp/TextClassificationPage'));
const WordEmbeddingConceptPage = lazy(() => import('../pages/algorithms/nlp/WordEmbeddingConceptPage'));
const SentimentAnalysisPage = lazy(() => import('../pages/algorithms/nlp/SentimentAnalysisPage'));
const NaiveBayesSpamClassifierPage = lazy(() => import('../pages/algorithms/nlp/NaiveBayesSpamClassifierPage'));
const AudioClassificationPage = lazy(() => import('../pages/algorithms/nlp/AudioClassificationPage'));

// Computer Vision
const ImageClassificationPage = lazy(() => import('../pages/algorithms/computerVision/ImageClassificationPage'));
const HandGestureRecognitionPage = lazy(() => import('../pages/algorithms/computerVision/HandGestureRecognitionPage'));
const PoseDetectionPage = lazy(() => import('../pages/algorithms/computerVision/PoseDetectionPage'));
const PersonSegmentationPage = lazy(() => import('../pages/algorithms/computerVision/PersonSegmentationPage'));
const CNNFilterExplorerPage = lazy(() => import('../pages/algorithms/computerVision/CNNFilterExplorerPage'));
const KMeansImageSegmentationPage = lazy(() => import('../pages/algorithms/computerVision/KMeansImageSegmentationPage'));
const EdgeDetectionPage = lazy(() => import('../pages/algorithms/computerVision/EdgeDetectionPage'));
const ObjectDetectionDemoPage = lazy(() => import('../pages/algorithms/computerVision/ObjectDetectionDemoPage'));

// Recommendation
const UserBasedCFPage = lazy(() => import('../pages/algorithms/recommendation/UserBasedCFPage'));
const ItemBasedCFPage = lazy(() => import('../pages/algorithms/recommendation/ItemBasedCFPage'));
const MatrixFactorizationPage = lazy(() => import('../pages/algorithms/recommendation/MatrixFactorizationPage'));
const ContentBasedRecommendationPage = lazy(() => import('../pages/algorithms/recommendation/ContentBasedRecommendationPage'));

// Reinforcement Learning
const MultiArmedBanditPage = lazy(() => import('../pages/algorithms/reinforcementLearning/MultiArmedBanditPage'));
const QLearningGridWorldPage = lazy(() => import('../pages/algorithms/reinforcementLearning/QLearningGridWorldPage'));
const MarkovDecisionProcessPage = lazy(() => import('../pages/algorithms/reinforcementLearning/MarkovDecisionProcessPage'));

// Explainability
const FeatureImportancePage = lazy(() => import('../pages/algorithms/explainability/FeatureImportancePage'));
const PartialDependencePlotPage = lazy(() => import('../pages/algorithms/explainability/PartialDependencePlotPage'));
const SHAPConceptPage = lazy(() => import('../pages/algorithms/explainability/SHAPConceptPage'));
const LIMEConceptPage = lazy(() => import('../pages/algorithms/explainability/LIMEConceptPage'));

// Optimization
const GradientDescentPage = lazy(() => import('../pages/algorithms/optimization/GradientDescentPage'));
const SGDPage = lazy(() => import('../pages/algorithms/optimization/SGDPage'));
const MomentumOptimizerPage = lazy(() => import('../pages/algorithms/optimization/MomentumOptimizerPage'));
const AdamOptimizerPage = lazy(() => import('../pages/algorithms/optimization/AdamOptimizerPage'));

// Ensemble
const BaggingPage = lazy(() => import('../pages/algorithms/ensemble/BaggingPage'));
const BoostingPage = lazy(() => import('../pages/algorithms/ensemble/BoostingPage'));
const StackingPage = lazy(() => import('../pages/algorithms/ensemble/StackingPage'));

// Probabilistic
const BayesianLinearRegressionPage = lazy(() => import('../pages/algorithms/probabilistic/BayesianLinearRegressionPage'));
const GaussianProcessRegressionPage = lazy(() => import('../pages/algorithms/probabilistic/GaussianProcessRegressionPage'));
const HiddenMarkovModelPage = lazy(() => import('../pages/algorithms/probabilistic/HiddenMarkovModelPage'));

// Deployment
const BrowserModelLoaderPage = lazy(() => import('../pages/algorithms/deployment/BrowserModelLoaderPage'));
const ONNXRuntimeWebDemoPage = lazy(() => import('../pages/algorithms/deployment/ONNXRuntimeWebDemoPage'));
const TensorFlowJSTrainingPage = lazy(() => import('../pages/algorithms/deployment/TensorFlowJSTrainingPage'));
const ModelExportPage = lazy(() => import('../pages/algorithms/deployment/ModelExportPage'));

// Lab
const AlgorithmComparisonLabPage = lazy(() => import('../pages/algorithms/lab/AlgorithmComparisonLabPage'));
const HyperparameterTuningLabPage = lazy(() => import('../pages/algorithms/lab/HyperparameterTuningLabPage'));
const AutoMLConceptLabPage = lazy(() => import('../pages/algorithms/lab/AutoMLConceptLabPage'));
const SavedExperimentsPage = lazy(() => import('../pages/algorithms/lab/SavedExperimentsPage'));
const DatasetManagerPage = lazy(() => import('../pages/algorithms/lab/DatasetManagerPage'));
const ReportBuilderPage = lazy(() => import('../pages/algorithms/lab/ReportBuilderPage'));
const ArchitectureFlowLabPage = lazy(() => import('../pages/algorithms/lab/ArchitectureFlowLabPage'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'documentation', element: <DocumentationPage /> },
      { path: 'dataset-library', element: <DatasetLibraryPage /> },
      { path: 'sitemap', element: <SitemapPage /> },
      { path: 'implementation-matrix', element: <ImplementationMatrixPage /> },
      // Supervised – Regression
      { path: 'ml/supervised/simple-linear-regression', element: <SimpleLinearRegressionPage /> },
      { path: 'ml/supervised/multiple-linear-regression', element: <MultipleLinearRegressionPage /> },
      { path: 'ml/supervised/polynomial-regression', element: <PolynomialRegressionPage /> },
      { path: 'ml/supervised/ridge-regression', element: <RidgeRegressionPage /> },
      { path: 'ml/supervised/lasso-regression', element: <LassoRegressionPage /> },
      { path: 'ml/supervised/elastic-net-regression', element: <ElasticNetRegressionPage /> },
      { path: 'ml/supervised/decision-tree-regression', element: <DecisionTreeRegressionPage /> },
      { path: 'ml/supervised/random-forest-regression', element: <RandomForestRegressionPage /> },
      { path: 'ml/supervised/gradient-boosting-regression', element: <GradientBoostingRegressionPage /> },
      { path: 'ml/supervised/support-vector-regression', element: <SupportVectorRegressionPage /> },
      // Supervised – Classification
      { path: 'ml/supervised/logistic-regression', element: <LogisticRegressionPage /> },
      { path: 'ml/supervised/multinomial-logistic-regression', element: <MultinomialLogisticRegressionPage /> },
      { path: 'ml/supervised/knn-classification', element: <KNNClassificationPage /> },
      { path: 'ml/supervised/naive-bayes', element: <NaiveBayesPage /> },
      { path: 'ml/supervised/decision-tree-classification', element: <DecisionTreeClassificationPage /> },
      { path: 'ml/supervised/random-forest-classification', element: <RandomForestClassificationPage /> },
      { path: 'ml/supervised/svm-classification', element: <SVMClassificationPage /> },
      { path: 'ml/supervised/gradient-boosting-classification', element: <GradientBoostingClassificationPage /> },
      { path: 'ml/supervised/adaboost-classification', element: <AdaBoostClassificationPage /> },
      { path: 'ml/supervised/xgboost-concept', element: <XGBoostConceptPage /> },
      // Clustering
      { path: 'ml/clustering/k-means', element: <KMeansPage /> },
      { path: 'ml/clustering/k-medoids', element: <KMedoidsPage /> },
      { path: 'ml/clustering/hierarchical-clustering', element: <HierarchicalClusteringPage /> },
      { path: 'ml/clustering/dbscan', element: <DBSCANPage /> },
      { path: 'ml/clustering/mean-shift', element: <MeanShiftPage /> },
      { path: 'ml/clustering/gaussian-mixture-model', element: <GaussianMixtureModelPage /> },
      { path: 'ml/clustering/spectral-clustering', element: <SpectralClusteringPage /> },
      { path: 'ml/clustering/optics', element: <OPTICSPage /> },
      // Dimensionality Reduction
      { path: 'ml/dimensionality-reduction/pca', element: <PCAPage /> },
      { path: 'ml/dimensionality-reduction/kernel-pca', element: <KernelPCAPage /> },
      { path: 'ml/dimensionality-reduction/tsne', element: <TSNEPage /> },
      { path: 'ml/dimensionality-reduction/umap-concept', element: <UMAPConceptPage /> },
      { path: 'ml/dimensionality-reduction/lda', element: <LDAPage /> },
      { path: 'ml/dimensionality-reduction/autoencoder', element: <AutoencoderDimensionalityPage /> },
      // Deep Learning
      { path: 'ml/deep-learning/perceptron', element: <PerceptronPage /> },
      { path: 'ml/deep-learning/mlp', element: <MLPPage /> },
      { path: 'ml/deep-learning/nn-playground', element: <NeuralNetworkPlaygroundPage /> },
      { path: 'ml/deep-learning/cnn', element: <CNNPage /> },
      { path: 'ml/deep-learning/convolution-visualizer', element: <ConvolutionVisualizerPage /> },
      { path: 'ml/deep-learning/rnn', element: <RNNPage /> },
      { path: 'ml/deep-learning/lstm', element: <LSTMPage /> },
      { path: 'ml/deep-learning/gru', element: <GRUPage /> },
      { path: 'ml/deep-learning/transformer-attention', element: <TransformerAttentionPage /> },
      { path: 'ml/deep-learning/multi-head-attention', element: <MultiHeadAttentionPage /> },
      { path: 'ml/deep-learning/backpropagation-visualizer', element: <BackpropagationVisualizerPage /> },
      // Evaluation
      { path: 'ml/evaluation/train-test-split', element: <TrainTestSplitPage /> },
      { path: 'ml/evaluation/cross-validation', element: <CrossValidationPage /> },
      { path: 'ml/evaluation/confusion-matrix', element: <ConfusionMatrixPage /> },
      { path: 'ml/evaluation/roc-auc', element: <ROCAUCPage /> },
      { path: 'ml/evaluation/precision-recall-curve', element: <PrecisionRecallCurvePage /> },
      { path: 'ml/evaluation/regression-metrics', element: <RegressionMetricsPage /> },
      { path: 'ml/evaluation/bias-variance-tradeoff', element: <BiasVarianceTradeoffPage /> },
      // Preprocessing
      { path: 'ml/preprocessing/missing-values', element: <MissingValuesPage /> },
      { path: 'ml/preprocessing/scaling-normalization', element: <ScalingNormalizationPage /> },
      { path: 'ml/preprocessing/categorical-encoding', element: <CategoricalEncodingPage /> },
      { path: 'ml/preprocessing/outlier-detection', element: <OutlierDetectionPage /> },
      { path: 'ml/preprocessing/feature-selection', element: <FeatureSelectionPage /> },
      { path: 'ml/preprocessing/polynomial-features', element: <PolynomialFeaturesPage /> },
      // Time Series
      { path: 'ml/time-series/moving-average', element: <MovingAveragePage /> },
      { path: 'ml/time-series/exponential-smoothing', element: <ExponentialSmoothingPage /> },
      { path: 'ml/time-series/holt-winters', element: <HoltWintersPage /> },
      { path: 'ml/time-series/arima-concept', element: <ARIMAConceptPage /> },
      { path: 'ml/time-series/anomaly-detection', element: <TimeSeriesAnomalyDetectionPage /> },
      // NLP
      { path: 'ml/nlp/bag-of-words', element: <BagOfWordsPage /> },
      { path: 'ml/nlp/tf-idf', element: <TFIDFPage /> },
      { path: 'ml/nlp/text-classification', element: <TextClassificationPage /> },
      { path: 'ml/nlp/word-embedding-concept', element: <WordEmbeddingConceptPage /> },
      { path: 'ml/nlp/sentiment-analysis', element: <SentimentAnalysisPage /> },
      { path: 'ml/nlp/naive-bayes-spam', element: <NaiveBayesSpamClassifierPage /> },
      { path: 'ml/nlp/audio-classification', element: <AudioClassificationPage /> },
      // Computer Vision
      { path: 'ml/computer-vision/image-classification', element: <ImageClassificationPage /> },
      { path: 'ml/computer-vision/hand-gesture-recognition', element: <HandGestureRecognitionPage /> },
      { path: 'ml/computer-vision/pose-detection', element: <PoseDetectionPage /> },
      { path: 'ml/computer-vision/person-segmentation', element: <PersonSegmentationPage /> },
      { path: 'ml/computer-vision/cnn-filter-explorer', element: <CNNFilterExplorerPage /> },
      { path: 'ml/computer-vision/kmeans-image-segmentation', element: <KMeansImageSegmentationPage /> },
      { path: 'ml/computer-vision/edge-detection', element: <EdgeDetectionPage /> },
      { path: 'ml/computer-vision/object-detection-demo', element: <ObjectDetectionDemoPage /> },
      // Recommendation
      { path: 'ml/recommendation/user-based-cf', element: <UserBasedCFPage /> },
      { path: 'ml/recommendation/item-based-cf', element: <ItemBasedCFPage /> },
      { path: 'ml/recommendation/matrix-factorization', element: <MatrixFactorizationPage /> },
      { path: 'ml/recommendation/content-based', element: <ContentBasedRecommendationPage /> },
      // Reinforcement Learning
      { path: 'ml/reinforcement-learning/multi-armed-bandit', element: <MultiArmedBanditPage /> },
      { path: 'ml/reinforcement-learning/q-learning-grid-world', element: <QLearningGridWorldPage /> },
      { path: 'ml/reinforcement-learning/markov-decision-process', element: <MarkovDecisionProcessPage /> },
      // Explainability
      { path: 'ml/explainability/feature-importance', element: <FeatureImportancePage /> },
      { path: 'ml/explainability/partial-dependence-plot', element: <PartialDependencePlotPage /> },
      { path: 'ml/explainability/shap-concept', element: <SHAPConceptPage /> },
      { path: 'ml/explainability/lime-concept', element: <LIMEConceptPage /> },
      // Optimization
      { path: 'ml/optimization/gradient-descent', element: <GradientDescentPage /> },
      { path: 'ml/optimization/sgd', element: <SGDPage /> },
      { path: 'ml/optimization/momentum', element: <MomentumOptimizerPage /> },
      { path: 'ml/optimization/adam', element: <AdamOptimizerPage /> },
      // Ensemble
      { path: 'ml/ensemble/bagging', element: <BaggingPage /> },
      { path: 'ml/ensemble/boosting', element: <BoostingPage /> },
      { path: 'ml/ensemble/stacking', element: <StackingPage /> },
      // Probabilistic
      { path: 'ml/probabilistic/bayesian-linear-regression', element: <BayesianLinearRegressionPage /> },
      { path: 'ml/probabilistic/gaussian-process-regression', element: <GaussianProcessRegressionPage /> },
      { path: 'ml/probabilistic/hidden-markov-model', element: <HiddenMarkovModelPage /> },
      // Deployment
      { path: 'ml/deployment/browser-model-loader', element: <BrowserModelLoaderPage /> },
      { path: 'ml/deployment/onnx-runtime-demo', element: <ONNXRuntimeWebDemoPage /> },
      { path: 'ml/deployment/tensorflowjs-training', element: <TensorFlowJSTrainingPage /> },
      { path: 'ml/deployment/model-export', element: <ModelExportPage /> },
      // Lab
      { path: 'ml/lab/algorithm-comparison', element: <AlgorithmComparisonLabPage /> },
      { path: 'ml/lab/hyperparameter-tuning', element: <HyperparameterTuningLabPage /> },
      { path: 'ml/lab/automl-concept', element: <AutoMLConceptLabPage /> },
      { path: 'ml/lab/saved-experiments', element: <SavedExperimentsPage /> },
      { path: 'ml/lab/dataset-manager', element: <DatasetManagerPage /> },
      { path: 'ml/lab/report-builder', element: <ReportBuilderPage /> },
      { path: 'ml/lab/architecture-flow', element: <ArchitectureFlowLabPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
