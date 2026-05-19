import { useMemo, useState } from 'react';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';

type SeriesPoint = { t: number; y: number };

function makeSeries(noise: number, seed: number): SeriesPoint[] {
  return Array.from({ length: 120 }, (_, index) => {
    const t = (index / 119) * 4 * Math.PI;
    const pseudoNoise = Math.sin(index * 12.9898 + seed * 78.233) * Math.cos(index * 4.137 + seed) * noise;
    return { t: index, y: 0.3 * t + 2 * Math.sin(t) + 0.5 * Math.sin(3 * t) + pseudoNoise };
  });
}

function difference(values: number[], order: number) {
  let current = values;
  for (let step = 0; step < order; step++) current = current.slice(1).map((value, index) => value - current[index]);
  return current;
}

function acf(values: number[], maxLag = 15) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const denom = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) || 1;
  return Array.from({ length: maxLag + 1 }, (_, lag) => {
    let numerator = 0;
    for (let index = lag; index < values.length; index++) numerator += (values[index] - mean) * (values[index - lag] - mean);
    return { lag, acf: numerator / denom };
  });
}

function linearArForecast(values: number[], p: number, q: number, horizon = 20) {
  const history = [...values];
  const residuals: number[] = [];
  for (let index = Math.max(1, p); index < values.length; index++) {
    const ar = p === 0 ? values[index - 1] : Array.from({ length: p }, (_, lag) => values[index - lag - 1]).reduce((sum, value) => sum + value, 0) / p;
    residuals.push(values[index] - ar);
  }
  const residualStd = Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / (residuals.length || 1));
  const forecasts: number[] = [];
  for (let step = 0; step < horizon; step++) {
    const ar = p === 0 ? history.at(-1) ?? 0 : Array.from({ length: p }, (_, lag) => history[history.length - lag - 1] ?? history.at(-1) ?? 0).reduce((sum, value) => sum + value, 0) / p;
    const ma = q === 0 ? 0 : residuals.slice(-q).reduce((sum, value) => sum + value, 0) / q;
    const next = ar + 0.35 * ma;
    history.push(next);
    residuals.push(0);
    forecasts.push(next);
  }
  return { forecasts, residuals, residualStd };
}

function undifference(original: number[], diffForecasts: number[], d: number) {
  if (d === 0) return diffForecasts;
  if (d === 1) {
    let last = original.at(-1) ?? 0;
    return diffForecasts.map(delta => {
      last += delta;
      return last;
    });
  }
  let lastValue = original.at(-1) ?? 0;
  let lastDiff = original.at(-1)! - original.at(-2)!;
  return diffForecasts.map(secondDelta => {
    lastDiff += secondDelta;
    lastValue += lastDiff;
    return lastValue;
  });
}

export default function ARIMAConceptPage() {
  const [p, setP] = useState(2);
  const [d, setD] = useState(1);
  const [q, setQ] = useState(1);
  const [noise, setNoise] = useState(0.4);
  const [seed, setSeed] = useState(1);

  const series = useMemo(() => makeSeries(noise, seed), [noise, seed]);
  const values = series.map(point => point.y);
  const diffValues = useMemo(() => difference(values, d), [values, d]);
  const acfData = useMemo(() => acf(values, 15), [values]);
  const diffChart = diffValues.map((value, index) => ({ t: index + d, y: value }));
  const stationary = Math.abs(acf(diffValues, 1)[1]?.acf ?? 1) < 0.45;
  const forecastState = useMemo(() => {
    const base = difference(values, d);
    const { forecasts, residuals, residualStd } = linearArForecast(base, p, q);
    const restored = undifference(values, forecasts, d);
    return {
      residualStd,
      residuals: residuals.slice(-60).map((value, index) => ({ t: index, error: value })),
      forecast: restored.map((value, index) => ({
        t: values.length + index,
        y: value,
        upper: value + 1.96 * residualStd,
        lower: value - 1.96 * residualStd,
        band: 3.92 * residualStd,
      })),
    };
  }, [values, p, d, q]);
  const combinedForecast = [
    ...series.map(point => ({ ...point, observed: point.y, forecast: null as number | null, upper: null as number | null, lower: null as number | null, band: null as number | null })),
    ...forecastState.forecast.map(point => ({ ...point, observed: null, forecast: point.y })),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="ARIMA" subtitle="Explore AR, differencing, MA residuals, ACF lags, and a browser-side ARIMA-style forecast." badge="Advanced" category="Time Series" icon={<Activity size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card title="ARIMA Controls">
            <div className="space-y-4 text-sm">
              <label className="block font-semibold">AR order p: {p}<input className="w-full accent-blue-600" type="range" min={0} max={3} value={p} onChange={event => setP(Number(event.target.value))} /></label>
              <label className="block font-semibold">Difference d: {d}<input className="w-full accent-blue-600" type="range" min={0} max={2} value={d} onChange={event => setD(Number(event.target.value))} /></label>
              <label className="block font-semibold">MA order q: {q}<input className="w-full accent-blue-600" type="range" min={0} max={3} value={q} onChange={event => setQ(Number(event.target.value))} /></label>
              <label className="block font-semibold">Noise sigma: {noise.toFixed(2)}<input className="w-full accent-blue-600" type="range" min={0} max={1.2} step={0.05} value={noise} onChange={event => setNoise(Number(event.target.value))} /></label>
              <button onClick={() => setSeed(value => value + 1)} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 text-sm font-bold text-white hover:bg-blue-700"><RefreshCw size={14} /> Regenerate</button>
            </div>
          </Card>
          <MetricsPanel title="Stationarity Check" metrics={[
            { label: 'ADF Label', value: stationary ? 'Stationary' : 'Non-stationary' },
            { label: 'Lag-1 ACF', value: acf(diffValues, 1)[1]?.acf ?? 0, format: 'fixed4', color: stationary ? 'green' : 'red' },
            { label: 'Residual Std', value: forecastState.residualStd, format: 'fixed4' },
          ]} />
          <InfoBox type="info" title="Reading ARIMA">
            AR uses lagged values, I differences the series to make it more stationary, and MA feeds recent residual errors back into the forecast.
          </InfoBox>
        </div>
        <div className="space-y-4">
          <Card title="Forecast with 95% Confidence Interval">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={combinedForecast}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" />
                <YAxis />
                <Tooltip />
                <Area dataKey="band" baseValue={0} stroke="none" fill="#93c5fd" fillOpacity={0.24} name="95% interval width" />
                <Line dataKey="observed" stroke="#334155" dot={false} name="observed" />
                <Line dataKey="forecast" stroke="#2563eb" strokeWidth={2.5} dot={false} name="forecast" />
                <Line dataKey="upper" stroke="#93c5fd" dot={false} name="upper" />
                <Line dataKey="lower" stroke="#93c5fd" dot={false} name="lower" />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="AR(p): Autocorrelation">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={acfData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="lag" />
                  <YAxis domain={[-1, 1]} />
                  <Tooltip />
                  <Bar dataKey="acf">
                    {acfData.map(item => <Cell key={item.lag} fill={item.lag > 0 && item.lag <= p ? '#2563eb' : '#94a3b8'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="I(d): Differenced Series">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={diffChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="t" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="y" stroke={stationary ? '#059669' : '#dc2626'} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
            <Card title="MA(q): Rolling Error">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={forecastState.residuals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="t" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="error" stroke="#f59e0b" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
