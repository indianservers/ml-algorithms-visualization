import { ResponsiveContainer, Scatter, ScatterChart, CartesianGrid, Tooltip, XAxis, YAxis, Cell } from 'recharts';

export function DecisionBoundaryPlot({ points, boundary }: { points: { x: number; y: number; label: number }[]; boundary?: { x: number; y: number; label: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" tick={{ fontSize: 11 }} />
        <YAxis type="number" dataKey="y" tick={{ fontSize: 11 }} />
        <Tooltip />
        {boundary && <Scatter data={boundary} opacity={0.18}>{boundary.map((point, i) => <Cell key={i} fill={point.label ? '#059669' : '#2563eb'} />)}</Scatter>}
        <Scatter data={points}>{points.map((point, i) => <Cell key={i} fill={point.label ? '#065f46' : '#1d4ed8'} />)}</Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
