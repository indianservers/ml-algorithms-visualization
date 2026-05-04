import { useMemo, useState } from 'react';
import { MessageSquare, Play, RotateCcw, Send } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { sentimentDataset, spamDataset } from '../../../data/sampleDatasets';
import { tokenize } from '../../../lib/algorithms/nlp/tfidf';

type Mode = 'sentiment' | 'text';
type Row = { text: string; label: string };

const copy = {
  sentiment: {
    title: 'Sentiment Analysis',
    subtitle: 'Real browser-side multinomial Naive Bayes sentiment classifier with token evidence and class probabilities.',
    sample: 'Amazing quality and fast delivery, I am very happy with this product.',
  },
  text: {
    title: 'Text Classification',
    subtitle: 'Real browser-side spam/ham text classifier using bag-of-words likelihoods and Laplace smoothing.',
    sample: 'URGENT free offer, click now to claim your prize.',
  },
} satisfies Record<Mode, { title: string; subtitle: string; sample: string }>;

function rowsToCSV(rows: Row[]) {
  return [
    'label,text',
    ...rows.map(row => `${row.label},"${row.text.replace(/"/g, '""')}"`),
  ].join('\n');
}

function parseDatasetCSV(text: string): { rows: Row[]; error: string | null } {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], error: 'Add a header row and at least one labeled example.' };

  const header = lines[0].split(',').map(item => item.trim().toLowerCase().replace(/^"|"$/g, ''));
  const labelIndex = header.indexOf('label');
  const textIndex = header.indexOf('text');
  if (labelIndex === -1 || textIndex === -1) return { rows: [], error: 'CSV must have exactly these useful columns: label,text' };

  const rows = lines.slice(1).map(line => {
    const firstComma = line.indexOf(',');
    if (firstComma === -1) return null;
    const rawParts = labelIndex === 0
      ? [line.slice(0, firstComma), line.slice(firstComma + 1)]
      : [line.slice(firstComma + 1), line.slice(0, firstComma)];
    const label = rawParts[0].trim().replace(/^"|"$/g, '');
    const body = rawParts[1].trim().replace(/^"|"$/g, '').replace(/""/g, '"');
    return label && body ? { label, text: body } : null;
  }).filter((row): row is Row => row !== null);

  const classCount = new Set(rows.map(row => row.label)).size;
  if (rows.length < 4) return { rows, error: 'Add at least 4 labeled examples so the page can train and test.' };
  if (classCount < 2) return { rows, error: 'Use at least 2 labels/classes.' };
  return { rows, error: null };
}

function splitRows(rows: Row[]) {
  return {
    train: rows.filter((_, index) => index % 4 !== 0),
    test: rows.filter((_, index) => index % 4 === 0),
  };
}

function trainNaiveBayes(rows: Row[], alpha: number, maxVocab: number) {
  const tokenized = rows.map(row => ({ ...row, tokens: tokenize(row.text) }));
  const termCounts = new Map<string, number>();
  tokenized.forEach(row => row.tokens.forEach(token => termCounts.set(token, (termCounts.get(token) ?? 0) + 1)));
  const vocabulary = [...termCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxVocab)
    .map(([term]) => term);
  const vocabSet = new Set(vocabulary);
  const labels = [...new Set(rows.map(row => row.label))].sort();
  const classDocs = new Map(labels.map(label => [label, tokenized.filter(row => row.label === label)]));
  const classTokenCounts = new Map<string, Map<string, number>>();
  const classTotals = new Map<string, number>();

  labels.forEach(label => {
    const counts = new Map<string, number>();
    classDocs.get(label)?.forEach(row => row.tokens.filter(token => vocabSet.has(token)).forEach(token => counts.set(token, (counts.get(token) ?? 0) + 1)));
    classTokenCounts.set(label, counts);
    classTotals.set(label, [...counts.values()].reduce((sum, value) => sum + value, 0));
  });

  const predict = (text: string) => {
    const tokens = tokenize(text).filter(token => vocabSet.has(token));
    const logScores = labels.map(label => {
      const prior = Math.log((classDocs.get(label)?.length ?? 0) / rows.length || 1e-9);
      const counts = classTokenCounts.get(label) ?? new Map<string, number>();
      const total = classTotals.get(label) ?? 0;
      const likelihood = tokens.reduce((sum, token) => {
        const numerator = (counts.get(token) ?? 0) + alpha;
        const denominator = total + alpha * vocabulary.length;
        return sum + Math.log(numerator / denominator);
      }, 0);
      return { label, score: prior + likelihood };
    });
    const max = Math.max(...logScores.map(item => item.score));
    const exp = logScores.map(item => ({ label: item.label, value: Math.exp(item.score - max) }));
    const total = exp.reduce((sum, item) => sum + item.value, 0) || 1;
    const probabilities = exp.map(item => ({ label: item.label, probability: item.value / total }));
    const best = probabilities.reduce((winner, item) => item.probability > winner.probability ? item : winner, probabilities[0]);
    const evidence = tokens.map(token => {
      const scores = labels.map(label => {
        const counts = classTokenCounts.get(label) ?? new Map<string, number>();
        const totalForClass = classTotals.get(label) ?? 0;
        return {
          label,
          value: Math.log(((counts.get(token) ?? 0) + alpha) / (totalForClass + alpha * vocabulary.length)),
        };
      });
      return { token, ...Object.fromEntries(scores.map(item => [item.label, Number(item.value.toFixed(3))])) };
    });
    return { label: best.label, probabilities, evidence, tokens };
  };

  return { labels, vocabulary, predict };
}

