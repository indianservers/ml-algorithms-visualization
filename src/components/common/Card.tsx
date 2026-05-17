import React from 'react';
import { Download, HelpCircle, Maximize2 } from 'lucide-react';
import { getAlgorithmByRoute } from '../../data/implementationStatus';
import { getAlgorithmFaqs } from '../../data/algorithmFaqs';
import { getAlgorithmIntroduction } from '../../data/algorithmIntroductions';
import { exportChartContainer, fullscreenChartContainer } from './chartUtils';

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
  const [explanationOpen, setExplanationOpen] = React.useState(false);
  const chartTitle = Boolean(title && /(chart|plot|curve|matrix|boundary|surface|distribution|metrics|loss|accuracy|residual)/i.test(title));
  const chartLike = Boolean(chartTitle && !actions);
  const chartExplanation = React.useMemo(() => {
    const algorithm = getAlgorithmByRoute(window.location.pathname);
    if (!algorithm) return 'This chart turns the current page data into a visual pattern. Check the axes, compare color groups, and look for whether the output matches the expected trend.';
    const intro = getAlgorithmIntroduction(algorithm);
    const faq = getAlgorithmFaqs(algorithm)[0]?.answer;
    return `This view helps explain ${algorithm.label}. The axes, bars, lines, or regions show how the model behaves as inputs or training steps change. A good result should support the lesson goal while avoiding: ${intro.watchFor} ${faq ?? ''}`;
  }, []);

  return (
    <div data-chart-container={chartTitle ? 'true' : undefined} className={`min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex flex-col gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="min-w-0">
            {title && <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">{icon}<span className="min-w-0 break-words">{title}</span></h3>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            {chartLike && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExplanationOpen(open => !open)}
                  className="grid min-h-10 min-w-10 place-items-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                  title="Explain this chart"
                  aria-label="Explain this chart"
                >
                  <HelpCircle size={14} />
                </button>
                {explanationOpen && (
                  <div className="absolute right-0 top-11 z-20 w-72 rounded-lg border border-gray-200 bg-white p-3 text-xs leading-5 text-gray-600 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    {chartExplanation}
                  </div>
                )}
              </div>
            )}
            {chartLike && (
              <div className="flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 dark:border-gray-700" aria-label="Chart color legend">
                {['#2563eb', '#16a34a', '#f59e0b'].map(color => (
                  <span key={color} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                ))}
              </div>
            )}
            {chartLike && (
              <button
                type="button"
                onClick={event => exportChartContainer(event.currentTarget)}
                className="grid min-h-10 min-w-10 place-items-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                title="Download PNG"
                aria-label="Download chart PNG"
              >
                <Download size={14} />
              </button>
            )}
            {chartLike && (
              <button
                type="button"
                onClick={event => fullscreenChartContainer(event.currentTarget)}
                className="grid min-h-10 min-w-10 place-items-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                title="Open fullscreen"
                aria-label="Open visualization fullscreen"
              >
                <Maximize2 size={14} />
              </button>
            )}
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
