import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Mic, Play, Plus, Radio, RotateCcw, Square, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { stopMediaStream } from '../../../lib/media/streams';
import { generateExperimentId, saveModelMetadata } from '../../../stores/experimentStore';

type AudioClass = { id: string; name: string; color: string };
type AudioExample = { id: string; classId: string; feature: number[]; frames: number[][]; createdAt: number };
type Prediction = AudioClass & { probability: number };
type EpochPoint = { epoch: number; loss: number; accuracy: number };

const COLORS = ['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#be123c', '#4f46e5'];
const MEL_BANDS = 40;
const WINDOW_MS = 1000;
const MIN_SAMPLES_PER_CLASS = 8;

const initialClasses: AudioClass[] = [
  { id: 'sound_a', name: 'Sound 1', color: COLORS[0] },
  { id: 'sound_b', name: 'Sound 2', color: COLORS[1] },
];

function hzToMel(hz: number) {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel: number) {
  return 700 * (10 ** (mel / 2595) - 1);
}

function makeMelEdges(sampleRate: number) {
  const minMel = hzToMel(80);
  const maxMel = hzToMel(Math.min(7600, sampleRate / 2));
  return Array.from({ length: MEL_BANDS + 2 }, (_, index) => melToHz(minMel + (index / (MEL_BANDS + 1)) * (maxMel - minMel)));
}

function extractMelBands(analyser: AnalyserNode, sampleRate: number) {
  const freq = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(freq);
  const edges = makeMelEdges(sampleRate);
  const nyquist = sampleRate / 2;
  const bands = Array.from({ length: MEL_BANDS }, (_, band) => {
    const start = Math.floor((edges[band] / nyquist) * freq.length);
    const center = Math.floor((edges[band + 1] / nyquist) * freq.length);
    const end = Math.max(center + 1, Math.floor((edges[band + 2] / nyquist) * freq.length));
    let weighted = 0;
    let weights = 0;
    for (let bin = start; bin <= end && bin < freq.length; bin++) {
      const weight = bin <= center
        ? (bin - start) / Math.max(1, center - start)
        : (end - bin) / Math.max(1, end - center);
      const magnitude = Math.max(0, (freq[bin] + 100) / 100);
      weighted += magnitude * Math.max(0, weight);
      weights += Math.max(0, weight);
    }
    return Math.max(0, Math.min(1, weighted / Math.max(1e-6, weights)));
  });
  return bands;
}

function averageFrames(frames: number[][]) {
  return Array.from({ length: MEL_BANDS }, (_, band) =>
    frames.reduce((sum, frame) => sum + (frame[band] ?? 0), 0) / Math.max(1, frames.length)
  );
}

function buildAudioModel(classCount: number) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [MEL_BANDS] }));
  model.add(tf.layers.dropout({ rate: 0.25 }));
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

