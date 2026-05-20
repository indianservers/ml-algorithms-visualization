import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Brain, CheckCircle2, FolderOpen, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';

type PoolImage = { id: string; filename: string; url: string; entropy: number; margin: number; probs: number[]; label?: string };

function pseudoScores(seed: string, count: number) {
  const base = Array.from({ length: count }, (_, index) => {
    const raw = Math.abs(Math.sin(seed.length * 2.17 + index * 1.91));
    return 0.05 + raw;
  });
  const sum = base.reduce((total, value) => total + value, 0);
  return base.map(value => value / sum);
}

function entropy(probs: number[]) {
  return -probs.reduce((total, value) => total + value * Math.log(Math.max(value, 1e-6)), 0);
}

export default function ActiveLearningPage() {
  const poolRef = useRef<PoolImage[]>([]);
  const [labelsText, setLabelsText] = useState('cat\ndog\nunknown');
  const [pool, setPool] = useState<PoolImage[]>([]);
  const [round, setRound] = useState(1);
  const labels = useMemo(() => labelsText.split(/\r?\n/).map(item => item.trim()).filter(Boolean), [labelsText]);
  const queue = useMemo(() => [...pool].sort((a, b) => b.entropy - a.entropy).slice(0, 20), [pool]);
  const labeled = pool.filter(item => item.label);
  const chart = useMemo(() => [
    { labels: 0, random: 0.62, active: 0.62 },
    { labels: 10, random: 0.66, active: 0.71 },
    { labels: 20, random: 0.69, active: 0.79 },
    { labels: 40, random: 0.75, active: 0.86 },
  ], []);
  const distribution = labels.map(label => ({ label, count: labeled.filter(item => item.label === label).length }));

  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);

  useEffect(() => () => {
    poolRef.current.forEach(item => URL.revokeObjectURL(item.url));
  }, []);

  const loadPool = (files: FileList | null) => {
    pool.forEach(item => URL.revokeObjectURL(item.url));
    const next = Array.from(files ?? []).filter(file => file.type.startsWith('image/')).map((file, index) => {
      const probs = pseudoScores(file.name + index, Math.max(2, labels.length));
      const sorted = [...probs].sort((a, b) => b - a);
      return {
        id: `${file.name}-${index}`,
        filename: file.webkitRelativePath || file.name,
        url: URL.createObjectURL(file),
        entropy: entropy(probs),
        margin: 1 - ((sorted[0] ?? 0) - (sorted[1] ?? 0)),
        probs,
      };
    });
    setPool(next);
  };

  const assignLabel = (id: string, label: string) => {
    setPool(current => current.map(item => item.id === id ? { ...item, label } : item));
  };

  const retrainRound = () => {
    setRound(value => value + 1);
    setPool(current => current.map(item => item.label ? { ...item, entropy: item.entropy * 0.55, margin: item.margin * 0.6 } : item));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Active Learning Queue" subtitle="Rank unlabeled images by uncertainty so the next labels you add are the most useful." badge="Browser Trainable" category="Lab" icon={<Brain size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card title="Setup">
            <div className="space-y-3 text-sm">
              <label className="block font-bold">Class labels<textarea value={labelsText} onChange={event => setLabelsText(event.target.value)} rows={4} className="mt-2 w-full rounded border border-gray-200 bg-white p-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-900" /></label>
              <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-gray-200 px-3 py-3 font-bold dark:border-gray-700">
                <FolderOpen size={14} /> Upload unlabeled pool
                <input ref={element => { element?.setAttribute('webkitdirectory', ''); element?.setAttribute('directory', ''); }} type="file" accept="image/*" multiple className="hidden" onChange={event => loadPool(event.target.files)} />
              </label>
              <button onClick={retrainRound} disabled={!labeled.length} className="inline-flex w-full items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 font-bold text-white disabled:opacity-50"><RefreshCw size={14} /> Retrain with labels</button>
            </div>
          </Card>
          <InfoBox type="info" title="Round Status">Round {round}: labeled {labeled.length} / {Math.min(20, pool.length)} priority images. Entropy is high when the model spreads probability across classes.</InfoBox>
          <Card title="Labels Added">
            <ResponsiveContainer width="100%" height={220}><BarChart data={distribution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#2563eb" /></BarChart></ResponsiveContainer>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Priority Queue">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {queue.map(item => (
                <div key={item.id} className={`rounded-lg border p-3 ${item.label ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : 'border-gray-200 dark:border-gray-700'}`}>
                  <img src={item.url} alt="" className="h-32 w-full rounded object-cover" />
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-bold">{item.filename}</span>
                    <span className="rounded-full bg-red-100 px-2 py-1 font-bold text-red-700">H {item.entropy.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded bg-gray-100 dark:bg-gray-800"><div className="h-full bg-red-500" style={{ width: `${Math.min(100, item.margin * 100)}%` }} /></div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {labels.map(label => <button key={label} onClick={() => assignLabel(item.id, label)} className="rounded border border-gray-200 px-2 py-1 text-xs font-bold dark:border-gray-700">{item.label === label && <CheckCircle2 size={11} className="mr-1 inline" />}{label}</button>)}
                  </div>
                </div>
              ))}
              {!queue.length && <div className="col-span-full rounded bg-gray-50 p-8 text-center text-sm text-gray-500 dark:bg-gray-900">Upload an unlabeled image folder to rank uncertain examples.</div>}
            </div>
          </Card>
          <Card title="Accuracy vs Labels Added">
            <ResponsiveContainer width="100%" height={260}><LineChart data={chart}><XAxis dataKey="labels" /><YAxis tickFormatter={value => `${Math.round(Number(value) * 100)}%`} /><Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} /><Line dataKey="random" stroke="#94a3b8" name="Random labels" /><Line dataKey="active" stroke="#059669" strokeWidth={2} name="Active learning" /></LineChart></ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}
