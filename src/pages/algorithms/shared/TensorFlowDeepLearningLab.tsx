import { useMemo, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { Brain, Play } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';

type Mode = 'cnn' | 'rnn' | 'lstm' | 'gru';

const copy: Record<Mode, { title: string; subtitle: string; inputShape: string; output: string }> = {
  cnn: {
    title: 'CNN',
    subtitle: 'Real TensorFlow.js convolutional neural network trained on synthetic 8x8 image patterns.',
    inputShape: '8 x 8 x 1 grayscale image',
    output: 'vertical-bar vs horizontal-bar class probability',
  },
  rnn: {
    title: 'RNN',
    subtitle: 'Real TensorFlow.js SimpleRNN sequence classifier trained on synthetic rising/falling signals.',
    inputShape: '12 time steps x 1 feature',
    output: 'rising vs falling sequence class probability',
  },
  lstm: {
    title: 'LSTM',
    subtitle: 'Real TensorFlow.js LSTM sequence classifier with gated recurrent memory.',
    inputShape: '12 time steps x 1 feature',
    output: 'rising vs falling sequence class probability',
  },
  gru: {
    title: 'GRU',
    subtitle: 'Real TensorFlow.js GRU sequence classifier with update/reset gates.',
    inputShape: '12 time steps x 1 feature',
    output: 'rising vs falling sequence class probability',
  },
};

function imageSample(index: number) {
  const label = index % 2;
  const pixels = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const signal = label === 1 ? Math.abs(col - 3.5) < 1.1 : Math.abs(row - 3.5) < 1.1;
    const noise = ((Math.sin(index * 17 + i * 3) + 1) / 2) * 0.18;
    return signal ? 0.82 + noise : noise;
  });
  return { values: pixels, label };
}

function sequenceSample(index: number) {
  const label = index % 2;
  const values = Array.from({ length: 12 }, (_, t) => {
    const trend = label === 1 ? t / 11 : 1 - t / 11;
    return trend + Math.sin(index * 0.9 + t) * 0.05;
  });
  return { values, label };
}

function makeTrainingData(mode: Mode, samples: number) {
  if (mode === 'cnn') {
    const rows = Array.from({ length: samples }, (_, i) => imageSample(i));
    return {
      xs: tf.tensor4d(rows.flatMap(row => row.values), [samples, 8, 8, 1]),
      ys: tf.tensor2d(rows.flatMap(row => row.label === 1 ? [0, 1] : [1, 0]), [samples, 2]),
      rows,
    };
  }
  const rows = Array.from({ length: samples }, (_, i) => sequenceSample(i));
  return {
    xs: tf.tensor3d(rows.flatMap(row => row.values), [samples, 12, 1]),
    ys: tf.tensor2d(rows.flatMap(row => row.label === 1 ? [0, 1] : [1, 0]), [samples, 2]),
    rows,
  };
}

function buildModel(mode: Mode, units: number, learningRate: number) {
  const model = tf.sequential();
  if (mode === 'cnn') {
    model.add(tf.layers.conv2d({ inputShape: [8, 8, 1], filters: units, kernelSize: 3, activation: 'relu', padding: 'same' }));
    model.add(tf.layers.maxPooling2d({ poolSize: 2 }));
    model.add(tf.layers.flatten());
    model.add(tf.layers.dense({ units: 10, activation: 'relu' }));
  } else {
    const recurrent = mode === 'lstm'
      ? tf.layers.lstm({ inputShape: [12, 1], units })
      : mode === 'gru'
        ? tf.layers.gru({ inputShape: [12, 1], units })
        : tf.layers.simpleRNN({ inputShape: [12, 1], units });
    model.add(recurrent);
  }
  model.add(tf.layers.dense({ units: 2, activation: 'softmax' }));
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });
  return model;
}

