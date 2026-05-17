import React from 'react';
import { Card } from '../common/Card';
import { Copy } from 'lucide-react';

interface Metric {
  label: string;
  value: number | string;
  format?: 'number' | 'percent' | 'fixed2' | 'fixed4';
  color?: 'default' | 'green' | 'red' | 'blue';
  approximate?: boolean;
}

interface MetricsPanelProps {
  metrics: Metric[];
  title?: string;
}

function formatValue(val: number | string, fmt?: string): string {
  if (typeof val === 'string') return val;
  if (fmt === 'percent') return `${(val * 100).toFixed(2)}%`;
  if (fmt === 'fixed4') return val.toFixed(4);
  if (fmt === 'fixed2') return val.toFixed(2);
  return val.toFixed(4);
}

const colorMap = {
  default: 'text-gray-900 dark:text-white',
  green: 'text-green-600 dark:text-green-400',
  red: 'text-red-600 dark:text-red-400',
  blue: 'text-blue-600 dark:text-blue-400',
};

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ metrics, title = 'Metrics' }) => {
  const [baseline, setBaseline] = React.useState<Record<string, number>>({});
  const [showDelta, setShowDelta] = React.useState(false);

  React.useEffect(() => {
    const capture = () => {
      setBaseline(Object.fromEntries(metrics
        .filter(metric => typeof metric.value === 'number')
        .map(metric => [metric.label, metric.value as number])));
      setShowDelta(true);
    };
    window.addEventListener('ml:train', capture);
    return () => window.removeEventListener('ml:train', capture);
  }, [metrics]);

  const copyAll = () => {
    const text = metrics.map(m => `${m.label}: ${formatValue(m.value, m.format)}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <Card
      title={title}
      actions={
        <button onClick={copyAll} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
          <Copy size={11} /> Copy
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m, i) => (
          <div key={i} className="result-change bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">{m.label}</p>
              {(m.approximate ?? typeof m.value === 'number') && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-200" title="Rounded or model-derived value">
                  Approx
                </span>
              )}
            </div>
            <div className="flex items-end justify-between gap-2">
              <p className={`text-lg font-bold font-mono ${colorMap[m.color ?? 'default']}`}>
                {formatValue(m.value, m.format)}
              </p>
              {showDelta && typeof m.value === 'number' && typeof baseline[m.label] === 'number' && m.value !== baseline[m.label] && (
                <span className={`mb-1 shrink-0 text-xs font-bold ${m.value > baseline[m.label] ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} title={`Changed by ${formatValue(m.value - baseline[m.label], m.format)}`}>
                  {m.value > baseline[m.label] ? '▲' : '▼'} {formatValue(Math.abs(m.value - baseline[m.label]), m.format)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
