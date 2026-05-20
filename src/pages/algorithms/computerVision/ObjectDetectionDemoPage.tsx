import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';
import { Camera, Copy, Download, FileImage, FolderOpen, Layers, Play, Plus, RotateCcw, Save, Trash2, Video } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { stopMediaElementStream, stopMediaStream } from '../../../lib/media/streams';

type Box = { x: number; y: number; w: number; h: number };
type BoxAnnotation = Box & { id: string; classId: string };
type ClassItem = { id: string; name: string; color: string };
type Sample = { id: string; feature: Float32Array; annotations: BoxAnnotation[]; preview: string; frameIndex: number };
type Prediction = Box & { id: string; classId: string; name: string; color: string; confidence: number };
type TrainPoint = { epoch: number; loss: number };

const CANVAS_W = 640;
const CANVAS_H = 360;
const ANCHORS = [[0.08, 0.08], [0.15, 0.15], [0.28, 0.28], [0.45, 0.45], [0.65, 0.65]] as const;
const COLORS = ['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];
const initialClasses: ClassItem[] = [
  { id: 'object_a', name: 'Object 1', color: COLORS[0] },
  { id: 'object_b', name: 'Object 2', color: COLORS[1] },
];

function downloadJson(filename: string, payload: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function clampBox(box: Box): Box {
  return {
    x: Math.max(0, Math.min(0.98, box.x)),
    y: Math.max(0, Math.min(0.98, box.y)),
    w: Math.max(0.02, Math.min(1 - box.x, box.w)),
    h: Math.max(0.02, Math.min(1 - box.y, box.h)),
  };
}

function iou(a: Box, b: Box) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const ix = Math.max(0, Math.min(ax2, bx2) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(ay2, by2) - Math.max(a.y, b.y));
  const intersection = ix * iy;
  return intersection / Math.max(1e-8, a.w * a.h + b.w * b.h - intersection);
}

function anchorBox(anchorIndex: number): Box {
  const [w, h] = ANCHORS[anchorIndex];
  return { x: 0.5 - w / 2, y: 0.5 - h / 2, w, h };
}

function buildDetector(classCount: number, featureSize: number, learningRate: number) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ inputShape: [featureSize], units: 256, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.2 }));
  model.add(tf.layers.dense({ units: ANCHORS.length * (5 + classCount) }));
  model.add(tf.layers.reshape({ targetShape: [ANCHORS.length, 5 + classCount] }));
  model.compile({ optimizer: tf.train.adam(learningRate), loss: 'meanSquaredError' });
  return model;
}

function targetsForSample(sample: Sample, classes: ClassItem[]) {
  const stride = 5 + classes.length;
  const classIndex = new Map(classes.map((item, index) => [item.id, index]));
  const target = Array.from({ length: ANCHORS.length }, () => Array(stride).fill(0));
  sample.annotations.forEach(annotation => {
    const box = clampBox(annotation);
    const bestAnchor = ANCHORS.map((_, index) => ({ index, score: iou(box, anchorBox(index)) })).sort((a, b) => b.score - a.score)[0]?.index ?? 0;
    const [aw, ah] = ANCHORS[bestAnchor];
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    target[bestAnchor][0] = 1;
    target[bestAnchor][1] = cx - 0.5;
    target[bestAnchor][2] = cy - 0.5;
    target[bestAnchor][3] = Math.log(box.w / aw);
    target[bestAnchor][4] = Math.log(box.h / ah);
    target[bestAnchor][5 + (classIndex.get(annotation.classId) ?? 0)] = 1;
  });
  return target.flat();
}

