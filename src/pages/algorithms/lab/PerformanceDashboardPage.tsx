import { useEffect, useMemo, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, Download, Gauge, Play, Square } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';

type MetricPoint = { second: number; fps: number; latency: number; memory: number };

function downloadJson(filename: string, payload: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function PerformanceDashboardPage() {
  const timerRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [inputSize, setInputSize] = useState(64);
  const [classCount, setClassCount] = useState(3);
  const [points, setPoints] = useState<MetricPoint[]>([]);
  const [predictions, setPredictions] = useState<number[]>([]);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

  const latest = points[points.length - 1];
  const p95 = useMemo(() => {
    const sorted = points.map(item => item.latency).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  }, [points]);
  const predictionDistribution = Array.from({ length: classCount }, (_, index) => ({ label: `Class ${index + 1}`, count: predictions.filter(item => item === index).length }));
  const alerts = [
    latest && latest.fps < 10 ? 'Inference may be too slow for real-time use.' : '',
    points.length > 6 && latest && latest.memory > points[0].memory * 1.25 ? 'Memory is growing. Check tensor disposal paths.' : '',
    predictionDistribution.some(item => item.count > Math.max(20, predictions.length * 0.8)) ? 'One class dominates recent predictions. Check class balance.' : '',
  ].filter(Boolean);

  const tick = async () => {
    const started = performance.now();
    const batch = tf.randomUniform([8, inputSize, inputSize, 3]);
    const logits = tf.tidy(() => tf.softmax(tf.randomUniform([8, classCount])));
    const data = Array.from(await logits.data());
    logits.dispose();
    batch.dispose();
    const latency = performance.now() - started;
    const fps = Math.round(8000 / Math.max(1, latency));
    const memory = tf.memory().numBytes / 1024 / 1024;
    setPredictions(current => [...current, ...Array.from({ length: 8 }, (_, row) => {
      const probs = data.slice(row * classCount, (row + 1) * classCount);
      return probs.reduce((winner, value, index) => value > probs[winner] ? index : winner, 0);
    })].slice(-100));
    setPoints(current => [...current, { second: current.length + 1, fps, latency, memory }].slice(-60));
    await tf.nextFrame();
  };

  const start = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRunning(true);
    void tick();
    timerRef.current = window.setInterval(() => void tick(), 1000);
  };

  const stop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Live Performance Dashboard" subtitle="Track browser inference speed, latency, memory, and prediction drift over time." badge="Browser Inference" category="Lab" icon={<Gauge size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card title="Benchmark Controls">
            <div className="space-y-3 text-sm">
              <label className="block font-bold">Input size: {inputSize}px<input type="range" min={32} max={224} step={32} value={inputSize} onChange={event => setInputSize(Number(event.target.value))} className="mt-2 w-full accent-blue-600" /></label>
              <label className="block font-bold">Classes: {classCount}<input type="range" min={2} max={10} value={classCount} onChange={event => setClassCount(Number(event.target.value))} className="mt-2 w-full accent-blue-600" /></label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={start} className="inline-flex items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 font-bold text-white"><Play size={14} /> Start</button>
                <button onClick={stop} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-bold dark:border-gray-700"><Square size={14} /> Stop</button>
              </div>
              <button onClick={() => downloadJson('benchmark-report.json', { latest, p95, points, predictions, date: new Date().toISOString() })} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-bold dark:border-gray-700"><Download size={14} /> Export report</button>
            </div>
          </Card>
          <InfoBox type={alerts.length ? 'warning' : running ? 'success' : 'info'} title="Performance Alerts">{alerts.length ? alerts.join(' ') : running ? 'Inference loop is healthy.' : 'Start a benchmark to collect live metrics.'}</InfoBox>
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[['FPS', latest?.fps ?? 0, 'frames/sec'], ['Latency', latest?.latency.toFixed(1) ?? 0, `p95 ${p95.toFixed(1)}ms`], ['Memory', latest?.memory.toFixed(1) ?? 0, 'MB tensors']].map(([label, value, hint]) => (
              <Card key={label}><div className="flex items-center gap-3"><Activity className="text-blue-600" size={22} /><div><p className="text-xs font-bold uppercase text-gray-500">{label}</p><p className="text-2xl font-black">{value}</p><p className="text-xs text-gray-500">{hint}</p></div></div></Card>
            ))}
          </div>
          <Card title="FPS, Latency, and Memory">
            <ResponsiveContainer width="100%" height={280}><LineChart data={points}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="second" /><YAxis /><Tooltip /><Line dataKey="fps" stroke="#059669" name="FPS" /><Line dataKey="latency" stroke="#dc2626" name="Latency ms" /><Line dataKey="memory" stroke="#2563eb" name="Memory MB" /></LineChart></ResponsiveContainer>
          </Card>
          <Card title="Prediction Distribution">
            <ResponsiveContainer width="100%" height={240}><BarChart data={predictionDistribution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#9333ea" /></BarChart></ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}