function metrics(actual: string[], predicted: string[]) {
  const labels = [...new Set(actual)].sort();
  const accuracy = actual.filter((label, index) => label === predicted[index]).length / Math.max(actual.length, 1);
  const perClass = labels.map(label => {
    const tp = actual.filter((value, index) => value === label && predicted[index] === label).length;
    const fp = actual.filter((value, index) => value !== label && predicted[index] === label).length;
    const fn = actual.filter((value, index) => value === label && predicted[index] !== label).length;
    const precision = tp / (tp + fp || 1);
    const recall = tp / (tp + fn || 1);
    const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    return { label, precision, recall, f1, support: actual.filter(value => value === label).length };
  });
  const macroF1 = perClass.reduce((sum, item) => sum + item.f1, 0) / Math.max(perClass.length, 1);
  return { accuracy, macroF1, perClass };
}

export default function NLPClassificationLab({ mode }: { mode: Mode }) {
  const meta = copy[mode];
  const starterRows = useMemo(() => (mode === 'sentiment' ? sentimentDataset.data : spamDataset.data) as Row[], [mode]);
  const [datasetText, setDatasetText] = useState(() => rowsToCSV(starterRows));
  const [rows, setRows] = useState<Row[]>(starterRows);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [alpha, setAlpha] = useState(1);
  const [maxVocab, setMaxVocab] = useState(40);
  const [input, setInput] = useState(meta.sample);
  const { train, test } = useMemo(() => splitRows(rows), [rows]);
  const model = useMemo(() => trainNaiveBayes(train, alpha, maxVocab), [train, alpha, maxVocab]);
  const predictions = test.map(row => model.predict(row.text).label);
  const report = metrics(test.map(row => row.label), predictions);
  const custom = model.predict(input);
  const confusionRows = test.map((row, index) => ({ text: row.text, actual: row.label, predicted: predictions[index], ok: row.label === predictions[index] }));
  const pendingDataset = parseDatasetCSV(datasetText);

  const handleTrain = () => {
    const parsed = parseDatasetCSV(datasetText);
    if (parsed.error) {
      setDatasetError(parsed.error);
      return;
    }
    setRows(parsed.rows);
    setDatasetError(null);
  };

  const resetDataset = () => {
    setDatasetText(rowsToCSV(starterRows));
    setRows(starterRows);
    setDatasetError(null);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title={meta.title} subtitle={meta.subtitle} badge="Implemented" category="NLP" icon={<MessageSquare size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[350px_1fr]">
        <div className="space-y-4">
          <Card title="Dataset">
            <div className="space-y-3 text-sm">
              <p className="text-xs text-gray-500 dark:text-gray-400">Paste CSV with two columns: label,text. Example: spam,"win free prize now"</p>
              <textarea value={datasetText} onChange={event => setDatasetText(event.target.value)} rows={8} className="w-full rounded border border-gray-200 bg-white p-3 font-mono text-xs dark:border-gray-700 dark:bg-gray-900" />
              {(datasetError ?? pendingDataset.error) && (
                <p className="rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{datasetError ?? pendingDataset.error}</p>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-gray-50 p-2 dark:bg-gray-900">Parsed rows: <b>{pendingDataset.rows.length}</b></div>
                <div className="rounded bg-gray-50 p-2 dark:bg-gray-900">Labels: <b>{[...new Set(pendingDataset.rows.map(row => row.label))].join(', ') || '-'}</b></div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleTrain} className="flex flex-1 items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  <Play size={14} /> Train Dataset
                </button>
                <button onClick={resetDataset} className="flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                  <RotateCcw size={14} /> Reset
                </button>
              </div>
            </div>
          </Card>
          <Card title="Training Controls">
            <div className="space-y-4 text-sm">
              <label className="block">Laplace alpha: <b>{alpha.toFixed(1)}</b><input type="range" min={0.1} max={3} step={0.1} value={alpha} onChange={event => setAlpha(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              <label className="block">Max vocabulary: <b>{maxVocab}</b><input type="range" min={10} max={80} step={5} value={maxVocab} onChange={event => setMaxVocab(Number(event.target.value))} className="w-full accent-blue-600" /></label>
              <div className="rounded bg-gray-50 p-3 text-xs dark:bg-gray-900">
                Active model: {rows.length} rows / Train rows: {train.length} / Test rows: {test.length} / Classes: {model.labels.join(', ')}
              </div>
            </div>
          </Card>
          <MetricsPanel title="Classification Metrics" metrics={[
            { label: 'Accuracy', value: report.accuracy, format: 'percent', color: 'green' },
            { label: 'Macro F1', value: report.macroF1, format: 'percent', color: 'blue' },
            { label: 'Vocabulary', value: model.vocabulary.length, format: 'number' },
            { label: 'Classes', value: model.labels.length, format: 'number' },
          ]} />
          <Card title="Try Custom Text">
            <textarea value={input} onChange={event => setInput(event.target.value)} rows={5} className="w-full rounded border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900" />
            <div className="mt-3 flex items-center gap-2 rounded bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
              <Send size={15} /> Prediction: <b>{custom.label}</b>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card title="Class Probabilities">
              <ResponsiveContainer width="100%" height={270}>
                <BarChart data={custom.probabilities}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="probability">
                    {custom.probabilities.map((_, index) => <Cell key={index} fill={['#2563eb', '#059669', '#dc2626', '#9333ea'][index % 4]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Per-Class Metrics">
              <div className="space-y-2">
                {report.perClass.map(item => (
                  <div key={item.label} className="rounded bg-gray-50 p-3 text-xs dark:bg-gray-900">
                    <div className="mb-1 flex justify-between"><b>{item.label}</b><span>support {item.support}</span></div>
                    <div className="grid grid-cols-3 gap-2 font-mono">
                      <span>P {(item.precision * 100).toFixed(1)}%</span>
                      <span>R {(item.recall * 100).toFixed(1)}%</span>
                      <span>F1 {(item.f1 * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <Card title="Token Evidence">
            {custom.evidence.length === 0 ? (
              <p className="text-sm text-gray-500">No known vocabulary tokens found in the custom text.</p>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead><tr><th className="p-2 text-left">token</th>{model.labels.map(label => <th key={label} className="p-2 text-right">{label} logP</th>)}</tr></thead>
                  <tbody>
                    {custom.evidence.map(row => (
                      <tr key={row.token}>
                        <td className="border border-gray-200 p-2 font-mono dark:border-gray-700">{row.token}</td>
                        {model.labels.map(label => <td key={label} className="border border-gray-200 p-2 text-right font-mono dark:border-gray-700">{String(row[label])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Held-Out Predictions">
            <div className="space-y-2">
              {confusionRows.map(row => (
                <div key={row.text} className={`rounded border p-3 text-xs ${row.ok ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'}`}>
                  <p className="text-gray-700 dark:text-gray-200">{row.text}</p>
                  <p className="mt-1 font-mono">actual={row.actual} predicted={row.predicted}</p>
                </div>
              ))}
            </div>
          </Card>
          <InfoBox type="success" title="Real NLP Logic">
            Workflow: paste labeled CSV, click Train Dataset, review held-out metrics, then type custom text to classify it. Everything runs locally in the browser.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