export default function AudioClassificationPage() {
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const inferenceRef = useRef<number | null>(null);
  const modelRef = useRef<tf.LayersModel | null>(null);
  const classesRef = useRef<AudioClass[]>(initialClasses);
  const [classes, setClasses] = useState<AudioClass[]>(initialClasses);
  const [examples, setExamples] = useState<AudioExample[]>([]);
  const [liveBands, setLiveBands] = useState<number[]>(Array(MEL_BANDS).fill(0));
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [recordingClass, setRecordingClass] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [training, setTraining] = useState(false);
  const [epochs, setEpochs] = useState(35);
  const [batchSize, setBatchSize] = useState(16);
  const [threshold, setThreshold] = useState(0.7);
  const [epochData, setEpochData] = useState<EpochPoint[]>([]);
  const [status, setStatus] = useState('Start the microphone, record at least 8 one-second clips per class, then train.');

  useEffect(() => { classesRef.current = classes; }, [classes]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (inferenceRef.current) window.clearInterval(inferenceRef.current);
    stopMediaStream(streamRef.current);
    void contextRef.current?.close();
    modelRef.current?.dispose();
  }, []);

  const counts = useMemo(
    () => Object.fromEntries(classes.map(cls => [cls.id, examples.filter(example => example.classId === cls.id).length])),
    [classes, examples]
  );
  const readyToTrain = classes.length >= 2 && classes.every(cls => (counts[cls.id] ?? 0) >= MIN_SAMPLES_PER_CLASS) && !training;
  const topPrediction = predictions[0];
  const displayLabel = topPrediction && topPrediction.probability >= threshold ? topPrediction.name : 'Uncertain';

  const readMelBands = useCallback(() => {
    const analyser = analyserRef.current;
    const context = contextRef.current;
    if (!analyser || !context) return null;
    return extractMelBands(analyser, context.sampleRate);
  }, []);

  const animateBands = useCallback(function tickBands() {
    const bands = readMelBands();
    if (bands) setLiveBands(bands);
    rafRef.current = requestAnimationFrame(tickBands);
  }, [readMelBands]);

  const classifyBands = useCallback(async (bands: number[]) => {
    const model = modelRef.current;
    if (!model) return;
    const input = tf.tensor2d(bands, [1, MEL_BANDS]);
    const output = model.predict(input) as tf.Tensor;
    const values = Array.from(await output.data());
    input.dispose();
    output.dispose();
    setPredictions(
      classesRef.current
        .map((cls, index) => ({ ...cls, probability: values[index] ?? 0 }))
        .sort((a, b) => b.probability - a.probability)
    );
  }, []);

  const startInferenceLoop = useCallback(() => {
    if (inferenceRef.current) window.clearInterval(inferenceRef.current);
    inferenceRef.current = window.setInterval(() => {
      const bands = readMelBands();
      if (bands) void classifyBands(bands);
    }, WINDOW_MS);
  }, [classifyBands, readMelBands]);

  const startMic = async () => {
    if (running) return;
    await tf.setBackend('webgl');
    await tf.ready();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) throw new Error('Web Audio API is not available in this browser.');
    const context = new AudioContextCtor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.45;
    context.createMediaStreamSource(stream).connect(analyser);
    contextRef.current = context;
    analyserRef.current = analyser;
    streamRef.current = stream;
    setRunning(true);
    setStatus('Microphone is live. Record one-second samples from each class card.');
    animateBands();
    startInferenceLoop();
  };

  const stopMic = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (inferenceRef.current) window.clearInterval(inferenceRef.current);
    rafRef.current = null;
    inferenceRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    analyserRef.current = null;
    setRunning(false);
    setRecordingClass(null);
    setStatus('Microphone stopped and released.');
  };

  const recordSample = async (classId: string) => {
    if (!analyserRef.current) {
      setStatus('Start the microphone before recording samples.');
      return;
    }
    setRecordingClass(classId);
    const frames: number[][] = [];
    const frameCount = 40;
    for (let index = 0; index < frameCount; index++) {
      const bands = readMelBands();
      if (bands) frames.push(bands);
      await new Promise(resolve => window.setTimeout(resolve, 25));
    }
    const feature = averageFrames(frames);
    setExamples(current => [...current, { id: `${classId}_${Date.now()}`, classId, feature, frames, createdAt: Date.now() }]);
    setRecordingClass(null);
    setStatus(`Recorded ${frames.length} Mel frames for ${classesRef.current.find(cls => cls.id === classId)?.name ?? 'class'}.`);
  };

  const train = async () => {
    if (!readyToTrain) {
      setStatus('Collect at least 8 one-second examples for every class before training.');
      return;
    }
    setTraining(true);
    setEpochData([]);
    modelRef.current?.dispose();
    const model = buildAudioModel(classes.length);
    const classIndex = new Map(classes.map((cls, index) => [cls.id, index]));
    const xs = tf.tensor2d(examples.flatMap(example => example.feature), [examples.length, MEL_BANDS]);
    const ys = tf.tensor2d(examples.flatMap(example => {
      const row = Array(classes.length).fill(0);
      row[classIndex.get(example.classId) ?? 0] = 1;
      return row;
    }), [examples.length, classes.length]);
    let finalAccuracy = 0;

    await model.fit(xs, ys, {
      epochs,
      batchSize,
      shuffle: true,
      validationSplit: examples.length >= 24 ? 0.2 : 0,
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
    modelRef.current = model;
    await saveModelMetadata({
      id: generateExperimentId(),
      name: `Audio classifier - ${classes.length} classes`,
      algorithmId: 'audio-classification',
      algorithmName: 'Audio Classification',
      savedAt: Date.now(),
      parameters: { modality: 'audio', classCount: classes.length, labels: classes.map(cls => cls.name), melBands: MEL_BANDS, windowSize: WINDOW_MS, epochs, batchSize },
      metrics: { accuracy: finalAccuracy },
      artifactType: 'tfjs',
    });
    setTraining(false);
    setStatus('Audio classifier trained. Live inference runs every second while the microphone is active.');
  };

  const exportModel = async () => {
    if (!modelRef.current) {
      setStatus('Train a model before exporting.');
      return;
    }
    await modelRef.current.save('downloads://audio-classifier');
    downloadJson('audio-classifier-metadata.json', {
      classLabels: classes.map(cls => cls.name),
      melBands: MEL_BANDS,
      sampleRate: contextRef.current?.sampleRate ?? 44100,
      windowSize: WINDOW_MS,
      createdAt: new Date().toISOString(),
    });
  };

  const addClass = () => {
    setClasses(current => current.length >= 8 ? current : [
      ...current,
      { id: `sound_${Date.now()}`, name: `Sound ${current.length + 1}`, color: COLORS[current.length % COLORS.length] },
    ]);
  };

  const reset = () => {
    modelRef.current?.dispose();
    modelRef.current = null;
    setExamples([]);
    setPredictions([]);
    setEpochData([]);
    setStatus('Dataset and trained model cleared.');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader
        title="Audio Classification"
        subtitle="Train a no-backend sound classifier from 40-band Mel spectrogram windows and run live microphone inference."
        badge="Browser Trainable"
        category="Browser Training"
        icon={<Mic size={22} />}
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr_360px]">
        <div className="space-y-4">
          <Card
            title="Class Samples"
            actions={<button onClick={addClass} disabled={classes.length >= 8} className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-700"><Plus size={12} /></button>}
          >
            <div className="space-y-3">
              {classes.map(cls => {
                const classExamples = examples.filter(example => example.classId === cls.id);
                const preview = classExamples.at(-1)?.feature ?? Array(MEL_BANDS).fill(0);
                return (
                  <div key={cls.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cls.color }} />
                      <input
                        value={cls.name}
                        onChange={event => setClasses(current => current.map(item => item.id === cls.id ? { ...item, name: event.target.value } : item))}
                        className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm font-semibold dark:border-gray-700 dark:bg-gray-900"
                      />
                      <button onClick={() => setClasses(current => current.length <= 2 ? current : current.filter(item => item.id !== cls.id))} className="text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        onClick={() => void recordSample(cls.id)}
                        disabled={!running || recordingClass !== null}
                        className={`inline-flex items-center gap-2 rounded px-3 py-2 text-xs font-bold text-white disabled:opacity-50 ${recordingClass === cls.id ? 'bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        {recordingClass === cls.id ? <Square size={13} /> : <Radio size={13} />}
                        {recordingClass === cls.id ? 'Recording...' : 'Record 1s'}
                      </button>
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${(counts[cls.id] ?? 0) >= MIN_SAMPLES_PER_CLASS ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {counts[cls.id] ?? 0} / {MIN_SAMPLES_PER_CLASS}
                      </span>
                    </div>
                    <div className="mt-3 flex h-12 items-end gap-[2px] rounded bg-gray-100 p-1 dark:bg-gray-900">
                      {preview.map((value, index) => (
                        <span key={index} className="flex-1 rounded-t" style={{ height: `${Math.max(4, value * 44)}px`, backgroundColor: cls.color, opacity: 0.35 + value * 0.55 }} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Training Controls">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                Epochs: <span className="font-mono text-blue-600">{epochs}</span>
                <input type="range" min={20} max={60} step={5} value={epochs} onChange={event => setEpochs(Number(event.target.value))} className="mt-2 w-full accent-blue-600" />
              </label>
              <label className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                Batch size: <span className="font-mono text-blue-600">{batchSize}</span>
                <input type="range" min={8} max={32} step={8} value={batchSize} onChange={event => setBatchSize(Number(event.target.value))} className="mt-2 w-full accent-blue-600" />
              </label>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <button onClick={startMic} disabled={running} className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Mic size={14} /> Start Mic</button>
              <button onClick={stopMic} disabled={!running} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-700"><Square size={14} /> Stop</button>
              <button onClick={train} disabled={!readyToTrain} className="inline-flex items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Play size={14} /> {training ? 'Training...' : 'Train'}</button>
              <button onClick={reset} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-gray-700"><RotateCcw size={14} /> Reset</button>
            </div>
          </Card>

          <Card title="Live Mel Bands">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={liveBands.map((value, band) => ({ band: band + 1, value }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="band" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 1]} tickFormatter={value => `${Math.round(Number(value) * 100)}%`} />
                <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                <Bar dataKey="value" fill="#2563eb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Training Accuracy / Loss">
            {epochData.length ? (
              <ResponsiveContainer width="100%" height={260}>
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
            ) : (
              <p className="text-sm text-gray-500">Training points appear epoch-by-epoch once you click Train.</p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Live Inference">
            <div className={`rounded-2xl p-5 text-center ${displayLabel === 'Uncertain' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200' : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-200'}`}>
              <p className="text-xs font-bold uppercase tracking-wide">Top prediction</p>
              <p className="mt-1 text-3xl font-black">{displayLabel}</p>
              <p className="text-sm">{topPrediction ? `${(topPrediction.probability * 100).toFixed(1)}% confidence` : 'No model output yet'}</p>
            </div>
            <label className="mt-4 block text-sm font-semibold text-gray-600 dark:text-gray-300">
              Confidence threshold: {(threshold * 100).toFixed(0)}%
              <input type="range" min={0.5} max={0.95} step={0.01} value={threshold} onChange={event => setThreshold(Number(event.target.value))} className="mt-2 w-full accent-purple-600" />
            </label>
            <div className="mt-4 space-y-2">
              {classes.map(cls => {
                const probability = predictions.find(prediction => prediction.id === cls.id)?.probability ?? 0;
                return (
                  <div key={cls.id}>
                    <div className="mb-1 flex justify-between text-xs font-semibold">
                      <span>{cls.name}</span>
                      <span>{(probability * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-3 rounded-full transition-all" style={{ width: `${probability * 100}%`, backgroundColor: cls.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid gap-2">
              <button onClick={exportModel} className="inline-flex items-center justify-center gap-2 rounded bg-gray-900 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-gray-950"><Download size={14} /> Export TFjs Model</button>
              <button onClick={() => downloadJson('audio-classifier-dataset.json', { classes, examples, melBands: MEL_BANDS, windowSize: WINDOW_MS })} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-gray-700"><Download size={14} /> Export Dataset JSON</button>
            </div>
          </Card>

          <InfoBox type="info" title="Status">
            {status}
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
