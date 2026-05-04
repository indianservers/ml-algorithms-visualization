import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { navigationData } from '../../data/navigation';
import { getImplementationStatus, type ImplementationStatus } from '../../data/implementationStatus';
import { Badge } from './Badge';
import type { BadgeType } from '../../data/navigation';

interface RouteSearchModalProps {
  open: boolean;
  onClose: () => void;
}

const formulaKeywords: Record<string, string> = {
  regression: 'mse rmse mae r2 residual slope intercept beta covariance multicollinearity prediction',
  logistic: 'sigmoid threshold log loss roc auc precision recall f1 probability',
  knn: 'nearest neighbors distance euclidean manhattan minkowski cosine voting boundary',
  bayes: 'prior likelihood posterior probability gaussian multinomial bernoulli',
  kmeans: 'centroid inertia sse elbow assignment clustering',
  dbscan: 'epsilon minpts core border noise density cluster',
  pca: 'covariance eigenvalues eigenvectors explained variance projection scree',
  tfidf: 'term frequency inverse document idf keywords vocabulary matrix',
  qlearning: 'q table rewards policy epsilon discount grid world bellman',
  attention: 'query key value softmax heatmap scaled dot product tokens',
};

export const RouteSearchModal: React.FC<RouteSearchModalProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [statusFilter, setStatusFilter] = React.useState<'All' | ImplementationStatus>('All');
  const [levelFilter, setLevelFilter] = React.useState<'All' | BadgeType>('All');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex(index => index + 1);
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex(index => Math.max(0, index - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const normalized = query.trim().toLowerCase();
  const routes = navigationData.flatMap(category =>
    category.items.map(item => {
      const status = getImplementationStatus(item.route);
      const routeTerms = item.route.replaceAll('/', ' ').replaceAll('-', ' ');
      const keywordTerms = Object.entries(formulaKeywords)
        .filter(([key]) => item.route.includes(key) || item.label.toLowerCase().includes(key))
        .map(([, terms]) => terms)
        .join(' ');
      return { ...item, category: category.category, status, searchable: `${item.label} ${item.badge} ${status} ${category.category} ${routeTerms} ${keywordTerms}`.toLowerCase() };
    })
  );
  const results = routes
    .filter(item =>
      (!normalized || item.searchable.includes(normalized)) &&
      (statusFilter === 'All' || item.status === statusFilter) &&
      (levelFilter === 'All' || item.badge === levelFilter)
    )
    .slice(0, 30);
  const boundedActiveIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  const openActiveResult = () => {
    const item = results[boundedActiveIndex];
    if (!item) return;
    navigate(item.route);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/45 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Route search">
      <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <Search size={17} className="text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={event => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                openActiveResult();
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-gray-100"
            placeholder="Search routes, formulas, use cases, status..."
          />
          <kbd className="hidden rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 dark:border-gray-700 sm:inline">Enter</kbd>
          <kbd className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 dark:border-gray-700">Esc</kbd>
          <button onClick={onClose} aria-label="Close route search" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-700">
          <select
            value={statusFilter}
            onChange={event => {
              setStatusFilter(event.target.value as 'All' | ImplementationStatus);
              setActiveIndex(0);
            }}
            className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <option>All</option>
            <option>Implemented</option>
            <option>Educational</option>
            <option>Concept</option>
            <option>Scaffold</option>
          </select>
          <select
            value={levelFilter}
            onChange={event => {
              setLevelFilter(event.target.value as 'All' | BadgeType);
              setActiveIndex(0);
            }}
            className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <option>All</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
            <option>Concept</option>
            <option>Browser Trainable</option>
            <option>Browser Inference</option>
          </select>
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-500">No routes matched that search.</p>
          ) : results.map((item, index) => (
            <Link
              key={item.route}
              to={item.route}
              onClick={onClose}
              onMouseEnter={() => setActiveIndex(index)}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 ${index === boundedActiveIndex ? 'bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:ring-blue-800' : item.status === 'Scaffold' ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold text-gray-900 dark:text-gray-100">{item.label}</span>
                <span className="block truncate font-mono text-[11px] text-gray-500 dark:text-gray-400">{item.category} / {item.route}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <Badge type={item.status} />
                <Badge type={item.badge} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
