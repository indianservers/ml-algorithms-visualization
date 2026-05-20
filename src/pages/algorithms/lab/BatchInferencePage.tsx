import { useEffect, useMemo, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, FolderOpen, Play, Search } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { loadModelMetadata, type SavedModelMetadata } from '../../../stores/experimentStore';

type ImageItem = { filename: string; url: string; file: File };
type Result = { filename: string; thumbnail: string; predictedClass: string; confidence: number; probs: number[] };

function download(filename: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

export default function BatchInferencePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<tf.LayersModel | null>(null);
  const [savedModels, setSavedModels] = useState<SavedModelMetadata[]>([]);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [weightsFile, setWeightsFile] = useState<File | null>(null);
  const [labelsText, setLabelsText] = useState('class 0\nclass 1');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [threshold, setThreshold] = useState(0.7);
  const [classFilter, setClassFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'confidence' | 'filename' | 'class'>('confidence');
  const [progress, setProgress] = useState('');
  const [status, setStatus] = useState('Upload a TFjs model and an image folder, then run batch inference.');
  const [modelReady, setModelReady] = useState(false);

  useEffect(() => {
    void loadModelMetadata().then(setSavedModels);
  }, []);

  useEffect(() => () => {
    modelRef.current?.dispose();
    images.forEach(item => URL.revokeObjectURL(item.url));
  }, [images]);

  const labels = useMemo(() => labelsText.split(/\r?\n/).map(item => item.trim()).filter(Boolean), [labelsText]);
  const filtered = useMemo(() => [...results]
    .filter(item => classFilter === 'all' || item.predictedClass === classFilter)
    .sort((a, b) => sortBy === 'confidence' ? b.confidence - a.confidence : sortBy === 'filename' ? a.filename.localeCompare(b.filename) : a.predictedClass.localeCompare(b.predictedClass)),
  [classFilter, results, sortBy]);
  const distribution = useMemo(() => labels.map(label => ({ label, count: results.filter(item => item.predictedClass === label).length })), [labels, results]);
  const confidenceBins = useMemo(() => Array.from({ length: 10 }, (_, index) => {
    const low = index / 10;
    const high = (index + 1) / 10;
    return { bin: `${Math.round(low * 100)}-${Math.round(high * 100)}%`, count: results.filter(item => item.confidence >= low && (index === 9 ? item.confidence <= high : item.confidence < high)).length };
  }), [results]);

  const loadModel = async () => {
    if (!jsonFile || !weightsFile) {
      setStatus('Choose model.json and weights.bin.');
      return;
    }
    await tf.ready();
    setModelReady(false);
    modelRef.current?.dispose();
    modelRef.current = await tf.loadLayersModel(tf.io.browserFiles([jsonFile, weightsFile]));
    setModelReady(true);
    setStatus('Model loaded. Choose an image folder and run all.');
  };

  const addImages = (files: FileList | null) => {
    images.forEach(item => URL.revokeObjectURL(item.url));
    const next = Array.from(files ?? []).filter(file => file.type.startsWith('image/')).map(file => ({ filename: file.webkitRelativePath || file.name, file, url: URL.createObjectURL(file) }));
    setImages(next);
    setResults([]);
    setProgress(`Loaded ${next.length} images.`);
  };

  const imageTensor = async (item: ImageItem, size: number) => {
    const image = await loadImage(item.url);
    const canvas = canvasRef.current ?? document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable.');
    ctx.drawImage(image, 0, 0, size, size);
    return {
      tensor: tf.browser.fromPixels(canvas).toFloat().div(255),
      thumbnail: canvas.toDataURL('image/jpeg', 0.75),
    };
  };

  const runAll = async () => {
    const model = modelRef.current;
    if (!model) {
      setStatus('Load a model first.');
      return;
    }
    const inputShape = model.inputs[0]?.shape ?? [1, 64, 64, 3];
    const size = Number(inputShape[1] ?? 64);
    const batchSize = 16;
    const nextResults: Result[] = [];
    for (let start = 0; start < images.length; start += batchSize) {
      const batch = images.slice(start, start + batchSize);
      const tensors = await Promise.all(batch.map(item => imageTensor(item, size)));
      const xs = tf.stack(tensors.map(item => item.tensor));
      const output = model.predict(xs) as tf.Tensor;
      const data = Array.from(await output.data());
      const outputCount = output.shape.at(-1) ?? labels.length;
      output.dispose();
      xs.dispose();
      tensors.forEach(item => item.tensor.dispose());
      batch.forEach((item, batchIndex) => {
        const probs = data.slice(batchIndex * outputCount, (batchIndex + 1) * outputCount);
        const best = probs.reduce((winner, value, index) => value > probs[winner] ? index : winner, 0);
        nextResults.push({ filename: item.filename, thumbnail: tensors[batchIndex].thumbnail, predictedClass: labels[best] ?? `class ${best}`, confidence: probs[best] ?? 0, probs });
      });
      setResults([...nextResults]);
      setProgress(`Processing ${Math.min(images.length, start + batch.length)} / ${images.length}...`);
      await tf.nextFrame();
    }
    setStatus(`Processed ${nextResults.length} images. ${nextResults.filter(item => item.confidence < threshold).length} need review below threshold.`);
  };

  const exportCsv = (onlyLow = false) => {
    const rows = (onlyLow ? results.filter(item => item.confidence < threshold) : results);
    download('batch-inference.csv', [
      ['filename', 'predicted_class', 'confidence', ...labels.map(label => `${label}_prob`)].join(','),
      ...rows.map(item => [item.filename, item.predictedClass, item.confidence.toFixed(4), ...item.probs.map(value => value.toFixed(4))].join(',')),
    ].join('\n'), 'text/csv');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Batch Inference" subtitle="Run a trained TensorFlow.js model against an image folder, inspect low-confidence predictions, and export results." badge="Browser Inference" category="Lab" icon={<FolderOpen size={22} />} />
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Load Model">
            <div className="space-y-3 text-sm">
              <select className="w-full rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900" onChange={event => {
                const model = savedModels.find(item => item.id === event.target.value);
                if (model && Array.isArray(model.parameters?.labels)) setLabelsText(model.parameters.labels.map(String).join('\n'));
              }}>
                <option value="">Saved metadata labels...</option>
                {savedModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
              <label className="block font-semibold">model.json<input type="file" accept=".json,application/json" onChange={event => setJsonFile(event.target.files?.[0] ?? null)} className="mt-2 w-full rounded border border-gray-200 p-2 dark:border-gray-700" /></label>
              <label className="block font-semibold">weights.bin<input type="file" accept=".bin" onChange={event => setWeightsFile(event.target.files?.[0] ?? null)} className="mt-2 w-full rounded border border-gray-200 p-2 dark:border-gray-700" /></label>
              <button onClick={loadModel} className="w-full rounded bg-blue-600 px-3 py-2 font-bold text-white">Load model</button>
              <textarea value={labelsText} onChange={event => setLabelsText(event.target.value)} rows={5} className="w-full rounded border border-gray-200 bg-white p-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-900" />
            </div>
          </Card>

          <Card title="Images">
            <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-gray-200 px-3 py-3 text-sm font-bold dark:border-gray-700">
              <FolderOpen size={14} /> Upload Folder
              <input ref={element => { element?.setAttribute('webkitdirectory', ''); element?.setAttribute('directory', ''); }} type="file" accept="image/*" multiple className="hidden" onChange={event => addImages(event.target.files)} />
            </label>
            <p className="mt-2 text-sm text-gray-500">{images.length} images loaded</p>
            <button onClick={() => void runAll()} disabled={!images.length || !modelReady} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><Play size={14} /> Run all</button>
          </Card>

          <Card title="Filters">
            <label className="block text-sm font-bold">Confidence threshold: {threshold.toFixed(2)}<input type="range" min={0.3} max={0.99} step={0.01} value={threshold} onChange={event => setThreshold(Number(event.target.value))} className="mt-2 w-full accent-blue-600" /></label>
            <select value={classFilter} onChange={event => setClassFilter(event.target.value)} className="mt-3 w-full rounded border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-900"><option value="all">All classes</option>{labels.map(label => <option key={label} value={label}>{label}</option>)}</select>
            <select value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)} className="mt-3 w-full rounded border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-900"><option value="confidence">Sort by confidence</option><option value="filename">Sort by filename</option><option value="class">Sort by class</option></select>
          </Card>
        </div>

        <div className="space-y-4">
          <InfoBox type={results.length ? 'success' : 'info'} title="Status">{progress || status}</InfoBox>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Predicted Class Distribution">
              <ResponsiveContainer width="100%" height={220}><BarChart data={distribution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#2563eb" /></BarChart></ResponsiveContainer>
            </Card>
            <Card title="Confidence Histogram">
              <ResponsiveContainer width="100%" height={220}><BarChart data={confidenceBins}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="bin" hide /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#059669" /></BarChart></ResponsiveContainer>
            </Card>
          </div>

          <Card title="Results" actions={<div className="flex gap-2"><button onClick={() => exportCsv(false)} className="inline-flex items-center gap-2 rounded border border-gray-200 px-2 py-1 text-xs font-bold dark:border-gray-700"><Download size={12} /> CSV</button><button onClick={() => download('batch-inference.json', JSON.stringify(results, null, 2), 'application/json')} className="inline-flex items-center gap-2 rounded border border-gray-200 px-2 py-1 text-xs font-bold dark:border-gray-700"><Download size={12} /> JSON</button><button onClick={() => exportCsv(true)} className="inline-flex items-center gap-2 rounded border border-amber-200 px-2 py-1 text-xs font-bold text-amber-700 dark:border-amber-800"><Search size={12} /> Low only</button></div>}>
            <div className="max-h-[620px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs uppercase text-gray-500 dark:bg-gray-950"><tr><th className="p-2">Image</th><th className="p-2">Filename</th><th className="p-2">Class</th><th className="p-2">Confidence</th><th className="p-2">Probabilities</th></tr></thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.filename} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="p-2"><img src={item.thumbnail} alt="" className="h-12 w-12 rounded object-cover" /></td>
                      <td className="max-w-[280px] truncate p-2">{item.filename}</td>
                      <td className="p-2 font-bold">{item.predictedClass}</td>
                      <td className={`p-2 font-bold ${item.confidence >= threshold ? 'text-green-600' : 'text-amber-600'}`}>{(item.confidence * 100).toFixed(1)}%</td>
                      <td className="p-2 text-xs text-gray-500">{item.probs.map((value, index) => `${labels[index] ?? index}: ${(value * 100).toFixed(0)}%`).join(' | ')}</td>
                    </tr>
                  ))}
                  {!filtered.length && <tr><td colSpan={5} className="p-8 text-center text-gray-500">No predictions yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
