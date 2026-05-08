import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';
import { Camera, Circle, Download, Hand, Play, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';

type GestureClass = { id: string; name: string; color: string };
type Example = { id: string; classId: string; values: number[] };
type Prediction = { id: string; name: string; color: string; probability: number };

const W = 640;
const H = 360;
const COLORS = ['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c'];
const initialClasses: GestureClass[] = [
  { id: 'open', name: 'Open Palm', color: COLORS[0] },
  { id: 'fist', name: 'Fist', color: COLORS[1] },
];

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

async function loadHandPoseDetection() {
  (window as any).tf = tf;
  await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/hand-pose-detection');
  return (window as any).handPoseDetection;
}

function normalizeHand(hand: any) {
  const points = hand.keypoints as Array<{ x: number; y: number; z?: number }>;
  if (!points?.length) return null;
  const wrist = points[0];
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const scale = Math.max(40, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return points.flatMap(point => [(point.x - wrist.x) / scale, (point.y - wrist.y) / scale, (point.z ?? 0) / scale]);
}

function buildClassifier(classCount: number, featureSize: number) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [featureSize], units: 48, activation: 'relu' }));
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

export default function HandGestureRecognitionPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<any>(null);
  const modelRef = useRef<tf.LayersModel | null>(null);
  const loopRef = useRef<number | null>(null);
  const captureRef = useRef<string | null>(null);
  const latestFeatureRef = useRef<number[] | null>(null);

  const [classes, setClasses] = useState<GestureClass[]>(initialClasses);
  const [examples, setExamples] = useState<Example[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [running, setRunning] = useState(false);
  const [capturing, setCapturing] = useState<string | null>(null);
  const [training, setTraining] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [status, setStatus] = useState('Start the webcam, hold Record for each gesture, then train.');

  const counts = useMemo(() => Object.fromEntries(classes.map(cls => [cls.id, examples.filter(ex => ex.classId === cls.id).length])), [classes, examples]);
  const readyToTrain = classes.length >= 2 && classes.every(cls => (counts[cls.id] ?? 0) >= 8) && !training;
  const best = predictions[0];

  useEffect(() => () => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    detectorRef.current?.dispose?.();
    modelRef.current?.dispose();
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(track => track.stop());
  }, []);

  const draw = (hands: any[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, W, H);
    hands.forEach(hand => {
      ctx.fillStyle = '#2563eb';
      hand.keypoints.forEach((point: any) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = '#22c55e';
      ctx.font = '14px sans-serif';
      ctx.fillText(`${hand.handedness} ${(hand.score * 100).toFixed(0)}%`, hand.keypoints[0].x + 8, hand.keypoints[0].y - 8);
    });
  };

  const classify = useCallback(async (feature: number[]) => {
    const model = modelRef.current;
    if (!model) return;
    const input = tf.tensor2d(feature, [1, feature.length]);
    const output = model.predict(input) as tf.Tensor;
    const values = Array.from(await output.data());
    input.dispose();
    output.dispose();
    setPredictions(classes.map((cls, index) => ({ ...cls, probability: values[index] ?? 0 })).sort((a, b) => b.probability - a.probability));
  }, [classes]);

  const tick = async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;
    if (!detector || !video || video.readyState < 2) {
      loopRef.current = requestAnimationFrame(tick);
      return;
    }
    const hands = await detector.estimateHands(video, { flipHorizontal: false, staticImageMode: false });
    draw(hands);
    const feature = hands[0] ? normalizeHand(hands[0]) : null;
    latestFeatureRef.current = feature;
    if (feature && captureRef.current) {
      setExamples(current => [...current, { id: `${captureRef.current}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, classId: captureRef.current as string, values: feature }]);
    }
    if (feature) void classify(feature);
    loopRef.current = requestAnimationFrame(tick);
  };

  const start = async () => {
    await tf.setBackend('webgl');
    await tf.ready();
    setStatus('Loading hand landmark detector...');
    const handPoseDetection = await loadHandPoseDetection();
    detectorRef.current ??= await handPoseDetection.createDetector(handPoseDetection.SupportedModels.MediaPipeHands, {
      runtime: 'tfjs',
      modelType: 'lite',
      maxHands: 1,
    } as any);
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: W, height: H }, audio: false });
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    setRunning(true);
    setStatus('Hand tracking is live.');
    loopRef.current = requestAnimationFrame(tick);
  };

  const train = async () => {
    if (!readyToTrain) {
      setStatus('Collect at least 8 examples for every gesture.');
      return;
    }
    setTraining(true);
    modelRef.current?.dispose();
    const featureSize = examples[0].values.length;
    const model = buildClassifier(classes.length, featureSize);
    const classIndex = new Map(classes.map((cls, index) => [cls.id, index]));
    const xs = tf.tensor2d(examples.flatMap(ex => ex.values), [examples.length, featureSize]);
    const ys = tf.tensor2d(examples.flatMap(ex => {
      const row = Array(classes.length).fill(0);
      row[classIndex.get(ex.classId) ?? 0] = 1;
      return row;
    }), [examples.length, classes.length]);
    await model.fit(xs, ys, {
      epochs: 24,
      batchSize: 12,
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
    setStatus('Gesture classifier trained. Show your hand for live inference.');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Hand Gesture Recognition" subtitle="Train custom hand gestures from webcam landmarks and classify them live with TensorFlow.js." badge="Browser Trainable" category="Computer Vision" icon={<Hand size={22} />} />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Controls" icon={<Camera size={14} />}>
            <button onClick={start} disabled={running} className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Play size={14} /> Start Webcam</button>
            <button onClick={train} disabled={!readyToTrain} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Play size={14} /> {training ? 'Training...' : 'Train Gestures'}</button>
            <button onClick={() => { setExamples([]); setPredictions([]); modelRef.current?.dispose(); modelRef.current = null; }} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-gray-700"><RotateCcw size={14} /> Reset</button>
          </Card>
          <Card title="Gesture Classes" actions={<button onClick={() => setClasses(current => [...current, { id: `gesture_${Date.now()}`, name: `Gesture ${current.length + 1}`, color: COLORS[current.length % COLORS.length] }])} className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700"><Plus size={12} /></button>}>
            <div className="space-y-2">
              {classes.map(cls => (
                <div key={cls.id} className="rounded border border-gray-200 p-2 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cls.color }} />
                    <input value={cls.name} onChange={event => setClasses(current => current.map(item => item.id === cls.id ? { ...item, name: event.target.value } : item))} className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold dark:border-gray-700 dark:bg-gray-900" />
                    <button onClick={() => setClasses(current => current.length <= 2 ? current : current.filter(item => item.id !== cls.id))} className="text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                  <button
                    onPointerDown={() => { captureRef.current = cls.id; setCapturing(cls.id); }}
                    onPointerUp={() => { captureRef.current = null; setCapturing(null); }}
                    onPointerCancel={() => { captureRef.current = null; setCapturing(null); }}
                    onPointerLeave={() => { captureRef.current = null; setCapturing(null); }}
                    className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded px-2 py-1.5 text-xs font-semibold text-white ${capturing === cls.id ? 'bg-red-600' : 'bg-blue-600'}`}
                  >
                    <Circle size={12} className={capturing === cls.id ? 'fill-current' : ''} /> Hold to Record
                  </button>
                  <p className="mt-1 text-xs text-gray-500">{counts[cls.id] ?? 0} examples</p>
                </div>
              ))}
            </div>
          </Card>
          <MetricsPanel title="Gesture Metrics" metrics={[
            { label: 'Classes', value: classes.length, format: 'number', color: 'blue' },
            { label: 'Examples', value: examples.length, format: 'number', color: 'green' },
            { label: 'Accuracy', value: accuracy, format: 'percent', color: 'green' },
            { label: 'Confidence', value: best?.probability ?? 0, format: 'percent', color: 'blue' },
          ]} />
          <InfoBox type="info" title="Runtime">{status}</InfoBox>
        </div>
        <div className="space-y-4">
          <Card title="Hand Landmarks">
            <video ref={videoRef} muted playsInline className="hidden" />
            <canvas ref={canvasRef} className="aspect-video w-full rounded-lg bg-gray-950" />
          </Card>
          <Card title="Live Gesture Prediction">
            {predictions.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={predictions}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 1]} tickFormatter={value => `${Math.round(Number(value) * 100)}%`} />
                  <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                  <Bar dataKey="probability" radius={[4, 4, 0, 0]}>{predictions.map(item => <Cell key={item.id} fill={item.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-500">Train the model to see live gesture probabilities.</p>}
            <button onClick={() => downloadJson('hand-gesture-dataset.json', { classes, examples })} className="mt-3 inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-gray-700"><Download size={14} /> Export Dataset</button>
          </Card>
        </div>
      </div>
    </div>
  );
}
