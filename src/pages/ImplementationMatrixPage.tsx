import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { implementationSummary, getImplementationStatus, type ImplementationStatus } from '../data/implementationStatus';
import { Badge } from '../components/common/Badge';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';

type SortKey = 'category' | 'label' | 'status' | 'difficulty' | 'route';
const statusRank: Record<ImplementationStatus, number> = {
  Implemented: 0,
  Educational: 1,
  Concept: 2,
  Scaffold: 3,
};

export default function ImplementationMatrixPage() {
  const [sortKey, setSortKey] = React.useState<SortKey>('status');
  const [ascending, setAscending] = React.useState(true);
  const summary = implementationSummary();
  const sortedItems = [...summary.items].sort((a, b) => {
    const statusA = getImplementationStatus(a.route);
    const statusB = getImplementationStatus(b.route);
    const values: Record<SortKey, [string | number, string | number]> = {
      category: [a.category, b.category],
      label: [a.label, b.label],
      status: [statusRank[statusA], statusRank[statusB]],
      difficulty: [a.badge, b.badge],
      route: [a.route, b.route],
    };
    const [av, bv] = values[sortKey];
    const result = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv));
    return ascending ? result : -result;
  });
  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setAscending(value => !value);
    } else {
      setSortKey(key);
      setAscending(true);
    }
  };
  const header = (key: SortKey, label: string) => (
    <button onClick={() => setSort(key)} className="flex w-full items-center justify-between gap-2 font-semibold">
      {label}
      <span className="text-[10px] text-gray-400">{sortKey === key ? (ascending ? 'asc' : 'desc') : 'sort'}</span>
    </button>
  );
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Implementation Matrix" subtitle="Quality gate view for every algorithm route and its current implementation status." badge="Advanced" category="Project Quality" icon={<ClipboardCheck size={22} />} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(summary.counts).map(([status, count]) => (
          <Card key={status}>
            <p className="font-mono text-2xl font-bold">{count}</p>
            <p className="text-xs text-gray-500">{status === 'Implemented' ? 'Ready' : status}</p>
          </Card>
        ))}
      </div>
      <Card title="All Routes">
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="border border-gray-200 p-2 text-left dark:border-gray-700">{header('category', 'Category')}</th>
                <th className="border border-gray-200 p-2 text-left dark:border-gray-700">{header('label', 'Algorithm')}</th>
                <th className="border border-gray-200 p-2 text-left dark:border-gray-700">{header('status', 'Status')}</th>
                <th className="border border-gray-200 p-2 text-left dark:border-gray-700">{header('difficulty', 'Difficulty')}</th>
                <th className="border border-gray-200 p-2 text-left dark:border-gray-700">{header('route', 'Route')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map(item => (
                <tr key={item.route} className={getImplementationStatus(item.route) === 'Scaffold' ? 'bg-red-50/60 dark:bg-red-900/10' : ''}>
                  <td className="border border-gray-200 p-2 dark:border-gray-700">{item.category}</td>
                  <td className="border border-gray-200 p-2 font-semibold dark:border-gray-700">{item.label}</td>
                  <td className="border border-gray-200 p-2 dark:border-gray-700">
                    {getImplementationStatus(item.route) === 'Implemented' ? (
                      <span className="text-xs font-semibold text-gray-500">Ready</span>
                    ) : (
                      <Badge type={getImplementationStatus(item.route)} />
                    )}
                  </td>
                  <td className="border border-gray-200 p-2 dark:border-gray-700"><Badge type={item.badge} /></td>
                  <td className="border border-gray-200 p-2 font-mono dark:border-gray-700"><Link className="text-blue-600 hover:underline dark:text-blue-300" to={item.route}>{item.route}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
