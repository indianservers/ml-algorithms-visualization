import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
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

function cosineSimilarity(a: Array<number | null>, b: Array<number | null>) {
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let index = 0; index < a.length; index++) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  }
  if (!aNorm || !bNorm) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

function predictRating(matrix: Array<Array<number | null>>, userIndex: number, itemIndex: number) {
  let weighted = 0;
  let totalSimilarity = 0;
  matrix.forEach((row, otherIndex) => {
    if (otherIndex === userIndex || row[itemIndex] === null) return;
    const similarity = Math.max(0, cosineSimilarity(matrix[userIndex], row));
    weighted += similarity * (row[itemIndex] ?? 0);
    totalSimilarity += similarity;
  });
  return totalSimilarity ? weighted / totalSimilarity : 0;
}

export default function UserBasedCFPage() {
  const [ratings, setRatings] = useState(initialRatings);
  const [activeUser, setActiveUser] = useState(0);
  const [topN, setTopN] = useState(3);

  const similarities = useMemo(() => users.map((user, index) => ({
    user,
    index,
    similarity: index === activeUser ? 1 : cosineSimilarity(ratings[activeUser], ratings[index]),
  })).sort((a, b) => b.similarity - a.similarity), [ratings, activeUser]);

  const recommendations = useMemo(() => items
    .map((item, index) => ({
      item,
      score: ratings[activeUser][index] === null ? predictRating(ratings, activeUser, index) : 0,
      known: ratings[activeUser][index] !== null,
    }))
    .filter(item => !item.known && item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN), [ratings, activeUser, topN]);

  const filled = ratings.flat().filter(value => value !== null).length;
  const coverage = filled / (users.length * items.length);

  const updateRating = (row: number, col: number, value: string) => {
    const nextValue = value === '' ? null : Math.max(1, Math.min(5, Number(value)));
    setRatings(current => current.map((ratingsRow, rowIndex) => ratingsRow.map((cell, colIndex) => rowIndex === row && colIndex === col ? nextValue : cell)));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="User Based Collaborative Filtering" subtitle="Edit the user-item rating matrix, compute cosine similarity, and rank recommendations live." badge="Intermediate" category="Recommendation" icon={<Users size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Recommendation Controls">
            <div className="space-y-4 text-sm">
              <label className="block font-semibold">Target user
                <select value={activeUser} onChange={event => setActiveUser(Number(event.target.value))} className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                  {users.map((user, index) => <option key={user} value={index}>{user}</option>)}
                </select>
              </label>
              <label className="block font-semibold">Top recommendations: {topN}
                <input className="w-full accent-blue-600" type="range" min={1} max={5} value={topN} onChange={event => setTopN(Number(event.target.value))} />
              </label>
            </div>
          </Card>
          <MetricsPanel title="Matrix Metrics" metrics={[
            { label: 'Filled Ratings', value: filled, format: 'number' },
            { label: 'Coverage', value: coverage, format: 'percent', color: coverage >= 0.8 ? 'green' : coverage >= 0.6 ? 'blue' : 'red' },
            { label: 'Similar Users', value: similarities.filter(item => item.index !== activeUser && item.similarity > 0.6).length, format: 'number' },
          ]} />
          <InfoBox type="info" title="How it works">
            The model compares the target user with every other user using cosine similarity, then predicts missing ratings from similar users who rated that item.
          </InfoBox>
        </div>
        <div className="space-y-4">
          <Card title="Editable User-Item Matrix">
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-1 text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-xs text-gray-500 dark:text-gray-400">User</th>
                    {items.map(item => <th key={item} className="min-w-28 rounded bg-gray-100 p-2 text-xs font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{item}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, row) => (
                    <tr key={user}>
                      <th className={`rounded p-2 text-left text-xs font-bold ${row === activeUser ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}>{user}</th>
                      {items.map((item, col) => {
                        const recommended = row === activeUser && recommendations.some(rec => rec.item === item);
                        return (
                          <td key={item} className={`rounded border p-1 ${recommended ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-950'}`}>
                            <input
                              aria-label={`${user} rating for ${item}`}
                              type="number"
                              min={1}
                              max={5}
                              value={ratings[row][col] ?? ''}
                              onChange={event => updateRating(row, col, event.target.value)}
                              className="h-9 w-full rounded bg-transparent text-center font-bold text-gray-800 outline-none ring-blue-500 focus:ring-2 dark:text-gray-100"
                              placeholder="-"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="User Similarity">
              <div className="space-y-2">
                {similarities.filter(item => item.index !== activeUser).map(item => (
                  <div key={item.user} className="rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span>{users[activeUser]} to {item.user}</span>
                      <span>{(item.similarity * 100).toFixed(1)}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-800">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(4, item.similarity * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Top Recommendations">
              <div className="space-y-2">
                {recommendations.map((item, index) => (
                  <div key={item.item} className="rounded border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <div className="flex items-center justify-between text-sm font-bold text-emerald-900 dark:text-emerald-100">
                      <span>{index + 1}. {item.item}</span>
                      <span>{item.score.toFixed(2)} / 5</span>
                    </div>
                    <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Predicted from similar users with ratings for this item.</p>
                  </div>
                ))}
                {recommendations.length === 0 && <p className="rounded border border-gray-200 p-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">No unrated items have enough neighbor signal yet. Add more ratings to the matrix.</p>}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
