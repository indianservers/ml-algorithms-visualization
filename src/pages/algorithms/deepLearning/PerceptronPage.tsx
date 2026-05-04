import { useMemo, useState } from 'react';
import { Line, LineChart, Scatter, ScatterChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Brain, Play, RotateCcw } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { trainPerceptron, predictPerceptron, ActivationFn } from '../../../lib/algorithms/neural/perceptron';

const makeData = (version: number) => Array.from({ length: 70 }, (_, i) => {
  const refreshOffset = version % 1;
  const label = i % 2;
  const x = (label ? 1.2 + Math.random() * 1.6 : -2.7 + Math.random() * 1.8) + refreshOffset;
  const y = (label ? 0.4 + Math.random() * 1.8 : -1.4 + Math.random() * 1.8) + refreshOffset;
  return { x, y, label };
});

export default function PerceptronPage() {
  const [lr, setLr] = useState(0.12);
  const [epochs, setEpochs] = useState(30);
  const [activation, setActivation] = useState<ActivationFn>('step');
  const [version, setVersion] = useState(0);
  const [epochStep, setEpochStep] = useState(0);

  const data = useMemo(() => makeData(version), [version]);
  const X = useMemo(() => data.map(point => [point.x, point.y]), [data]);
  const y = useMemo(() => data.map(point => point.label), [data]);
  const trained = useMemo(() => trainPerceptron(X, y, lr, epochs, activation), [X, y, lr, epochs, activation]);
  const active = trained.steps[Math.min(epochStep, trained.steps.length - 1)] ?? trained.steps[0];
  const weights = active?.weights ?? trained.weights;
  const bias = active?.bias ?? trained.bias;
  const predictions = X.map(row => predictPerceptron(row, weights, bias));
  const accuracy = predictions.filter((pred, i) => pred === y[i]).length / y.length;
  const boundary = [-3, 3].map(xValue => ({ x: xValue, y: weights[1] === 0 ? 0 : -(weights[0] * xValue + bias) / weights[1] }));
  const errorCurve = trained.steps.map(step => ({ epoch: step.epoch, errors: step.errors }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Perceptron" subtitle="Real browser-side perceptron updates with weights, bias, activation, mistakes, and a moving decision boundary." badge="Beginner" category="Deep Learning" icon={<Brain size={22} />} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Weights and Training Controls">
            <div className="space-y-4 text-sm">
              <label className="block text-xs font-semibold text-gray-500">Learning rate: <span className="font-mono text-blue-600">{lr.toFixed(2)}</span></label>
              <input type="range" min={0.01} max={0.5} step={0.01} value={lr} onChange={event => setLr(Number(event.target.value))} className="w-full accent-blue-600" />
              <label className="block text-xs font-semibold text-gray-500">Max epochs: <span className="font-mono text-blue-600">{epochs}</span></label>
              <input type="range" min={5} max={80} value={epochs} onChange={event => setEpochs(Number(event.target.value))} className="w-full accent-blue-600" />
              <select value={activation} onChange={event => setActivation(event.target.value as ActivationFn)} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                <option value="step">Step activation</option>
                <option value="sigmoid">Sigmoid rounded activation</option>
                <option value="tanh">Tanh rounded activation</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setEpochStep(s => Math.min(s + 1, trained.steps.length - 1))} className="flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-semibold text-white"><Play size={14} /> Epoch</button>
                <button onClick={() => { setVersion(v => v + 1); setEpochStep(0); }} className="flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 dark:border-gray-700"><RotateCcw size={14} /> Reset</button>
              </div>
            </div>
          </Card>

          <MetricsPanel title="Perceptron Metrics" metrics={[
            { label: 'Accuracy', value: accuracy, format: 'percent', color: 'green' },
            { label: 'Errors', value: active?.errors ?? 0, format: 'number', color: active?.errors ? 'red' : 'green' },
            { label: 'Weight w1', value: weights[0] ?? 0, format: 'fixed4' },
            { label: 'Bias', value: bias, format: 'fixed4' },
          ]} />
        </div>

        <div className="space-y-4">
          <Card title="Decision Boundary and Misclassification Updates">
            <ResponsiveContainer width="100%" height={390}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="y" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Scatter data={data}>
                  {data.map((point, i) => <Cell key={i} fill={point.label ? '#059669' : '#2563eb'} />)}
                </Scatter>
                <Scatter data={boundary} line={{ stroke: '#dc2626', strokeWidth: 2 }} fill="#dc2626" />
              </ScatterChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="Epoch Error Curve">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={errorCurve}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="epoch" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line dataKey="errors" stroke="#dc2626" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Current Model">
              <div className="space-y-2 text-sm">
                <p className="font-mono">z = {weights[0]?.toFixed(3)} * x1 + {weights[1]?.toFixed(3)} * x2 + {bias.toFixed(3)}</p>
                <p className="font-mono">activation = {activation}</p>
                <p className="font-mono">epoch = {active?.epoch ?? 0}</p>
              </div>
            </Card>
          </div>

          <InfoBox type="info" title="Real Logic Cross-Check">
            For every sample, prediction is activation(w.x + b). On mistake, weights update by w = w + learning_rate * error * x and bias updates by learning_rate * error.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
