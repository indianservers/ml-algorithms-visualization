import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';
import { Camera, Download, FileImage, FolderOpen, Layers, Play, Plus, RotateCcw, Save, Trash2, Video } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { stopMediaElementStream, stopMediaStream } from '../../../lib/media/streams';

type Box = { x: number; y: number; w: number; h: number };
type ClassItem = { id: string; name: string; color: string };
type Sample = { id: string; classId: string; feature: Float32Array; box: Box; preview: string };
type Prediction = { classId: string; name: string; color: string; confidence: number; box: Box };
type TrainPoint = { epoch: number; loss: number };

const CANVAS_W = 640;
const CANVAS_H = 360;
const COLORS = ['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];
const initialClasses: ClassItem[] = [
  { id: 'object_a', name: 'Object 1', color: COLORS[0] },
  { id: 'object_b', name: 'Object 2', color: COLORS[1] },
];

function buildDetector(classCount: number, featureSize: number, learningRate: number) {
  const input = tf.input({ shape: [featureSize] });
  const hidden = tf.layers.dense({ units: 128, activation: 'relu' }).apply(input) as tf.SymbolicTensor;
  const dropout = tf.layers.dropout({ rate: 0.2 }).apply(hidden) as tf.SymbolicTensor;
  const box = tf.layers.dense({ units: 4, activation: 'sigmoid', name: 'box' }).apply(dropout) as tf.SymbolicTensor;
  const label = tf.layers.dense({ units: classCount, activation: 'softmax', name: 'label' }).apply(dropout) as tf.SymbolicTensor;
  const model = tf.model({ inputs: input, outputs: [box, label] });
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: ['meanSquaredError', 'categoricalCrossentropy'],
  });
  return model;
}

