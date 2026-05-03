import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { Minimize2 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { pca } from '../../../lib/algorithms/dimensionality/pca';
import { irisDataset, housingDataset } from '../../../data/sampleDatasets';

const colors = ['#2563eb', '#059669', '#dc2626'];

function Matrix({ values, headers }: { values: number[][]; headers: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr><th className="p-2" />{headers.map(header => <th key={header} className="p-2 font-mono">{header}</th>)}</tr>
        </thead>
        <tbody>
          {values.map((row, i) => (
            <tr key={headers[i]}>
              <th className="p-2 text-left font-mono">{headers[i]}</th>
              {row.map((value, j) => <td key={j} className="border border-gray-200 p-2 text-center font-mono dark:border-gray-700">{value.toFixed(3)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PCAPage() {
  const [dataset, setDataset] = useState<'iris' | 'housing'>('iris');
  const [components, setComponents] = useState(2);

  const prepared = useMemo(() => {
    if (dataset === 'housing') {
      const rows = housingDataset.data as Record<string, number>[];
      const features = ['area_sqft', 'bedrooms', 'bathrooms', 'age_years', 'distance_center'];
      return { features, X: rows.map(row => features.map(feature => Number(row[feature]))), labels: rows.map(() => 0) };
    }
    const rows = irisDataset.data as Record<string, string | number>[];
    const features = ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'];
    const species = ['setosa', 'versicolor', 'virginica'];
    return {
      features,
      X: rows.map(row => features.map(feature => Number(row[feature]))),
      labels: rows.map(row => species.indexOf(String(row.species))),
    };
  }, [dataset]);

  const result = useMemo(() => pca(prepared.X, components), [prepared.X, components]);
  const projection = result.projections.map((row, i) => ({ pc1: row[0] ?? 0, pc2: row[1] ?? 0, label: prepared.labels[i], index: i }));
  const variance = result.explainedVarianceRatio.map((ratio, i) => ({ component: `PC${i + 1}`, explained: Number((ratio * 100).toFixed(2)) }));
  const totalExplained = result.explainedVarianceRatio.reduce((sum, value) => sum + value, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader
        title="Principal Component Analysis"
        subtitle="Real PCA in TypeScript: covariance matrix, eigenvectors, explained variance, projection, and reconstruction intuition."
        badge="Intermediate"
        category="Dimensionality Reduction"
        icon={<Minimize2 size={22} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Dataset and Controls">
            <div className="space-y-4 text-sm">
              <select value={dataset} onChange={event => setDataset(event.target.value as 'iris' | 'housing')} className="w-full rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
                <option value="iris">Iris dataset</option>
                <option value="housing">Housing price dataset</option>
              </select>
              <label className="block text-xs font-semibold text-gray-500">Components: <span className="font-mono text-blue-600">{components}</span></label>
              <input type="range" min={1} max={Math.min(4, prepared.features.length)} value={components} onChange={event => setComponents(Number(event.target.value))} className="w-full accent-blue-600" />
              <p className="text-xs text-gray-500">Features: <span className="font-mono">{prepared.features.join(', ')}</span></p>
            </div>
          </Card>

          <MetricsPanel
            title="PCA Metrics"
            metrics={[
              { label: 'Total Explained', value: totalExplained, format: 'percent', color: 'green' },
              { label: 'PC1 Variance', value: result.explainedVarianceRatio[0] ?? 0, format: 'percent', color: 'blue' },
              { label: 'Eigenvalue 1', value: result.eigenvalues[0] ?? 0, format: 'fixed4' },
              { label: 'Samples', value: prepared.X.length, format: 'number' },
            ]}
          />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card title="2D Projection">
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="pc1" name="PC1" tick={{ fontSize: 11 }} />
                  <YAxis type="number" dataKey="pc2" name="PC2" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Scatter data={projection}>
                    {projection.map((point, i) => <Cell key={i} fill={colors[Math.max(point.label, 0) % colors.length]} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Scree Plot">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={variance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="component" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="explained" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card title="Covariance Matrix">
            <Matrix values={result.covarianceMatrix} headers={prepared.features} />
          </Card>

          <Card title="Eigenvectors / Principal Components">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {result.components.map((component, i) => (
                <div key={i} className="rounded bg-gray-50 p-3 dark:bg-gray-900">
                  <p className="mb-2 text-xs font-semibold">PC{i + 1}</p>
                  <p className="font-mono text-xs">[{component.map(value => value.toFixed(3)).join(', ')}]</p>
                </div>
              ))}
            </div>
          </Card>

          <InfoBox type="info" title="Real Logic Cross-Check">
            The page centers feature columns, computes covariance, estimates top eigenvectors by power iteration, projects samples with dot products, and reports explained variance from eigenvalues.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
