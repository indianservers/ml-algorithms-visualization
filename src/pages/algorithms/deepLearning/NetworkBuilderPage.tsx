import { useMemo, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { BrainCircuit, Download, Play, Plus, Trash2 } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';

type LayerConfig =
  | { id: string; type: 'dense'; units: number; activation: 'relu' | 'tanh' | 'sigmoid' }
  | { id: string; type: 'dropout'; rate: number }
  | { id: string; type: 'batchnorm' };
type DatasetName = 'xor' | 'circles' | 'moons' | 'spiral';
type Point = { x: number; y: number; label: number };
type HistoryPoint = { epoch: number; loss: number; accuracy: number; val_accuracy?: number };

const presets: Record<string, LayerConfig[]> = {
  Minimal: [{ id: 'dense_1', type: 'dense', units: 8, activation: 'tanh' }],
  Standard: [{ id: 'dense_1', type: 'dense', units: 32, activation: 'relu' }, { id: 'dense_2', type: 'dense', units: 16, activation: 'relu' }],
  Deep: [16, 32, 32, 16].map((units, index) => ({ id: `dense_${index}`, type: 'dense', units, activation: 'relu' as const })),
  Dropout: [{ id: 'dense_1', type: 'dense', units: 48, activation: 'relu' }, { id: 'dropout_1', type: 'dropout', rate: 0.2 }, { id: 'dense_2', type: 'dense', units: 24, activation: 'relu' }],
  BatchNorm: [{ id: 'dense_1', type: 'dense', units: 32, activation: 'relu' }, { id: 'bn_1', type: 'batchnorm' }, { id: 'dense_2', type: 'dense', units: 16, activation: 'relu' }],
};

function makeDataset(kind: DatasetName, count = 240): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const t = index / count;
    if (kind === 'xor') {
      const x = Math.random() * 2 - 1;
      const y = Math.random() * 2 - 1;
      return { x, y, label: x * y > 0 ? 1 : 0 };
    }
    if (kind === 'circles') {
      const r = index % 2 ? 0.72 + Math.random() * 0.18 : 0.25 + Math.random() * 0.16;
      const a = Math.random() * Math.PI * 2;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, label: index % 2 };
    }
    if (kind === 'moons') {
      const a = Math.random() * Math.PI;
      const upper = index % 2 === 0;
      return upper
        ? { x: Math.cos(a) * 0.75 - 0.1 + Math.random() * 0.08, y: Math.sin(a) * 0.55 + Math.random() * 0.08, label: 0 }
        : { x: 0.55 - Math.cos(a) * 0.75 + Math.random() * 0.08, y: -Math.sin(a) * 0.55 + 0.35 + Math.random() * 0.08, label: 1 };
    }
    const label = index % 2;
    const r = t;
    const a = t * Math.PI * 7 + label * Math.PI;
    return { x: Math.cos(a) * r + Math.random() * 0.08, y: Math.sin(a) * r + Math.random() * 0.08, label };
  });
}

