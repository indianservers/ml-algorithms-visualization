import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';
import { Camera, Sparkles, Upload } from 'lucide-react';
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { stopMediaElementStream, stopMediaStream } from '../../../lib/media/streams';

type SupportExample = { id: string; classId: string; preview: string; embedding: number[] };
type FewShotClass = { id: string; name: string; color: string };

const COLORS = ['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c'];

function cosine(a: number[], b: number[]) {
  let dot = 0, ma = 0, mb = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    dot += a[index] * b[index];
    ma += a[index] * a[index];
    mb += b[index] * b[index];
  }
  return dot / Math.max(1e-8, Math.sqrt(ma) * Math.sqrt(mb));
}

function meanEmbedding(items: SupportExample[]) {
  const length = items[0]?.embedding.length ?? 0;
  return Array.from({ length }, (_, index) => items.reduce((sum, item) => sum + item.embedding[index], 0) / Math.max(1, items.length));
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });
}

export default function FewShotLearningPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const extractorRef = useRef<mobilenet.MobileNet | null>(null);
  const [classCount, setClassCount] = useState(3);
  const [shots, setShots] = useState(2);
  const [classes, setClasses] = useState<FewShotClass[]>(() => Array.from({ length: 3 }, (_, index) => ({ id: `class_${index}`, name: `Class ${index + 1}`, color: COLORS[index] })));
  const [examples, setExamples] = useState<SupportExample[]>([]);
  const [query, setQuery] = useState<{ embedding: number[]; scores: Array<{ classId: string; score: number }> } | null>(null);
  const [status, setStatus] = useState('Load MobileNet, add 1-5 examples per class, then run live cosine similarity.');

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    stopMediaStream(streamRef.current);
    stopMediaElementStream(videoRef.current);
  }, []);

  useEffect(() => {
    setClasses(current => Array.from({ length: classCount }, (_, index) => current[index] ?? { id: `class_${index}`, name: `Class ${index + 1}`, color: COLORS[index] }));
  }, [classCount]);

  const ensureExtractor = async () => {
    await tf.ready();
    if (!extractorRef.current) {
      setStatus('Loading MobileNet feature extractor...');
      extractorRef.current = await mobilenet.load({ version: 2, alpha: 0.5 });
    }
    return extractorRef.current;
  };

  const embedSource = async (source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) => {
    const extractor = await ensureExtractor();
    const activation = extractor.infer(source, true) as tf.Tensor;
    const values = Array.from(await activation.data());
    activation.dispose();
    return values;
  };

  const startCamera = async () => {
    await ensureExtractor();
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    setStatus('Camera is live. Capture support images or watch the query prediction update.');
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => void updateQuery(), 400);
  };

  const addSupportFromVideo = async (classId: string) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    canvas.width = 96;
    canvas.height = 96;
    canvas.getContext('2d')?.drawImage(video, 0, 0, 96, 96);
    const embedding = await embedSource(video);
    setExamples(current => [...current.filter(item => !(item.classId === classId && current.filter(entry => entry.classId === classId).indexOf(item) >= shots)), { id: `${classId}_${Date.now()}`, classId, preview: canvas.toDataURL('image/jpeg', 0.75), embedding }]);
  };

  const addSupportFile = async (classId: string, file: File | null) => {
    if (!file) return;
    const image = await loadImage(file);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 96;
    canvas.height = 96;
    canvas.getContext('2d')?.drawImage(image, 0, 0, 96, 96);
    const embedding = await embedSource(image);
    setExamples(current => [...current, { id: `${classId}_${Date.now()}`, classId, preview: canvas.toDataURL('image/jpeg', 0.75), embedding }]);
  };

  const updateQuery = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || examples.length === 0) return;
    const embedding = await embedSource(video);
    const scores = classes.map(cls => {
      const items = examples.filter(item => item.classId === cls.id);
      return { classId: cls.id, score: items.length ? cosine(embedding, meanEmbedding(items)) : -1 };
    }).sort((a, b) => b.score - a.score);
    setQuery({ embedding, scores });
  }, [classes, examples]);

  const top = query?.scores[0];
  const scatter = useMemo(() => {
    const points = examples.map(item => ({ x: item.embedding[0] ?? 0, y: item.embedding[1] ?? 0, classId: item.classId, kind: 'support' }));
    if (query) points.push({ x: query.embedding[0] ?? 0, y: query.embedding[1] ?? 0, classId: 'query', kind: 'query' });
    return points;
  }, [examples, query]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Few-Shot Learning" subtitle="Classify new images from 1-5 support examples per class using MobileNet embeddings and cosine similarity, with no retraining." badge="Browser Inference" category="Deep Learning" icon={<Sparkles size={22} />} />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Support Set">
            <label className="block text-sm font-semibold">Classes: {classCount}<input type="range" min={2} max={5} value={classCount} onChange={event => setClassCount(Number(event.target.value))} className="mt-2 w-full accent-blue-600" /></label>
            <label className="mt-3 block text-sm font-semibold">K-shot: {shots}<input type="range" min={1} max={5} value={shots} onChange={event => setShots(Number(event.target.value))} className="mt-2 w-full accent-blue-600" /></label>
            <button onClick={startCamera} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white"><Camera size={14} /> Start Camera</button>
          </Card>
          {classes.map(cls => {
            const classExamples = examples.filter(item => item.classId === cls.id).slice(-shots);
            return (
              <Card key={cls.id} title={cls.name}>
                <input value={cls.name} onChange={event => setClasses(current => current.map(item => item.id === cls.id ? { ...item, name: event.target.value } : item))} className="mb-2 w-full rounded border border-gray-200 bg-white p-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-900" />
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => void addSupportFromVideo(cls.id)} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-2 py-2 text-xs font-bold dark:border-gray-700"><Camera size={13} /> Capture</button>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded border border-gray-200 px-2 py-2 text-xs font-bold dark:border-gray-700"><Upload size={13} /> Upload<input type="file" accept="image/*" className="hidden" onChange={event => void addSupportFile(cls.id, event.target.files?.[0] ?? null)} /></label>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-1">{classExamples.map(item => <img key={item.id} src={item.preview} alt="" className="aspect-square rounded object-cover" />)}</div>
              </Card>
            );
          })}
        </div>
        <div className="space-y-4">
          <Card title="Live Query">
            <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-lg bg-gray-950 object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="mt-4 rounded-2xl bg-gray-50 p-5 text-center dark:bg-gray-900">
              <p className="text-xs font-bold uppercase text-gray-500">Prediction</p>
              <p className="text-4xl font-black" style={{ color: classes.find(cls => cls.id === top?.classId)?.color }}>{classes.find(cls => cls.id === top?.classId)?.name ?? 'Add support images'}</p>
              <p className="text-sm text-gray-500">{top ? `${(top.score * 100).toFixed(1)}% cosine similarity` : 'Waiting for query frame'}</p>
            </div>
            <div className="mt-4 space-y-2">
              {query?.scores.map(score => {
                const cls = classes.find(item => item.id === score.classId);
                return <div key={score.classId}><div className="flex justify-between text-xs font-bold"><span>{cls?.name}</span><span>{(score.score * 100).toFixed(1)}%</span></div><div className="h-3 rounded bg-gray-100 dark:bg-gray-800"><div className="h-3 rounded" style={{ width: `${Math.max(0, score.score) * 100}%`, backgroundColor: cls?.color }} /></div></div>;
              })}
            </div>
          </Card>
          <Card title="Embedding Space">
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" type="number" name="feature 1" />
                <YAxis dataKey="y" type="number" name="feature 2" />
                <Tooltip />
                {classes.map(cls => <Scatter key={cls.id} name={cls.name} data={scatter.filter(item => item.classId === cls.id)} fill={cls.color} />)}
                <Scatter name="Query" data={scatter.filter(item => item.kind === 'query')} fill="#111827" shape="star" />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>
          <InfoBox type="info" title="Why This Works">{status} MobileNet was trained on a broad image corpus, so nearby 1024-dimensional feature vectors often share visual meaning even for new classes.</InfoBox>
        </div>
      </div>
    </div>
  );
}
