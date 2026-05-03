import { ResponsiveContainer, Scatter, ScatterChart, CartesianGrid, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';

export function ResidualPlot({ data }: { data: { x: number; residual: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="x" tick={{ fontSize: 11 }} />
        <YAxis type="number" dataKey="residual" tick={{ fontSize: 11 }} />
        <Tooltip />
        <ReferenceLine y={0} stroke="#64748b" />
        <Scatter data={data} fill="#9333ea" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
