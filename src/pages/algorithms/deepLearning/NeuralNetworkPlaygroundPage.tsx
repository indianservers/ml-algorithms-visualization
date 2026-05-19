import { useMemo, useState } from 'react';
import { Brain, Play } from 'lucide-react';
import { Line, LineChart, Scatter, ScatterChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { generateSyntheticMoons, generateSyntheticCircles } from '../../../data/sampleDatasets';

type Activation = 'tanh' | 'sigmoid' | 'relu';

const act = (x: number, fn: Activation) => fn === 'relu' ? Math.max(0, x) : fn === 'sigmoid' ? 1 / (1 + Math.exp(-x)) : Math.tanh(x);
const dAct = (y: number, fn: Activation) => fn === 'relu' ? (y > 0 ? 1 : 0) : fn === 'sigmoid' ? y * (1 - y) : 1 - y * y;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function trainTinyMlp(X: number[][], y: number[], hidden: number, lr: number, epochs: number, activation: Activation) {
  const w1 = Array.from({ length: hidden }, (_, h) => [Math.sin(h + 1) * 0.5, Math.cos(h + 2) * 0.5]);
  const b1 = Array(hidden).fill(0);
  let w2 = Array.from({ length: hidden }, (_, h) => Math.sin(h + 3) * 0.5);
  let b2 = 0;
  const losses: { epoch: number; loss: number; accuracy: number }[] = [];

  for (let epoch = 0; epoch < epochs; epoch++) {
    let loss = 0;
    let correct = 0;
    for (let i = 0; i < X.length; i++) {
      const hiddenOut = w1.map((weights, h) => act(weights[0] * X[i][0] + weights[1] * X[i][1] + b1[h], activation));
      const z2 = hiddenOut.reduce((sum, value, h) => sum + value * w2[h], b2);
      const pred = sigmoid(z2);
      loss += -(y[i] * Math.log(pred + 1e-9) + (1 - y[i]) * Math.log(1 - pred + 1e-9));
      correct += (pred >= 0.5 ? 1 : 0) === y[i] ? 1 : 0;

      const dz2 = pred - y[i];
      const oldW2 = [...w2];
      w2 = w2.map((weight, h) => weight - lr * dz2 * hiddenOut[h]);
      b2 -= lr * dz2;
      for (let h = 0; h < hidden; h++) {
        const dz1 = dz2 * oldW2[h] * dAct(hiddenOut[h], activation);
        w1[h][0] -= lr * dz1 * X[i][0];
        w1[h][1] -= lr * dz1 * X[i][1];
        b1[h] -= lr * dz1;
      }
    }
    if (epoch % 5 === 0 || epoch === epochs - 1) losses.push({ epoch, loss: Number((loss / X.length).toFixed(4)), accuracy: Number((correct / X.length).toFixed(4)) });
  }

  const predict = (x: number[]) => {
    const hiddenOut = w1.map((weights, h) => act(weights[0] * x[0] + weights[1] * x[1] + b1[h], activation));
    return sigmoid(hiddenOut.reduce((sum, value, h) => sum + value * w2[h], b2));
  };

  return { losses, predict, params: { w1, b1, w2, b2 } };
}

export default function NeuralNetworkPlaygroundPage() {
  const [dataset, setDataset] = useState<'moons' | 'circles'>('moons');
  const [hidden, setHidden] = useState(8);
  const [lr, setLr] = useState(0.05);
  const [epochs, setEpochs] = useState(120);
  const [activation, setActivation] = useState<Activation>('tanh');
  const [runs, setRuns] = useState(0);

  const points = useMemo(() => {
    const sampleCount = 120 + (runs % 1);
    return dataset === 'moons' ? generateSyntheticMoons(sampleCount) : generateSyntheticCircles(sampleCount);
  }, [dataset, runs]);
  const X = points.map(point => [point.x, point.y]);
  const y = points.map(point => point.label);
  const model = useMemo(() => trainTinyMlp(X, y, hidden, lr, epochs, activation), [X, y, hidden, lr, epochs, activation]);
  const latest = model.losses[model.losses.length - 1];
  const boundary = Array.from({ length: 25 }, (_, xi) => Array.from({ length: 25 }, (_, yi) => {
    const x = -2.8 + xi * 0.23;
    const yy = -2.2 + yi * 0.2;
    return { x, y: yy, probability: model.predict([x, yy]) };
  })).flat();

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Neural Network Playground" subtitle="Real tiny MLP trained in the browser with hidden neurons, activation, learning rate, loss curve, and decision boundary." badge="Browser Trainable" category="Deep Learning" icon={<Brain size={22} />} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Network Controls">
            <div className="space-y-4 text-sm">
              <select value={dataset} onChange={event => setDataset(event.target.value as 'moons' | 'circles')} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                <option value="moons">Synthetic moons</option>
                <option value="circles">Synthetic circles</option>
              </select>
              <label className="block text-xs font-semibold text-gray-500">Hidden neurons: <span className="font-mono text-blue-600">{hidden}</span></label>
              <input type="range" min={2} max={16} value={hidden} onChange={event => setHidden(Number(event.target.value))} className="w-full accent-blue-600" />
              <label className="block text-xs font-semibold text-gray-500">Learning rate: <span className="font-mono text-blue-600">{lr.toFixed(3)}</span></label>
              <input type="range" min={0.005} max={0.2} step={0.005} value={lr} onChange={event => setLr(Number(event.target.value))} className="w-full accent-blue-600" />
              <label className="block text-xs font-semibold text-gray-500">Epochs: <span className="font-mono text-blue-600">{epochs}</span></label>
              <input type="range" min={20} max={300} step={10} value={epochs} onChange={event => setEpochs(Number(event.target.value))} className="w-full accent-blue-600" />
              <select value={activation} onChange={event => setActivation(event.target.value as Activation)} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                <option value="tanh">tanh</option>
                <option value="sigmoid">sigmoid</option>
                <option value="relu">relu</option>
              </select>
              <button onClick={() => setRuns(r => r + 1)} className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-semibold text-white"><Play size={14} /> Regenerate and Train</button>
            </div>
          </Card>
          <MetricsPanel title="Training Metrics" metrics={[
            { label: 'Loss', value: latest?.loss ?? 0, format: 'fixed4', color: 'blue' },
            { label: 'Train Accuracy', value: latest?.accuracy ?? 0, format: 'percent', color: 'green' },
            { label: 'Hidden', value: hidden, format: 'number' },
            { label: 'Params', value: hidden * 4 + 1, format: 'number' },
          ]} />
        </div>

        <div className="space-y-4">
          <Card title="Live Decision Boundary">
            <ResponsiveContainer width="100%" height={390}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="y" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Scatter data={boundary} opacity={0.24}>
                  {boundary.map((point, i) => <Cell key={i} fill={point.probability >= 0.5 ? '#059669' : '#2563eb'} />)}
                </Scatter>
                <Scatter data={points}>
                  {points.map((point, i) => <Cell key={i} fill={point.label ? '#065f46' : '#1d4ed8'} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Training Loss and Accuracy">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={model.losses}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epoch" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line yAxisId={0} dataKey="loss" stroke="#dc2626" strokeWidth={2} dot={false} />
                  <Line yAxisId={0} dataKey="accuracy" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Model Summary">
              <div className="space-y-2 text-xs font-mono">
                <p>Input layer: 2 features</p>
                <p>Hidden layer: {hidden} neurons, {activation}</p>
                <p>Output layer: sigmoid probability</p>
                <p>Optimizer: stochastic gradient descent</p>
                <p>Output bias: {model.params.b2.toFixed(4)}</p>
              </div>
            </Card>
          </div>

          <InfoBox type="info" title="Real Logic Cross-Check">
            This page performs forward pass, binary cross-entropy, backpropagation, and stochastic gradient descent in TypeScript for a one-hidden-layer neural network.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
