import { Card } from './Card';
import { EmptyState } from './EmptyState';

export function MatrixViewer({ title, matrix, rowLabels, colLabels }: { title: string; matrix: number[][]; rowLabels?: string[]; colLabels?: string[] }) {
  return (
    <Card title={title}>
      {matrix.length === 0 ? (
        <EmptyState title="Matrix is empty" message="Run the algorithm or choose data to populate the matrix grid." />
      ) : (
      <div className="overflow-auto">
        <table className="w-full text-xs sm:text-sm" aria-label={title}>
          <thead>
            <tr>
              <th className="min-h-10 min-w-12 p-2 text-left text-[11px] uppercase tracking-wide text-gray-400">row / col</th>
              {(colLabels ?? matrix[0]?.map((_, i) => `c${i + 1}`) ?? []).map(label => <th key={label} className="min-h-10 min-w-14 border border-gray-200 p-3 font-mono dark:border-gray-700">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <th className="min-h-10 border border-gray-200 p-3 text-left font-mono dark:border-gray-700">{rowLabels?.[i] ?? `r${i + 1}`}</th>
                {row.map((value, j) => <td key={j} className="min-h-10 min-w-14 border border-gray-200 p-3 text-center font-mono dark:border-gray-700">{Number(value).toFixed(3)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </Card>
  );
}
