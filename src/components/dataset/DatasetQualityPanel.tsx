import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { DatasetProfile } from '../../lib/preprocessing/dataProfile';

interface DatasetQualityPanelProps {
  profile: DatasetProfile;
  errors?: string[];
  warnings?: string[];
}

export function DatasetQualityPanel({ profile, errors = [], warnings = [] }: DatasetQualityPanelProps) {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 dark:text-gray-100">Dataset Validation</h3>
        {errors.length === 0 ? (
          <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 size={13} /> Trainable</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-red-600"><AlertTriangle size={13} /> Blocked</span>
        )}
      </div>
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="space-y-1">
          {errors.map(error => <p key={error} className="rounded bg-red-50 px-2 py-1 font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>)}
          {warnings.map(warning => <p key={warning} className="rounded bg-amber-50 px-2 py-1 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">{warning}</p>)}
        </div>
      )}
      <div className="max-h-48 overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-gray-500">
              <th className="py-1">Column</th>
              <th className="py-1">Type</th>
              <th className="py-1">Missing</th>
              <th className="py-1">Outliers</th>
            </tr>
          </thead>
          <tbody>
            {profile.columnsProfile.map(column => (
              <tr key={column.name} className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-1 font-semibold">{column.name}</td>
                <td className="py-1"><span className="rounded bg-gray-100 px-1.5 py-0.5 dark:bg-gray-800">{column.type}</span></td>
                <td className="py-1">{column.missing}</td>
                <td className="py-1">{column.outliers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
