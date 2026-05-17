import { ResponsiveContainer, Scatter, ScatterChart, CartesianGrid, Tooltip, XAxis, YAxis, Cell, ReferenceArea } from 'recharts';
import { themedTooltipProps, useChartPalette, useRechartsZoom } from '../common/chartUtils';

export function DecisionBoundaryPlot({ points, boundary }: { points: { x: number; y: number; label: number }[]; boundary?: { x: number; y: number; label: number }[] }) {
  const palette = useChartPalette();
  const zoom = useRechartsZoom();
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart onMouseDown={zoom.mouseDown} onMouseMove={zoom.mouseMove} onMouseUp={zoom.mouseUp} onDoubleClick={zoom.resetZoom}>
        <CartesianGrid strokeDasharray="3 3" stroke={palette.grid} />
        <XAxis type="number" dataKey="x" domain={zoom.xDomain ?? ['dataMin', 'dataMax']} allowDataOverflow tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} />
        <YAxis type="number" dataKey="y" tick={{ fontSize: 11, fill: palette.axis }} stroke={palette.axis} />
        <Tooltip {...themedTooltipProps(palette)} />
        {boundary && <Scatter data={boundary} opacity={0.18}>{boundary.map((point, i) => <Cell key={i} fill={point.label ? palette.series[1] : palette.series[0]} />)}</Scatter>}
        <Scatter data={points}>{points.map((point, i) => <Cell key={i} fill={point.label ? palette.series[1] : palette.series[0]} />)}</Scatter>
        {zoom.refAreaLeft !== null && zoom.refAreaRight !== null && (
          <ReferenceArea x1={zoom.refAreaLeft} x2={zoom.refAreaRight} strokeOpacity={0.3} fill={palette.series[0]} fillOpacity={0.12} />
        )}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
