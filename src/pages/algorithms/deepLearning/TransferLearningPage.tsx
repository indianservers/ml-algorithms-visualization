import { useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { Camera, Layers, Play } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';

type SamplePoint = { id: string; className: string; x: number; y: number; stage: string };
type CurvePoint = { epoch: number; frozen: number; fineTuned: number; scratch: number };

const colors = ['#2563eb', '#059669', '#dc2626', '#9333ea'];

function makePoints(classes: string[], perClass: number) {
  return classes.flatMap((className, classIndex) => Array.from({ length: perClass }, (_, index) => {
    const angle = (classIndex / Math.max(1, classes.length)) * Math.PI * 2;
    const cx = Math.cos(angle) * 2.2;
    const cy = Math.sin(angle) * 1.4;
    return {
      id: `${className}-${index}`,
      className,
      x: cx + Math.sin(index * 1.7 + classIndex) * 0.45,
      y: cy + Math.cos(index * 1.1 + classIndex) * 0.35,
      stage: 'MobileNet feature',
    };
  }));
}

export default function TransferLearningPage() {
  const [classText, setClassText] = useState('Defect\nNormal');
  const [shots, setShots] = useState(10);
  const [stage, setStage] = useState<'features' | 'head' | 'fineTune'>('features');
  const [running, setRunning] = useState(false);
  const classes = useMemo(() => classText.split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, 4), [classText]);
  const points = useMemo(() => makePoints(classes.length ? classes : ['Class 1', 'Class 2'], shots), [classes, shots]);
  const curve = useMemo<CurvePoint[]>(() => Array.from({ length: 16 }, (_, index) => {
    const epoch = index + 1;
    return {
      epoch,
      frozen: Math.min(0.96, 0.48 + Math.log1p(epoch) * 0.17),
      fineTuned: index < 10 ? 0 : Math.min(0.98, 0.86 + (epoch - 10) * 0.018),
      scratch: Math.min(0.78, 0.35 + Math.log1p(epoch) * 0.13),
    };
  }), []);

  const runDemo = () => {
    setRunning(true);
    setStage('features');
    window.setTimeout(() => setStage('head'), 800);
    window.setTimeout(() => setStage('fineTune'), 1700);
    window.setTimeout(() => setRunning(false), 2200);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Transfer Learning Explorer" subtitle="Walk through frozen MobileNet features, a trainable classifier head, and careful fine-tuning." badge="Browser Trainable" category="Deep Learning" icon={<Layers size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card title="Controls">
            <div className="space-y-3 text-sm">
              <label className="block font-bold">Class labels<textarea value={classText} onChange={event => setClassText(event.target.value)} rows={4} className="mt-2 w-full rounded border border-gray-200 bg-white p-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-900" /></label>
              <label className="block font-bold">Examples per class: {shots}<input type="range" min={4} max={24} value={shots} onChange={event => setShots(Number(event.target.value))} className="mt-2 w-full accent-blue-600" /></label>
              <button onClick={runDemo} className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-bold text-white"><Play size={14} /> {running ? 'Running stages...' : 'Run staged demo'}</button>
            </div>
          </Card>
          <Card title="Stage Checklist">
            {[
              ['features', '1. Frozen feature extraction', 'MobileNet turns images into reusable 1024-d visual features.'],
              ['head', '2. Train classifier head', 'Only a tiny Dense head updates, so small datasets train quickly.'],
              ['fineTune', '3. Fine-tune top layers', 'A small learning rate nudges the base model toward your task.'],
            ].map(([key, title, detail]) => (
              <div key={key} className={`mb-2 rounded border p-3 text-sm ${stage === key ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' : 'border-gray-200 dark:border-gray-700'}`}>
                <p className="font-bold">{title}</p>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{detail}</p>
              </div>
            ))}
          </Card>
          <InfoBox type="info" title="Scratch vs Transfer">Transfer learning starts from general visual features. Training from scratch needs far more images before it becomes stable.</InfoBox>
        </div>
        <div className="space-y-4">
          <Card title="Feature Space Projection" actions={<span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold dark:bg-gray-900"><Camera size={13} /> simulated webcam embeddings</span>}>
            <ResponsiveContainer width="100%" height={330}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis dataKey="x" name="PCA 1" />
                <YAxis dataKey="y" name="PCA 2" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                {classes.map((className, index) => (
                  <Scatter key={className} name={className} data={points.filter(point => point.className === className)} fill={colors[index % colors.length]} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
          <Card title="Accuracy Comparison">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={curve}>
                <XAxis dataKey="epoch" />
                <YAxis tickFormatter={value => `${Math.round(Number(value) * 100)}%`} domain={[0.3, 1]} />
                <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                <Line type="monotone" dataKey="scratch" stroke="#94a3b8" name="Scratch" />
                <Line type="monotone" dataKey="frozen" stroke="#2563eb" name="Frozen base" strokeWidth={2} />
                <Line type="monotone" dataKey="fineTuned" stroke="#059669" name="Fine-tuned" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}
