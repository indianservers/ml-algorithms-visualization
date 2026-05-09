import { useEffect, useMemo, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Mic, Play, Plus, Radio, RotateCcw, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { stopMediaStream } from '../../../lib/media/streams';

type AudioClass = { id: string; name: string; color: string };
type AudioExample = { id: string; classId: string; values: number[] };
type Prediction = AudioClass & { probability: number };

const COLORS = ['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c'];
const initialClasses: AudioClass[] = [
  { id: 'sound_a', name: 'Sound 1', color: COLORS[0] },
  { id: 'sound_b', name: 'Sound 2', color: COLORS[1] },
];
const FEATURE_SIZE = 64;

function buildModel(classCount: number) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [FEATURE_SIZE], units: 48, activation: 'relu' }));
  model.add(tf.layers.dense({ units: classCount, activation: 'softmax' }));
  model.compile({ optimizer: tf.train.adam(0.01), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
  return model;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AudioClassificationPage() {
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<tf.LayersModel | null>(null);
  const captureRef = useRef<string | null>(null);
  const loopRef = useRef<number | null>(null);
  const [classes, setClasses] = useState<AudioClass[]>(initialClasses);
  const [examples, setExamples] = useState<AudioExample[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [capturing, setCapturing] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [training, setTraining] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState('Start the microphone, hold Record for each sound, then train.');

  const counts = useMemo(() => Object.fromEntries(classes.map(cls => [cls.id, examples.filter(ex => ex.classId === cls.id).length])), [classes, examples]);
  const readyToTrain = classes.length >= 2 && classes.every(cls => (counts[cls.id] ?? 0) >= 8) && !training;
  const best = predictions[0];

  useEffect(() => () => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    void contextRef.current?.close();
    modelRef.current?.dispose();
  }, []);

  const readFeature = () => {
    const analyser = analyserRef.current;
    if (!analyser) return null;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const bins = Array.from(data.slice(0, FEATURE_SIZE)).map(value => value / 255);
    setLevel(bins.reduce((sum, value) => sum + value, 0) / bins.length);
    return bins;
  };

  const classify = async (feature: number[]) => {
    const model = modelRef.current;
    if (!model) return;
    const input = tf.tensor2d(feature, [1, FEATURE_SIZE]);
    const output = model.predict(input) as tf.Tensor;
    const values = Array.from(await output.data());
    input.dispose();
    output.dispose();
    setPredictions(classes.map((cls, index) => ({ ...cls, probability: values[index] ?? 0 })).sort((a, b) => b.probability - a.probability));
  };

  const loop = () => {
    const feature = readFeature();
    if (feature && captureRef.current) {
      setExamples(current => [...current, { id: `${captureRef.current}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, classId: captureRef.current as string, values: feature }]);
    }
    if (feature) void classify(feature);
    loopRef.current = requestAnimationFrame(loop);
  };

  const startMic = async () => {
    stopMic(false);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    streamRef.current = stream;
    contextRef.current = context;
    analyserRef.current = analyser;
    setRunning(true);
    setStatus('Microphone is live.');
    loopRef.current = requestAnimationFrame(loop);
  };

  const stopMic = (updateStatus = true) => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    captureRef.current = null;
    setCapturing(null);
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    analyserRef.current = null;
    setRunning(false);
    if (updateStatus) setStatus('Microphone stopped and released.');
  };

  const train = async () => {
    if (!readyToTrain) {
      setStatus('Collect at least 8 examples for every sound class.');
      return;
    }
    setTraining(true);
    modelRef.current?.dispose();
    const model = buildModel(classes.length);
    const classIndex = new Map(classes.map((cls, index) => [cls.id, index]));
    const xs = tf.tensor2d(examples.flatMap(ex => ex.values), [examples.length, FEATURE_SIZE]);
    const ys = tf.tensor2d(examples.flatMap(ex => {
      const row = Array(classes.length).fill(0);
      row[classIndex.get(ex.classId) ?? 0] = 1;
      return row;
    }), [examples.length, classes.length]);
    await model.fit(xs, ys, {
      epochs: 30,
      batchSize: 16,
      shuffle: true,
      callbacks: {
        onEpochEnd: async (_epoch, logs) => {
          setAccuracy(Number((logs?.acc as number ?? logs?.accuracy as number ?? 0).toFixed(4)));
          await tf.nextFrame();
        },
      },
    });
    xs.dispose();
    ys.dispose();
    modelRef.current = model;
    setTraining(false);
    setStatus('Audio classifier trained. Keep the microphone running for live inference.');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Audio Classification" subtitle="Train custom sound classes from microphone FFT features and classify live audio in TensorFlow.js." badge="Browser Trainable" category="NLP" icon={<Mic size={22} />} />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Microphone" icon={<Mic size={14} />}>
            <button onClick={startMic} disabled={running} className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Radio size={14} /> Start Microphone</button>
            <button onClick={() => stopMic()} disabled={!running} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-700"><Mic size={14} /> Stop Microphone</button>
            <button onClick={train} disabled={!readyToTrain} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Play size={14} /> {training ? 'Training...' : 'Train Audio'}</button>
            <button onClick={() => { setExamples([]); setPredictions([]); modelRef.current?.dispose(); modelRef.current = null; }} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-gray-700"><RotateCcw size={14} /> Reset</button>
          </Card>
          <Card title="Sound Classes" actions={<button onClick={() => setClasses(current => [...current, { id: `sound_${Date.now()}`, name: `Sound ${current.length + 1}`, color: COLORS[current.length % COLORS.length] }])} className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700"><Plus size={12} /></button>}>
            <div className="space-y-2">
              {classes.map(cls => (
                <div key={cls.id} className="rounded border border-gray-200 p-2 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cls.color }} />
                    <input value={cls.name} onChange={event => setClasses(current => current.map(item => item.id === cls.id ? { ...item, name: event.target.value } : item))} className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold dark:border-gray-700 dark:bg-gray-900" />
                    <button onClick={() => setClasses(current => current.length <= 2 ? current : current.filter(item => item.id !== cls.id))} className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                  <button onPointerDown={() => { captureRef.current = cls.id; setCapturing(cls.id); }} onPointerUp={() => { captureRef.current = null; setCapturing(null); }} onPointerLeave={() => { captureRef.current = null; setCapturing(null); }} className={`mt-2 w-full rounded px-2 py-1.5 text-xs font-semibold text-white ${capturing === cls.id ? 'bg-red-600' : 'bg-blue-600'}`}>Hold to Record</button>
                  <p className="mt-1 text-xs text-gray-500">{counts[cls.id] ?? 0} examples</p>
                </div>
              ))}
            </div>
          </Card>
          <MetricsPanel title="Audio Metrics" metrics={[
            { label: 'Classes', value: classes.length, format: 'number', color: 'blue' },
            { label: 'Examples', value: examples.length, format: 'number', color: 'green' },
            { label: 'Input Level', value: level, format: 'percent', color: 'blue' },
            { label: 'Accuracy', value: accuracy, format: 'percent', color: 'green' },
          ]} />
          <InfoBox type="info" title="Runtime">{status}</InfoBox>
        </div>
        <div className="space-y-4">
          <Card title="Live Audio Prediction">
            {predictions.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={predictions}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 1]} tickFormatter={value => `${Math.round(Number(value) * 100)}%`} />
                  <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                  <Bar dataKey="probability" radius={[4, 4, 0, 0]}>{predictions.map(item => <Cell key={item.id} fill={item.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-500">Train the model to see live sound probabilities.</p>}
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">Top sound: <b>{best?.name ?? 'none'}</b> {best ? `${(best.probability * 100).toFixed(1)}%` : ''}</p>
            <button onClick={() => downloadJson('audio-classification-dataset.json', { classes, examples })} className="mt-3 inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-gray-700"><Download size={14} /> Export Dataset</button>
          </Card>
          <InfoBox type="success" title="Real Browser Audio ML">
            The page reads microphone frequency bins with Web Audio, records examples per class, trains a TensorFlow.js classifier, and runs live inference locally.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