function samplesToTensors(samples: Sample[], classes: ClassItem[], featureSize: number) {
  const classIndex = new Map(classes.map((item, index) => [item.id, index]));
  const xs = tf.tensor2d(samples.flatMap(sample => Array.from(sample.feature)), [samples.length, featureSize]);
  const boxes = tf.tensor2d(samples.flatMap(sample => [sample.box.x, sample.box.y, sample.box.w, sample.box.h]), [samples.length, 4]);
  const labels = tf.tensor2d(samples.flatMap(sample => {
    const row = Array(classes.length).fill(0);
    row[classIndex.get(sample.classId) ?? 0] = 1;
    return row;
  }), [samples.length, classes.length]);
  return { xs, boxes, labels };
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

function clampBox(box: Box): Box {
  return {
    x: Math.max(0, Math.min(1, box.x)),
    y: Math.max(0, Math.min(1, box.y)),
    w: Math.max(0.02, Math.min(1, box.w)),
    h: Math.max(0.02, Math.min(1, box.h)),
  };
}

export default function ObjectDetectionDemoPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveTimerRef = useRef<number | null>(null);
  const modelRef = useRef<tf.LayersModel | null>(null);
  const extractorRef = useRef<mobilenet.MobileNet | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [selectedClassId, setSelectedClassId] = useState(initialClasses[0].id);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [featureSize, setFeatureSize] = useState(1024);
  const [cameraReady, setCameraReady] = useState(false);
  const [sourceReady, setSourceReady] = useState(false);
  const [currentBox, setCurrentBox] = useState<Box | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [history, setHistory] = useState<TrainPoint[]>([]);
  const [epochs, setEpochs] = useState(25);
  const [batchSize, setBatchSize] = useState(8);
  const [learningRate, setLearningRate] = useState(0.001);
  const [training, setTraining] = useState(false);
  const [status, setStatus] = useState('Start the camera or import images, draw a box, save samples, then train.');

  const sampleCounts = useMemo(() => Object.fromEntries(classes.map(item => [
    item.id,
    samples.filter(sample => sample.classId === item.id).length,
  ])), [classes, samples]);
  const readyToTrain = classes.length >= 2 && classes.every(item => (sampleCounts[item.id] ?? 0) >= 3) && !!extractorRef.current && !training;
  const latest = history[history.length - 1];
  const predictionRows = prediction
    ? [{ name: prediction.name, confidence: prediction.confidence, color: prediction.color }]
    : [];

  useEffect(() => () => {
    if (liveTimerRef.current) window.clearInterval(liveTimerRef.current);
    modelRef.current?.dispose();
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    stopMediaElementStream(videoRef.current);
  }, []);

  const ensureExtractor = async () => {
    await tf.ready();
    if (!extractorRef.current) {
      setStatus('Loading TensorFlow.js MobileNet feature extractor...');
      extractorRef.current = await mobilenet.load({ version: 2, alpha: 0.5 });
    }
    return extractorRef.current;
  };

  const drawCanvas = useCallback((box = currentBox, detected = prediction) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, 0, 0, CANVAS_W, CANVAS_H);
    } else if (videoRef.current && cameraReady) {
      ctx.drawImage(videoRef.current, 0, 0, CANVAS_W, CANVAS_H);
    } else {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Start camera or import an image', CANVAS_W / 2, CANVAS_H / 2);
    }
    if (box) {
      const cls = classes.find(item => item.id === selectedClassId) ?? classes[0];
      ctx.strokeStyle = cls.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x * CANVAS_W, box.y * CANVAS_H, box.w * CANVAS_W, box.h * CANVAS_H);
      ctx.fillStyle = cls.color;
      ctx.fillRect(box.x * CANVAS_W, Math.max(0, box.y * CANVAS_H - 22), Math.max(70, box.w * CANVAS_W), 22);
      ctx.fillStyle = 'white';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(cls.name, box.x * CANVAS_W + 6, Math.max(14, box.y * CANVAS_H - 7));
    }
    if (detected) {
      ctx.strokeStyle = detected.color;
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(detected.box.x * CANVAS_W, detected.box.y * CANVAS_H, detected.box.w * CANVAS_W, detected.box.h * CANVAS_H);
      ctx.setLineDash([]);
      ctx.fillStyle = detected.color;
      ctx.fillRect(detected.box.x * CANVAS_W, Math.max(0, detected.box.y * CANVAS_H - 24), Math.max(120, detected.box.w * CANVAS_W), 24);
      ctx.fillStyle = 'white';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${detected.name} ${(detected.confidence * 100).toFixed(1)}%`, detected.box.x * CANVAS_W + 6, Math.max(16, detected.box.y * CANVAS_H - 8));
    }
  }, [cameraReady, classes, currentBox, prediction, selectedClassId]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const syncSourceCanvas = () => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return null;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (imageRef.current) ctx.drawImage(imageRef.current, 0, 0, CANVAS_W, CANVAS_H);
    else if (videoRef.current && cameraReady) ctx.drawImage(videoRef.current, 0, 0, CANVAS_W, CANVAS_H);
    else return null;
    return canvas;
  };

  const extractFeature = async () => {
    const extractor = await ensureExtractor();
    const source = syncSourceCanvas();
    if (!source) throw new Error('No camera frame or imported image is ready.');
    const activation = extractor.infer(source, true) as tf.Tensor;
    const values = new Float32Array(await activation.data());
    activation.dispose();
    setFeatureSize(values.length);
    return { feature: values, preview: source.toDataURL('image/jpeg', 0.72) };
  };

  const startCamera = async () => {
    try {
      await ensureExtractor();
      stopCamera(false);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360, facingMode: 'environment' }, audio: false });
      if (!videoRef.current) {
        stopMediaStream(stream);
        return;
      }
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      imageRef.current = null;
      setCameraReady(true);
      setSourceReady(true);
      setPrediction(null);
      setStatus('Camera is ready. Draw a box on the frame or start live inference after training.');
      drawCanvas();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to start camera.');
    }
  };

  const stopCamera = (updateStatus = true) => {
    if (liveTimerRef.current) window.clearInterval(liveTimerRef.current);
    liveTimerRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    stopMediaElementStream(videoRef.current);
    setCameraReady(false);
    if (!imageRef.current) setSourceReady(false);
    if (updateStatus) setStatus('Camera stopped. Imported images, labels, and trained model remain available.');
  };

  const captureFrame = () => {
    if (!videoRef.current || !cameraReady) return;
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, CANVAS_W, CANVAS_H);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setSourceReady(true);
      setPrediction(null);
      drawCanvas();
    };
    image.src = canvas.toDataURL('image/jpeg', 0.8);
  };

  const importImage = async (file: File) => {
    await ensureExtractor();
    const image = await loadImage(file);
    imageRef.current = image;
    setSourceReady(true);
    setPrediction(null);
    setStatus(`Loaded ${file.name}. Draw a bounding box and save the sample.`);
    drawCanvas();
  };

  const importFilesAsSamples = async (classId: string, fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter(file => file.type.startsWith('image/'));
    if (!files.length) return;
    const previousImage = imageRef.current;
    try {
      await ensureExtractor();
      setStatus(`Importing ${files.length} image${files.length === 1 ? '' : 's'} with full-frame boxes...`);
      const imported: Sample[] = [];
      for (const [index, file] of files.entries()) {
        const image = await loadImage(file);
        imageRef.current = image;
        const { feature, preview } = await extractFeature();
        imported.push({
          id: `${classId}_file_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
          classId,
          feature,
          preview,
          box: { x: 0.08, y: 0.08, w: 0.84, h: 0.84 },
        });
        if (index % 5 === 0) await tf.nextFrame();
      }
      imageRef.current = previousImage;
      setSamples(current => [...current, ...imported]);
      setPrediction(null);
      setStatus(`Imported ${imported.length} image${imported.length === 1 ? '' : 's'} as full-frame object samples. Draw tighter boxes for better accuracy.`);
    } catch (error) {
      imageRef.current = previousImage;
      setStatus(error instanceof Error ? error.message : 'Folder import failed.');
    } finally {
      drawCanvas();
    }
  };

  const pointerToBoxPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!sourceReady) return;
    const point = pointerToBoxPoint(event);
    dragStartRef.current = point;
    setCurrentBox({ x: point.x, y: point.y, w: 0.02, h: 0.02 });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    const point = pointerToBoxPoint(event);
    setCurrentBox(clampBox({
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x),
      h: Math.abs(point.y - start.y),
    }));
  };

  const onPointerUp = () => {
    dragStartRef.current = null;
  };

  const saveSample = async () => {
    if (!currentBox) {
      setStatus('Draw a bounding box before saving a sample.');
      return;
    }
    try {
      const { feature, preview } = await extractFeature();
      setSamples(current => [...current, {
        id: `sample_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        classId: selectedClassId,
        feature,
        preview,
        box: currentBox,
      }]);
      setStatus('Saved labeled object sample.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save sample.');
    }
  };

  const addClass = () => {
    setClasses(current => {
      const next = {
        id: `object_${Date.now()}`,
        name: `Object ${current.length + 1}`,
        color: COLORS[current.length % COLORS.length],
      };
      setSelectedClassId(next.id);
      return [...current, next];
    });
    modelRef.current?.dispose();
    modelRef.current = null;
    setPrediction(null);
  };

  const removeClass = (id: string) => {
    if (classes.length <= 2) {
      setSamples(current => current.filter(sample => sample.classId !== id));
      return;
    }
    setClasses(current => current.filter(item => item.id !== id));
    setSamples(current => current.filter(sample => sample.classId !== id));
    setSelectedClassId(classes.find(item => item.id !== id)?.id ?? initialClasses[0].id);
    modelRef.current?.dispose();
    modelRef.current = null;
    setPrediction(null);
  };

  const train = async () => {
    if (!readyToTrain) {
      setStatus('Add at least 3 labeled samples for every object class before training.');
      return;
    }
    setTraining(true);
    setHistory([]);
    modelRef.current?.dispose();
    const model = buildDetector(classes.length, featureSize, learningRate);
    const { xs, boxes, labels } = samplesToTensors(samples, classes, featureSize);
    try {
      setStatus('Training TensorFlow.js object detector head...');
      await model.fit(xs, [boxes, labels], {
        epochs,
        batchSize,
        shuffle: true,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            setHistory(current => [...current, { epoch: epoch + 1, loss: Number((logs?.loss as number ?? 0).toFixed(4)) }]);
            await tf.nextFrame();
          },
        },
      });
      modelRef.current = model;
      setStatus('Training complete. Run inference on the current image or webcam.');
    } catch (error) {
      model.dispose();
      setStatus(error instanceof Error ? error.message : 'Training failed.');
    } finally {
      xs.dispose();
      boxes.dispose();
      labels.dispose();
      setTraining(false);
    }
  };

  const runInference = useCallback(async () => {
    const model = modelRef.current;
    if (!model) {
      setStatus('Train the detector before running inference.');
      return;
    }
    try {
      const { feature } = await extractFeature();
      const input = tf.tensor2d(Array.from(feature), [1, feature.length]);
      const outputs = model.predict(input) as tf.Tensor[];
      const boxValues = Array.from(await outputs[0].data());
      const classValues = Array.from(await outputs[1].data());
      input.dispose();
      outputs.forEach(output => output.dispose());
      const classIndex = classValues.reduce((best, value, index) => value > classValues[best] ? index : best, 0);
      const cls = classes[classIndex] ?? classes[0];
      const next = {
        classId: cls.id,
        name: cls.name,
        color: cls.color,
        confidence: classValues[classIndex] ?? 0,
        box: clampBox({ x: boxValues[0] ?? 0, y: boxValues[1] ?? 0, w: boxValues[2] ?? 0.1, h: boxValues[3] ?? 0.1 }),
      };
      setPrediction(next);
      drawCanvas(currentBox, next);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Inference failed.');
    }
  }, [classes, currentBox, drawCanvas]);

  const startLiveInference = () => {
    if (liveTimerRef.current) {
      window.clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
      setStatus('Live inference paused.');
      return;
    }
    if (!cameraReady) {
      setStatus('Start the webcam before live inference.');
      return;
    }
    imageRef.current = null;
    liveTimerRef.current = window.setInterval(() => void runInference(), 240);
    setStatus('Live webcam inference is running.');
  };

  const resetAll = () => {
    setSamples([]);
    setHistory([]);
    setPrediction(null);
    setCurrentBox(null);
    modelRef.current?.dispose();
    modelRef.current = null;
    setStatus('Dataset and model cleared.');
  };

  const exportModel = async () => {
    if (!modelRef.current) {
      setStatus('Train a detector before exporting.');
      return;
    }
    await modelRef.current.save('downloads://browser-object-detector-head');
    downloadJson('browser-object-detector-labels.json', {
      model: 'MobileNet feature extractor + TensorFlow.js box/class detector head',
      exportedAt: new Date().toISOString(),
      featureSize,
      canvas: { width: CANVAS_W, height: CANVAS_H },
      classes: classes.map((item, index) => ({ index, ...item, samples: sampleCounts[item.id] ?? 0 })),
    });
    setStatus('Detector exported. Keep model files and labels JSON together.');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader
        title="Object Detection Demo"
        subtitle="Train a browser object detector from webcam frames or imported images by drawing bounding boxes, then run live or file inference with TensorFlow.js."
        badge="Browser Trainable"
        category="Computer Vision"
        icon={<Camera size={22} />}
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Inputs" icon={<Video size={14} />}>
            <div className="space-y-2 text-sm">
              <video ref={videoRef} muted playsInline className="hidden" />
              <canvas ref={sourceCanvasRef} className="hidden" />
              <button onClick={startCamera} className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-semibold text-white">
                <Camera size={14} /> {cameraReady ? 'Restart Camera' : 'Start Camera'}
              </button>
              <button onClick={() => stopCamera()} disabled={!cameraReady} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold disabled:opacity-50 dark:border-gray-700">
                <Video size={14} /> Stop Camera
              </button>
              <button onClick={captureFrame} disabled={!cameraReady} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold disabled:opacity-50 dark:border-gray-700">
                <Camera size={14} /> Capture Frame for Labeling
              </button>
              <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <FileImage size={14} /> Load Image File
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={event => {
                    const file = event.currentTarget.files?.[0];
                    if (file) void importImage(file);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </div>
          </Card>

          <Card title="Classes" icon={<Layers size={14} />} actions={<button onClick={addClass} className="rounded border border-gray-200 px-2 py-1 text-xs font-semibold dark:border-gray-700"><Plus size={12} /></button>}>
            <div className="space-y-2">
              {classes.map(item => (
                <div key={item.id} className={`rounded border p-2 ${selectedClassId === item.id ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <input value={item.name} onChange={event => setClasses(current => current.map(cls => cls.id === item.id ? { ...cls, name: event.target.value } : cls))} className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-semibold dark:border-gray-700 dark:bg-gray-900" />
                    <button onClick={() => setSelectedClassId(item.id)} className="rounded bg-blue-600 px-2 py-1 text-xs font-semibold text-white">Use</button>
                    <button onClick={() => removeClass(item.id)} className="rounded p-1 text-gray-400 hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="inline-flex cursor-pointer items-center justify-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs font-semibold dark:border-gray-700">
                      <FileImage size={12} /> Files
                      <input type="file" accept="image/*" multiple className="hidden" onChange={event => { void importFilesAsSamples(item.id, event.currentTarget.files); event.currentTarget.value = ''; }} />
                    </label>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs font-semibold dark:border-gray-700">
                      <FolderOpen size={12} /> Folder
                      <input
                        ref={element => {
                          element?.setAttribute('webkitdirectory', '');
                          element?.setAttribute('directory', '');
                        }}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={event => { void importFilesAsSamples(item.id, event.currentTarget.files); event.currentTarget.value = ''; }}
                      />
                    </label>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-gray-500">{sampleCounts[item.id] ?? 0} samples</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Training" icon={<Play size={14} />}>
            <div className="space-y-3 text-sm">
              <label className="block">Epochs: <b>{epochs}</b><input type="range" min={5} max={80} value={epochs} onChange={event => setEpochs(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              <label className="block">Batch size: <b>{batchSize}</b><input type="range" min={2} max={24} step={2} value={batchSize} onChange={event => setBatchSize(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              <label className="block">Learning rate: <b>{learningRate.toFixed(4)}</b><input type="range" min={0.0005} max={0.01} step={0.0005} value={learningRate} onChange={event => setLearningRate(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={!readyToTrain} onClick={train} className="inline-flex items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 font-semibold text-white disabled:opacity-50"><Play size={14} /> {training ? 'Training...' : 'Train'}</button>
                <button onClick={resetAll} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold dark:border-gray-700"><RotateCcw size={14} /> Reset</button>
              </div>
              <button disabled={!modelRef.current} onClick={exportModel} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold disabled:opacity-50 dark:border-gray-700"><Download size={14} /> Export Model</button>
            </div>
          </Card>

          <MetricsPanel title="Detector Metrics" metrics={[
            { label: 'Classes', value: classes.length, format: 'number', color: 'blue' },
            { label: 'Samples', value: samples.length, format: 'number', color: 'green' },
            { label: 'Loss', value: latest?.loss ?? 0, format: 'fixed4', color: 'blue' },
            { label: 'Confidence', value: prediction?.confidence ?? 0, format: 'percent', color: 'green' },
          ]} />
        </div>

        <div className="space-y-4">
          <Card title="Label and Infer">
            <div className="space-y-3">
              <canvas
                ref={canvasRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="aspect-video w-full cursor-crosshair rounded-lg border border-gray-200 bg-gray-950 dark:border-gray-700"
              />
              <div className="flex flex-wrap gap-2">
                <button onClick={saveSample} disabled={!currentBox || !sourceReady} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={14} /> Save Box Sample</button>
                <button onClick={() => void runInference()} disabled={!modelRef.current} className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-700"><Play size={14} /> Infer Current</button>
                <button onClick={startLiveInference} disabled={!modelRef.current} className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-700"><Video size={14} /> Live Webcam</button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Draw one tight object box per sample. Folder imports use full-frame boxes, useful when each image is already cropped around the object.</p>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card title="Prediction">
              {prediction ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-300">Detected <b>{prediction.name}</b> at <b>{(prediction.confidence * 100).toFixed(1)}%</b></p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={predictionRows}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 1]} tickFormatter={value => `${Math.round(Number(value) * 100)}%`} />
                      <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                      <Bar dataKey="confidence" radius={[4, 4, 0, 0]}>
                        {predictionRows.map(item => <Cell key={item.name} fill={item.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Train and run inference to see a detected box.</div>
              )}
            </Card>

            <Card title="Samples">
              <div className="grid grid-cols-3 gap-2">
                {samples.slice(-12).map(sample => {
                  const cls = classes.find(item => item.id === sample.classId);
                  return <img key={sample.id} src={sample.preview} title={cls?.name} alt="" className="aspect-video rounded object-cover" />;
                })}
                {samples.length === 0 && <p className="col-span-3 text-sm text-gray-500">No labeled samples yet.</p>}
              </div>
            </Card>
          </div>

          <InfoBox type={readyToTrain ? 'success' : 'info'} title="Runtime Status">{status}</InfoBox>
          <InfoBox type="success" title="Real TensorFlow.js Detector">
            This page trains a browser detector head with two outputs: normalized bounding box coordinates and object class probabilities. MobileNet supplies image features; your drawn boxes and classes supply the supervised labels.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
