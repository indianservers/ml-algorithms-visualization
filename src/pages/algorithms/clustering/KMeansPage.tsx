import { useEffect, useMemo, useRef, useState } from 'react';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { FileImage, FolderOpen, Image as ImageIcon, Network, Play, Plus, RotateCcw, Target, Trash2, Upload } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { kmeans, elbowMethod, type KMeansResult, type KMeansStep } from '../../../lib/algorithms/clustering/kmeans';
import { generateSyntheticBlobs, mallCustomersDataset, studentMarksDataset } from '../../../data/sampleDatasets';

const colors = ['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c', '#0891b2'];
const animalDatasetAssets = import.meta.glob('../../../data/animals-dataset/**/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;
const starterPointCsv = `x,y,label
-3.2,2.8,dog-like
-2.8,3.4,dog-like
-3.6,2.3,dog-like
2.8,2.7,car-like
3.2,3.4,car-like
3.8,2.2,car-like
0.1,-3.1,horse-like
-0.4,-2.5,horse-like
0.6,-3.6,horse-like`;

type PointRow = { x: number; y: number; label: string };
type ImageSample = { id: string; name: string; group: string; preview: string; feature: number[]; x: number; y: number; source: 'dataset' | 'upload' };
type DatasetImage = { url: string; name: string; group: string };
type InferenceSample = { name: string; preview: string; group: string; distance: number; similarity: number };
type ProgressState = { phase: string; current: number; total: number };
type PointSource = 'editable' | 'synthetic' | 'mall' | 'students';

function parsePointCsv(text: string): PointRow[] {
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(1)
    .map(line => {
      const [x, y, label = 'sample'] = line.split(',').map(part => part.trim());
      return { x: Number(x), y: Number(y), label };
    })
    .filter(row => Number.isFinite(row.x) && Number.isFinite(row.y));
}

function rowsToCsv(rows: PointRow[]) {
  return ['x,y,label', ...rows.map(row => `${row.x.toFixed(2)},${row.y.toFixed(2)},${row.label}`)].join('\n');
}

function fitLine(rows: PointRow[]) {
  if (rows.length < 2) return { slope: 0, intercept: 0 };
  const meanX = rows.reduce((sum, row) => sum + row.x, 0) / rows.length;
  const meanY = rows.reduce((sum, row) => sum + row.y, 0) / rows.length;
  const numerator = rows.reduce((sum, row) => sum + (row.x - meanX) * (row.y - meanY), 0);
  const denominator = rows.reduce((sum, row) => sum + (row.x - meanX) ** 2, 0) || 1;
  const slope = numerator / denominator;
  return { slope, intercept: meanY - slope * meanX };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeEmbedding(feature: number[]) {
  const magnitude = Math.sqrt(feature.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  return feature.map(value => value / magnitude);
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

function loadImageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not read ${url}`));
    image.src = url;
  });
}

function getAnimalDataset(limitPerClass: number): DatasetImage[] {
  const counts = new Map<string, number>();
  return Object.entries(animalDatasetAssets)
    .map(([path, url]) => {
      const parts = path.split('/');
      const group = parts[parts.length - 2] || 'animal';
      return { url, name: parts[parts.length - 1] || group, group };
    })
    .sort((a, b) => `${a.group}/${a.name}`.localeCompare(`${b.group}/${b.name}`))
    .filter(image => {
      const next = (counts.get(image.group) ?? 0) + 1;
      counts.set(image.group, next);
      return next <= limitPerClass;
    });
}

function projectEmbeddings(features: number[][]) {
  if (!features.length) return [];
  return features.map(feature => {
    let x = 0;
    let y = 0;
    feature.forEach((value, index) => {
      x += value * Math.sin(index * 0.073);
      y += value * Math.cos(index * 0.097);
    });
    return [x, y];
  });
}

function nearestCentroid(feature: number[], centroids: number[][]) {
  return centroids.reduce((best, centroid, index) => {
    const distance = Math.sqrt(centroid.reduce((sum, value, dim) => sum + (value - feature[dim]) ** 2, 0));
    return distance < best.distance ? { cluster: index, distance } : best;
  }, { cluster: 0, distance: Infinity });
}

function distance(a: number[], b: number[]) {
  return Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));
}

function assignToCentroids(values: number[][], centroids: number[][]) {
  return values.map(value => nearestCentroid(value, centroids).cluster);
}

function calculateInertia(values: number[][], assignments: number[], centroids: number[][]) {
  return values.reduce((sum, value, index) => sum + distance(value, centroids[assignments[index]]) ** 2, 0);
}

function pickInitialCentroids(values: number[][], count: number, method: 'random' | 'kmeans++') {
  if (method === 'random') {
    const indices = Array.from({ length: values.length }, (_, index) => index).sort(() => Math.random() - 0.5);
    return indices.slice(0, count).map(index => [...values[index]]);
  }
  const centroids: number[][] = [[...values[Math.floor(Math.random() * values.length)]]];
  while (centroids.length < count) {
    const distances = values.map(value => Math.min(...centroids.map(centroid => distance(value, centroid) ** 2)));
    const total = distances.reduce((sum, value) => sum + value, 0) || 1;
    let threshold = Math.random() * total;
    let selected = values[values.length - 1];
    for (let index = 0; index < values.length; index++) {
      threshold -= distances[index];
      if (threshold <= 0) {
        selected = values[index];
        break;
      }
    }
    centroids.push([...selected]);
  }
  return centroids;
}

async function trainKMeansWithProgress(
  values: number[][],
  count: number,
  maxIterations: number,
  method: 'random' | 'kmeans++',
  onProgress: (progress: ProgressState) => void
): Promise<KMeansResult> {
  let centroids = pickInitialCentroids(values, count, method);
  let assignments = assignToCentroids(values, centroids);
  const steps: KMeansStep[] = [];
  let converged = false;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const inertia = calculateInertia(values, assignments, centroids);
    steps.push({ iteration, centroids: centroids.map(centroid => [...centroid]), assignments: [...assignments], inertia });
    onProgress({ phase: 'Training K-Means clusters', current: iteration + 1, total: maxIterations });
    await tf.nextFrame();

    const dims = values[0].length;
    const sums = Array.from({ length: count }, () => Array(dims).fill(0));
    const clusterCounts = Array(count).fill(0);
    assignments.forEach((cluster, index) => {
      clusterCounts[cluster]++;
      values[index].forEach((value, dim) => { sums[cluster][dim] += value; });
    });
    const nextCentroids = sums.map((sum, cluster) => (
      clusterCounts[cluster] > 0
        ? sum.map(value => value / clusterCounts[cluster])
        : [...values[Math.floor(Math.random() * values.length)]]
    ));
    const nextAssignments = assignToCentroids(values, nextCentroids);
    const changed = nextAssignments.some((assignment, index) => assignment !== assignments[index]);
    centroids = nextCentroids;
    assignments = nextAssignments;
    if (!changed) {
      converged = true;
      break;
    }
  }

  const inertia = calculateInertia(values, assignments, centroids);
  return { centroids, assignments, inertia, steps, converged };
}

function ProgressBar({ progress }: { progress: ProgressState | null }) {
  if (!progress || progress.total <= 0) return null;
  const percent = Math.min(100, Math.round((progress.current / progress.total) * 100));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500">
        <span>{progress.phase}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-gray-200 dark:bg-gray-800">
        <div className="h-full rounded bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
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

export default function KMeansPage() {
  const extractorRef = useRef<mobilenet.MobileNet | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<'points' | 'images'>('points');
  const [k, setK] = useState(3);
  const [init, setInit] = useState<'random' | 'kmeans++'>('kmeans++');
  const [maxIter, setMaxIter] = useState(25);
  const [step, setStep] = useState(0);
  const [source, setSource] = useState<PointSource>('editable');
  const [seed, setSeed] = useState(1);
  const [pointCsv, setPointCsv] = useState(starterPointCsv);
  const [studyHours, setStudyHours] = useState(5);
  const [images, setImages] = useState<ImageSample[]>([]);
  const [imageStatus, setImageStatus] = useState('Load the bundled animals dataset or your own image folders/files to cluster them with MobileNet embeddings.');
  const [loadingImages, setLoadingImages] = useState(false);
  const [datasetLimit, setDatasetLimit] = useState(20);
  const [inference, setInference] = useState<InferenceSample | null>(null);
  const [embeddingProgress, setEmbeddingProgress] = useState<ProgressState | null>(null);
  const [trainingProgress, setTrainingProgress] = useState<ProgressState | null>(null);
  const [trainingImages, setTrainingImages] = useState(false);
  const [imageResult, setImageResult] = useState<KMeansResult | null>(null);

  const ensureExtractor = async () => {
    await tf.ready();
    if (!extractorRef.current) {
      setImageStatus('Loading TensorFlow.js MobileNet feature extractor...');
      extractorRef.current = await mobilenet.load({ version: 2, alpha: 0.5 });
    }
    return extractorRef.current;
  };

  const pointRows = useMemo(() => {
    if (source === 'mall') {
      return (mallCustomersDataset.data as { annual_income: number; spending_score: number }[])
        .map(row => ({ x: row.annual_income / 20 - 2, y: row.spending_score / 20 - 2, label: 'customer' }));
    }
    if (source === 'students') {
      return (studentMarksDataset.data as { student_id: number; study_hours: number; marks: number }[])
        .map(row => ({
          x: row.study_hours,
          y: row.marks,
          label: row.marks >= 85 ? 'high score' : row.marks >= 65 ? 'solid score' : row.marks >= 45 ? 'pass zone' : 'needs support',
        }));
    }
    if (source === 'synthetic') {
      return generateSyntheticBlobs(90, 3 + (seed % 2)).map(row => ({ x: row.x, y: row.y, label: `blob-${row.label + 1}` }));
    }
    return parsePointCsv(pointCsv);
  }, [pointCsv, seed, source]);

  const pointX = useMemo(() => pointRows.map(point => [point.x, point.y]), [pointRows]);
  const studentTrend = useMemo(() => fitLine(source === 'students' ? pointRows : []), [pointRows, source]);
  const imageFeatures = useMemo(() => images.map(image => normalizeEmbedding(image.feature)), [images]);
  const imageProjection = useMemo(() => projectEmbeddings(imageFeatures), [imageFeatures]);
  const imageX = imageFeatures.length ? imageFeatures : [];
  const activeX = mode === 'images' ? imageX : pointX;
  const canCluster = activeX.length >= k && k >= 2;
  const pointResult = useMemo(() => mode === 'points' && canCluster ? kmeans(pointX, k, maxIter, init) : null, [canCluster, init, k, maxIter, mode, pointX]);
  const result = mode === 'images' ? imageResult : pointResult;
  const activeStep = result?.steps[Math.min(step, Math.max(result.steps.length - 1, 0))] ?? result?.steps[0];
  const displayedAssignments = mode === 'images'
    ? result?.assignments
    : activeStep?.assignments ?? result?.assignments;
  const displayedCentroids = mode === 'images'
    ? result?.centroids
    : activeStep?.centroids ?? result?.centroids;
  const canShowClusters = mode === 'images' ? Boolean(result) : canCluster;
  const elbow = useMemo(() => activeX.length >= 3 && (mode === 'points' || Boolean(result))
    ? elbowMethod(activeX, Math.min(8, activeX.length)).map((inertia, i) => ({ k: i + 2, inertia: Number(inertia.toFixed(2)) }))
    : [],
  [activeX, mode, result]);
  const movement = result?.steps.map(item => ({ iteration: item.iteration, inertia: Number(item.inertia.toFixed(3)) })) ?? [];
  const studentPrediction = useMemo(() => {
    if (source !== 'students') return null;
    const score = clamp(studentTrend.intercept + studentTrend.slope * studyHours, 0, 100);
    const cluster = result?.centroids?.length ? nearestCentroid([studyHours, score], result.centroids).cluster : null;
    return { score, cluster };
  }, [result, source, studentTrend, studyHours]);

  const plotData = mode === 'images'
    ? images.map((image, index) => ({
      x: imageProjection[index]?.[0] ?? image.x,
      y: imageProjection[index]?.[1] ?? image.y,
      label: image.group,
      name: image.name,
      cluster: displayedAssignments?.[index] ?? 0,
    }))
    : pointRows.map((point, index) => ({
      ...point,
      cluster: displayedAssignments?.[index] ?? 0,
    }));
  const predictedStudentPoint = source === 'students' && studentPrediction
    ? [{
      x: studyHours,
      y: studentPrediction.score,
      label: 'your input',
      cluster: studentPrediction.cluster ?? 0,
    }]
    : [];
  const centroids = (displayedCentroids ?? []).map((centroid, index) => {
    if (mode === 'images') {
      const projection = projectEmbeddings([centroid])[0] ?? [0, 0];
      return { x: projection[0], y: projection[1], cluster: index };
    }
    return { x: centroid[0], y: centroid[1], cluster: index };
  });
  const clusterCounts = Array.from({ length: k }, (_, cluster) => plotData.filter(point => point.cluster === cluster).length);
  const clusterLabels = useMemo(() => {
    if (mode !== 'images' || !result) return [];
    return Array.from({ length: k }, (_, cluster) => {
      const counts = new Map<string, number>();
      result.assignments.forEach((assigned, index) => {
        if (assigned !== cluster) return;
        const label = images[index]?.group ?? 'unknown';
        counts.set(label, (counts.get(label) ?? 0) + 1);
      });
      const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const total = ranked.reduce((sum, [, count]) => sum + count, 0);
      const [label = `cluster-${cluster + 1}`, count = 0] = ranked[0] ?? [];
      return { label, purity: total ? count / total : 0, total };
    });
  }, [images, k, mode, result]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setImageResult(null);
      setInference(null);
      setTrainingProgress(null);
    });
    return () => { cancelled = true; };
  }, [imageFeatures, init, k, maxIter]);

  const extractFeature = async (image: HTMLImageElement) => {
    const extractor = await ensureExtractor();
    const canvas = canvasRef.current ?? document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create image canvas.');
    ctx.clearRect(0, 0, 224, 224);
    ctx.drawImage(image, 0, 0, 224, 224);
    const activation = extractor.infer(canvas, true) as tf.Tensor;
    const feature = Array.from(await activation.data());
    activation.dispose();
    return { feature, preview: canvas.toDataURL('image/jpeg', 0.78) };
  };

  const loadAnimalDataset = async () => {
    const dataset = getAnimalDataset(datasetLimit);
    if (!dataset.length) {
      setImageStatus('No bundled animals dataset was found under src/data/animals-dataset.');
      return;
    }
    setMode('images');
    setLoadingImages(true);
    setInference(null);
    setImageResult(null);
    setTrainingProgress(null);
    setEmbeddingProgress({ phase: 'Loading and embedding images', current: 0, total: dataset.length });
    try {
      const imported: ImageSample[] = [];
      setImageStatus(`Embedding ${dataset.length} local animal images with TensorFlow.js MobileNet...`);
      for (const [index, item] of dataset.entries()) {
        const image = await loadImageFromUrl(item.url);
        const { feature, preview } = await extractFeature(image);
        imported.push({
          id: `dataset_${item.group}_${item.name}_${index}`,
          name: item.name,
          group: item.group,
          feature,
          preview,
          x: 0,
          y: 0,
          source: 'dataset',
        });
        if (index % 4 === 0) {
          setImageStatus(`Embedded ${index + 1}/${dataset.length} animal images...`);
        }
        setEmbeddingProgress({ phase: 'Loading and embedding images', current: index + 1, total: dataset.length });
        await tf.nextFrame();
      }
      setImages(imported);
      setK(Math.min(5, Math.max(2, new Set(imported.map(item => item.group)).size)));
      setStep(0);
      setImageStatus(`Ready: ${imported.length} image embeddings loaded. Click Train K-Means to cluster them.`);
    } catch (error) {
      setImageStatus(error instanceof Error ? error.message : 'Local animal dataset import failed.');
    } finally {
      setLoadingImages(false);
    }
  };

  const loadFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter(file => file.type.startsWith('image/'));
    if (!files.length) return;
    setMode('images');
    setLoadingImages(true);
    setInference(null);
    setImageResult(null);
    setTrainingProgress(null);
    setEmbeddingProgress({ phase: 'Loading and embedding images', current: 0, total: files.length });
    try {
      const imported: ImageSample[] = [];
      setImageStatus(`Embedding ${files.length} image${files.length === 1 ? '' : 's'} with TensorFlow.js...`);
      for (const [index, file] of files.entries()) {
        const image = await loadImage(file);
        const { feature, preview } = await extractFeature(image);
        const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        const parts = path.split('/');
        const group = parts.length > 1 ? parts[parts.length - 2] : file.name.split(/[-_\s.]/)[0] || 'image';
        imported.push({
          id: `${file.name}_${file.lastModified}_${index}`,
          name: file.name,
          group,
          feature,
          preview,
          x: 0,
          y: 0,
          source: 'upload',
        });
        setEmbeddingProgress({ phase: 'Loading and embedding images', current: index + 1, total: files.length });
        if (index % 4 === 0) await tf.nextFrame();
      }
      setImages(current => [...current, ...imported]);
      setStep(0);
      setImageStatus(`Loaded ${imported.length} image embeddings. Click Train K-Means to cluster them.`);
    } catch (error) {
      setImageStatus(error instanceof Error ? error.message : 'Image import failed.');
    } finally {
      setLoadingImages(false);
    }
  };

  const runInference = async (fileList: FileList | null) => {
    const file = Array.from(fileList ?? []).find(item => item.type.startsWith('image/'));
    if (!file || !result || !images.length) return;
    setLoadingImages(true);
    try {
      setImageStatus(`Embedding query image ${file.name}...`);
      const image = await loadImage(file);
      const { feature, preview } = await extractFeature(image);
      const normalized = normalizeEmbedding(feature);
      const nearest = nearestCentroid(normalized, result.centroids);
      const labelInfo = clusterLabels[nearest.cluster];
      const similarity = Math.max(0, Math.min(1, 1 / (1 + nearest.distance)));
      setInference({
        name: file.name,
        preview,
        group: labelInfo?.label ?? `Cluster ${nearest.cluster + 1}`,
        distance: nearest.distance,
        similarity: labelInfo ? similarity * labelInfo.purity : similarity,
      });
      setImageStatus(`Query image assigned to Cluster ${nearest.cluster + 1}.`);
    } catch (error) {
      setImageStatus(error instanceof Error ? error.message : 'Inference failed.');
    } finally {
      setLoadingImages(false);
    }
  };

  const trainImageClusters = async () => {
    if (mode !== 'images' || !canCluster || !imageX.length) return;
    setTrainingImages(true);
    setInference(null);
    setStep(0);
    setImageStatus(`Training K-Means on ${imageX.length} MobileNet image embeddings...`);
    setTrainingProgress({ phase: 'Training K-Means clusters', current: 0, total: maxIter });
    try {
      const trained = await trainKMeansWithProgress(imageX, k, maxIter, init, setTrainingProgress);
      setImageResult(trained);
      setStep(Math.max(trained.steps.length - 1, 0));
      setTrainingProgress({ phase: trained.converged ? 'Training converged' : 'Training complete', current: trained.steps.length || maxIter, total: trained.steps.length || maxIter });
      setImageStatus(`Training complete: ${imageX.length} images clustered into ${k} groups. You can now run inference on a new image.`);
    } catch (error) {
      setImageStatus(error instanceof Error ? error.message : 'K-Means training failed.');
    } finally {
      setTrainingImages(false);
    }
  };

  const loadPointDataset = (nextSource: PointSource) => {
    setMode('points');
    setSource(nextSource);
    setStep(0);
  };

  const addPoint = () => {
    const labels = ['dog-like', 'car-like', 'horse-like'];
    const next = parsePointCsv(pointCsv);
    const label = labels[next.length % labels.length];
    const angle = next.length * 1.7;
    next.push({ x: Number((Math.cos(angle) * 3).toFixed(2)), y: Number((Math.sin(angle) * 3).toFixed(2)), label });
    setSource('editable');
    setPointCsv(rowsToCsv(next));
    setStep(0);
  };

  const resetData = () => {
    setStep(0);
    setSeed(value => value + 1);
    if (mode === 'images') {
      setImages([]);
      setInference(null);
      setImageResult(null);
      setEmbeddingProgress(null);
      setTrainingProgress(null);
      setImageStatus('Image samples cleared. Load the bundled animals dataset or your own folders/files.');
    } else {
      setPointCsv(starterPointCsv);
      setSource('editable');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader
        title="K-Means Clustering"
        subtitle="Experiment with real editable numeric data or cluster dog/car/horse-style image folders using TensorFlow.js MobileNet embeddings."
        badge="Browser Trainable"
        category="Clustering"
        icon={<Network size={22} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card title="Experiment Mode">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <button onClick={() => { setMode('points'); setStep(0); }} className={`rounded px-3 py-2 font-semibold ${mode === 'points' ? 'bg-blue-600 text-white' : 'border border-gray-200 dark:border-gray-700'}`}>Point Data</button>
              <button onClick={() => { setMode('images'); setStep(0); }} className={`rounded px-3 py-2 font-semibold ${mode === 'images' ? 'bg-blue-600 text-white' : 'border border-gray-200 dark:border-gray-700'}`}>Image Data</button>
            </div>
          </Card>

          <Card title="Load Dataset" icon={<Upload size={14} />}>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <button onClick={() => loadPointDataset('students')} className={`rounded px-3 py-2 text-left font-semibold ${mode === 'points' && source === 'students' ? 'bg-blue-600 text-white' : 'border border-gray-200 dark:border-gray-700'}`}>
                Students: study hours vs score
                <span className="block text-xs font-normal opacity-80">120 records, score check input, cluster view</span>
              </button>
              <button onClick={() => loadPointDataset('mall')} className={`rounded px-3 py-2 text-left font-semibold ${mode === 'points' && source === 'mall' ? 'bg-blue-600 text-white' : 'border border-gray-200 dark:border-gray-700'}`}>
                Mall customers
                <span className="block text-xs font-normal opacity-80">Income vs spending score clustering</span>
              </button>
              <button onClick={() => loadPointDataset('synthetic')} className={`rounded px-3 py-2 text-left font-semibold ${mode === 'points' && source === 'synthetic' ? 'bg-blue-600 text-white' : 'border border-gray-200 dark:border-gray-700'}`}>
                Synthetic blobs
                <span className="block text-xs font-normal opacity-80">Generated cluster data</span>
              </button>
            </div>
          </Card>

          {mode === 'points' ? (
            <Card title="Point Dataset" icon={<Upload size={14} />}>
              <div className="space-y-3 text-sm">
                <select value={source} onChange={event => { setSource(event.target.value as PointSource); setStep(0); }} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                  <option value="editable">Editable dog/car/horse-like points</option>
                  <option value="students">Students: study hours vs score</option>
                  <option value="mall">Mall customers real table</option>
                  <option value="synthetic">Synthetic blobs</option>
                </select>
                {source === 'students' ? (
                  <div className="space-y-3 rounded border border-gray-200 p-3 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="font-semibold text-gray-500">Records</p>
                        <p className="text-lg font-bold text-blue-600">{studentMarksDataset.data.length}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-500">Model</p>
                        <p className="text-lg font-bold text-blue-600">Score trend</p>
                      </div>
                    </div>
                    <label className="block text-xs font-semibold text-gray-500">Study hours: <span className="font-mono text-blue-600">{studyHours.toFixed(1)}</span></label>
                    <input type="range" min={0.5} max={10.5} step={0.1} value={studyHours} onChange={event => setStudyHours(Number(event.target.value))} className="w-full accent-blue-600" />
                    <input type="number" min={0.5} max={10.5} step={0.1} value={studyHours} onChange={event => setStudyHours(Number(event.target.value))} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900" />
                    <InfoBox type="success" title="Study Hours Check">
                      Estimated score: {studentPrediction ? studentPrediction.score.toFixed(1) : '0.0'} / 100
                      {studentPrediction?.cluster !== null && studentPrediction?.cluster !== undefined ? ` - nearest cluster ${studentPrediction.cluster + 1}` : ''}
                    </InfoBox>
                  </div>
                ) : (
                  <textarea
                    value={pointCsv}
                    onChange={event => { setPointCsv(event.target.value); setSource('editable'); setStep(0); }}
                    rows={8}
                    className="w-full rounded border border-gray-200 bg-white p-3 font-mono text-xs dark:border-gray-700 dark:bg-gray-900"
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={source === 'students'} onClick={addPoint} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold disabled:opacity-50 dark:border-gray-700"><Plus size={14} /> Add Point</button>
                  <button onClick={() => downloadJson('kmeans-points.json', { rows: pointRows, k, result })} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold dark:border-gray-700">Export Data</button>
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Animal Image Clustering" icon={<ImageIcon size={14} />}>
              <canvas ref={canvasRef} className="hidden" />
              <div className="space-y-3 text-sm">
                <p className="text-xs text-gray-500">Use the local bear/cat/cow/dog/horse folders, or load mixed image folders. K-Means learns clusters from MobileNet features; folder names are used to name the clusters after training.</p>
                <div className="rounded border border-gray-200 p-3 dark:border-gray-700">
                  <label className="block text-xs font-semibold text-gray-500">Images per animal folder: <span className="font-mono text-blue-600">{datasetLimit}</span></label>
                  <input type="range" min={10} max={60} step={10} value={datasetLimit} onChange={event => setDatasetLimit(Number(event.target.value))} className="mt-2 w-full accent-blue-600" />
                  <button disabled={loadingImages} onClick={() => { void loadAnimalDataset(); }} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-50">
                    <Network size={14} /> Load Local Animals Dataset
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-semibold text-white">
                    <FileImage size={14} /> Files
                    <input type="file" accept="image/*" multiple className="hidden" onChange={event => { void loadFiles(event.currentTarget.files); event.currentTarget.value = ''; }} />
                  </label>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold dark:border-gray-700">
                    <FolderOpen size={14} /> Folders
                    <input
                      ref={element => {
                        element?.setAttribute('webkitdirectory', '');
                        element?.setAttribute('directory', '');
                      }}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={event => { void loadFiles(event.currentTarget.files); event.currentTarget.value = ''; }}
                    />
                  </label>
                </div>
                <ProgressBar progress={embeddingProgress} />
                <label className={`inline-flex w-full items-center justify-center gap-2 rounded px-3 py-2 font-semibold ${result && images.length ? 'cursor-pointer bg-emerald-600 text-white' : 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-gray-800'}`}>
                  <Target size={14} /> Inference Image
                  <input type="file" accept="image/*" disabled={!result || !images.length} className="hidden" onChange={event => { void runInference(event.currentTarget.files); event.currentTarget.value = ''; }} />
                </label>
                <button disabled={!result || !images.length} onClick={() => downloadJson('kmeans-animal-clusters.json', { k, labels: clusterLabels, assignments: result?.assignments, centroids: result?.centroids, images: images.map((image, index) => ({ name: image.name, group: image.group, source: image.source, cluster: result?.assignments[index] })) })} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold disabled:opacity-50 dark:border-gray-700">Export Clusters</button>
                <button onClick={() => { setImages([]); setInference(null); setImageResult(null); setEmbeddingProgress(null); setTrainingProgress(null); }} className="inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-semibold dark:border-gray-700"><Trash2 size={14} /> Clear Images</button>
                <InfoBox type={images.length ? 'success' : 'info'} title="Image Runtime">{loadingImages ? 'Embedding images...' : imageStatus}</InfoBox>
              </div>
            </Card>
          )}

          <Card title="K-Means Controls">
            <div className="space-y-4 text-sm">
              <label className="block text-xs font-semibold text-gray-500">K: <span className="font-mono text-blue-600">{k}</span></label>
              <input type="range" min={2} max={6} value={k} onChange={event => { setK(Number(event.target.value)); setStep(0); }} className="w-full accent-blue-600" />
              <label className="block text-xs font-semibold text-gray-500">Initialization</label>
              <select value={init} onChange={event => { setInit(event.target.value as 'random' | 'kmeans++'); setStep(0); }} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                <option value="kmeans++">K-means++</option>
                <option value="random">Random centroid initialization</option>
              </select>
              <label className="block text-xs font-semibold text-gray-500">Max iterations: <span className="font-mono text-blue-600">{maxIter}</span></label>
              <input type="range" min={3} max={60} value={maxIter} onChange={event => setMaxIter(Number(event.target.value))} className="w-full accent-blue-600" />
            </div>
          </Card>

          <Card title="Training Controls">
            <div className="flex gap-2">
              {mode === 'images' ? (
                <button disabled={!canCluster || loadingImages || trainingImages} onClick={() => { void trainImageClusters(); }} className="flex flex-1 items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Play size={14} /> Train K-Means</button>
              ) : (
                <button disabled={!result} onClick={() => setStep(s => Math.min(s + 1, Math.max((result?.steps.length ?? 1) - 1, 0)))} className="flex flex-1 items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Play size={14} /> Step</button>
              )}
              <button onClick={resetData} className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"><RotateCcw size={14} /> Reset</button>
            </div>
            <div className="mt-3 space-y-2">
              {mode === 'images' && <ProgressBar progress={trainingProgress} />}
              <p className="text-xs text-gray-500">
                {mode === 'images'
                  ? (result ? `Trained iterations: ${result.steps.length}` : 'Load images, then train K-Means to create clusters.')
                  : `Current iteration: ${activeStep?.iteration ?? 0} / ${Math.max((result?.steps.length ?? 1) - 1, 0)}`}
              </p>
            </div>
          </Card>

          <MetricsPanel
            title="Cluster Metrics"
            metrics={[
              { label: 'Inertia/SSE', value: result?.inertia ?? 0, format: 'fixed4', color: 'blue' },
              { label: mode === 'images' ? 'Image Embeddings' : 'Samples', value: activeX.length, format: 'number' },
              { label: 'Clusters', value: k, format: 'number' },
              { label: 'Converged', value: result?.converged ? 'Yes' : 'No' },
            ]}
          />
        </div>

        <div className="space-y-4">
          <Card title={mode === 'images' ? 'Image Embedding Clusters' : 'Centroids, Assignments, and Movement Path'}>
            {canShowClusters ? (
              <ResponsiveContainer width="100%" height={390}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" tick={{ fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Scatter name="Assigned samples" data={plotData}>
                    {plotData.map((point, index) => <Cell key={index} fill={colors[point.cluster % colors.length]} />)}
                  </Scatter>
                  {predictedStudentPoint.length > 0 && <Scatter name="Your study-hours check" data={predictedStudentPoint} fill="#111827" shape="diamond" />}
                  <Scatter name="Centroids" data={centroids} fill="#111827" shape="star" />
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
                {mode === 'images' && images.length >= k ? 'Click Train K-Means to create clusters.' : `Add at least ${k} ${mode === 'images' ? 'images' : 'points'} to cluster.`}
              </div>
            )}
          </Card>

          {mode === 'images' && (
            <Card title="Image Cluster Gallery">
              {inference && (
                <div className="mb-4 flex items-center gap-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                  <img src={inference.preview} alt="" className="h-16 w-16 rounded object-cover" />
                  <div>
                    <p className="font-bold text-emerald-700 dark:text-emerald-300">Inference: {inference.group}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{inference.name} nearest-cluster distance {inference.distance.toFixed(3)} - similarity score {(inference.similarity * 100).toFixed(1)}%</p>
                  </div>
                </div>
              )}
              {result ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {Array.from({ length: k }, (_, cluster) => (
                    <div key={cluster} className="rounded border border-gray-200 p-2 dark:border-gray-700">
                      <p className="mb-1 text-xs font-bold" style={{ color: colors[cluster % colors.length] }}>Cluster {cluster + 1} ({clusterCounts[cluster] ?? 0})</p>
                      <p className="mb-2 text-[11px] font-semibold text-gray-500">
                        {clusterLabels[cluster]?.label ?? 'unlabeled'} {clusterLabels[cluster]?.total ? `- ${(clusterLabels[cluster].purity * 100).toFixed(0)}% match` : ''}
                      </p>
                      <div className="grid grid-cols-3 gap-1">
                        {images.map((image, index) => ({ image, cluster: displayedAssignments?.[index] ?? -1 }))
                          .filter(item => item.cluster === cluster)
                          .slice(0, 12)
                          .map(({ image }) => <img key={image.id} src={image.preview} title={`${image.group} / ${image.name}`} alt="" className="aspect-square rounded object-cover" />)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                  {images.length ? 'Images are embedded. Click Train K-Means to build the clusters.' : 'Load animal images to begin.'}
                </div>
              )}
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Inertia by Iteration">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={movement}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="iteration" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="inertia" stroke="#2563eb" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Elbow Method">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={elbow}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="k" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="inertia" stroke="#059669" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <InfoBox type="success" title="Real Logic Cross-Check">
            Numeric mode clusters editable x/y rows. Image mode embeds your images with TensorFlow.js MobileNet, runs K-Means on the high-dimensional embedding vectors, then projects them to 2D only for visualization.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
