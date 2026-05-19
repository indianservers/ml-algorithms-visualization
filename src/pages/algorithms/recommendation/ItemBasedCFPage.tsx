import { useMemo, useState } from 'react';
import { Boxes } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';

const users = ['Asha', 'Ben', 'Cara', 'Dev', 'Eli'];
const items = ['Linear Algebra', 'KNN', 'Decision Trees', 'SVM', 'Transformers', 'Recommenders'];
const initialRatings: Array<Array<number | null>> = [
  [5, 4, null, 2, null, 4],
  [4, 5, 2, null, 1, null],
  [null, 2, 5, 4, 4, null],
  [1, null, 4, 5, 5, 2],
  [4, 4, null, 3, null, 5],
];

function itemVector(matrix: Array<Array<number | null>>, itemIndex: number) {
  return matrix.map(row => row[itemIndex]);
}

function cosine(a: Array<number | null>, b: Array<number | null>) {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let index = 0; index < a.length; index++) {
    if (a[index] === null || b[index] === null) continue;
    dot += a[index]! * b[index]!;
    aNorm += a[index]! ** 2;
    bNorm += b[index]! ** 2;
  }
  if (!aNorm || !bNorm) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

function predictMissing(matrix: Array<Array<number | null>>, userIndex: number, itemIndex: number, k: number) {
  const rated = matrix[userIndex]
    .map((rating, otherItem) => ({ rating, otherItem, similarity: cosine(itemVector(matrix, itemIndex), itemVector(matrix, otherItem)) }))
    .filter(item => item.rating !== null && item.otherItem !== itemIndex)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
  const weighted = rated.reduce((sum, item) => sum + item.similarity * (item.rating ?? 0), 0);
  const total = rated.reduce((sum, item) => sum + Math.abs(item.similarity), 0);
  return { score: total ? weighted / total : 0, neighbors: rated };
}

