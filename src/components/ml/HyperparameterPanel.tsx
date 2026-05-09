import React from 'react';
import { Card } from '../common/Card';
import { HelpCircle, RotateCcw, Settings } from 'lucide-react';

export interface HyperparamDef {
  key: string;
  label: string;
  type: 'range' | 'select' | 'number' | 'checkbox';
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string | number; label: string }[];
  value: number | string | boolean;
  tooltip?: string;
}

export interface HyperparameterPreset {
  name: string;
  values: Record<string, number | string | boolean>;
}

interface HyperparameterPanelProps {
  params: HyperparamDef[];
  onChange: (key: string, value: number | string | boolean) => void;
  presets?: HyperparameterPreset[];
  onReset?: () => void;
}

export const HyperparameterPanel: React.FC<HyperparameterPanelProps> = ({ params, onChange, presets = [], onReset }) => {
  const initialValues = React.useRef(Object.fromEntries(params.map(param => [param.key, param.value])));

  const resetParams = () => {
    if (onReset) {
      onReset();
      return;
    }
    Object.entries(initialValues.current).forEach(([key, value]) => onChange(key, value));
  };

  const applyPreset = (preset: HyperparameterPreset) => {
    Object.entries(preset.values).forEach(([key, value]) => onChange(key, value));
  };

  return (
    <Card title="Hyperparameters" className="" actions={<Settings size={14} className="text-gray-400" />}>
      <div className="space-y-4">
        {(presets.length > 0 || params.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {presets.map(preset => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900"
              >
                {preset.name}
              </button>
            ))}
            <button
              type="button"
              onClick={resetParams}
              className="ml-auto inline-flex items-center gap-1 rounded border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
              title="Reset parameters to their initial values"
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        )}
        <div className="space-y-3">
          {params.map(param => (
            <div key={param.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                  {param.label}
                  {param.tooltip && (
                    <HelpCircle size={12} className="text-gray-400" aria-label={param.tooltip}>
                      <title>{param.tooltip}</title>
                    </HelpCircle>
                  )}
                </label>
                {param.type === 'range' && (
                  <span className="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                    {param.value}
                  </span>
                )}
              </div>
              {param.type === 'range' && (
                <input
                  type="range"
                  min={param.min} max={param.max} step={param.step ?? 1}
                  value={param.value as number}
                  onChange={e => onChange(param.key, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
              )}
              {param.type === 'select' && (
                <select
                  value={param.value as string}
                  onChange={e => onChange(param.key, e.target.value)}
                  className="w-full text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {param.options?.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
              {param.type === 'number' && (
                <input
                  type="number"
                  min={param.min} max={param.max} step={param.step ?? 1}
                  value={param.value as number}
                  onChange={e => onChange(param.key, parseFloat(e.target.value))}
                  className="w-full text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              )}
              {param.type === 'checkbox' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={param.value as boolean}
                    onChange={e => onChange(param.key, e.target.checked)}
                    className="w-3.5 h-3.5 accent-blue-500 rounded"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">Enabled</span>
                </label>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
