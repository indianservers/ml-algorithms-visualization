import type { DatasetProfile } from '../../lib/preprocessing/dataProfile';

interface DatasetSummaryStripProps {
  profile: DatasetProfile;
  target?: string;
}

export function DatasetSummaryStrip({ profile, target }: DatasetSummaryStripProps) {
  const items = [
    ['Rows', profile.rows],
    ['Columns', profile.columns],
    ['Missing', profile.missing],
    ['Numeric', profile.numericColumns.length],
    ['Categorical', profile.categoricalColumns.length],
    ['Duplicates', profile.duplicates],
    ['Target', target ?? 'n/a'],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-white p-2 text-xs dark:border-gray-700 dark:bg-gray-900 sm:grid-cols-4 lg:grid-cols-7">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-800">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="truncate font-mono font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
      ))}
    </div>
  );
}
