import React, { useState } from 'react';
import { Table, Download } from 'lucide-react';

interface DataPreviewProps {
  columns: string[];
  data: Record<string, unknown>[];
  maxRows?: number;
  title?: string;
}

function exportCSV(columns: string[], data: Record<string, unknown>[], filename = 'data.csv') {
  const header = columns.join(',');
  const rows = data.map(row => columns.map(c => row[c] ?? '').join(','));
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export const DataPreview: React.FC<DataPreviewProps> = ({ columns, data, maxRows = 10, title = 'Data Preview' }) => {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? data : data.slice(0, maxRows);

  return (
    <div>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Table size={13} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{title}</span>
          <span className="text-xs text-gray-400">({data.length} rows × {columns.length} cols)</span>
        </div>
        <button
          onClick={() => exportCSV(columns, data)}
          className="flex min-h-10 items-center gap-1 self-start rounded px-2 py-2 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 sm:self-auto"
        >
          <Download size={11} /> CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50">
              {columns.map(col => (
                <th key={col} className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap border-b border-gray-200 dark:border-gray-700">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                {columns.map(col => (
                  <td key={col} className="px-3 py-1.5 font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {row[col] === null || row[col] === undefined || row[col] === '' ? (
                      <span className="text-red-400 italic">null</span>
                    ) : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > maxRows && (
        <button onClick={() => setShowAll(s => !s)} className="mt-2 min-h-10 rounded px-2 py-2 text-xs text-blue-500 hover:text-blue-700">
          {showAll ? `Show less` : `Show all ${data.length} rows`}
        </button>
      )}
    </div>
  );
};
