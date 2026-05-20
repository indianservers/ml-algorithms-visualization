import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';
import { Camera, Circle, Download, FileImage, FolderOpen, Layers, Play, Plus, RotateCcw, Trash2, Video } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { stopMediaElementStream, stopMediaStream } from '../../../lib/media/streams';
import { generateExperimentId, saveModelMetadata } from '../../../stores/experimentStore';

type ClassItem = { id: string; name: string; color: string };
type ExampleItem = { id: string; classId: string; data: Float32Array; preview: string };
type Prediction = { classId: string; name: string; probability: number; color: string };
type TrainPoint = { epoch: number; loss: number; accuracy: number };
type ConfusionReport = { matrix: number[][]; total: number; classMetrics: Array<{ classId: string; precision: number; recall: number; f1: number }>; worstPair: { actual: string; predicted: string; count: number } | null };
type CalibrationSample = { classId: string; confidence: number; accepted: boolean };

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

function timestampNow() {
  return Date.now();
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
  const [extractorReady, setExtractorReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [history, setHistory] = useState<TrainPoint[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.7);
  const [calibrationSamples, setCalibrationSamples] = useState<CalibrationSample[]>([]);
  const [calibrating, setCalibrating] = useState(false);
  const [confusionReport, setConfusionReport] = useState<ConfusionReport | null>(null);
  const [balanceMode, setBalanceMode] = useState(false);
  const [balanceTarget, setBalanceTarget] = useState(20);
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

  const readyToTrain = classes.length >= 2 && classes.every(item => (sampleCounts[item.id] ?? 0) >= 10) && !training && extractorReady;
  const latest = history[history.length - 1];
  const totalSamples = examples.length;
  const maxClassSamples = Math.max(0, ...classes.map(item => sampleCounts[item.id] ?? 0));
  const balanceTargetCount = balanceMode ? balanceTarget : maxClassSamples;
  const classNeedingSamples = classes
    .map(item => ({ ...item, count: sampleCounts[item.id] ?? 0, needed: Math.max(0, balanceTargetCount - (sampleCounts[item.id] ?? 0)) }))
    .sort((a, b) => b.needed - a.needed)[0];
  const bestPrediction = predictions[0];
  const predictedLabel = bestPrediction && bestPrediction.probability >= confidenceThreshold ? bestPrediction.name : 'Unknown / Uncertain';
  const rejectionRate = calibrationSamples.length
    ? calibrationSamples.filter(sample => sample.confidence < confidenceThreshold).length / calibrationSamples.length
    : bestPrediction ? (bestPrediction.probability >= confidenceThreshold ? 0 : 1) : 0;
  const calibrationHistogram = useMemo(() => Array.from({ length: 10 }, (_, index) => {
    const low = index / 10;
    const high = (index + 1) / 10;
    return {
      bin: `${Math.round(low * 100)}-${Math.round(high * 100)}%`,
      count: calibrationSamples.filter(sample => sample.confidence >= low && (index === 9 ? sample.confidence <= high : sample.confidence < high)).length,
    };
  }), [calibrationSamples]);
  const suggestedThreshold = useMemo(() => {
    if (!calibrationSamples.length) return confidenceThreshold;
    const sorted = [...calibrationSamples].map(sample => sample.confidence).sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.25)] ?? confidenceThreshold;
  }, [calibrationSamples, confidenceThreshold]);

  const ensureFeatureExtractor = async () => {
    await tf.ready();
    if (!featureExtractorRef.current) {
      setStatus('Loading TensorFlow.js MobileNet feature extractor...');
      featureExtractorRef.current = await mobilenet.load({ version: 2, alpha: 0.5 });
      setExtractorReady(true);
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
      setConfusionReport(null);
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
      setConfusionReport(null);
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
    setConfusionReport(null);
    modelRef.current?.dispose();
    modelRef.current = null;
    setModelReady(false);
    setCalibrationSamples([]);
  };

  const autoAugmentClass = (classId: string) => {
    const source = examples.filter(example => example.classId === classId);
    const count = sampleCounts[classId] ?? 0;
    const needed = Math.max(0, balanceTargetCount - count);
    if (!source.length || needed <= 0) return;
    const augmented = Array.from({ length: needed }, (_, index) => {
      const base = source[index % source.length];
      const data = new Float32Array(base.data.length);
      for (let featureIndex = 0; featureIndex < base.data.length; featureIndex++) {
        data[featureIndex] = base.data[featureIndex] + (Math.random() - 0.5) * 0.035;
      }
      return {
        id: `${classId}_aug_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
        classId,
        data,
        preview: base.preview,
      };
    });
    setExamples(current => [...current, ...augmented]);
    setStatus(`Added ${augmented.length} augmented examples to balance the class.`);
  };

  const renameClass = (id: string, name: string) => {
    setClasses(current => current.map(item => item.id === id ? { ...item, name } : item));
  };

  const clearClass = (id: string) => {
    setExamples(current => current.filter(item => item.classId !== id));
    setPredictions([]);
    setConfusionReport(null);
    setCalibrationSamples([]);
  };

  const removeClass = (id: string) => {
    if (classes.length <= 2) {
      clearClass(id);
      return;
    }
    setClasses(current => current.filter(item => item.id !== id));
    setExamples(current => current.filter(item => item.classId !== id));
    setPredictions([]);
    setConfusionReport(null);
    setCalibrationSamples([]);
    modelRef.current?.dispose();
    modelRef.current = null;
    setModelReady(false);
  };

  const resetAll = () => {
    stopCapture();
    setExamples([]);
    setHistory([]);
    setPredictions([]);
    setConfusionReport(null);
    setCalibrationSamples([]);
    modelRef.current?.dispose();
    modelRef.current = null;
    setModelReady(false);
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
    setConfusionReport(null);
    setCalibrationSamples([]);
    setStatus('Training TensorFlow.js image classifier locally...');
    modelRef.current?.dispose();
    setModelReady(false);
    const model = buildModel(classes.length, featureSize, learningRate);
    const { xs, ys } = examplesToTensors(examplesRef.current, classes, featureSize);
    let finalAccuracy = 0;
    try {
      await model.fit(xs, ys, {
        epochs,
        batchSize,
        shuffle: true,
        validationSplit: 0.15,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            finalAccuracy = (logs?.acc as number | undefined) ?? (logs?.accuracy as number | undefined) ?? 0;
            setHistory(current => [...current, {
              epoch: epoch + 1,
              loss: Number((logs?.loss as number ?? 0).toFixed(4)),
              accuracy: Number(finalAccuracy.toFixed(4)),
            }]);
            await tf.nextFrame();
          },
        },
      });
      const output = model.predict(xs) as tf.Tensor;
      const values = Array.from(await output.data());
      output.dispose();
      const classIndex = new Map(classes.map((item, index) => [item.id, index]));
      const matrix = Array.from({ length: classes.length }, () => Array.from({ length: classes.length }, () => 0));
      examplesRef.current.forEach((example, exampleIndex) => {
        const actual = classIndex.get(example.classId) ?? 0;
        const row = values.slice(exampleIndex * classes.length, (exampleIndex + 1) * classes.length);
        const predicted = row.reduce((best, value, index) => value > row[best] ? index : best, 0);
        matrix[actual][predicted]++;
      });
      const classMetrics = classes.map((item, index) => {
        const tp = matrix[index][index];
        const fp = matrix.reduce((sum, row, rowIndex) => sum + (rowIndex === index ? 0 : row[index]), 0);
        const fn = matrix[index].reduce((sum, value, colIndex) => sum + (colIndex === index ? 0 : value), 0);
        const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
        const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
        const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
        return { classId: item.id, precision, recall, f1 };
      });
      const worstPair = matrix.flatMap((row, actual) => row.map((count, predicted) => ({ actual, predicted, count })))
        .filter(cell => cell.actual !== cell.predicted)
        .sort((a, b) => b.count - a.count)[0];
      setConfusionReport({
        matrix,
        total: examplesRef.current.length,
        classMetrics,
        worstPair: worstPair && worstPair.count > 0 ? {
          actual: classes[worstPair.actual]?.name ?? `Class ${worstPair.actual + 1}`,
          predicted: classes[worstPair.predicted]?.name ?? `Class ${worstPair.predicted + 1}`,
          count: worstPair.count,
        } : null,
      });
      modelRef.current = model;
      setModelReady(true);
      await saveModelMetadata({
        id: generateExperimentId(),
        name: `Image classifier - ${classes.length} classes`,
        algorithmId: 'image-classification',
        algorithmName: 'Image Classification',
        savedAt: timestampNow(),
        parameters: { modality: 'image', classCount: classes.length, labels: classes.map(item => item.name), featureSize, imageSize: IMAGE_SIZE, epochs, batchSize },
        metrics: { accuracy: finalAccuracy },
        artifactType: 'tfjs',
      });
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

  const readImagePrediction = useCallback(async () => {
    const model = modelRef.current;
    const video = videoRef.current;
    const extractor = featureExtractorRef.current;
    if (!model || !video || !extractor || video.readyState < 2) return null;
    const input = extractor.infer(video, true) as tf.Tensor;
    const output = model.predict(input) as tf.Tensor;
    const values = Array.from(await output.data());
    input.dispose();
    output.dispose();
    return classes
      .map((item, index) => ({
        classId: item.id,
        name: item.name,
        color: item.color,
        probability: values[index] ?? 0,
      }))
      .sort((a, b) => b.probability - a.probability);
  }, [classes]);

  const calibrateThreshold = async () => {
    if (!modelRef.current || !cameraReady) {
      setStatus('Start the camera and train a model before calibration.');
      return;
    }
    setCalibrating(true);
    setStatus('Calibrating confidence threshold from 30 live webcam frames...');
    const samples: CalibrationSample[] = [];
    for (let index = 0; index < 30; index++) {
      const next = await readImagePrediction();
      const top = next?.[0];
      if (next) setPredictions(next);
      if (top) samples.push({ classId: top.classId, confidence: top.probability, accepted: top.probability >= confidenceThreshold });
      await new Promise(resolve => window.setTimeout(resolve, 90));
    }
    setCalibrationSamples(samples);
    setCalibrating(false);
    setStatus(`Calibration complete. Suggested threshold: ${Math.round((samples.length ? ([...samples].map(sample => sample.confidence).sort((a, b) => a - b)[Math.floor(samples.length * 0.25)] ?? confidenceThreshold) : confidenceThreshold) * 100)}%.`);
  };

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
                disabled={!modelReady}
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

          <Card title="Balance">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 font-bold">
                  <input type="checkbox" checked={balanceMode} onChange={event => setBalanceMode(event.target.checked)} className="h-4 w-4 accent-blue-600" />
                  Balance mode
                </label>
                <label className="text-xs font-bold text-gray-500">
                  Target
                  <input type="number" min={10} max={100} value={balanceTarget} onChange={event => setBalanceTarget(Number(event.target.value))} className="ml-2 w-16 rounded border border-gray-200 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900" />
                </label>
              </div>
              <div className="space-y-2">
                {classes.map(item => {
                  const count = sampleCounts[item.id] ?? 0;
                  const ratio = balanceTargetCount ? count / balanceTargetCount : 1;
                  const color = ratio >= 0.8 ? 'bg-green-500' : ratio >= 0.5 ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={item.id}>
                      <div className="mb-1 flex items-center justify-between text-xs font-bold">
                        <span>{item.name}</span>
                        <span>{count} / {balanceTargetCount || balanceTarget}</span>
                      </div>
                      <div className="relative h-3 overflow-hidden rounded bg-gray-100 dark:bg-gray-900">
                        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                        <div className="absolute inset-y-0 right-0 border-l-2 border-dashed border-gray-500" />
                      </div>
                    </div>
                  );
                })}
              </div>
              {classNeedingSamples && classNeedingSamples.needed > 0 ? (
                <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                  {classNeedingSamples.name} needs {classNeedingSamples.needed} more sample{classNeedingSamples.needed === 1 ? '' : 's'} to match the target.
                  <button onClick={() => autoAugmentClass(classNeedingSamples.id)} disabled={(sampleCounts[classNeedingSamples.id] ?? 0) === 0} className="mt-2 w-full rounded bg-amber-600 px-2 py-1 font-bold text-white disabled:opacity-50">Auto-augment this class</button>
                </div>
              ) : (
                <div className="rounded border border-green-200 bg-green-50 p-2 text-xs font-bold text-green-700 dark:border-green-900 dark:bg-green-950/20 dark:text-green-200">Dataset balanced. Ready to train.</div>
              )}
            </div>
          </Card>

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
                const classFull = balanceMode && (sampleCounts[item.id] ?? 0) >= balanceTarget;
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
                        disabled={!cameraReady || classFull}
                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${recording ? 'bg-red-600' : 'bg-blue-600'}`}
                      >
                        <Circle size={13} className={recording ? 'fill-current' : ''} />
                        {classFull ? 'Class full' : recording ? 'Recording 20+ fps target' : 'Hold to Record'}
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
                    Prediction: <b>{predictedLabel}</b> at <b>{((bestPrediction?.probability ?? 0) * 100).toFixed(1)}%</b>
                  </p>
                  <label className="block text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Confidence threshold: {(confidenceThreshold * 100).toFixed(0)}%
                    <input type="range" min={0.5} max={0.99} step={0.01} value={confidenceThreshold} onChange={event => setConfidenceThreshold(Number(event.target.value))} className="mt-2 w-full accent-purple-600" />
                  </label>
                  <div className="rounded-lg border border-purple-100 bg-purple-50 p-3 text-sm dark:border-purple-900/60 dark:bg-purple-950/20">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-purple-900 dark:text-purple-100">Tune confidence gate</p>
                        <p className="text-xs text-purple-700 dark:text-purple-200">
                          Current rejection rate: <b>{(rejectionRate * 100).toFixed(0)}%</b> of frames
                        </p>
                      </div>
                      <button
                        onClick={calibrateThreshold}
                        disabled={!modelReady || !cameraReady || calibrating}
                        className="rounded bg-purple-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {calibrating ? 'Calibrating...' : 'Calibrate 30 frames'}
                      </button>
                    </div>
                    {calibrationSamples.length > 0 && (
                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_130px]">
                        <ResponsiveContainer width="100%" height={110}>
                          <BarChart data={calibrationHistogram}>
                            <XAxis dataKey="bin" hide />
                            <YAxis allowDecimals={false} width={24} tick={{ fontSize: 10 }} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        <button
                          onClick={() => setConfidenceThreshold(Number(suggestedThreshold.toFixed(2)))}
                          className="rounded border border-purple-200 bg-white px-3 py-2 text-xs font-bold text-purple-700 dark:border-purple-800 dark:bg-gray-950 dark:text-purple-200"
                        >
                          Use suggested {Math.round(suggestedThreshold * 100)}%
                        </button>
                      </div>
                    )}
                  </div>
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
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="epoch" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" domain={[0, 1]} tickFormatter={value => `${Math.round(Number(value) * 100)}%`} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="accuracy" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="loss" stroke="#dc2626" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Training epochs will appear here.</p>
              )}
            </Card>
          </div>

          {confusionReport && (
            <Card title="Training Confusion Matrix" subtitle="All collected training images evaluated after the latest training run">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-center text-xs">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-gray-500">Actual \ Pred</th>
                      {classes.map(item => <th key={item.id} className="p-2 text-gray-500">{item.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {confusionReport.matrix.map((row, actual) => (
                      <tr key={classes[actual]?.id ?? actual}>
                        <th className="p-2 text-left font-semibold" style={{ color: classes[actual]?.color }}>{classes[actual]?.name}</th>
                        {row.map((count, predicted) => {
                          const pct = confusionReport.total ? count / confusionReport.total : 0;
                          const correct = actual === predicted;
                          return (
                            <td
                              key={predicted}
                              className="border border-gray-200 p-3 font-mono font-bold dark:border-gray-700"
                              style={{
                                backgroundColor: correct ? `rgba(5, 150, 105, ${0.12 + pct * 2})` : `rgba(220, 38, 38, ${0.08 + pct * 2})`,
                                color: correct ? '#047857' : count > 0 ? '#b91c1c' : '#9ca3af',
                              }}
                            >
                              <div>{count}</div>
                              <div className="text-[10px] font-normal">{(pct * 100).toFixed(1)}%</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {confusionReport.classMetrics.map(metric => {
                  const item = classes.find(entry => entry.id === metric.classId);
                  return (
                    <div key={metric.classId} className="rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-900">
                      <p className="mb-1 font-semibold" style={{ color: item?.color }}>{item?.name}</p>
                      <p>Precision {(metric.precision * 100).toFixed(1)}%</p>
                      <p>Recall {(metric.recall * 100).toFixed(1)}%</p>
                      <p>F1 {(metric.f1 * 100).toFixed(1)}%</p>
                    </div>
                  );
                })}
              </div>
              <InfoBox type={confusionReport.worstPair ? 'warning' : 'success'} title="Most Confused Classes">
                {confusionReport.worstPair
                  ? `Model confuses ${confusionReport.worstPair.actual} with ${confusionReport.worstPair.predicted} most (${confusionReport.worstPair.count} time${confusionReport.worstPair.count === 1 ? '' : 's'}).`
                  : 'No off-diagonal mistakes on the training examples.'}
              </InfoBox>
            </Card>
          )}

          <InfoBox type="success" title="TensorFlow.js Browser Training">
            Frames are sampled locally from your webcam, converted into MobileNet feature vectors, trained with a TensorFlow.js classifier head, and then evaluated continuously in the browser. No backend or cloud API is used.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
