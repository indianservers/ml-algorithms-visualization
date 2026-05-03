import { useMemo, useState } from 'react';
import { Brain } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';

const round = (value: number) => Number(value.toFixed(3));
const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const softmax = (row: number[]) => {
  const max = Math.max(...row);
  const exps = row.map(value => Math.exp(value - max));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map(value => value / total);
};
const matVec = (row: number[], matrix: number[][]) => matrix[0].map((_, j) => row.reduce((sum, value, i) => sum + value * matrix[i][j], 0));

const WQ = [[0.4, -0.2, 0.1], [0.1, 0.5, -0.3], [-0.4, 0.2, 0.6], [0.3, 0.1, 0.2]];
const WK = [[0.2, 0.1, -0.5], [0.3, 0.4, 0.2], [-0.1, 0.6, 0.3], [0.5, -0.2, 0.1]];
const WV = [[0.6, 0.2, 0.1], [-0.2, 0.5, 0.3], [0.3, -0.4, 0.7], [0.1, 0.3, 0.4]];

function embed(token: string, index: number) {
  const chars = [...token].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return [
    Math.sin(chars * 0.07),
    Math.cos(chars * 0.11),
    (token.length % 7) / 3,
    (index + 1) / 5,
  ];
}

function Matrix({ title, rows, rowLabels, colLabels }: { title: string; rows: number[][]; rowLabels: string[]; colLabels?: string[] }) {
  return (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr><th className="p-2" />{(colLabels ?? rows[0]?.map((_, i) => `d${i + 1}`) ?? []).map(label => <th key={label} className="p-2 font-mono">{label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={rowLabels[i]}>
                <th className="p-2 text-left font-mono">{rowLabels[i]}</th>
                {row.map((value, j) => <td key={j} className="border border-gray-200 p-2 text-center font-mono dark:border-gray-700">{round(value)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function TransformerAttentionPage() {
  const [text, setText] = useState('attention learns context');
  const [selectedToken, setSelectedToken] = useState(0);

  const tokens = useMemo(() => text.trim().split(/\s+/).filter(Boolean).slice(0, 6), [text]);
  const computed = useMemo(() => {
    const embeddings = tokens.map(embed);
    const Q = embeddings.map(row => matVec(row, WQ));
    const K = embeddings.map(row => matVec(row, WK));
    const V = embeddings.map(row => matVec(row, WV));
    const scale = Math.sqrt(Q[0]?.length || 1);
    const scores = Q.map(q => K.map(k => dot(q, k) / scale));
    const attention = scores.map(softmax);
    const outputs = attention.map(row => V[0].map((_, j) => row.reduce((sum, weight, i) => sum + weight * V[i][j], 0)));
    return { embeddings, Q, K, V, scores, attention, outputs };
  }, [tokens]);

  const safeIndex = Math.min(selectedToken, Math.max(tokens.length - 1, 0));
  const selectedWeights = (computed.attention[safeIndex] ?? []).map((weight, i) => ({ token: tokens[i], weight: round(weight) }));
  const maxAttention = Math.max(...(computed.attention.flat().length ? computed.attention.flat() : [0]));
  const entropy = -(computed.attention[safeIndex] ?? []).reduce((sum, value) => sum + (value > 0 ? value * Math.log2(value) : 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Transformer Attention" subtitle="Real scaled dot-product attention: embeddings, Q/K/V projections, scores, softmax heatmap, and weighted values." badge="Advanced" category="Deep Learning" icon={<Brain size={22} />} />

      <Card title="Token Input">
        <input value={text} onChange={event => { setText(event.target.value); setSelectedToken(0); }} className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
        <div className="mt-3 flex flex-wrap gap-2">
          {tokens.map((token, i) => (
            <button key={`${token}-${i}`} onClick={() => setSelectedToken(i)} className={`rounded px-3 py-1 text-xs font-semibold ${i === safeIndex ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}>{token}</button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Matrix title="Query Matrix Q" rows={computed.Q} rowLabels={tokens} />
            <Matrix title="Key Matrix K" rows={computed.K} rowLabels={tokens} />
            <Matrix title="Value Matrix V" rows={computed.V} rowLabels={tokens} />
          </div>
          <Matrix title="Scaled QK^T Scores" rows={computed.scores} rowLabels={tokens} colLabels={tokens} />
          <Matrix title="Softmax Attention Heatmap" rows={computed.attention} rowLabels={tokens} colLabels={tokens} />
          <Matrix title="Weighted Value Outputs" rows={computed.outputs} rowLabels={tokens} />
        </div>

        <div className="space-y-4">
          <MetricsPanel title="Attention Metrics" metrics={[
            { label: 'Tokens', value: tokens.length, format: 'number' },
            { label: 'd_k', value: computed.Q[0]?.length ?? 0, format: 'number' },
            { label: 'Max Attention', value: maxAttention, format: 'fixed4', color: 'blue' },
            { label: 'Entropy', value: entropy, format: 'fixed4' },
          ]} />
          <Card title={`Attention From "${tokens[safeIndex] ?? ''}"`}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={selectedWeights}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="token" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="weight" radius={[4, 4, 0, 0]}>
                  {selectedWeights.map((_, i) => <Cell key={i} fill={i === safeIndex ? '#dc2626' : '#2563eb'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <InfoBox type="info" title="Real Logic Cross-Check">
            Scores are QK^T divided by sqrt(d_k). Each score row is passed through softmax, then multiplied by V to produce contextual output vectors.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
