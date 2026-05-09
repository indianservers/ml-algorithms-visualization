import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
  collapsible?: boolean;
  icon?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, subtitle, children, className = '', actions, collapsible, icon }) => {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className={`min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0">
            {title && <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">{icon}<span className="min-w-0 break-words">{title}</span></h3>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {collapsible && (
              <button onClick={() => setCollapsed(c => !c)} className="min-h-10 rounded px-2 py-2 text-xs text-gray-400 hover:text-gray-600">
                {collapsed ? 'Expand' : 'Collapse'}
              </button>
            )}
          </div>
        </div>
      )}
      {!collapsed && <div className="min-w-0 p-3 sm:p-4">{children}</div>}
    </div>
  );
};

interface InfoBoxProps {
  type: 'info' | 'warning' | 'success' | 'error';
  title?: string;
  children: React.ReactNode;
}

export const InfoBox: React.FC<InfoBoxProps> = ({ type, title, children }) => {
  const styles = {
    info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300',
    warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300',
    success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300',
    error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300',
  };
  return (
    <div className={`border rounded-lg p-3 text-xs ${styles[type]}`}>
      {title && <p className="font-semibold mb-1">{title}</p>}
      <div>{children}</div>
    </div>
  );
};
