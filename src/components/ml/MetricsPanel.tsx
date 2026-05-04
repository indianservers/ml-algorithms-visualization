import React from 'react';
import { Card } from '../common/Card';
import { Copy } from 'lucide-react';

interface Metric {
  label: string;
  value: number | string;
  format?: 'number' | 'percent' | 'fixed2' | 'fixed4';
  color?: 'default' | 'green' | 'red' | 'blue';
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
          <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2.5">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{m.label}</p>
            <p className={`text-lg font-bold font-mono ${colorMap[m.color ?? 'default']}`}>
              {formatValue(m.value, m.format)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
};