function download(filename: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parameterCount(layers: LayerConfig[]) {
  let input = 2;
  let total = 0;
  layers.forEach(layer => {
    if (layer.type === 'dense') {
      total += input * layer.units + layer.units;
      input = layer.units;
    }
    if (layer.type === 'batchnorm') total += input * 4;
  });
  return total + input * 2 + 2;
}

export default function NetworkBuilderPage() {
  const boundaryRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<tf.Sequential | null>(null);
  const [datasetName, setDatasetName] = useState<DatasetName>('moons');
  const [dataset, setDataset] = useState(() => makeDataset('moons'));
  const [layers, setLayers] = useState<LayerConfig[]>(presets.Standard);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [training, setTraining] = useState(false);
  const [status, setStatus] = useState('Choose a preset or add layers, then train the network in your browser.');
  const totalParams = useMemo(() => parameterCount(layers), [layers]);

  const setDatasetKind = (kind: DatasetName) => {
    setDatasetName(kind);
    setDataset(makeDataset(kind));
  };

  const addLayer = (type: LayerConfig['type']) => {
    setLayers(current => [...current, type === 'dense'
      ? { id: `dense_${Date.now()}`, type, units: 16, activation: 'relu' }
      : type === 'dropout' ? { id: `drop_${Date.now()}`, type, rate: 0.2 } : { id: `bn_${Date.now()}`, type }]);
  };

  const buildModel = () => {
    const model = tf.sequential();
    let first = true;
    layers.forEach(layer => {
      if (layer.type === 'dense') {
        model.add(tf.layers.dense({ units: layer.units, activation: layer.activation, inputShape: first ? [2] : undefined }));
        first = false;
      } else if (layer.type === 'dropout') model.add(tf.layers.dropout({ rate: layer.rate }));
      else model.add(tf.layers.batchNormalization());
    });
    model.add(tf.layers.dense({ units: 2, activation: 'softmax', inputShape: first ? [2] : undefined }));
    model.compile({ optimizer: tf.train.adam(0.03), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
    return model;
  };

  const drawBoundary = async (model: tf.LayersModel) => {
    const canvas = boundaryRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const size = 320;
    canvas.width = size;
    canvas.height = size;
    const grid = 60;
    const points = Array.from({ length: grid * grid }, (_, index) => {
      const gx = index % grid;
      const gy = Math.floor(index / grid);
      return [gx / (grid - 1) * 2.4 - 1.2, gy / (grid - 1) * 2.4 - 1.2];
    });
    const input = tf.tensor2d(points, [points.length, 2]);
    const output = model.predict(input) as tf.Tensor;
    const values = Array.from(await output.data());
    input.dispose();
    output.dispose();
    for (let index = 0; index < points.length; index++) {
      const gx = index % grid;
      const gy = Math.floor(index / grid);
      const p1 = values[index * 2 + 1] ?? 0;
      ctx.fillStyle = p1 > 0.5 ? 'rgba(37,99,235,0.24)' : 'rgba(220,38,38,0.22)';
      ctx.fillRect((gx / grid) * size, (gy / grid) * size, size / grid + 1, size / grid + 1);
    }
    dataset.forEach(point => {
      ctx.beginPath();
      ctx.arc(((point.x + 1.2) / 2.4) * size, ((point.y + 1.2) / 2.4) * size, 3, 0, Math.PI * 2);
      ctx.fillStyle = point.label ? '#2563eb' : '#dc2626';
      ctx.fill();
    });
  };

  const train = async () => {
    setTraining(true);
    setHistory([]);
    modelRef.current?.dispose();
    const model = buildModel();
    modelRef.current = model;
    const xs = tf.tensor2d(dataset.flatMap(point => [point.x, point.y]), [dataset.length, 2]);
    const ys = tf.tensor2d(dataset.flatMap(point => point.label ? [0, 1] : [1, 0]), [dataset.length, 2]);
    await model.fit(xs, ys, {
      epochs: 45,
      batchSize: 24,
      validationSplit: 0.2,
      shuffle: true,
      callbacks: {
        onEpochEnd: async (epoch, logs) => {
          setHistory(current => [...current, {
            epoch: epoch + 1,
            loss: Number((logs?.loss as number ?? 0).toFixed(4)),
            accuracy: Number(((logs?.acc as number | undefined) ?? (logs?.accuracy as number | undefined) ?? 0).toFixed(4)),
            val_accuracy: Number(((logs?.val_acc as number | undefined) ?? (logs?.val_accuracy as number | undefined) ?? 0).toFixed(4)),
          }]);
          if (epoch % 5 === 0) await drawBoundary(model);
          await tf.nextFrame();
        },
      },
    });
    await drawBoundary(model);
    xs.dispose();
    ys.dispose();
    setTraining(false);
    setStatus('Training complete. The decision boundary shows what the architecture learned.');
  };

  const python = [
    'model = tf.keras.Sequential([',
    '  tf.keras.layers.Input(shape=(2,)),',
    ...layers.map(layer => layer.type === 'dense'
      ? `  tf.keras.layers.Dense(${layer.units}, activation='${layer.activation}'),`
      : layer.type === 'dropout' ? `  tf.keras.layers.Dropout(${layer.rate}),` : '  tf.keras.layers.BatchNormalization(),'),
    '  tf.keras.layers.Dense(2, activation="softmax"),',
    '])',
  ].join('\n');

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Network Builder" subtitle="Design, train, visualize, and export neural network architectures directly in the browser." badge="Browser Trainable" category="Deep Learning" icon={<BrainCircuit size={22} />} />

      <div className="grid gap-6 xl:grid-cols-[300px_1fr_340px]">
        <div className="space-y-4">
          <Card title="Layer Palette">
            <div className="grid gap-2">
              <button onClick={() => addLayer('dense')} className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white"><Plus size={14} /> Dense</button>
              <button onClick={() => addLayer('dropout')} className="rounded border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700">Dropout</button>
              <button onClick={() => addLayer('batchnorm')} className="rounded border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700">BatchNorm</button>
            </div>
          </Card>
          <Card title="Presets">
            <div className="grid gap-2">{Object.entries(presets).map(([name, preset]) => <button key={name} onClick={() => setLayers(preset.map(layer => ({ ...layer, id: `${layer.id}_${Date.now()}` }))) } className="rounded border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700">{name}</button>)}</div>
          </Card>
          <Card title="Dataset">
            <select value={datasetName} onChange={event => setDatasetKind(event.target.value as DatasetName)} className="w-full rounded border border-gray-200 bg-white p-2 text-sm font-bold dark:border-gray-700 dark:bg-gray-900">
              <option value="xor">XOR</option><option value="circles">Circles</option><option value="moons">Moons</option><option value="spiral">Spiral</option>
            </select>
            <button onClick={() => setDataset(makeDataset(datasetName))} className="mt-2 w-full rounded border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700">Regenerate</button>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Architecture" subtitle={`Total: ${totalParams.toLocaleString()} params`}>
            <svg viewBox="0 0 760 230" className="h-[230px] w-full rounded bg-gray-50 dark:bg-gray-900">
              {([{ id: 'input', type: 'input' as const }, ...layers, { id: 'output', type: 'output' as const }] as Array<LayerConfig | { id: string; type: 'input' | 'output' }>).map((layer, index, all) => {
                const x = 55 + index * (650 / Math.max(1, all.length - 1));
                const neurons = layer.type === 'dense' ? Math.min(8, layer.units) : layer.type === 'input' || layer.type === 'output' ? 2 : 1;
                return (
                  <g key={layer.id}>
                    {index < all.length - 1 && <line x1={x + 35} x2={55 + (index + 1) * (650 / Math.max(1, all.length - 1)) - 35} y1={112} y2={112} stroke="#94a3b8" strokeWidth={2} opacity={0.65} />}
                    {Array.from({ length: neurons }, (_, neuron) => <circle key={neuron} cx={x} cy={72 + neuron * (84 / Math.max(1, neurons - 1))} r={9} fill={layer.type === 'output' ? '#059669' : layer.type === 'input' ? '#64748b' : '#2563eb'} opacity={0.9} />)}
                    <text x={x} y={185} textAnchor="middle" className="fill-gray-700 text-[11px] font-bold dark:fill-gray-200">{layer.type === 'dense' ? `Dense ${layer.units}` : layer.type}</text>
                    {layer.type === 'dense' && layer.units > 8 && <text x={x} y={202} textAnchor="middle" className="fill-gray-500 text-[10px]">+{layer.units - 8} more</text>}
                  </g>
                );
              })}
            </svg>
            <div className="mt-3 space-y-2">
              {layers.map((layer, index) => (
                <div key={layer.id} className="flex items-center gap-2 rounded border border-gray-200 p-2 text-sm dark:border-gray-700">
                  <span className="w-8 text-xs font-bold text-gray-500">{index + 1}</span>
                  {layer.type === 'dense' ? (
                    <>
                      <span className="font-bold">Dense</span>
                      <input type="number" value={layer.units} min={2} max={128} onChange={event => setLayers(current => current.map(item => item.id === layer.id ? { ...layer, units: Number(event.target.value) } : item))} className="w-20 rounded border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900" />
                      <select value={layer.activation} onChange={event => setLayers(current => current.map(item => item.id === layer.id ? { ...layer, activation: event.target.value as 'relu' | 'tanh' | 'sigmoid' } : item))} className="rounded border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900"><option value="relu">relu</option><option value="tanh">tanh</option><option value="sigmoid">sigmoid</option></select>
                    </>
                  ) : layer.type === 'dropout' ? <><span className="font-bold">Dropout</span><input type="number" step={0.05} min={0.05} max={0.8} value={layer.rate} onChange={event => setLayers(current => current.map(item => item.id === layer.id ? { ...layer, rate: Number(event.target.value) } : item))} className="w-20 rounded border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900" /></> : <span className="font-bold">BatchNorm</span>}
                  <button onClick={() => setLayers(current => current.filter(item => item.id !== layer.id))} className="ml-auto rounded p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Decision Boundary"><canvas ref={boundaryRef} className="aspect-square w-full rounded bg-white dark:bg-gray-950" /></Card>
            <Card title="Training Curves">
              {history.length ? <ResponsiveContainer width="100%" height={300}><LineChart data={history}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="epoch" /><YAxis domain={[0, 1]} /><Tooltip /><Legend /><Line dataKey="accuracy" stroke="#2563eb" dot={false} /><Line dataKey="val_accuracy" stroke="#059669" dot={false} /></LineChart></ResponsiveContainer> : <p className="text-sm text-gray-500">Train to see accuracy curves.</p>}
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <Card title="Train">
            <button disabled={training} onClick={() => void train()} className="inline-flex w-full items-center justify-center gap-2 rounded bg-emerald-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-50"><Play size={15} /> {training ? 'Training...' : 'Train Network'}</button>
            <InfoBox type="info">{status}</InfoBox>
          </Card>
          <Card title="Export">
            <div className="grid gap-2">
              <button onClick={() => download('architecture.json', JSON.stringify({ layers, dataset: datasetName, history: history.at(-1) }, null, 2), 'application/json')} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700"><Download size={14} /> Architecture JSON</button>
              <button onClick={() => download('network.py', python, 'text/x-python')} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700"><Download size={14} /> Python code</button>
            </div>
            <pre className="mt-3 max-h-72 overflow-auto rounded bg-gray-950 p-3 text-xs text-gray-100">{python}</pre>
          </Card>
        </div>
      </div>
    </div>
  );
}