export default function TensorFlowDeepLearningLab({ mode }: { mode: Mode }) {
  const [epochs, setEpochs] = useState(18);
  const [units, setUnits] = useState(mode === 'cnn' ? 4 : 8);
  const [learningRate, setLearningRate] = useState(0.025);
  const [training, setTraining] = useState(false);
  const [history, setHistory] = useState<Array<{ epoch: number; loss: number; accuracy: number }>>([]);
  const [prediction, setPrediction] = useState<{ probability: number; label: number } | null>(null);
  const [status, setStatus] = useState('Ready to train in TensorFlow.js.');
  const meta = copy[mode];
  const preview = useMemo(() => mode === 'cnn' ? imageSample(101).values : sequenceSample(101).values, [mode]);
  const latest = history[history.length - 1];

  const train = async () => {
    setTraining(true);
    setHistory([]);
    setStatus('Training TensorFlow.js model...');
    const data = makeTrainingData(mode, 96);
    const model = buildModel(mode, units, learningRate);
    try {
      await model.fit(data.xs, data.ys, {
        epochs,
        batchSize: 16,
        shuffle: true,
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
      const sample = mode === 'cnn' ? imageSample(101) : sequenceSample(101);
      const input = mode === 'cnn'
        ? tf.tensor4d(sample.values, [1, 8, 8, 1])
        : tf.tensor3d(sample.values, [1, 12, 1]);
      const output = model.predict(input) as tf.Tensor;
      const values = Array.from(await output.data());
      const label = values[1] >= values[0] ? 1 : 0;
      setPrediction({ probability: Number(values[label].toFixed(4)), label });
      input.dispose();
      output.dispose();
      setStatus('Training complete. Prediction computed from held-out preview sample.');
    } finally {
      data.xs.dispose();
      data.ys.dispose();
      model.dispose();
      setTraining(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title={meta.title} subtitle={meta.subtitle} badge="Browser Trainable" category="Deep Learning" icon={<Brain size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="TensorFlow.js Controls">
            <div className="space-y-4 text-sm">
              <label className="block">Units / filters: <b>{units}</b><input type="range" min={2} max={16} value={units} onChange={event => setUnits(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              <label className="block">Epochs: <b>{epochs}</b><input type="range" min={5} max={40} value={epochs} onChange={event => setEpochs(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              <label className="block">Learning rate: <b>{learningRate.toFixed(3)}</b><input type="range" min={0.005} max={0.08} step={0.005} value={learningRate} onChange={event => setLearningRate(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              <button disabled={training} onClick={train} className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-60"><Play size={14} /> {training ? 'Training...' : 'Train Model'}</button>
            </div>
          </Card>
          <MetricsPanel title="Training Metrics" metrics={[
            { label: 'Loss', value: latest?.loss ?? 0, format: 'fixed4', color: 'blue' },
            { label: 'Accuracy', value: latest?.accuracy ?? 0, format: 'percent', color: 'green' },
            { label: 'Epochs Run', value: history.length, format: 'number' },
            { label: 'Probability', value: prediction?.probability ?? 0, format: 'percent', color: 'blue' },
          ]} />
          <InfoBox type="success" title="Runtime">{status}</InfoBox>
        </div>
        <div className="space-y-4">
          <Card title="Loss and Accuracy">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="epoch" />
                <YAxis />
                <Tooltip />
                <Line dataKey="loss" stroke="#dc2626" strokeWidth={2} dot={false} />
                <Line dataKey="accuracy" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Input Preview">
              {mode === 'cnn' ? (
                <div className="grid grid-cols-8 gap-1">
                  {preview.map((value, index) => <div key={index} className="aspect-square rounded" style={{ background: `rgb(${Math.round(value * 255)}, ${Math.round(value * 255)}, ${Math.round(value * 255)})` }} />)}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={preview.map((value, step) => ({ step, value }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="step" />
                    <YAxis />
                    <Tooltip />
                    <Line dataKey="value" stroke="#2563eb" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
            <Card title="Model Summary">
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                <p><b>Input:</b> {meta.inputShape}</p>
                <p><b>Layer:</b> {mode === 'cnn' ? 'Conv2D + MaxPool + Dense' : mode.toUpperCase()}</p>
                <p><b>Output:</b> {meta.output}</p>
                <p><b>Prediction:</b> {prediction ? `class ${prediction.label} at ${(prediction.probability * 100).toFixed(1)}%` : 'Train to compute'}</p>
              </div>
            </Card>
          </div>
          <InfoBox type="info" title="Real TensorFlow.js Implementation">
            This route builds, compiles, trains, predicts, and disposes an actual TensorFlow.js model in the browser.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
