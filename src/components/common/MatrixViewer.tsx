import { Card } from './Card';

export function MatrixViewer({ title, matrix, rowLabels, colLabels }: { title: string; matrix: number[][]; rowLabels?: string[]; colLabels?: string[] }) {
  return (
    <Card title={title}>
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="p-2" />
              {(colLabels ?? matrix[0]?.map((_, i) => `c${i + 1}`) ?? []).map(label => <th key={label} className="border border-gray-200 p-2 font-mono dark:border-gray-700">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i}>
                <th className="border border-gray-200 p-2 text-left font-mono dark:border-gray-700">{rowLabels?.[i] ?? `r${i + 1}`}</th>
                {row.map((value, j) => <td key={j} className="border border-gray-200 p-2 text-center font-mono dark:border-gray-700">{Number(value).toFixed(3)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
