import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';
import { Camera, Circle, Download, FileImage, FolderOpen, Layers, Play, Plus, RotateCcw, Trash2, Video } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { stopMediaElementStream, stopMediaStream } from '../../../lib/media/streams';

type ClassItem = { id: string; name: string; color: string };
type ExampleItem = { id: string; classId: string; data: Float32Array; preview: string };
type Prediction = { classId: string; name: string; probability: number; color: string };
type TrainPoint = { epoch: number; loss: number; accuracy: number };

const IMAGE_SIZE = 64;
const CAPTURE_INTERVAL_MS = 45;
const COLORS = ['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];

const initialClasses: ClassItem[] = [
  { id: 'class_a', name: 'Class 1', color: COLORS[0] },
  { id: 'class_b', name: 'Class 2', color: COLORS[1] },
];

function buildModel(classCount: number, featureSize: number, learningRate: number) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [featureSize], units: 96, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: classCount, activation: 'softmax' }));
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });
  return model;
}

function examplesToTensors(examples: ExampleItem[], classes: ClassItem[], featureSize: number) {
  const classIndex = new Map(classes.map((item, index) => [item.id, index]));
  const xs = tf.tensor2d(examples.flatMap(item => Array.from(item.data)), [examples.length, featureSize]);
  const labels = examples.flatMap(item => {
    const row = Array(classes.length).fill(0);
    row[classIndex.get(item.classId) ?? 0] = 1;
    return row;
  });
  const ys = tf.tensor2d(labels, [examples.length, classes.length]);
  return { xs, ys };
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}`));
    };
    image.src = url;
  });
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

export default function ImageClassificationPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const predictTimerRef = useRef<number | null>(null);
  const captureTimerRef = useRef<number | null>(null);
  const modelRef = useRef<tf.LayersModel | null>(null);
  const featureExtractorRef = useRef<mobilenet.MobileNet | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureBusyRef = useRef(false);
  const examplesRef = useRef<ExampleItem[]>([]);

  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [examples, setExamples] = useState<ExampleItem[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
  const [activeCapture, setActiveCapture] = useState<string | null>(null);
  const [featureSize, setFeatureSize] = useState(1024);
  const [epochs, setEpochs] = useState(18);
  const [learningRate, setLearningRate] = useState(0.001);
  const [batchSize, setBatchSize] = useState(16);
  const [training, setTraining] = useState(false);
  const [history, setHistory] = useState<TrainPoint[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [status, setStatus] = useState('Start the camera, hold a class button to collect examples, then train.');

  useEffect(() => {
    examplesRef.current = examples;
  }, [examples]);

  useEffect(() => () => {
    if (captureTimerRef.current) window.clearInterval(captureTimerRef.current);
    if (predictTimerRef.current) window.clearInterval(predictTimerRef.current);
    modelRef.current?.dispose();
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    stopMediaElementStream(videoRef.current);
  }, []);

  const sampleCounts = useMemo(() => Object.fromEntries(classes.map(item => [
    item.id,
    examples.filter(example => example.classId === item.id).length,
  ])), [classes, examples]);

  const readyToTrain = classes.length >= 2 && classes.every(item => (sampleCounts[item.id] ?? 0) >= 10) && !training && !!featureExtractorRef.current;
  const latest = history[history.length - 1];
  const totalSamples = examples.length;
  const bestPrediction = predictions[0];

  const ensureFeatureExtractor = async () => {
    await tf.ready();
    if (!featureExtractorRef.current) {
      setStatus('Loading TensorFlow.js MobileNet feature extractor...');
      featureExtractorRef.current = await mobilenet.load({ version: 2, alpha: 0.5 });
    }
    return featureExtractorRef.current;
  };

  const startCamera = async () => {
    try {
      await ensureFeatureExtractor();
      stopCamera(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      if (!videoRef.current) {
        stopMediaStream(stream);
        return;
      }
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraReady(true);
      setStatus('Camera and MobileNet are ready. Hold Record on a class to add image examples rapidly.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to start camera.');
    }
  };

  const stopCamera = (updateStatus = true) => {
    stopCapture();
    if (predictTimerRef.current) window.clearInterval(predictTimerRef.current);
    predictTimerRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    stopMediaElementStream(videoRef.current);
    setCameraReady(false);
    if (updateStatus) setStatus('Camera stopped. Samples and trained model are still available.');
  };

  const importFiles = async (classId: string, fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter(file => file.type.startsWith('image/'));
    const canvas = canvasRef.current;
    if (!files.length || !canvas) return;
    try {
      const extractor = await ensureFeatureExtractor();
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = IMAGE_SIZE;
      canvas.height = IMAGE_SIZE;
      setStatus(`Importing ${files.length} image${files.length === 1 ? '' : 's'} into class...`);
      const imported: ExampleItem[] = [];
      for (const [index, file] of files.entries()) {
        const image = await loadImage(file);
        ctx.clearRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
        ctx.drawImage(image, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
        const activation = extractor.infer(canvas, true) as tf.Tensor;
        const values = new Float32Array(await activation.data());
        setFeatureSize(values.length);
        activation.dispose();
        imported.push({
          id: `${classId}_file_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
          classId,
          data: values,
          preview: canvas.toDataURL('image/jpeg', 0.72),
        });
        if (index % 6 === 0) await tf.nextFrame();
      }
      setExamples(current => [...current, ...imported]);
      setPredictions([]);
      setStatus(`Imported ${imported.length} image${imported.length === 1 ? '' : 's'}. Add more samples or train the model.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Image import failed.');
    }
  };

  const captureExample = useCallback(async (classId: string) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const extractor = featureExtractorRef.current;
    if (!video || !canvas || !extractor || video.readyState < 2 || captureBusyRef.current) return;
    captureBusyRef.current = true;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      captureBusyRef.current = false;
      return;
    }
    canvas.width = IMAGE_SIZE;
    canvas.height = IMAGE_SIZE;
    ctx.drawImage(video, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
    try {
      const activation = extractor.infer(video, true) as tf.Tensor;
      const values = new Float32Array(await activation.data());
      setFeatureSize(values.length);
      activation.dispose();
      const example: ExampleItem = {
        id: `${classId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        classId,
        data: values,
        preview: canvas.toDataURL('image/jpeg', 0.68),
      };
      setExamples(current => [...current, example]);
    } finally {
      captureBusyRef.current = false;
    }
  }, []);

  const startCapture = (classId: string) => {
    if (!cameraReady || captureTimerRef.current) return;
    setActiveCapture(classId);
    void captureExample(classId);
    captureTimerRef.current = window.setInterval(() => void captureExample(classId), CAPTURE_INTERVAL_MS);
  };

  const stopCapture = () => {
    if (captureTimerRef.current) window.clearInterval(captureTimerRef.current);
    captureTimerRef.current = null;
    setActiveCapture(null);
  };

  const addClass = () => {
    setClasses(current => [
      ...current,
      {
        id: `class_${Date.now()}`,
        name: `Class ${current.length + 1}`,
        color: COLORS[current.length % COLORS.length],
      },
    ]);
    setPredictions([]);
    modelRef.current?.dispose();
    modelRef.current = null;
  };

  const renameClass = (id: string, name: string) => {
    setClasses(current => current.map(item => item.id === id ? { ...item, name } : item));
  };

  const clearClass = (id: string) => {
    setExamples(current => current.filter(item => item.classId !== id));
    setPredictions([]);
  };

  const removeClass = (id: string) => {
    if (classes.length <= 2) {
      clearClass(id);
      return;
    }
    setClasses(current => current.filter(item => item.id !== id));
    setExamples(current => current.filter(item => item.classId !== id));
    setPredictions([]);
    modelRef.current?.dispose();
    modelRef.current = null;
  };

  const resetAll = () => {
    stopCapture();
    setExamples([]);
    setHistory([]);
    setPredictions([]);
    modelRef.current?.dispose();
    modelRef.current = null;
    setStatus('Samples cleared. Hold Record to collect fresh images.');
  };

  const exportModel = async () => {
    const model = modelRef.current;
    if (!model) {
      setStatus('Train the classifier before exporting a model.');
      return;
    }
    await model.save('downloads://teachable-image-classifier-head');
    downloadJson('teachable-image-classifier-labels.json', {
      model: 'MobileNet feature extractor + TensorFlow.js classifier head',
      exportedAt: new Date().toISOString(),
      featureSize,
      imageSize: IMAGE_SIZE,
      classes: classes.map((item, index) => ({
        index,
        id: item.id,
        name: item.name,
        color: item.color,
        samples: sampleCounts[item.id] ?? 0,
      })),
    });
    setStatus('Model exported. Keep the model files and labels JSON together for inference.');
  };

  const train = async () => {
    if (!readyToTrain) {
      setStatus('Collect at least 10 images for every class before training.');
      return;
    }
    setTraining(true);
    setHistory([]);
    setPredictions([]);
    setStatus('Training TensorFlow.js image classifier locally...');
    modelRef.current?.dispose();
    const model = buildModel(classes.length, featureSize, learningRate);
    const { xs, ys } = examplesToTensors(examplesRef.current, classes, featureSize);
    try {
      await model.fit(xs, ys, {
        epochs,
        batchSize,
        shuffle: true,
        validationSplit: 0.15,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            setHistory(current => [...current, {
              epoch: epoch + 1,
              loss: Number((logs?.loss as number ?? 0).toFixed(4)),
              accuracy: Number((logs?.acc as number ?? logs?.accuracy as number ?? 0).toFixed(4)),
            }]);
            await tf.nextFrame();
          },
        },
      });
      modelRef.current = model;
      setStatus('Training complete. Live inference is running from the webcam.');
      startLiveInference();
    } catch (error) {
      model.dispose();
      setStatus(error instanceof Error ? error.message : 'Training failed.');
    } finally {
      xs.dispose();
      ys.dispose();
      setTraining(false);
    }
  };

  const predictFrame = useCallback(async () => {
    const model = modelRef.current;
    const video = videoRef.current;
    const extractor = featureExtractorRef.current;
    if (!model || !video || !extractor || video.readyState < 2) return;
    const input = extractor.infer(video, true) as tf.Tensor;
    const output = model.predict(input) as tf.Tensor;
    const values = Array.from(await output.data());
    input.dispose();
    output.dispose();
    const next = classes
      .map((item, index) => ({
        classId: item.id,
        name: item.name,
        color: item.color,
        probability: values[index] ?? 0,
      }))
      .sort((a, b) => b.probability - a.probability);
    setPredictions(next);
  }, [classes]);

  const startLiveInference = useCallback(() => {
    if (predictTimerRef.current) window.clearInterval(predictTimerRef.current);
    predictFrame();
    predictTimerRef.current = window.setInterval(predictFrame, 180);
  }, [predictFrame]);

  useEffect(() => {
    if (modelRef.current) startLiveInference();
    return undefined;
  }, [classes, startLiveInference]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader
        title="Image Classification"
        subtitle="Teachable Machine-style webcam classifier using TensorFlow.js: collect examples by holding Record, train locally, and run live inference."
        badge="Browser Trainable"
        category="Computer Vision"
        icon={<Camera size={22} />}
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Camera" icon={<Video size={14} />}>
            <div className="space-y-3">
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-950 dark:border-gray-700">
                <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <button
                onClick={startCamera}
                disabled={cameraReady}
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Camera size={15} /> {cameraReady ? 'Camera Running' : 'Start Camera'}
              </button>
              <button
                onClick={() => stopCamera()}
                disabled={!cameraReady}
                className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-700"
              >
                <Video size={15} /> Stop Camera
              </button>
            </div>
          </Card>

          <Card title="Training Controls" icon={<Play size={14} />}>
            <div className="space-y-4 text-sm">
              <label className="block text-gray-700 dark:text-gray-200">
                Epochs: <b>{epochs}</b>
                <input type="range" min={5} max={50} value={epochs} onChange={event => setEpochs(Number(event.target.value))} className="w-full accent-blue-600" />
              </label>
              <label className="block text-gray-700 dark:text-gray-200">
                Batch size: <b>{batchSize}</b>
                <input type="range" min={4} max={32} step={4} value={batchSize} onChange={event => setBatchSize(Number(event.target.value))} className="w-full accent-blue-600" />
              </label>
              <label className="block text-gray-700 dark:text-gray-200">
                Learning rate: <b>{learningRate.toFixed(4)}</b>
                <input type="range" min={0.0005} max={0.01} step={0.0005} value={learningRate} onChange={event => setLearningRate(Number(event.target.value))} className="w-full accent-blue-600" />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={!readyToTrain} onClick={train} className="inline-flex items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 font-semibold text-white disabled:opacity-50">
                  <Play size={14} /> {training ? 'Training...' : 'Train'}
                </button>
                <button onClick={resetAll} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold dark:border-gray-700">
                  <RotateCcw size={14} /> Reset
                </button>
              </div>
              <button
                disabled={!modelRef.current}
                onClick={exportModel}
                className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Download size={14} /> Export Model
              </button>
            </div>
          </Card>

          <MetricsPanel title="Dataset and Training" metrics={[
            { label: 'Classes', value: classes.length, format: 'number', color: 'blue' },
            { label: 'Images', value: totalSamples, format: 'number', color: 'green' },
            { label: 'Accuracy', value: latest?.accuracy ?? 0, format: 'percent', color: 'green' },
            { label: 'Top Confidence', value: bestPrediction?.probability ?? 0, format: 'percent', color: 'blue' },
          ]} />

          <InfoBox type={readyToTrain ? 'success' : 'info'} title="Runtime Status">{status}</InfoBox>
        </div>

        <div className="space-y-4">
          <Card
            title="Classes"
            icon={<Layers size={14} />}
            actions={(
              <button onClick={addClass} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <Plus size={13} /> Add Class
              </button>
            )}
          >
            <div className="grid gap-3 lg:grid-cols-2">
              {classes.map(item => {
                const previews = examples.filter(example => example.classId === item.id).slice(-6);
                const recording = activeCapture === item.id;
                return (
                  <div key={item.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <input value={item.name} onChange={event => renameClass(item.id, event.target.value)} className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm font-semibold dark:border-gray-700 dark:bg-gray-900" />
                      <button onClick={() => removeClass(item.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30" title="Remove class">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onPointerDown={() => startCapture(item.id)}
                        onPointerUp={stopCapture}
                        onPointerCancel={stopCapture}
                        onPointerLeave={stopCapture}
                        disabled={!cameraReady}
                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${recording ? 'bg-red-600' : 'bg-blue-600'}`}
                      >
                        <Circle size={13} className={recording ? 'fill-current' : ''} />
                        {recording ? 'Recording 20+ fps target' : 'Hold to Record'}
                      </button>
                      <button onClick={() => clearClass(item.id)} className="rounded border border-gray-200 px-3 py-2 text-xs font-semibold dark:border-gray-700">Clear</button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                        <FileImage size={13} /> Files
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={event => {
                            void importFiles(item.id, event.currentTarget.files);
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                      <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                        <FolderOpen size={13} /> Folder
                        <input
                          ref={element => {
                            element?.setAttribute('webkitdirectory', '');
                            element?.setAttribute('directory', '');
                          }}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={event => {
                            void importFiles(item.id, event.currentTarget.files);
                            event.currentTarget.value = '';
                          }}
                        />
                      </label>
                    </div>
                    <div className="mt-3 grid grid-cols-6 gap-1">
                      {previews.map(example => <img key={example.id} src={example.preview} alt="" className="aspect-square rounded object-cover" />)}
                      {previews.length === 0 && <div className="col-span-6 rounded bg-gray-50 p-3 text-center text-xs text-gray-500 dark:bg-gray-900">No images yet</div>}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-gray-500">{sampleCounts[item.id] ?? 0} images</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card title="Live Inference">
              {predictions.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Prediction: <b>{bestPrediction?.name}</b> at <b>{((bestPrediction?.probability ?? 0) * 100).toFixed(1)}%</b>
                  </p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={predictions}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 1]} tickFormatter={value => `${Math.round(Number(value) * 100)}%`} />
                      <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                      <Bar dataKey="probability" radius={[4, 4, 0, 0]}>
                        {predictions.map(item => <Cell key={item.classId} fill={item.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {predictions.map(item => (
                      <div key={item.classId}>
                        <div className="mb-1 flex justify-between text-xs font-semibold text-gray-600 dark:text-gray-300">
                          <span>{item.name}</span>
                          <span>{(item.probability * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded bg-gray-100 dark:bg-gray-900">
                          <div className="h-full transition-all" style={{ width: `${item.probability * 100}%`, backgroundColor: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Train the model to start live webcam inference.
                </div>
              )}
            </Card>

            <Card title="Training History">
              {history.length > 0 ? (
                <div className="space-y-2 text-xs">
                  {history.slice(-10).map(point => (
                    <div key={point.epoch} className="flex items-center justify-between rounded bg-gray-50 px-2 py-1.5 dark:bg-gray-900">
                      <span>Epoch {point.epoch}</span>
                      <span>loss {point.loss}</span>
                      <span>{(point.accuracy * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Training epochs will appear here.</p>
              )}
            </Card>
          </div>

          <InfoBox type="success" title="TensorFlow.js Browser Training">
            Frames are sampled locally from your webcam, converted into MobileNet feature vectors, trained with a TensorFlow.js classifier head, and then evaluated continuously in the browser. No backend or cloud API is used.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
