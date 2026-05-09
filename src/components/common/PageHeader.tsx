import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Badge } from './Badge';
import type { BadgeType } from '../../data/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { getAlgorithmByRoute, getAllAlgorithms } from '../../data/implementationStatus';
import { getAlgorithmDatasetSuggestions } from '../../data/algorithmDatasets';
import { LearningCompanion } from '../learning/LearningCompanion';
import { AlgorithmDatasetLoader } from '../dataset/AlgorithmDatasetLoader';
import { AlgorithmIntroduction } from '../learning/AlgorithmIntroduction';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  badge: BadgeType | string;
  category: string;
  icon?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, badge, category, icon }) => {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);
  const isAlgorithmRoute = location.pathname.startsWith('/ml/');
  const currentAlgorithm = isAlgorithmRoute ? getAlgorithmByRoute(location.pathname) : undefined;
  const related = getAllAlgorithms()
    .filter(item => item.category === category && item.route !== location.pathname)
    .slice(0, 3);
  const datasetSuggestions = isAlgorithmRoute
    ? getAlgorithmDatasetSuggestions(location.pathname, category).slice(0, 3)
    : [];

  return (
    <div className="mb-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs text-gray-400 mb-3">
        <Link to="/" className="hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1">
          <Home size={11} /> Home
        </Link>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <ChevronRight size={11} />
            <span className={i === parts.length - 1 ? 'text-gray-600 dark:text-gray-300 font-medium' : 'capitalize'}>
              {part.replace(/-/g, ' ')}
            </span>
          </React.Fragment>
        ))}
      </nav>

      {/* Header */}
      <div className="flex items-start gap-4">
        {icon && (
          <div className="w-11 h-11 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
            <Badge type={badge} size="md" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{category}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">{subtitle}</p>
          {currentAlgorithm && <AlgorithmIntroduction algorithm={currentAlgorithm} />}
          {related.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Related</span>
              {related.map(item => (
                <Link key={item.route} to={item.route} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-300">
                  {item.label}
                </Link>
              ))}
            </div>
          )}
          {datasetSuggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Datasets</span>
              {datasetSuggestions.map(dataset => (
                <span key={dataset.id} title={dataset.description} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                  {dataset.name}{dataset.target ? ` -> ${dataset.target}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {isAlgorithmRoute && (
        <div className="mt-4 space-y-4">
          <LearningCompanion route={location.pathname} compact />
          <AlgorithmDatasetLoader route={location.pathname} category={category} />
        </div>
      )}
    </div>
  );
};
