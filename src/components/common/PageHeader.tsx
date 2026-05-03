import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Badge } from './Badge';
import type { BadgeType } from '../../data/navigation';
import { ChevronRight, Home } from 'lucide-react';

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
        </div>
      </div>
    </div>
  );
};
