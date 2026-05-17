import { ResponsiveContainer, Scatter, ScatterChart, CartesianGrid, Tooltip, XAxis, YAxis, ReferenceLine, ReferenceArea } from 'recharts';
import { themedTooltipProps, useChartPalette, useRechartsZoom } from '../common/chartUtils';

export function ResidualPlot({ data }: { data: { x: number; residual: number }[] }) {
  const palette = useChartPalette();
  const zoom = useRechartsZoom();
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart onMouseDown={zoom.mouseDown} onMouseMove={zoom.mouseMove} onMouseUp={zoom.mouseUp} onDoubleClick={zoom.resetZoom}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
        <XAxis type="number" dataKey="x" domain={zoom.xDomain ?? ['dataMin', 'dataMax']} allowDataOverflow tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} />
        <YAxis type="number" dataKey="residual" tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} />
        <Tooltip {...themedTooltipProps(palette)} />
        <ReferenceLine y={0} stroke={palette.axis} />
        <Scatter data={data} fill={palette.series[3]} />
        {zoom.refAreaLeft !== null && zoom.refAreaRight !== null && (
          <ReferenceArea x1={zoom.refAreaLeft} x2={zoom.refAreaRight} strokeOpacity={0.3} fill={palette.series[0]} fillOpacity={0.12} />
        )}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
