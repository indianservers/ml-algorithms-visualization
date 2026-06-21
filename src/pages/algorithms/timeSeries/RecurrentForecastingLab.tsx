import { useMemo, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { Activity, BrainCircuit, Database, Play, RotateCcw } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { TrainingLossChart } from '../../../components/ml/TrainingLossChart';
import { themedTooltipProps, useChartPalette } from '../../../components/common/chartUtils';
import {
  gruMachineLoadDataset,
  lstmRetailDemandDataset,
  recurrentTrafficDataset,
  sensorAnomalyDataset,
  timeSeriesSalesDataset,
  weatherDailyDataset,
} from '../../../data/sampleDatasets';
import type { Dataset } from '../../../data/sampleDatasets';

type RecurrentMode = 'rnn' | 'lstm' | 'gru';

type SeriesPoint = {
  step: number;
  period: string;
  actual?: number;
  fitted?: number;
  forecast?: number;
  train?: number;
  prediction?: number;
};

const metadata: Record<RecurrentMode, { title: string; subtitle: string; layer: string; gateNote: string }> = {
  rnn: {
    title: 'RNN Time-Series Forecasting',
    subtitle: 'Train a SimpleRNN in TensorFlow.js on seasonal browser data and run next-step inference live.',
    layer: 'SimpleRNN',
    gateNote: 'A compact recurrent state carries recent signal context from one time step to the next.',
  },
  lstm: {
    title: 'LSTM Time-Series Forecasting',
    subtitle: 'Train an LSTM forecaster with gated memory, recursive horizon inference, and live loss updates.',
    layer: 'LSTM',
    gateNote: 'Input, forget, and output gates decide what the model keeps, updates, and exposes.',
  },
  gru: {
    title: 'GRU Time-Series Forecasting',
    subtitle: 'Train a GRU forecaster that uses reset/update gates for efficient sequence memory.',
    layer: 'GRU',
    gateNote: 'Update and reset gates give recurrent memory control with fewer parameters than LSTM.',
  },
};

const datasetOptions: Record<RecurrentMode, Dataset[]> = {
  rnn: [recurrentTrafficDataset, weatherDailyDataset, timeSeriesSalesDataset],
  lstm: [lstmRetailDemandDataset, timeSeriesSalesDataset, recurrentTrafficDataset],
  gru: [gruMachineLoadDataset, sensorAnomalyDataset, recurrentTrafficDataset],
};

const defaultTargets: Record<string, string> = {
  [recurrentTrafficDataset.id]: 'visits',
  [weatherDailyDataset.id]: 'temperature_c',
  [timeSeriesSalesDataset.id]: 'sales',
  [lstmRetailDemandDataset.id]: 'orders',
  [gruMachineLoadDataset.id]: 'load_kw',
  [sensorAnomalyDataset.id]: 'temperature_c',
};

function numericColumns(dataset: Dataset) {
  return dataset.columns.filter(column => dataset.data.some(row => typeof row[column] === 'number'));
}

function labelColumn(dataset: Dataset, targetColumn: string) {
  return dataset.columns.find(column => column !== targetColumn && typeof dataset.data[0]?.[column] !== 'number') ?? dataset.columns[0];
}

function seriesFromDataset(dataset: Dataset, targetColumn: string) {
  const labelKey = labelColumn(dataset, targetColumn);
  return dataset.data
    .map((row, index) => ({
      step: index + 1,
      period: String(row[labelKey] ?? index + 1),
      value: Number(row[targetColumn]),
    }))
    .filter(point => Number.isFinite(point.value));
}

function normalize(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1e-6);
  return {
    min,
    max,
    values: values.map(value => (value - min) / span),
    denormalize: (value: number) => value * span + min,
  };
}

function buildWindows(values: number[], lookback: number) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index < values.length - lookback; index += 1) {
    xs.push(...values.slice(index, index + lookback));
    ys.push(values[index + lookback]);
  }
  return {
    xs: tf.tensor3d(xs, [values.length - lookback, lookback, 1]),
    ys: tf.tensor2d(ys, [values.length - lookback, 1]),
  };
}

