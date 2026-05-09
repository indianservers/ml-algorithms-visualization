import { Activity } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, InfoBox } from '../common/Card';

export interface TrainingLossPoint {
  epoch?: number;
  iter?: number;
  step?: number;
  loss: number;
  accuracy?: number;
  valLoss?: number;
}

interface TrainingLossChartProps {
  data: TrainingLossPoint[];
  title?: string;
  subtitle?: string;
  xKey?: 'epoch' | 'iter' | 'step';
  height?: number;
  showAccuracy?: boolean;
  emptyText?: string;
}

export function TrainingLossChart({
  data,
  title = 'Training Loss',
  subtitle = 'Live loss curve while the model trains.',
  xKey,
  height = 300,
  showAccuracy = true,
  emptyText = 'Train the model to see the live loss curve.',
}: TrainingLossChartProps) {
  const resolvedXKey = xKey ?? (data[0]?.epoch !== undefined ? 'epoch' : data[0]?.iter !== undefined ? 'iter' : 'step');
  const chartData = data.map((point, index) => ({
    step: index + 1,
    ...point,
    loss: Number(point.loss),
    accuracy: point.accuracy === undefined ? undefined : Number(point.accuracy),
    valLoss: point.valLoss === undefined ? undefined : Number(point.valLoss),
  }));
  const hasAccuracy = showAccuracy && chartData.some(point => typeof point.accuracy === 'number');
  const hasValLoss = chartData.some(point => typeof point.valLoss === 'number');

  return (
    <Card title={title} subtitle={subtitle} icon={<Activity size={15} />}>
      {chartData.length === 0 ? (
        <InfoBox type="info">{emptyText}</InfoBox>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 10, right: 18, bottom: 18, left: 6 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={resolvedXKey} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="loss" tick={{ fontSize: 11 }} />
            {hasAccuracy && <YAxis yAxisId="accuracy" orientation="right" domain={[0, 1]} tick={{ fontSize: 11 }} tickFormatter={value => `${Math.round(Number(value) * 100)}%`} />}
            <Tooltip formatter={(value: number, name) => [typeof value === 'number' ? value.toFixed(name === 'accuracy' ? 3 : 5) : value, name]} />
            <Line yAxisId="loss" type="monotone" dataKey="loss" name="loss" stroke="#dc2626" strokeWidth={2} dot={false} isAnimationActive={false} />
            {hasValLoss && <Line yAxisId="loss" type="monotone" dataKey="valLoss" name="val loss" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} />}
            {hasAccuracy && <Line yAxisId="accuracy" type="monotone" dataKey="accuracy" name="accuracy" stroke="#059669" strokeWidth={2} dot={false} isAnimationActive={false} />}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
