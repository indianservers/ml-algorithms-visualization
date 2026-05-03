import { useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';

const data = [
  { id: 1, city: 'Delhi', plan: 'free', risk: 'low' },
  { id: 2, city: 'Mumbai', plan: 'pro', risk: 'medium' },
  { id: 3, city: 'Delhi', plan: 'enterprise', risk: 'high' },
  { id: 4, city: 'Pune', plan: 'pro', risk: 'medium' },
  { id: 5, city: 'Mumbai', plan: 'free', risk: 'low' },
  { id: 6, city: 'Delhi', plan: 'pro', risk: 'high' },
];

export default function CategoricalEncodingPage() {
  const [column, setColumn] = useState<'city' | 'plan' | 'risk'>('plan');
  const categories = [...new Set(data.map(row => row[column]))];
  const encoded = useMemo(() => {
    const labelMap = Object.fromEntries(categories.map((cat, i) => [cat, i]));
    const freqMap = Object.fromEntries(categories.map(cat => [cat, data.filter(row => row[column] === cat).length / data.length]));
    const ordinal = { low: 0, medium: 1, high: 2 };
    return data.map(row => ({
      ...row,
      label: labelMap[row[column]],
      ordinal: column === 'risk' ? ordinal[row.risk as keyof typeof ordinal] : labelMap[row[column]],
      frequency: Number(freqMap[row[column]].toFixed(3)),
      ...Object.fromEntries(categories.map(cat => [`onehot_${cat}`, row[column] === cat ? 1 : 0])),
    }));
  }, [column, categories]);
  const columns = Object.keys(encoded[0]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Categorical Encoding" subtitle="Real label, one-hot, ordinal, and frequency encoding from local categorical rows." badge="Beginner" category="Preprocessing" icon={<Filter size={22} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card title="Encoding Controls">
          <select value={column} onChange={e => setColumn(e.target.value as typeof column)} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
            <option value="city">city</option><option value="plan">plan</option><option value="risk">risk</option>
          </select>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Categories: <span className="font-mono">{categories.join(', ')}</span></p>
        </Card>
        <div className="space-y-4">
          <Card title="Before / After Table">
            <div className="overflow-auto"><table className="w-full text-xs"><thead><tr>{columns.map(col => <th key={col} className="border border-gray-200 p-2 dark:border-gray-700">{col}</th>)}</tr></thead><tbody>{encoded.map(row => <tr key={row.id}>{columns.map(col => <td key={col} className="border border-gray-200 p-2 text-center font-mono dark:border-gray-700">{String(row[col as keyof typeof row])}</td>)}</tr>)}</tbody></table></div>
          </Card>
          <InfoBox type="info" title="Real Logic Cross-Check">Mappings are computed from the selected column's actual unique categories and row frequencies.</InfoBox>
        </div>
      </div>
    </div>
  );
}
