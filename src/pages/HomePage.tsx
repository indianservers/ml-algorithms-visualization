import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, TrendingUp, Network, Minimize2, BookOpen, FlaskConical, ArrowRight, Zap, Shield, Globe, Clock, Database, GraduationCap, Trophy } from 'lucide-react';
import { getImplementationStatus, getLearningPath, getRecentRoutes, implementationSummary, type ImplementationStatus } from '../data/implementationStatus';
import { navigationData } from '../data/navigation';
import { loadExperiments, type Experiment } from '../stores/experimentStore';
import { getLearningStats } from '../stores/learningStore';
import { Badge } from '../components/common/Badge';

const categories = [
  {
    icon: <TrendingUp size={20} />,
    title: 'Supervised Learning',
    description: 'Regression & classification with interactive visualizations',
    color: 'from-blue-500 to-blue-600',
    link: '/ml/supervised/simple-linear-regression',
    count: 20,
  },
  {
    icon: <Network size={20} />,
    title: 'Clustering',
    description: 'K-Means, DBSCAN, Hierarchical, GMM with step-by-step animation',
    color: 'from-purple-500 to-purple-600',
    link: '/ml/clustering/k-means',
    count: 8,
  },
  {
    icon: <Minimize2 size={20} />,
    title: 'Dimensionality Reduction',
    description: 'PCA, t-SNE, LDA, UMAP with 2D/3D projections',
    color: 'from-indigo-500 to-indigo-600',
    link: '/ml/dimensionality-reduction/pca',
    count: 6,
  },
  {
    icon: <Brain size={20} />,
    title: 'Deep Learning',
    description: 'Perceptron to Transformers with browser-trainable models',
    color: 'from-pink-500 to-rose-600',
    link: '/ml/deep-learning/perceptron',
    count: 11,
  },
  {
    icon: <BookOpen size={20} />,
    title: 'NLP & Text',
    description: 'Bag of Words, TF-IDF, Sentiment Analysis in the browser',
    color: 'from-amber-500 to-orange-600',
    link: '/ml/nlp/tf-idf',
    count: 6,
  },
  {
    icon: <FlaskConical size={20} />,
    title: 'Algorithm Lab',
    description: 'Compare algorithms, tune hyperparameters, manage experiments',
    color: 'from-teal-500 to-green-600',
    link: '/ml/lab/algorithm-comparison',
    count: 6,
  },
];

const highlights = [
  { icon: <Globe size={16} />, text: '100% Browser-Based - No Python, No Backend' },
  { icon: <Zap size={16} />, text: '100+ Interactive Algorithm Pages' },
  { icon: <Shield size={16} />, text: 'Offline-Capable with IndexedDB Storage' },
  { icon: <Brain size={16} />, text: 'TensorFlow.js & ONNX Browser Inference' },
];

