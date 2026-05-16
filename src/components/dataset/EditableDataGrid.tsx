import React from 'react';
import { Download, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import type { DataRow } from '../../lib/preprocessing/dataProfile';

interface EditableDataGridProps {
  rows: DataRow[];
  onChange: (rows: DataRow[]) => void;
  columns?: string[];
  onColumnsChange?: (columns: string[]) => void;
  maxRows?: number;
}

export function EditableDataGrid({ rows, onChange, columns: providedColumns, onColumnsChange, maxRows = 12 }: EditableDataGridProps) {
  const [history, setHistory] = React.useState<DataRow[][]>([]);
  const columns = providedColumns?.length ? providedColumns : Array.from(new Set(rows.flatMap(row => Object.keys(row))));

  const update = (next: DataRow[]) => {
    setHistory(previous => [rows, ...previous].slice(0, 20));
    onChange(next);
  };
  const addRow = () => update([...rows, Object.fromEntries(columns.map(column => [column, '']))]);
  const deleteRow = (index: number) => update(rows.filter((_, rowIndex) => rowIndex !== index));
  const updateCell = (rowIndex: number, column: string, value: string) => update(rows.map((row, index) => index === rowIndex ? { ...row, [column]: Number.isFinite(Number(value)) && value.trim() !== '' ? Number(value) : value } : row));
  const renameColumn = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    const nextColumns = columns.map(column => column === oldName ? newName : column);
    const nextRows = rows.map(row => {
      const next: DataRow = {};
      Object.entries(row).forEach(([key, value]) => { next[key === oldName ? newName : key] = value; });
      return next;
    });
    setHistory(previous => [rows, ...previous].slice(0, 20));
    onColumnsChange?.(nextColumns);
    onChange(nextRows);
  };
  const downloadCsv = () => {
    const body = [columns.join(','), ...rows.map(row => columns.map(column => JSON.stringify(row[column] ?? '')).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dataset-edits.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  const importJson = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text) as DataRow[];
    if (Array.isArray(parsed)) update(parsed);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button onClick={addRow} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs font-semibold dark:border-gray-700"><Plus size={13} /> Row</button>
        <button disabled={!history.length} onClick={() => { const [last, ...rest] = history; if (last) { onChange(last); setHistory(rest); } }} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs font-semibold disabled:opacity-40 dark:border-gray-700"><RotateCcw size={13} /> Undo</button>
        <button onClick={downloadCsv} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs font-semibold dark:border-gray-700"><Download size={13} /> CSV</button>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs font-semibold dark:border-gray-700">
          <Upload size={13} /> JSON
          <input type="file" accept="application/json,.json" className="hidden" onChange={event => importJson(event.target.files?.[0])} />
        </label>
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="sticky top-0 bg-gray-50 p-1 dark:bg-gray-800" />
              {columns.map(column => (
                <th key={column} className="sticky top-0 min-w-28 bg-gray-50 p-1 dark:bg-gray-800">
                  <input aria-label={`Rename ${column}`} className="w-full rounded border border-gray-200 bg-white px-1 py-0.5 font-semibold dark:border-gray-700 dark:bg-gray-900" defaultValue={column} onBlur={event => renameColumn(column, event.target.value)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, maxRows).map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-gray-100 dark:border-gray-800">
                <td className="p-1"><button aria-label={`Delete row ${rowIndex + 1}`} onClick={() => deleteRow(rowIndex)} className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={12} /></button></td>
                {columns.map(column => (
                  <td key={column} className="p-1">
                    <input aria-label={`${column} row ${rowIndex + 1}`} className="w-full rounded border border-gray-200 bg-white px-1 py-0.5 font-mono dark:border-gray-700 dark:bg-gray-900" value={String(row[column] ?? '')} onChange={event => updateCell(rowIndex, column, event.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > maxRows && <p className="mt-2 text-[11px] text-gray-500">Showing first {maxRows} editable rows of {rows.length}.</p>}
    </div>
  );
}
