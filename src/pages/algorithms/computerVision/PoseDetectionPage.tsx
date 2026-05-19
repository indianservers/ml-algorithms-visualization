import { useEffect, useMemo, useRef, useState } from 'react';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';
import { Activity, Camera, Download, Play, Plus, Square, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { stopMediaElementStream, stopMediaStream } from '../../../lib/media/streams';
import { generateExperimentId, saveModelMetadata } from '../../../stores/experimentStore';

const W = 640;
const H = 360;
const FEATURE_SIZE = 34;
const MIN_POSES_PER_CLASS = 10;
const COLORS = ['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];

type PosePoint = { name?: string; x: number; y: number; score?: number };
type Pose = { keypoints: PosePoint[]; score?: number };
type PoseDetector = { estimatePoses: (video: HTMLVideoElement, options: { maxPoses: number; flipHorizontal: boolean }) => Promise<Pose[]>; dispose?: () => void };
type PoseDetectionModule = {
  SupportedModels: { MoveNet: string };
  movenet: { modelType: { SINGLEPOSE_LIGHTNING: string } };
  createDetector: (model: string, options: { modelType: string }) => Promise<PoseDetector>;
  util: { getAdjacentPairs: (model: string) => Array<[number, number]> };
};
type PoseClass = { id: string; label: string; color: string };
type PoseSample = { id: string; classId: string; features: number[]; keypoints: PosePoint[] };
type EpochPoint = { epoch: number; loss: number; accuracy: number };

const initialClasses: PoseClass[] = [
  { id: 'pose_a', label: 'Pose 1', color: COLORS[0] },
  { id: 'pose_b', label: 'Pose 2', color: COLORS[1] },
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

async function loadPoseDetection() {
  (window as typeof window & { tf?: typeof tf }).tf = tf;
  await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection');
  return (window as typeof window & { poseDetection?: PoseDetectionModule }).poseDetection;
}

function normalizeKeypoints(keypoints: PosePoint[]) {
  const visible = keypoints.filter(point => (point.score ?? 0) > 0.2);
  if (visible.length < 6) return null;
  const xs = visible.map(point => point.x);
  const ys = visible.map(point => point.y);
  const cx = visible.reduce((sum, point) => sum + point.x, 0) / visible.length;
  const cy = visible.reduce((sum, point) => sum + point.y, 0) / visible.length;
  const scale = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
  return keypoints.flatMap(point => [Number(((point.x - cx) / scale).toFixed(4)), Number(((point.y - cy) / scale).toFixed(4))]);
}

function buildPoseModel(classCount: number) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [FEATURE_SIZE] }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
  model.add(tf.layers.dense({ units: classCount, activation: 'softmax' }));
  model.compile({ optimizer: tf.train.adam(0.001), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
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

function PosePreview({ sample, color }: { sample: PoseSample; color: string }) {
  return (
    <svg viewBox="0 0 120 90" className="h-16 w-full rounded bg-gray-950">
      {sample.keypoints.map((point, index) => (
        <circle key={index} cx={(point.x / W) * 120} cy={(point.y / H) * 90} r="2.2" fill={color} opacity={(point.score ?? 0) > 0.2 ? 1 : 0.25} />
      ))}
    </svg>
  );
}

export default function PoseDetectionPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<PoseDetector | null>(null);
  const loopRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const classifierRef = useRef<tf.LayersModel | null>(null);
  const recordingRef = useRef<string | null>(null);
  const frameCounterRef = useRef(0);
  const classesRef = useRef<PoseClass[]>(initialClasses);
  const stableRef = useRef<{ label: number; count: number }>({ label: -1, count: 0 });
  const [classes, setClasses] = useState<PoseClass[]>(initialClasses);
  const [samples, setSamples] = useState<PoseSample[]>([]);
  const [running, setRunning] = useState(false);
  const [training, setTraining] = useState(false);
  const [recordingClass, setRecordingClass] = useState<string | null>(null);
  const [epochs, setEpochs] = useState(35);
  const [stabilityFrames, setStabilityFrames] = useState(5);
  const [status, setStatus] = useState('Start the webcam to detect poses. Hold a class button to record training samples.');
  const [poseCount, setPoseCount] = useState(0);
  const [keypointCount, setKeypointCount] = useState(0);
  const [score, setScore] = useState(0);
  const [latest, setLatest] = useState<Pose[]>([]);
  const [predictions, setPredictions] = useState<Array<PoseClass & { probability: number }>>([]);
  const [stablePrediction, setStablePrediction] = useState<string>('No pose');
  const [epochData, setEpochData] = useState<EpochPoint[]>([]);

  useEffect(() => { classesRef.current = classes; }, [classes]);

  useEffect(() => () => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    detectorRef.current?.dispose?.();
    classifierRef.current?.dispose();
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    stopMediaElementStream(videoRef.current);
  }, []);

  const counts = useMemo(
    () => Object.fromEntries(classes.map(cls => [cls.id, samples.filter(sample => sample.classId === cls.id).length])),
    [classes, samples]
  );
  const readyToTrain = classes.length >= 2 && classes.every(cls => (counts[cls.id] ?? 0) >= MIN_POSES_PER_CLASS) && !training;

  const draw = (poses: Pose[], label?: string) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, W, H);
    const poseDetection = (window as typeof window & { poseDetection?: PoseDetectionModule }).poseDetection;
    ctx.lineWidth = 3;
    poseDetection?.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet).forEach(([a, b]: [number, number]) => {
      poses.forEach(pose => {
        const p1 = pose.keypoints[a] as PosePoint;
        const p2 = pose.keypoints[b] as PosePoint;
        if ((p1.score ?? 0) > 0.25 && (p2.score ?? 0) > 0.25) {
          ctx.strokeStyle = '#22c55e';
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });
    });
    poses.flatMap(pose => pose.keypoints as PosePoint[]).forEach(point => {
      if ((point.score ?? 0) < 0.25) return;
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    if (label) {
      ctx.fillStyle = 'rgba(17,24,39,0.78)';
      ctx.fillRect(14, 14, 260, 44);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(label, 28, 43);
    }
  };

  const classifyPose = async (features: number[]) => {
    const classifier = classifierRef.current;
    if (!classifier) return undefined;
    const input = tf.tensor2d(features, [1, FEATURE_SIZE]);
    const output = classifier.predict(input) as tf.Tensor;
    const values = Array.from(await output.data());
    input.dispose();
    output.dispose();
    const ranked = classesRef.current
      .map((cls, index) => ({ ...cls, probability: values[index] ?? 0, index }))
      .sort((a, b) => b.probability - a.probability);
    setPredictions(ranked);
    const winner = ranked[0];
    if (!winner) return undefined;
    if (stableRef.current.label === winner.index) stableRef.current.count += 1;
    else stableRef.current = { label: winner.index, count: 1 };
    if (stableRef.current.count >= stabilityFrames) {
      setStablePrediction(winner.label);
      return `${winner.label} (${(winner.probability * 100).toFixed(0)}%)`;
    }
    return `${winner.label} pending...`;
  };

  async function tick() {
    const detector = detectorRef.current;
    const video = videoRef.current;
    if (!detector || !video || video.readyState < 2) {
      loopRef.current = requestAnimationFrame(tick);
      return;
    }
    const poses = await detector.estimatePoses(video, { maxPoses: 1, flipHorizontal: false });
    setLatest(poses);
    setPoseCount(poses.length);
    const visible = poses.flatMap(pose => pose.keypoints).filter((point: PosePoint) => (point.score ?? 0) > 0.25);
    setKeypointCount(visible.length);
    setScore(poses[0]?.score ?? visible.reduce((sum: number, point: PosePoint) => sum + (point.score ?? 0), 0) / Math.max(1, visible.length));

    const keypoints = (poses[0]?.keypoints ?? []) as PosePoint[];
    const features = keypoints.length ? normalizeKeypoints(keypoints) : null;
    const label = features ? await classifyPose(features) : undefined;
    frameCounterRef.current += 1;
    if (features && recordingRef.current && frameCounterRef.current % 12 === 0) {
      const classId = recordingRef.current;
      const sample: PoseSample = { id: `${classId}_${samples.length}_${frameCounterRef.current}`, classId, features, keypoints };
      setSamples(current => [...current, sample]);
    }
    draw(poses, classifierRef.current ? label : undefined);
    loopRef.current = requestAnimationFrame(tick);
  }

  const start = async () => {
    if (running) return;
    await tf.setBackend('webgl');
    await tf.ready();
    setStatus('Loading MoveNet...');
    const poseDetection = await loadPoseDetection();
    detectorRef.current ??= await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: W, height: H }, audio: false });
    if (!videoRef.current) {
      stopMediaStream(stream);
      return;
    }
    streamRef.current = stream;
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    setRunning(true);
    setStatus('MoveNet is running. Hold a pose class button to collect samples every 200ms.');
    loopRef.current = requestAnimationFrame(tick);
  };

  const stop = () => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    recordingRef.current = null;
    setRecordingClass(null);
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    stopMediaElementStream(videoRef.current);
    setRunning(false);
    setStatus('Pose detection stopped and webcam released.');
  };

  const train = async () => {
    if (!readyToTrain) {
      setStatus('Collect at least 10 pose samples for every class before training.');
      return;
    }
    setTraining(true);
    setEpochData([]);
    classifierRef.current?.dispose();
    const model = buildPoseModel(classes.length);
    const classIndex = new Map(classes.map((cls, index) => [cls.id, index]));
    const xs = tf.tensor2d(samples.flatMap(sample => sample.features), [samples.length, FEATURE_SIZE]);
    const ys = tf.tensor2d(samples.flatMap(sample => {
      const row = Array(classes.length).fill(0);
      row[classIndex.get(sample.classId) ?? 0] = 1;
      return row;
    }), [samples.length, classes.length]);
    let finalAccuracy = 0;
    await model.fit(xs, ys, {
      epochs,
      batchSize: 16,
      shuffle: true,
      validationSplit: samples.length >= 30 ? 0.2 : 0,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          finalAccuracy = (logs?.acc as number | undefined) ?? (logs?.accuracy as number | undefined) ?? 0;
          setEpochData(current => [...current, {
            epoch: epoch + 1,
            loss: Number((logs?.loss ?? 0).toFixed(4)),
            accuracy: Number(finalAccuracy.toFixed(4)),
          }]);
          await tf.nextFrame();
        },
      },
    });
    xs.dispose();
    ys.dispose();
    classifierRef.current = model;
    await saveModelMetadata({
      id: generateExperimentId(),
      name: `Pose classifier - ${classes.length} classes`,
      algorithmId: 'pose-detection',
      algorithmName: 'Pose Classification',
      savedAt: Date.now(),
      parameters: { modality: 'pose', classCount: classes.length, labels: classes.map(cls => cls.label), featureSize: FEATURE_SIZE, epochs },
      metrics: { accuracy: finalAccuracy },
      artifactType: 'tfjs',
    });
    setTraining(false);
    setStatus('Pose classifier trained. Predictions now appear on the skeleton overlay.');
  };

  const exportModel = async () => {
    if (!classifierRef.current) {
      setStatus('Train the pose classifier before exporting a model.');
      return;
    }
    await classifierRef.current.save('downloads://pose-classifier');
    downloadJson('pose-classifier-dataset.json', { classes, samples: classes.map(cls => ({ label: cls.label, samples: samples.filter(sample => sample.classId === cls.id).map(sample => sample.features) })) });
  };

  const addClass = () => {
    setClasses(current => current.length >= 6 ? current : [
      ...current,
      { id: `pose_${Date.now()}`, label: `Pose ${current.length + 1}`, color: COLORS[current.length % COLORS.length] },
    ]);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader
        title="Pose Detection and Classification"
        subtitle="MoveNet keypoints plus a browser-trained dense classifier for custom yoga poses, exercises, or body gestures."
        badge="Browser Trainable"
        category="Computer Vision"
        icon={<Activity size={22} />}
      />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr_360px]">
        <div className="space-y-4">
          <Card title="Pose Classes" actions={<button onClick={addClass} disabled={classes.length >= 6} className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"><Plus size={12} /></button>}>
            <div className="space-y-3">
              {classes.map(cls => {
                const classSamples = samples.filter(sample => sample.classId === cls.id);
                return (
                  <div key={cls.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cls.color }} />
                      <input value={cls.label} onChange={event => setClasses(current => current.map(item => item.id === cls.id ? { ...item, label: event.target.value } : item))} className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm font-semibold dark:border-gray-700 dark:bg-gray-900" />
                      <button onClick={() => setClasses(current => current.length <= 2 ? current : current.filter(item => item.id !== cls.id))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                    <button
                      onPointerDown={() => { recordingRef.current = cls.id; setRecordingClass(cls.id); }}
                      onPointerUp={() => { recordingRef.current = null; setRecordingClass(null); }}
                      onPointerLeave={() => { recordingRef.current = null; setRecordingClass(null); }}
                      disabled={!running}
                      className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-xs font-bold text-white disabled:opacity-50 ${recordingClass === cls.id ? 'bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      {recordingClass === cls.id ? <Square size={13} /> : <Camera size={13} />}
                      Hold to record
                    </button>
                    <p className={`mt-2 text-xs font-bold ${(counts[cls.id] ?? 0) >= MIN_POSES_PER_CLASS ? 'text-green-600' : 'text-amber-600'}`}>{counts[cls.id] ?? 0} / {MIN_POSES_PER_CLASS} poses</p>
                    <div className="mt-2 grid grid-cols-3 gap-1">
                      {classSamples.slice(-9).map(sample => <PosePreview key={sample.id} sample={sample} color={cls.color} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Webcam Skeleton">
            <video ref={videoRef} muted playsInline className="hidden" />
            <canvas ref={canvasRef} className="aspect-video w-full rounded-lg bg-gray-950" />
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <button onClick={start} disabled={running} className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Play size={14} /> Start</button>
              <button onClick={stop} disabled={!running} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-700"><Square size={14} /> Stop</button>
              <button onClick={train} disabled={!readyToTrain} className="inline-flex items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Play size={14} /> {training ? 'Training...' : 'Train'}</button>
              <button onClick={exportModel} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-gray-700"><Download size={14} /> Export</button>
            </div>
          </Card>

          <Card title="Training Monitor">
            {epochData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={epochData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epoch" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line dataKey="accuracy" stroke="#059669" strokeWidth={2.5} dot={false} />
                  <Line dataKey="loss" stroke="#dc2626" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-500">Training accuracy and loss stream here during model.fit().</p>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Live Pose Prediction">
            <div className="rounded-2xl bg-green-50 p-5 text-center text-green-700 dark:bg-green-900/20 dark:text-green-200">
              <p className="text-xs font-bold uppercase tracking-wide">Stable prediction</p>
              <p className="mt-1 text-3xl font-black">{stablePrediction}</p>
            </div>
            <label className="mt-4 block text-sm font-semibold text-gray-600 dark:text-gray-300">
              Epochs: <span className="font-mono text-blue-600">{epochs}</span>
              <input type="range" min={20} max={60} step={5} value={epochs} onChange={event => setEpochs(Number(event.target.value))} className="mt-2 w-full accent-emerald-600" />
            </label>
            <label className="mt-4 block text-sm font-semibold text-gray-600 dark:text-gray-300">
              Hold for frames: <span className="font-mono text-blue-600">{stabilityFrames}</span>
              <input type="range" min={1} max={12} value={stabilityFrames} onChange={event => setStabilityFrames(Number(event.target.value))} className="mt-2 w-full accent-blue-600" />
            </label>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={predictions}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 1]} tickFormatter={value => `${Math.round(Number(value) * 100)}%`} />
                  <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                  <Bar dataKey="probability" radius={[4, 4, 0, 0]}>
                    {predictions.map(prediction => <Cell key={prediction.id} fill={prediction.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card title="Live Metrics">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Poses', poseCount],
                ['Keypoints', keypointCount],
                ['Score', `${(score * 100).toFixed(1)}%`],
                ['Samples', samples.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-900">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-xl font-black text-gray-900 dark:text-gray-100">{value}</p>
                </div>
              ))}
            </div>
          </Card>
          <InfoBox type="info" title="Runtime">{status}</InfoBox>
          <button onClick={() => downloadJson('pose-detection-frame.json', latest)} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-gray-700"><Download size={14} /> Export Current Pose JSON</button>
        </div>
      </div>
    </div>
  );
}
