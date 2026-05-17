import { Activity } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, InfoBox } from '../common/Card';
import { ChartToolbar } from '../common/ChartToolbar';
import { themedTooltipProps, useChartPalette, useRechartsZoom, useSeriesVisibility } from '../common/chartUtils';

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
  const palette = useChartPalette();
  const zoom = useRechartsZoom();
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
  const visibleKeys = ['loss', hasValLoss ? 'valLoss' : '', hasAccuracy ? 'accuracy' : ''].filter(Boolean);
  const { hidden, legendClick } = useSeriesVisibility(visibleKeys);

  return (
    <Card
      title={title}
      subtitle={subtitle}
      icon={<Activity size={15} />}
      actions={<ChartToolbar onReset={zoom.resetZoom} explanation="This chart plots training progress over time. The x-axis is the epoch, iteration, or step; the loss line should generally move downward, while accuracy should generally move upward when it is available. Drag across the plot to zoom, double-click to reset, and click legend labels to hide or show a series." />}
    >
      {chartData.length === 0 ? (
        <InfoBox type="info">{emptyText}</InfoBox>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 18, bottom: 18, left: 6 }}
            onMouseDown={zoom.mouseDown}
            onMouseMove={zoom.mouseMove}
            onMouseUp={zoom.mouseUp}
            onDoubleClick={zoom.resetZoom}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
            <XAxis dataKey={resolvedXKey} domain={zoom.xDomain ?? ['dataMin', 'dataMax']} tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} type="number" allowDataOverflow />
            <YAxis yAxisId="loss" tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} />
            {hasAccuracy && <YAxis yAxisId="accuracy" orientation="right" domain={[0, 1]} tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} tickFormatter={value => `${Math.round(Number(value) * 100)}%`} />}
            <Tooltip {...themedTooltipProps(palette)} formatter={(value: number, name) => [typeof value === 'number' ? value.toFixed(name === 'accuracy' ? 3 : 5) : value, name]} />
            <Legend onClick={legendClick} wrapperStyle={{ color: palette.axis, cursor: 'pointer' }} />
            {!hidden.has('loss') && <Line yAxisId="loss" type="monotone" dataKey="loss" name="loss" stroke={palette.series[2]} strokeWidth={2} dot={false} isAnimationActive={false} />}
            {hasValLoss && !hidden.has('valLoss') && <Line yAxisId="loss" type="monotone" dataKey="valLoss" name="val loss" stroke={palette.series[4]} strokeWidth={2} dot={false} isAnimationActive={false} />}
            {hasAccuracy && !hidden.has('accuracy') && <Line yAxisId="accuracy" type="monotone" dataKey="accuracy" name="accuracy" stroke={palette.series[1]} strokeWidth={2} dot={false} isAnimationActive={false} />}
            {zoom.refAreaLeft !== null && zoom.refAreaRight !== null && (
              <ReferenceArea yAxisId="loss" x1={zoom.refAreaLeft} x2={zoom.refAreaRight} strokeOpacity={0.3} fill={palette.series[0]} fillOpacity={0.12} />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