export default function HomePage() {
  const [completedOnly, setCompletedOnly] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<'All' | ImplementationStatus>('All');
  const [recentExperiments, setRecentExperiments] = React.useState<Experiment[]>([]);
  const [, setProgressTick] = React.useState(0);
  const summary = implementationSummary();
  const learningStats = getLearningStats();
  const recentRoutes = getRecentRoutes();
  const allItems = navigationData.flatMap(category => category.items);
  const learningPaths = [
    { title: 'Beginner Path', level: 'Beginner' as const, description: 'Start with the core ideas, visual intuition, and essential metrics.' },
    { title: 'Intermediate Path', level: 'Intermediate' as const, description: 'Move into regularization, validation, preprocessing, and richer models.' },
    { title: 'Advanced Path', level: 'Advanced' as const, description: 'Explore ensembles, kernels, deep learning, and probabilistic methods.' },
  ];
  const scaffoldItems = summary.items.filter(item => getImplementationStatus(item.route) === 'Scaffold').slice(0, 12);
  const recentItems = recentRoutes
    .map(route => allItems.find(item => item.route === route))
    .filter(Boolean)
    .slice(0, 6);
  const activeStatus: 'All' | ImplementationStatus = completedOnly ? 'Implemented' : statusFilter;
  const visibleCategories = categories.map(category => {
    const prefix = category.title.split(' ')[0];
    const count = summary.items.filter(item =>
      item.category.includes(prefix) && (activeStatus === 'All' || getImplementationStatus(item.route) === activeStatus)
    ).length;
    return { ...category, count };
  }).filter(category => activeStatus === 'All' || category.count > 0);

  React.useEffect(() => {
    loadExperiments()
      .then(items => setRecentExperiments(items.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)))
      .catch(() => setRecentExperiments([]));
  }, []);

  React.useEffect(() => {
    const refresh = () => setProgressTick(tick => tick + 1);
    window.addEventListener('ml:learner-progress-changed', refresh);
    return () => window.removeEventListener('ml:learner-progress-changed', refresh);
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <Brain size={15} /> Mega ML Algorithms Suite
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
          Machine Learning,{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
            Visualized
          </span>
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-6">
          Learn, experiment, and compare 100+ ML algorithms with fully interactive visualizations-
          all running directly in your browser. No installation. No server.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {highlights.map((h, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full">
              <span className="text-blue-500">{h.icon}</span> {h.text}
            </div>
          ))}
        </div>
      </div>

      {/* Quick start */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {[
          { label: 'Total Routes', value: summary.total, tone: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100' },
          { label: 'Ready', value: summary.counts.Implemented, tone: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
          { label: 'Concept/Educational', value: summary.counts.Concept + summary.counts.Educational, tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
          { label: 'Incomplete Scaffold', value: summary.counts.Scaffold, tone: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
        ].map(item => (
          <div key={item.label} className={`rounded-lg p-4 ${item.tone}`}>
            <p className="text-2xl font-bold font-mono">{item.value}</p>
            <p className="text-xs font-semibold">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="mb-10 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 lg:col-span-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white"><Trophy size={18} /> Curriculum Dashboard</h2>
              <p className="text-sm text-gray-500">Progress, quizzes, achievements, and category completion are stored locally in this browser.</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{learningStats.completed}/{learningStats.total}</p>
              <p className="text-xs font-semibold text-gray-500">routes completed</p>
            </div>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
            <div className="h-full bg-green-500" style={{ width: `${learningStats.total ? (learningStats.completed / learningStats.total) * 100 : 0}%` }} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg bg-blue-50 p-3 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
              <p className="text-xs font-bold uppercase tracking-wide">Quiz Average</p>
              <p className="mt-1 text-xl font-bold">{Math.round(learningStats.quizAverage * 100)}%</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-green-900 dark:bg-green-950/30 dark:text-green-100">
              <p className="text-xs font-bold uppercase tracking-wide">Achievements</p>
              <p className="mt-1 text-xl font-bold">{learningStats.achievements.filter(item => item.earned).length}/{learningStats.achievements.length}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="text-xs font-bold uppercase tracking-wide">Recent Notes</p>
              <p className="mt-1 text-xl font-bold">{learningStats.recentNotes.length}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Achievements</p>
              <div className="flex flex-wrap gap-2">
                {learningStats.achievements.map(item => (
                  <span key={item.id} className={`rounded-full px-3 py-1 text-xs font-semibold ${item.earned ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Category Progress</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {learningStats.categories.slice(0, 8).map(item => (
                  <div key={item.category} className="rounded border border-gray-200 px-3 py-2 text-xs dark:border-gray-700">
                    <div className="mb-1 flex justify-between gap-2">
                      <span className="truncate font-semibold text-gray-700 dark:text-gray-200">{item.category}</span>
                      <span className="font-mono text-gray-500">{item.done}/{item.total}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
                      <div className="h-full bg-blue-500" style={{ width: `${item.total ? (item.done / item.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {learningPaths.map(path => {
          const items = getLearningPath(path.level).slice(0, 4);
          return (
            <div key={path.level} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-3 flex items-start gap-3">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">{path.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{path.description}</p>
                </div>
              </div>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <Link key={item.route} to={item.route} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-blue-900/20">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-white text-[10px] font-bold text-gray-500 dark:bg-gray-900 dark:text-gray-400">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{item.label}</span>
                    <ArrowRight size={12} className="text-gray-400" />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
        <label className="flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          <input type="checkbox" checked={completedOnly} onChange={event => setCompletedOnly(event.target.checked)} />
          Show only completed pages
        </label>
        <div className="flex flex-wrap items-center justify-center gap-1 rounded border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
          {(['All', 'Implemented', 'Educational', 'Concept', 'Scaffold'] as const).map(status => (
            <button
              key={status}
              onClick={() => {
                setCompletedOnly(false);
                setStatusFilter(status);
              }}
              className={`rounded px-2.5 py-1 text-xs font-semibold ${activeStatus === status ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
            >
              {status === 'Implemented' ? 'Ready' : status}
            </button>
          ))}
        </div>
        <Link to="/implementation-matrix" className="rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-gray-900">Open Implementation Matrix</Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {visibleCategories.map((cat, i) => (
          <Link
            key={i}
            to={cat.link}
            className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all"
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-white mb-3`}>
              {cat.icon}
            </div>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">{cat.title}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{cat.description}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-400">{cat.count} algorithms</span>
              <ArrowRight size={14} className="text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
        ))}
      </div>

      {/* Featured algorithms */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white"><Clock size={17} /> Continue Where You Left Off</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recentItems.length === 0 ? (
              <p className="text-sm text-gray-500">Open any algorithm route and it will appear here.</p>
            ) : recentItems.map((item) => item && (
              <Link key={item.route} to={item.route} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-blue-900/20">
                <span className="truncate">{item.label}</span>
                {getImplementationStatus(item.route) === 'Implemented'
                  ? <Badge type={item.badge} />
                  : <Badge type={getImplementationStatus(item.route)} />}
              </Link>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white"><Database size={17} /> Recently Saved Experiments</h2>
          <div className="space-y-2">
            {recentExperiments.length === 0 ? (
              <p className="text-sm text-gray-500">Saved experiment cards will appear after you save from an implemented workbench.</p>
            ) : recentExperiments.map(experiment => (
              <div key={experiment.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">{experiment.name}</p>
                <p className="text-[11px] text-gray-500">{experiment.algorithmName} / {new Date(experiment.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {scaffoldItems.length > 0 && (
        <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
          <h2 className="mb-3 text-lg font-bold text-red-900 dark:text-red-100">Needs Implementation</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {scaffoldItems.map(item => (
              <Link key={item.route} to={item.route} className="flex items-center justify-between rounded-lg border border-red-200 bg-white/70 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-white dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                <span className="truncate">{item.label}</span>
                <Badge type="Scaffold" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Start With These</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Linear Regression', to: '/ml/supervised/simple-linear-regression', badge: 'Beginner' },
            { label: 'K-Means Clustering', to: '/ml/clustering/k-means', badge: 'Beginner' },
            { label: 'PCA', to: '/ml/dimensionality-reduction/pca', badge: 'Intermediate' },
            { label: 'Neural Network', to: '/ml/deep-learning/nn-playground', badge: 'Interactive' },
            { label: 'Logistic Regression', to: '/ml/supervised/logistic-regression', badge: 'Beginner' },
            { label: 'DBSCAN', to: '/ml/clustering/dbscan', badge: 'Intermediate' },
            { label: 'TF-IDF', to: '/ml/nlp/tf-idf', badge: 'NLP' },
            { label: 'Q-Learning', to: '/ml/reinforcement-learning/q-learning-grid-world', badge: 'Interactive' },
          ].map((item, i) => (
            <Link
              key={i}
              to={item.to}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-700 hover:border-blue-300 rounded-lg px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all group"
            >
              {item.label}
              <ArrowRight size={11} className="text-gray-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 rounded-2xl p-6 text-white">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { num: '100+', label: 'Algorithm Pages' },
            { num: '15+', label: 'Algorithm Categories' },
            { num: '0', label: 'Backend Dependencies' },
            { num: '8', label: 'Experiments to Save' },
          ].map((stat, i) => (
            <div key={i}>
              <p className="text-3xl font-bold">{stat.num}</p>
              <p className="text-sm text-blue-200">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