function buildModel(mode: RecurrentMode, lookback: number, units: number, learningRate: number) {
  const model = tf.sequential();
  const recurrentConfig = { inputShape: [lookback, 1] as [number, number], units, activation: 'tanh' as const };
  if (mode === 'lstm') {
    model.add(tf.layers.lstm(recurrentConfig));
  } else if (mode === 'gru') {
    model.add(tf.layers.gru(recurrentConfig));
  } else {
    model.add(tf.layers.simpleRNN(recurrentConfig));
  }
  model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
  model.add(tf.layers.dense({ units: 1 }));
  model.compile({ optimizer: tf.train.adam(learningRate), loss: 'meanSquaredError' });
  return model;
}

function computeMae(points: SeriesPoint[]) {
  const compared = points.filter(point => typeof point.actual === 'number' && typeof point.fitted === 'number');
  if (compared.length === 0) return 0;
  return compared.reduce((sum, point) => sum + Math.abs((point.actual ?? 0) - (point.fitted ?? 0)), 0) / compared.length;
}

function RecurrentForecastingLab({ mode }: { mode: RecurrentMode }) {
  const palette = useChartPalette();
  const meta = metadata[mode];
  const options = datasetOptions[mode];
  const [selectedDatasetId, setSelectedDatasetId] = useState(options[0].id);
  const selectedDataset = options.find(dataset => dataset.id === selectedDatasetId) ?? options[0];
  const availableTargets = numericColumns(selectedDataset);
  const [targetColumn, setTargetColumn] = useState(defaultTargets[options[0].id] ?? availableTargets[0] ?? '');
  const [lookback, setLookback] = useState(12);
  const [units, setUnits] = useState(mode === 'lstm' ? 14 : 10);
  const [epochs, setEpochs] = useState(24);
  const [horizon, setHorizon] = useState(8);
  const [learningRate, setLearningRate] = useState(0.018);
  const [training, setTraining] = useState(false);
  const [status, setStatus] = useState('Ready to train a browser recurrent model.');
  const [history, setHistory] = useState<Array<{ epoch: number; loss: number }>>([]);
  const [chart, setChart] = useState<SeriesPoint[]>([]);
  const [lastPrediction, setLastPrediction] = useState<number | null>(null);

  const resolvedTarget = availableTargets.includes(targetColumn) ? targetColumn : availableTargets[0];
  const datasetSeries = useMemo(() => seriesFromDataset(selectedDataset, resolvedTarget), [selectedDataset, resolvedTarget]);
  const rawSeries = useMemo(() => datasetSeries.map(point => point.value), [datasetSeries]);
  const preview = useMemo<SeriesPoint[]>(() => datasetSeries.map(point => ({ step: point.step, period: point.period, actual: point.value })), [datasetSeries]);
  const displayChart = chart.length > 0 ? chart : preview;
  const mae = useMemo(() => computeMae(chart), [chart]);
  const latestLoss = history[history.length - 1]?.loss ?? 0;
  const trainableWindows = Math.max(0, rawSeries.length - lookback);
  const lastObservedPeriod = datasetSeries.at(-1)?.period ?? 'latest';

  const reset = () => {
    setHistory([]);
    setChart([]);
    setLastPrediction(null);
    setStatus('Controls changed. Train again to compute fitted values and forecast horizon.');
  };

  const train = async () => {
    setTraining(true);
    setHistory([]);
    setChart([]);
    setLastPrediction(null);
    setStatus(`Training ${meta.layer} on ${selectedDataset.name} -> ${resolvedTarget}...`);
    const normalized = normalize(rawSeries);
    const data = buildWindows(normalized.values, lookback);
    const model = buildModel(mode, lookback, units, learningRate);

    try {
      await model.fit(data.xs, data.ys, {
        epochs,
        batchSize: 12,
        shuffle: true,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            setHistory(current => [...current, { epoch: epoch + 1, loss: Number((logs?.loss as number ?? 0).toFixed(5)) }]);
            await tf.nextFrame();
          },
        },
      });

      const fittedWindows = buildWindows(normalized.values, lookback);
      const fittedTensor = model.predict(fittedWindows.xs) as tf.Tensor;
      const fittedValues = Array.from(await fittedTensor.data()).map(value => normalized.denormalize(value));
      fittedTensor.dispose();
      fittedWindows.xs.dispose();
      fittedWindows.ys.dispose();

      const nextValues: number[] = [];
      const rollingWindow = normalized.values.slice(-lookback);
      for (let index = 0; index < horizon; index += 1) {
        const input = tf.tensor3d(rollingWindow, [1, lookback, 1]);
        const output = model.predict(input) as tf.Tensor;
        const [nextNormalized] = Array.from(await output.data());
        input.dispose();
        output.dispose();
        rollingWindow.push(nextNormalized);
        rollingWindow.shift();
        nextValues.push(normalized.denormalize(nextNormalized));
        await tf.nextFrame();
      }

      const fittedChart = rawSeries.map((actual, index) => ({
        step: index + 1,
        period: datasetSeries[index]?.period ?? String(index + 1),
        actual,
        fitted: index >= lookback ? fittedValues[index - lookback] : undefined,
        train: actual,
      }));
      const forecastChart = nextValues.map((forecast, index) => ({
        step: rawSeries.length + index + 1,
        period: `T+${index + 1}`,
        forecast,
        prediction: forecast,
      }));
      setChart([...fittedChart, ...forecastChart]);
      setLastPrediction(nextValues[0] ?? null);
      setStatus('Training complete. Forecast horizon was generated recursively from the latest observed window.');
    } finally {
      data.xs.dispose();
      data.ys.dispose();
      model.dispose();
      setTraining(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title={meta.title} subtitle={meta.subtitle} badge="Browser Trainable" category="Time Series" icon={<BrainCircuit size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Dataset and Forecast Controls" icon={<Database size={15} />}>
            <div className="space-y-4 text-sm">
              <label className="block text-gray-700 dark:text-gray-200">
                Dataset
                <select
                  value={selectedDataset.id}
                  onChange={event => {
                    const next = options.find(dataset => dataset.id === event.target.value) ?? options[0];
                    setSelectedDatasetId(next.id);
                    setTargetColumn(defaultTargets[next.id] ?? numericColumns(next)[0] ?? '');
                    reset();
                  }}
                  className="mt-1 min-h-10 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
                >
                  {options.map(dataset => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}
                </select>
              </label>
              <label className="block text-gray-700 dark:text-gray-200">
                Target series
                <select
                  value={resolvedTarget}
                  onChange={event => {
                    setTargetColumn(event.target.value);
                    reset();
                  }}
                  className="mt-1 min-h-10 w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
                >
                  {availableTargets.map(column => <option key={column} value={column}>{column}</option>)}
                </select>
              </label>
              <label className="block text-gray-700 dark:text-gray-200">Lookback window: <b>{lookback}</b><input type="range" min={6} max={20} value={lookback} onChange={event => { setLookback(Number(event.target.value)); reset(); }} className="w-full accent-blue-600" /></label>
              <label className="block text-gray-700 dark:text-gray-200">Hidden units: <b>{units}</b><input type="range" min={4} max={28} value={units} onChange={event => { setUnits(Number(event.target.value)); reset(); }} className="w-full accent-blue-600" /></label>
              <label className="block text-gray-700 dark:text-gray-200">Epochs: <b>{epochs}</b><input type="range" min={8} max={60} value={epochs} onChange={event => setEpochs(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              <label className="block text-gray-700 dark:text-gray-200">Forecast horizon: <b>{horizon}</b><input type="range" min={3} max={16} value={horizon} onChange={event => { setHorizon(Number(event.target.value)); reset(); }} className="w-full accent-blue-600" /></label>
              <label className="block text-gray-700 dark:text-gray-200">Learning rate: <b>{learningRate.toFixed(3)}</b><input type="range" min={0.004} max={0.05} step={0.002} value={learningRate} onChange={event => setLearningRate(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={training} onClick={train} className="inline-flex min-h-10 items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-semibold text-white disabled:opacity-60"><Play size={14} />{training ? 'Training' : 'Train'}</button>
                <button type="button" disabled={training} onClick={reset} className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-gray-300 px-3 py-2 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"><RotateCcw size={14} />Reset</button>
              </div>
            </div>
          </Card>
          <MetricsPanel title="Live Forecast Metrics" metrics={[
            { label: 'Training Loss', value: latestLoss, format: 'fixed4', color: 'blue' },
            { label: 'Fitted MAE', value: mae, format: 'fixed2', color: 'green' },
            { label: 'Next Forecast', value: lastPrediction ?? 0, format: 'fixed2', color: 'blue' },
            { label: 'Windows', value: trainableWindows, format: 'number' },
          ]} />
          <InfoBox type="success" title="Runtime">{status}</InfoBox>
        </div>
        <div className="space-y-4">
          <Card title={`${selectedDataset.name}: Observed, Fitted, and Forecast`} subtitle={`${selectedDataset.data.length} rows. Target: ${resolvedTarget}. Last observed period: ${lastObservedPeriod}.`}>
            <ResponsiveContainer width="100%" height={390}>
              <LineChart data={displayChart} margin={{ top: 10, right: 18, bottom: 18, left: 6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
                <XAxis dataKey="step" tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} />
                <YAxis tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
                <Tooltip {...themedTooltipProps(palette)} formatter={(value: number, name) => [Number(value).toFixed(3), name]} labelFormatter={step => displayChart.find(point => point.step === Number(step))?.period ?? `Step ${step}`} />
                <Legend />
                {chart.length > 0 && <ReferenceLine x={rawSeries.length} stroke={palette.axis} strokeDasharray="4 4" label={{ value: 'forecast starts', position: 'insideTopRight', fill: palette.axis, fontSize: 11 }} />}
                <Line type="monotone" dataKey="actual" name="observed" stroke={palette.series[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="fitted" name="fitted" stroke={palette.series[1]} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="forecast" name="forecast" stroke={palette.series[2]} strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Dataset Shape">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-gray-50 p-2 dark:bg-gray-900"><p className="text-gray-500">Rows</p><p className="font-mono text-lg font-bold">{selectedDataset.data.length}</p></div>
                <div className="rounded bg-gray-50 p-2 dark:bg-gray-900"><p className="text-gray-500">Numeric</p><p className="font-mono text-lg font-bold">{availableTargets.length}</p></div>
                <div className="rounded bg-gray-50 p-2 dark:bg-gray-900"><p className="text-gray-500">Lookback</p><p className="font-mono text-lg font-bold">{lookback}</p></div>
                <div className="rounded bg-gray-50 p-2 dark:bg-gray-900"><p className="text-gray-500">Horizon</p><p className="font-mono text-lg font-bold">{horizon}</p></div>
              </div>
            </Card>
            <Card title="Recent Values" className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {datasetSeries.slice(-8).map(point => (
                  <div key={point.step} className="rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900">
                    <p className="truncate text-gray-500">{point.period}</p>
                    <p className="font-mono font-bold text-gray-900 dark:text-gray-100">{point.value.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <TrainingLossChart data={history} title="TensorFlow.js Training Loss" subtitle="Mean squared error reported at every recurrent training epoch." showAccuracy={false} height={280} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Model Architecture">
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                <p><b>Input tensor:</b> batch x {lookback} steps x 1 feature</p>
                <p><b>Recurrent layer:</b> {meta.layer} with {units} hidden units</p>
                <p><b>Output:</b> one normalized next value</p>
                <p><b>Inference:</b> recursive {horizon}-step horizon</p>
              </div>
            </Card>
            <InfoBox type="info" title="Sequence Memory">{meta.gateNote}</InfoBox>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RecurrentForecastingLab;