export default function ItemBasedCFPage() {
  const [ratings, setRatings] = useState(initialRatings);
  const [selectedItem, setSelectedItem] = useState(0);
  const [targetUser, setTargetUser] = useState(0);
  const [k, setK] = useState(3);
  const [highlight, setHighlight] = useState<[number, number]>([0, 1]);

  const similarityMatrix = useMemo(() => items.map((_, row) => items.map((__, col) => row === col ? 1 : cosine(itemVector(ratings, row), itemVector(ratings, col)))), [ratings]);
  const similarItems = useMemo(() => items
    .map((item, index) => ({ item, index, similarity: similarityMatrix[selectedItem][index] }))
    .filter(item => item.index !== selectedItem)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3), [similarityMatrix, selectedItem]);
  const recommendations = useMemo(() => items
    .map((item, index) => ({ item, index, known: ratings[targetUser][index] !== null, ...predictMissing(ratings, targetUser, index, k) }))
    .filter(item => !item.known && item.score > 0)
    .sort((a, b) => b.score - a.score), [ratings, targetUser, k]);

  const updateRating = (row: number, col: number, value: string) => {
    const nextValue = value === '' ? null : Math.max(1, Math.min(5, Number(value)));
    setRatings(current => current.map((ratingRow, rowIndex) => ratingRow.map((cell, colIndex) => rowIndex === row && colIndex === col ? nextValue : cell)));
  };

  const sharedReason = (a: number, b: number) => {
    const shared = users.filter((_, userIndex) => (ratings[userIndex][a] ?? 0) >= 4 && (ratings[userIndex][b] ?? 0) >= 4);
    return shared.length ? `Users ${shared.join(' and ')} rated both highly.` : 'Similarity is based on overlapping user ratings.';
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Item Based Collaborative Filtering" subtitle="Edit ratings, inspect item-item cosine similarity, and predict missing ratings from similar items." badge="Intermediate" category="Recommendation" icon={<Boxes size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Item CF Controls">
            <div className="space-y-4 text-sm">
              <label className="block font-semibold">Selected item
                <select value={selectedItem} onChange={event => setSelectedItem(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                  {items.map((item, index) => <option key={item} value={index}>{item}</option>)}
                </select>
              </label>
              <label className="block font-semibold">Target user
                <select value={targetUser} onChange={event => setTargetUser(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                  {users.map((user, index) => <option key={user} value={index}>{user}</option>)}
                </select>
              </label>
              <label className="block font-semibold">k similar items: {k}<input className="w-full accent-blue-600" type="range" min={1} max={4} value={k} onChange={event => setK(Number(event.target.value))} /></label>
            </div>
          </Card>
          <MetricsPanel title="Similarity Metrics" metrics={[
            { label: 'Selected Item', value: items[selectedItem] },
            { label: 'Top Similarity', value: similarItems[0]?.similarity ?? 0, format: 'percent', color: 'green' },
            { label: 'Recommendations', value: recommendations.length, format: 'number' },
          ]} />
          <InfoBox type="info" title="Item-based idea">
            Instead of finding similar users, this model finds similar items. A missing rating is predicted from items the target user already rated.
          </InfoBox>
        </div>
        <div className="space-y-4">
          <Card title="Editable Rating Matrix">
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-1 text-sm">
                <thead><tr><th className="p-2 text-left text-xs text-gray-500">User</th>{items.map(item => <th key={item} className="min-w-28 rounded bg-gray-100 p-2 text-xs dark:bg-gray-800">{item}</th>)}</tr></thead>
                <tbody>
                  {users.map((user, row) => (
                    <tr key={user}>
                      <th className="rounded bg-gray-100 p-2 text-left text-xs font-bold dark:bg-gray-800">{user}</th>
                      {items.map((item, col) => (
                        <td key={item} className="rounded border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-950">
                          <input aria-label={`${user} rating for ${item}`} type="number" min={1} max={5} value={ratings[row][col] ?? ''} placeholder="-" onChange={event => updateRating(row, col, event.target.value)} className="h-9 w-full rounded bg-transparent text-center font-bold outline-none ring-blue-500 focus:ring-2" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card title="Item Similarity Heatmap">
              <div className="grid gap-1" style={{ gridTemplateColumns: `120px repeat(${items.length}, minmax(46px, 1fr))` }}>
                <div />
                {items.map(item => <div key={item} className="truncate text-center text-[10px] font-bold text-gray-500">{item}</div>)}
                {items.map((rowItem, row) => (
                  <div key={`${rowItem}-row`} className="contents">
                    <div key={`${rowItem}-label`} className="truncate rounded bg-gray-100 px-2 py-3 text-xs font-bold dark:bg-gray-800">{rowItem}</div>
                    {items.map((colItem, col) => {
                      const value = similarityMatrix[row][col];
                      const selected = highlight[0] === row && highlight[1] === col;
                      return (
                        <button key={`${rowItem}-${colItem}`} onClick={() => setHighlight([row, col])} className={`rounded border p-2 text-xs font-bold ${selected ? 'border-blue-600 ring-2 ring-blue-300' : 'border-transparent'}`} style={{ backgroundColor: `rgba(37, 99, 235, ${0.12 + value * 0.72})`, color: value > 0.65 ? 'white' : '#1f2937' }}>
                          {value.toFixed(2)}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500">Selected pair: {items[highlight[0]]} and {items[highlight[1]]}. {sharedReason(highlight[0], highlight[1])}</p>
            </Card>
            <div className="space-y-4">
              <Card title="Top Similar Items">
                <div className="space-y-2">
                  {similarItems.map(item => <div key={item.item} className="rounded border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-900"><b>{item.item}</b><p className="text-xs text-gray-500">{(item.similarity * 100).toFixed(1)}% similar. {sharedReason(selectedItem, item.index)}</p></div>)}
                </div>
              </Card>
              <Card title={`Predictions for ${users[targetUser]}`}>
                <div className="space-y-2">
                  {recommendations.map(item => <div key={item.item} className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30"><b>{item.item}: {item.score.toFixed(2)} / 5</b><p className="text-xs text-emerald-700 dark:text-emerald-300">Using {item.neighbors.map(n => items[n.otherItem]).join(', ')}</p></div>)}
                  {recommendations.length === 0 && <p className="rounded border border-gray-200 p-3 text-sm text-gray-500 dark:border-gray-700">No missing item has enough similar rated neighbors yet.</p>}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
