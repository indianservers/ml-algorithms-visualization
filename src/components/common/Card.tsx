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
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            {title && <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">{icon}{title}</h3>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            {collapsible && (
              <button onClick={() => setCollapsed(c => !c)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded">
                {collapsed ? 'Expand' : 'Collapse'}
              </button>
            )}
          </div>
        </div>
      )}
      {!collapsed && <div className="p-4">{children}</div>}
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