function samplesToTensors(samples: Sample[], classes: ClassItem[], featureSize: number) {
  return {
    xs: tf.tensor2d(samples.flatMap(sample => Array.from(sample.feature)), [samples.length, featureSize]),
    ys: tf.tensor3d(samples.flatMap(sample => targetsForSample(sample, classes)), [samples.length, ANCHORS.length, 5 + classes.length]),
  };
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
  const undoStackRef = useRef<Array<Map<number, BoxAnnotation[]>>>([]);

  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [selectedClassId, setSelectedClassId] = useState(initialClasses[0].id);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [annotationsByFrame, setAnnotationsByFrame] = useState<Map<number, BoxAnnotation[]>>(() => new Map([[0, []]]));
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [draftBox, setDraftBox] = useState<Box | null>(null);
  const [featureSize, setFeatureSize] = useState(1024);
  const [cameraReady, setCameraReady] = useState(false);
  const [sourceReady, setSourceReady] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [history, setHistory] = useState<TrainPoint[]>([]);
  const [epochs, setEpochs] = useState(25);
  const [batchSize, setBatchSize] = useState(8);
  const [learningRate, setLearningRate] = useState(0.001);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.45);
  const [nmsThreshold, setNmsThreshold] = useState(0.45);
  const [lastLatency, setLastLatency] = useState(0);
  const [training, setTraining] = useState(false);
  const [status, setStatus] = useState('Start the camera or import images, draw one or more boxes, save the frame, then train.');

  const currentAnnotations = annotationsByFrame.get(currentFrameIndex) ?? [];
  const latest = history[history.length - 1];
  const sampleCounts = useMemo(() => Object.fromEntries(classes.map(item => [
    item.id,
    samples.reduce((sum, sample) => sum + sample.annotations.filter(annotation => annotation.classId === item.id).length, 0),
  ])), [classes, samples]);
  const readyToTrain = classes.length >= 2 && classes.every(item => (sampleCounts[item.id] ?? 0) >= 3) && !!extractorRef.current && !training && samples.length > 0;

  const pushUndo = useCallback(() => {
    undoStackRef.current = [...undoStackRef.current, new Map([...annotationsByFrame.entries()].map(([key, value]) => [key, value.map(item => ({ ...item }))]))].slice(-20);
  }, [annotationsByFrame]);

  const updateCurrentAnnotations = useCallback((updater: (items: BoxAnnotation[]) => BoxAnnotation[]) => {
    pushUndo();
    setAnnotationsByFrame(current => {
      const next = new Map(current);
      next.set(currentFrameIndex, updater(next.get(currentFrameIndex) ?? []));
      return next;
    });
  }, [currentFrameIndex, pushUndo]);

  const undo = () => {
    const previous = undoStackRef.current.at(-1);
    if (!previous) return;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setAnnotationsByFrame(previous);
  };

  useEffect(() => () => {
    if (liveTimerRef.current) window.clearInterval(liveTimerRef.current);
    modelRef.current?.dispose();
    stopMediaStream(streamRef.current);
    stopMediaElementStream(videoRef.current);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Delete' && selectedBoxId) {
        updateCurrentAnnotations(items => items.filter(item => item.id !== selectedBoxId));
        setSelectedBoxId(null);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedBoxId, updateCurrentAnnotations]);

  const ensureExtractor = async () => {
    await tf.ready();
    if (!extractorRef.current) {
      setStatus('Loading TensorFlow.js MobileNet feature extractor...');
      extractorRef.current = await mobilenet.load({ version: 2, alpha: 0.5 });
    }
    return extractorRef.current;
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (imageRef.current) ctx.drawImage(imageRef.current, 0, 0, CANVAS_W, CANVAS_H);
    else if (videoRef.current && cameraReady) ctx.drawImage(videoRef.current, 0, 0, CANVAS_W, CANVAS_H);
    else {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Start camera or import an image', CANVAS_W / 2, CANVAS_H / 2);
    }

    const drawBox = (box: Box, cls: ClassItem, label: string, selected = false, dashed = false) => {
      const x = box.x * CANVAS_W;
      const y = box.y * CANVAS_H;
      const w = box.w * CANVAS_W;
      const h = box.h * CANVAS_H;
      ctx.save();
      ctx.strokeStyle = cls.color;
      ctx.lineWidth = selected ? 4 : 3;
      if (dashed || selected) ctx.setLineDash([7, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.fillStyle = cls.color;
      ctx.fillRect(x, Math.max(0, y - 22), Math.max(82, label.length * 7 + 12), 22);
      ctx.fillStyle = 'white';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 6, Math.max(14, y - 7));
      if (selected) {
        ctx.fillStyle = '#fff';
        [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].forEach(([hx, hy]) => {
          ctx.fillRect(hx - 4, hy - 4, 8, 8);
          ctx.strokeRect(hx - 4, hy - 4, 8, 8);
        });
      }
      ctx.restore();
    };

    currentAnnotations.forEach(annotation => {
      const cls = classes.find(item => item.id === annotation.classId) ?? classes[0];
      drawBox(annotation, cls, cls.name, annotation.id === selectedBoxId);
    });
    if (draftBox) drawBox(draftBox, classes.find(item => item.id === selectedClassId) ?? classes[0], 'new box', false, true);
    predictions.forEach(prediction => drawBox(prediction, prediction, `${prediction.name} ${(prediction.confidence * 100).toFixed(0)}%`, false, true));
  }, [cameraReady, classes, currentAnnotations, draftBox, predictions, selectedBoxId, selectedClassId]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const syncSourceCanvas = () => {
    const canvas = sourceCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return null;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
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
    return { feature: values, preview: source.toDataURL('image/jpeg', 0.74) };
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
      setPredictions([]);
      setStatus('Camera is ready. Draw multiple boxes on the frame, or start live inference after training.');
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
    const source = syncSourceCanvas();
    if (!source) return;
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setSourceReady(true);
      setPredictions([]);
    };
    image.src = source.toDataURL('image/jpeg', 0.82);
  };

  const importImage = async (file: File) => {
    await ensureExtractor();
    imageRef.current = await loadImage(file);
    setSourceReady(true);
    setPredictions([]);
    setStatus(`Loaded ${file.name}. Draw one or more boxes and save the frame.`);
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
        imageRef.current = await loadImage(file);
        const { feature, preview } = await extractFeature();
        imported.push({
          id: `${classId}_file_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
          feature,
          preview,
          frameIndex: currentFrameIndex + index,
          annotations: [{ id: `ann_${Date.now()}_${index}`, classId, x: 0.08, y: 0.08, w: 0.84, h: 0.84 }],
        });
        if (index % 5 === 0) await tf.nextFrame();
      }
      imageRef.current = previousImage;
      setSamples(current => [...current, ...imported]);
      setStatus(`Imported ${imported.length} image${imported.length === 1 ? '' : 's'} as full-frame object samples. Draw tighter boxes for better accuracy.`);
    } catch (error) {
      imageRef.current = previousImage;
      setStatus(error instanceof Error ? error.message : 'Folder import failed.');
    }
  };

  const pointerToPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  };

  const findBoxAt = (point: { x: number; y: number }) => [...currentAnnotations].reverse().find(box => point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!sourceReady) return;
    const point = pointerToPoint(event);
    if (event.shiftKey) {
      setSelectedBoxId(findBoxAt(point)?.id ?? null);
      return;
    }
    dragStartRef.current = point;
    setDraftBox({ x: point.x, y: point.y, w: 0.02, h: 0.02 });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const start = dragStartRef.current;
    if (!start) return;
    const point = pointerToPoint(event);
    setDraftBox(clampBox({ x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), w: Math.abs(point.x - start.x), h: Math.abs(point.y - start.y) }));
  };

  const onPointerUp = () => {
    if (draftBox && draftBox.w > 0.015 && draftBox.h > 0.015) {
      const annotation = { ...draftBox, id: `box_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, classId: selectedClassId };
      updateCurrentAnnotations(items => [...items, annotation]);
      setSelectedBoxId(annotation.id);
    }
    dragStartRef.current = null;
    setDraftBox(null);
  };

  const saveFrame = async () => {
    if (!currentAnnotations.length) {
      setStatus('Draw at least one bounding box before saving this frame.');
      return;
    }
    try {
      const { feature, preview } = await extractFeature();
      setSamples(current => [...current, { id: `frame_${Date.now()}`, feature, preview, annotations: currentAnnotations.map(item => ({ ...item })), frameIndex: currentFrameIndex }]);
      setStatus(`Saved frame ${currentFrameIndex} with ${currentAnnotations.length} box${currentAnnotations.length === 1 ? '' : 'es'}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save frame.');
    }
  };

  const copyToNextFrame = () => {
    pushUndo();
    setAnnotationsByFrame(current => {
      const next = new Map(current);
      next.set(currentFrameIndex + 1, currentAnnotations.map(item => ({ ...item, id: `box_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` })));
      return next;
    });
    setCurrentFrameIndex(index => index + 1);
    setSelectedBoxId(null);
  };

  const addClass = () => {
    setClasses(current => {
      const next = { id: `object_${Date.now()}`, name: `Object ${current.length + 1}`, color: COLORS[current.length % COLORS.length] };
      setSelectedClassId(next.id);
      return [...current, next];
    });
    modelRef.current?.dispose();
    modelRef.current = null;
    setPredictions([]);
  };

  const removeClass = (id: string) => {
    if (classes.length <= 2) return;
    setClasses(current => current.filter(item => item.id !== id));
    setSamples(current => current.map(sample => ({ ...sample, annotations: sample.annotations.filter(annotation => annotation.classId !== id) })).filter(sample => sample.annotations.length > 0));
    updateCurrentAnnotations(items => items.filter(item => item.classId !== id));
    setSelectedClassId(classes.find(item => item.id !== id)?.id ?? initialClasses[0].id);
    modelRef.current?.dispose();
    modelRef.current = null;
  };

  const train = async () => {
    if (!readyToTrain) {
      setStatus('Add at least 3 labeled boxes for every object class before training.');
      return;
    }
    setTraining(true);
    setHistory([]);
    modelRef.current?.dispose();
    const model = buildDetector(classes.length, featureSize, learningRate);
    const { xs, ys } = samplesToTensors(samples, classes, featureSize);
    try {
      setStatus('Training 5-anchor TensorFlow.js detector head...');
      await model.fit(xs, ys, {
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
      setStatus('Training complete. Run multi-object inference on the current frame or webcam.');
    } catch (error) {
      model.dispose();
      setStatus(error instanceof Error ? error.message : 'Training failed.');
    } finally {
      xs.dispose();
      ys.dispose();
      setTraining(false);
    }
  };

  const decodePredictions = async (raw: number[]) => {
    const stride = 5 + classes.length;
    const candidates: Prediction[] = [];
    for (let anchorIndex = 0; anchorIndex < ANCHORS.length; anchorIndex++) {
      const offset = anchorIndex * stride;
      const objectness = 1 / (1 + Math.exp(-(raw[offset] ?? 0)));
      const classValues = raw.slice(offset + 5, offset + 5 + classes.length);
      const exp = classValues.map(value => Math.exp(value));
      const total = exp.reduce((sum, value) => sum + value, 0) || 1;
      const probs = exp.map(value => value / total);
      const classIndex = probs.reduce((best, value, index) => value > probs[best] ? index : best, 0);
      const score = objectness * (probs[classIndex] ?? 0);
      if (score < confidenceThreshold) continue;
      const [aw, ah] = ANCHORS[anchorIndex];
      const cx = 0.5 + (raw[offset + 1] ?? 0);
      const cy = 0.5 + (raw[offset + 2] ?? 0);
      const w = aw * Math.exp(Math.max(-1.5, Math.min(1.5, raw[offset + 3] ?? 0)));
      const h = ah * Math.exp(Math.max(-1.5, Math.min(1.5, raw[offset + 4] ?? 0)));
      const cls = classes[classIndex] ?? classes[0];
      candidates.push({ id: `pred_${anchorIndex}`, classId: cls.id, name: cls.name, color: cls.color, confidence: score, ...clampBox({ x: cx - w / 2, y: cy - h / 2, w, h }) });
    }
    if (!candidates.length) return [];
    const boxes = tf.tensor2d(candidates.map(item => [item.y, item.x, item.y + item.h, item.x + item.w]), [candidates.length, 4]);
    const scores = tf.tensor1d(candidates.map(item => item.confidence));
    const selectedTensor = await tf.image.nonMaxSuppressionAsync(boxes, scores, 20, nmsThreshold, confidenceThreshold);
    const selected = Array.from(await selectedTensor.data());
    boxes.dispose();
    scores.dispose();
    selectedTensor.dispose();
    return selected.map(index => candidates[index]);
  };

  const runInference = useCallback(async () => {
    const model = modelRef.current;
    if (!model) {
      setStatus('Train the detector before running inference.');
      return;
    }
    const started = performance.now();
    try {
      const { feature } = await extractFeature();
      const input = tf.tensor2d(Array.from(feature), [1, feature.length]);
      const output = model.predict(input) as tf.Tensor;
      const raw = Array.from(await output.data());
      input.dispose();
      output.dispose();
      const next = await decodePredictions(raw);
      setLastLatency(performance.now() - started);
      setPredictions(next);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Inference failed.');
    }
  }, [classes, confidenceThreshold, nmsThreshold]);

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
    liveTimerRef.current = window.setInterval(() => void runInference(), 260);
    setStatus('Live webcam multi-object inference is running.');
  };

  const resetAll = () => {
    setSamples([]);
    setHistory([]);
    setPredictions([]);
    setDraftBox(null);
    setAnnotationsByFrame(new Map([[0, []]]));
    setCurrentFrameIndex(0);
    setSelectedBoxId(null);
    modelRef.current?.dispose();
    modelRef.current = null;
    setStatus('Dataset and model cleared.');
  };

  const exportModel = async () => {
    if (!modelRef.current) {
      setStatus('Train a detector before exporting.');
      return;
    }
    await modelRef.current.save('downloads://browser-multi-object-detector-head');
    downloadJson('browser-multi-object-detector-labels.json', {
      model: 'MobileNet feature extractor + TensorFlow.js 5-anchor detector head',
      exportedAt: new Date().toISOString(),
      featureSize,
      anchors: ANCHORS,
      thresholds: { confidenceThreshold, nmsThreshold },
      canvas: { width: CANVAS_W, height: CANVAS_H },
      classes: classes.map((item, index) => ({ index, ...item, boxes: sampleCounts[item.id] ?? 0 })),
    });
    setStatus('Detector exported. Keep model files and labels JSON together.');
  };

  const predictionChart = predictions.map(item => ({ name: item.name, confidence: Number(item.confidence.toFixed(3)) }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Object Detection Demo" subtitle="Train a browser multi-object detector from webcam frames or image folders with multiple boxes, anchor targets, NMS, and live inference." badge="Browser Trainable" category="Computer Vision" icon={<Camera size={22} />} />

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Inputs" icon={<Video size={14} />}>
            <div className="space-y-2 text-sm">
              <video ref={videoRef} muted playsInline className="hidden" />
              <canvas ref={sourceCanvasRef} className="hidden" />
              <button onClick={startCamera} className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-semibold text-white"><Camera size={14} /> {cameraReady ? 'Restart Camera' : 'Start Camera'}</button>
              <button onClick={() => stopCamera()} disabled={!cameraReady} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold disabled:opacity-50 dark:border-gray-700"><Video size={14} /> Stop Camera</button>
              <button onClick={captureFrame} disabled={!cameraReady} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold disabled:opacity-50 dark:border-gray-700"><Camera size={14} /> Capture Frame</button>
              <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <FileImage size={14} /> Load Image File
                <input type="file" accept="image/*" className="hidden" onChange={event => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void importImage(file);
                  event.currentTarget.value = '';
                }} />
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
                      <input ref={element => { element?.setAttribute('webkitdirectory', ''); element?.setAttribute('directory', ''); }} type="file" accept="image/*" multiple className="hidden" onChange={event => { void importFilesAsSamples(item.id, event.currentTarget.files); event.currentTarget.value = ''; }} />
                    </label>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-gray-500">{sampleCounts[item.id] ?? 0} boxes</p>
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
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
            <Card title="Label and Infer" subtitle={`Frame ${currentFrameIndex} · shift-click selects a box`}>
              <div className="space-y-3">
                <canvas ref={canvasRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className="aspect-video w-full cursor-crosshair rounded-lg border border-gray-200 bg-gray-950 dark:border-gray-700" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={saveFrame} disabled={!currentAnnotations.length || !sourceReady} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={14} /> Save Frame</button>
                  <button onClick={copyToNextFrame} disabled={!currentAnnotations.length} className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-700"><Copy size={14} /> Copy to Next</button>
                  <button onClick={() => void runInference()} disabled={!modelRef.current} className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-700"><Play size={14} /> Infer Current</button>
                  <button onClick={startLiveInference} disabled={!modelRef.current} className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-gray-700"><Video size={14} /> Live Webcam</button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Draw repeatedly to add multiple boxes. Shift-click a box to select it, Delete removes it, Ctrl+Z restores the previous annotation state.</p>
              </div>
            </Card>

            <Card title="Frame Boxes">
              <div className="space-y-2">
                {currentAnnotations.map(annotation => {
                  const cls = classes.find(item => item.id === annotation.classId) ?? classes[0];
                  return (
                    <button key={annotation.id} onClick={() => setSelectedBoxId(annotation.id)} className={`flex w-full items-center gap-2 rounded border px-2 py-2 text-left text-xs ${selectedBoxId === annotation.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700'}`}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cls.color }} />
                      <span className="min-w-0 flex-1"><b>{cls.name}</b> x:{annotation.x.toFixed(2)} y:{annotation.y.toFixed(2)}</span>
                      <Trash2 size={12} onClick={event => {
                        event.stopPropagation();
                        updateCurrentAnnotations(items => items.filter(item => item.id !== annotation.id));
                      }} />
                    </button>
                  );
                })}
                {!currentAnnotations.length && <p className="rounded border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500 dark:border-gray-700">No boxes on this frame.</p>}
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <MetricsPanel title="Detector Metrics" metrics={[
              { label: 'Classes', value: classes.length, format: 'number', color: 'blue' },
              { label: 'Saved Frames', value: samples.length, format: 'number', color: 'green' },
              { label: 'Objects', value: predictions.length, format: 'number', color: 'green' },
              { label: 'Latency', value: `${Math.round(lastLatency)} ms`, color: 'blue' },
            ]} />

            <Card title="Post Processing">
              <div className="space-y-3 text-sm">
                <label className="block">Confidence: <b>{confidenceThreshold.toFixed(2)}</b><input type="range" min={0.3} max={0.8} step={0.01} value={confidenceThreshold} onChange={event => setConfidenceThreshold(Number(event.target.value))} className="w-full accent-purple-600" /></label>
                <label className="block">NMS IoU: <b>{nmsThreshold.toFixed(2)}</b><input type="range" min={0.3} max={0.7} step={0.01} value={nmsThreshold} onChange={event => setNmsThreshold(Number(event.target.value))} className="w-full accent-purple-600" /></label>
                <p className="rounded bg-gray-50 p-2 text-xs dark:bg-gray-900">{predictions.length} objects · {Math.round(lastLatency)}ms</p>
              </div>
            </Card>

            <Card title="Training Loss">
              {history.length ? (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="epoch" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line dataKey="loss" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-500">Loss appears during training.</p>}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card title="Prediction Scores">
              {predictions.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={predictionChart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 1]} tickFormatter={value => `${Math.round(Number(value) * 100)}%`} />
                    <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
                    <Bar dataKey="confidence" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-gray-700">Run inference to see all surviving boxes after NMS.</div>}
            </Card>

            <Card title="Saved Frames">
              <div className="grid grid-cols-3 gap-2">
                {samples.slice(-12).map(sample => <img key={sample.id} src={sample.preview} title={`${sample.annotations.length} boxes`} alt="" className="aspect-video rounded object-cover" />)}
                {samples.length === 0 && <p className="col-span-3 text-sm text-gray-500">No saved frames yet.</p>}
              </div>
            </Card>
          </div>

          <InfoBox type={readyToTrain ? 'success' : 'info'} title="Runtime Status">{status}</InfoBox>
          <InfoBox type="success" title="5-Anchor Detector">
            Each saved frame trains five anchor predictions. Inference decodes objectness, box offsets, and class probabilities, then applies TensorFlow.js non-max suppression so multiple objects can survive on the same image.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
