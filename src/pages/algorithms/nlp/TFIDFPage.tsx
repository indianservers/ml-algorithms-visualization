import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { Plus, Trash2, Download, FileText } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { Tabs } from '../../../components/common/Tabs';
import { computeTFIDF, tokenize } from '../../../lib/algorithms/nlp/tfidf';

// ─── Default documents ────────────────────────────────────────────────────────
const DEFAULT_DOCS = [
  'Machine learning is a subset of artificial intelligence that enables systems to learn from data.',
  'Deep learning uses neural networks with many layers to learn complex patterns in large datasets.',
  'Natural language processing allows computers to understand and generate human language using machine learning.',
];

// ─── Colour helpers ───────────────────────────────────────────────────────────
const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

function tfidfCellBg(value: number, max: number): React.CSSProperties {
  if (max === 0 || value === 0) return {};
  const intensity = value / max;
  return { backgroundColor: `rgba(59, 130, 246, ${0.08 + intensity * 0.75})` };
}

function idfCellBg(value: number, maxIdf: number): React.CSSProperties {
  const intensity = maxIdf > 0 ? value / maxIdf : 0;
  return { backgroundColor: `rgba(139, 92, 246, ${0.08 + intensity * 0.6})` };
}

// ─── CSV export ───────────────────────────────────────────────────────────────
function matrixToCSV(
  vocab: string[],
  tfidfMatrix: Record<string, number>[],
  docLabels: string[]
): string {
  const header = ['Document', ...vocab].join(',');
  const rows = tfidfMatrix.map((row, i) =>
    [docLabels[i], ...vocab.map(t => row[t]?.toFixed(6) ?? '0')].join(',')
  );
  return [header, ...rows].join('\n');
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TFIDFPage() {
  const [docs, setDocs]       = useState<string[]>(DEFAULT_DOCS);
  const [computed, setComputed] = useState(false);

  // ── Compute TF-IDF ──────────────────────────────────────────────────────────
  const result = useMemo(() => {
    if (!computed) return null;
    const nonEmpty = docs.filter(d => d.trim().length > 0);
    if (nonEmpty.length === 0) return null;
    return computeTFIDF(nonEmpty);
  }, [docs, computed]);

  // Document labels
  const docLabels = useMemo(() => docs.filter(d => d.trim()).map((_, i) => `Doc ${i + 1}`), [docs]);

  // Max tfidf value for scaling
  const maxTFIDF = useMemo(() => {
    if (!result) return 1;
    return Math.max(...result.tfidfMatrix.flatMap(row => Object.values(row)));
  }, [result]);

  const maxIDF = useMemo(() => {
    if (!result) return 1;
    return Math.max(...Object.values(result.idf));
  }, [result]);

  // ── Vocabulary with frequency ────────────────────────────────────────────────
  const vocabWithFreq = useMemo(() => {
    if (!result) return [];
    const activeDocs = docs.filter(d => d.trim());
    const allTokens  = activeDocs.flatMap(d => tokenize(d));
    const freq: Record<string, number> = {};
    allTokens.forEach(t => { freq[t] = (freq[t] ?? 0) + 1; });
    return result.vocabulary
      .map(term => ({ term, freq: freq[term] ?? 0, idf: result.idf[term] ?? 0 }))
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [result, docs]);

  // ── Top-N terms to display in tables (avoid overly wide tables) ─────────────
  const displayTerms = useMemo(() => {
    if (!result) return [];
    // Sort by total tfidf score across all docs
    return [...result.vocabulary]
      .sort((a, b) => {
        const sumA = result.tfidfMatrix.reduce((s, row) => s + (row[a] ?? 0), 0);
        const sumB = result.tfidfMatrix.reduce((s, row) => s + (row[b] ?? 0), 0);
        return sumB - sumA;
      })
      .slice(0, 20);
  }, [result]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleCompute = () => setComputed(true);

  const handleAddDoc = () => {
    setDocs(d => [...d, '']);
    setComputed(false);
  };

  const handleRemoveDoc = (i: number) => {
    setDocs(d => d.filter((_, idx) => idx !== i));
    setComputed(false);
  };

  const handleChange = (i: number, val: string) => {
    setDocs(d => d.map((doc, idx) => idx === i ? val : doc));
    setComputed(false);
  };

  const handleDownload = useCallback(() => {
    if (!result) return;
    const csv = matrixToCSV(result.vocabulary, result.tfidfMatrix, docLabels);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'tfidf_matrix.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [result, docLabels]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <PageHeader
        title="TF-IDF Vectorizer"
        subtitle="Compute Term Frequency–Inverse Document Frequency for multi-document corpora."
        badge="nlp"
        category="Natural Language Processing"
        icon={<FileText size={22} />}
      />

      {/* Formulas */}
      <Card title="Formulas">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Term Frequency',         formula: 'TF(t, d) = count(t in d) / |d|' },
            { label: 'Inverse Document Freq.', formula: 'IDF(t)   = log((N+1) / (df(t)+1)) + 1' },
            { label: 'TF-IDF Score',           formula: 'TF-IDF   = TF(t, d) × IDF(t)' },
          ].map(({ label, formula }) => (
            <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-700/40 p-3 border border-gray-200 dark:border-gray-600">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{label}</p>
              <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all">{formula}</pre>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          N = total documents, df(t) = number of documents containing term t, |d| = total words in document d.
          Smoothing (+1) prevents division by zero.
        </p>
      </Card>

      {/* Document inputs */}
      <Card
        title={`Documents (${docs.length})`}
        actions={
          <button onClick={handleAddDoc}
            className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg border border-blue-400 text-blue-600
                       hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
            <Plus size={12} /> Add Document
          </button>
        }
      >
        <div className="space-y-3">
          {docs.map((doc, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="mt-2 text-xs font-bold text-gray-400 w-12 shrink-0 text-right">Doc {i + 1}</span>
              <textarea
                value={doc}
                onChange={e => handleChange(i, e.target.value)}
                rows={2}
                placeholder={`Enter text for document ${i + 1}…`}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm resize-none
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {docs.length > 1 && (
                <button onClick={() => handleRemoveDoc(i)}
                  className="mt-2 p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={handleCompute}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors">
            Compute TF-IDF
          </button>
          {result && (
            <button onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
              <Download size={14} /> Export Matrix CSV
            </button>
          )}
        </div>
      </Card>

      {/* Results */}
      {result ? (
        <Tabs tabs={[
          { id: 'matrix',   label: 'TF-IDF Matrix'    },
          { id: 'vocab',    label: 'Vocabulary & IDF' },
          { id: 'tf',       label: 'TF Table'         },
          { id: 'keywords', label: 'Top Keywords'     },
        ]}>
          {(tab) => (
            <>
              {/* ── TF-IDF Heatmap ── */}
              {tab === 'matrix' && (
                <Card title="TF-IDF Matrix (Heatmap)"
                  subtitle={`Rows = documents, Columns = top ${displayTerms.length} terms by total TF-IDF. Blue intensity ∝ value.`}
                >
                  <div className="overflow-x-auto">
                    <table className="text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="sticky left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-2 py-1 text-gray-500 font-normal min-w-[60px]">
                            Term →
                          </th>
                          {displayTerms.map(term => (
                            <th key={term}
                              className="border border-gray-200 dark:border-gray-600 px-1 py-1 font-mono text-gray-700 dark:text-gray-300 font-medium"
                              style={{ minWidth: 54, maxWidth: 80, writingMode: 'vertical-lr', transform: 'rotate(180deg)', height: 70 }}
                            >
                              {term}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.tfidfMatrix.map((row, di) => (
                          <tr key={di}>
                            <td className="sticky left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-2 py-1 font-semibold text-gray-700 dark:text-gray-300 text-center">
                              Doc {di + 1}
                            </td>
                            {displayTerms.map(term => {
                              const val = row[term] ?? 0;
                              return (
                                <td key={term}
                                  className="border border-gray-200 dark:border-gray-600 text-center px-1 py-1 text-gray-800 dark:text-gray-200"
                                  style={tfidfCellBg(val, maxTFIDF)}
                                  title={`Doc ${di + 1} × "${term}" = ${val.toFixed(4)}`}
                                >
                                  {val > 0 ? val.toFixed(3) : ''}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                    <span>Low</span>
                    <div className="flex gap-0.5">
                      {[0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 1].map(i => (
                        <div key={i} className="w-5 h-3 rounded-sm" style={{ backgroundColor: `rgba(59,130,246,${i})` }} />
                      ))}
                    </div>
                    <span>High TF-IDF</span>
                  </div>
                </Card>
              )}

              {/* ── Vocabulary & IDF ── */}
              {tab === 'vocab' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card title={`Vocabulary (${vocabWithFreq.length} terms)`}>
                    <div className="overflow-y-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white dark:bg-gray-800">
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            {['Term', 'Frequency', 'IDF'].map(h => (
                              <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {vocabWithFreq.map(({ term, freq, idf }) => (
                            <tr key={term} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                              <td className="px-3 py-1.5 font-mono text-gray-800 dark:text-gray-200">{term}</td>
                              <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{freq}</td>
                              <td className="px-3 py-1.5 font-semibold"
                                style={{ color: `rgba(139,92,246,${0.4 + (idf / maxIDF) * 0.6})` }}>
                                {idf.toFixed(4)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  <Card title="IDF Values — Bar Chart"
                    subtitle="Higher IDF = rarer term across documents"
                  >
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart
                        data={vocabWithFreq.slice(0, 15).map(v => ({ term: v.term, idf: parseFloat(v.idf.toFixed(4)) }))}
                        layout="vertical"
                        margin={{ top: 5, right: 20, bottom: 5, left: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" fontSize={10} domain={[0, 'auto']} />
                        <YAxis type="category" dataKey="term" fontSize={10} width={55} />
                        <Tooltip formatter={(v: number) => v.toFixed(4)} />
                        <Bar dataKey="idf" name="IDF" radius={[0, 3, 3, 0]}>
                          {vocabWithFreq.slice(0, 15).map((_, i) => (
                            <Cell key={i} fill={`hsl(${262 - i * 3}, 70%, ${45 + i * 2}%)`} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              )}

              {/* ── TF Table ── */}
              {tab === 'tf' && (
                <Card title="Term Frequency (TF) per Document"
                  subtitle={`Showing top ${displayTerms.length} terms. TF = count(t,d) / |d|`}
                >
                  <div className="overflow-x-auto">
                    <table className="text-xs border-collapse w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Term</th>
                          {docLabels.map((dl, i) => (
                            <th key={i} className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">{dl}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayTerms.map(term => (
                          <tr key={term} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                            <td className="px-3 py-1.5 font-mono text-gray-800 dark:text-gray-200">{term}</td>
                            {result.tfMatrix.map((row, di) => {
                              const val = row[term] ?? 0;
                              return (
                                <td key={di} className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400">
                                  {val > 0 ? val.toFixed(4) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}

              {/* ── Top Keywords ── */}
              {tab === 'keywords' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {result.topKeywords.map((kws, di) => (
                      <Card key={di} title={`Top Keywords — Doc ${di + 1}`}
                        subtitle={docs[di]?.slice(0, 60) + (docs[di]?.length > 60 ? '…' : '')}
                      >
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={kws.map(k => ({ term: k.term, score: k.score }))}
                            layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 55 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" fontSize={9} domain={[0, 'auto']} />
                            <YAxis type="category" dataKey="term" fontSize={9} width={50} />
                            <Tooltip formatter={(v: number) => v.toFixed(4)} />
                            <Bar dataKey="score" name="TF-IDF" radius={[0, 3, 3, 0]}
                              fill={CHART_COLORS[di % CHART_COLORS.length]} />
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {kws.map(({ term, score }) => (
                            <span key={term}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: `${CHART_COLORS[di % CHART_COLORS.length]}20`, color: CHART_COLORS[di % CHART_COLORS.length] }}
                            >
                              {term} <span className="opacity-70">{score.toFixed(3)}</span>
                            </span>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Combined top keywords bar chart */}
                  <Card title="Top Keywords Across All Documents">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={(() => {
                          const allKws: Record<string, Record<string, number>> = {};
                          result.topKeywords.forEach((kws, di) => {
                            kws.forEach(({ term, score }) => {
                              allKws[term] = { ...(allKws[term] ?? {}), [`doc${di + 1}`]: score };
                            });
                          });
                          return Object.entries(allKws)
                            .sort((a, b) => {
                              const sumA = Object.values(a[1]).reduce((s, v) => s + v, 0);
                              const sumB = Object.values(b[1]).reduce((s, v) => s + v, 0);
                              return sumB - sumA;
                            })
                            .slice(0, 12)
                            .map(([term, scores]) => ({ term, ...scores }));
                        })()}
                        margin={{ top: 5, right: 20, bottom: 20, left: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="term" fontSize={10} angle={-20} textAnchor="end" />
                        <YAxis fontSize={10} tickFormatter={v => v.toFixed(2)} />
                        <Tooltip formatter={(v: number) => v.toFixed(4)} />
                        <Legend />
                        {docLabels.map((label, i) => (
                          <Bar key={i} dataKey={`doc${i + 1}`} name={label}
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                            radius={[3, 3, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
              )}
            </>
          )}
        </Tabs>
      ) : (
        <InfoBox type="info" title="Ready to Compute">
          Enter or edit your documents above and click <strong>Compute TF-IDF</strong> to see the vocabulary,
          TF table, IDF values, TF-IDF matrix heatmap, and top keywords per document.
        </InfoBox>
      )}

      {/* Interpretation */}
      <Card title="Interpretation Guide">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoBox type="success" title="High TF-IDF">
            A term appears frequently in this document but rarely in others. It is a strong discriminating keyword for that document.
          </InfoBox>
          <InfoBox type="warning" title="Low TF-IDF (common words)">
            Stop words like "the", "is", "a" have near-zero TF-IDF because they appear in all documents — IDF dampens them.
          </InfoBox>
          <InfoBox type="info" title="Uses of TF-IDF">
            Document classification, information retrieval, keyword extraction, search engine ranking, and feature generation for ML models.
          </InfoBox>
          <InfoBox type="info" title="Limitations">
            Does not capture word order or semantics. Consider Word2Vec / BERT for semantic similarity tasks.
          </InfoBox>
        </div>
      </Card>
    </div>
  );
}
