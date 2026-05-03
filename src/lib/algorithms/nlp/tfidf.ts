export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
}

export function buildVocabulary(docs: string[][]): string[] {
  const vocab = new Set<string>();
  docs.forEach(doc => doc.forEach(t => vocab.add(t)));
  return [...vocab].sort();
}

export function termFrequency(doc: string[], vocab: string[]): Record<string, number> {
  const n = doc.length || 1;
  const counts: Record<string, number> = {};
  doc.forEach(t => { counts[t] = (counts[t] ?? 0) + 1; });
  const tf: Record<string, number> = {};
  vocab.forEach(term => { tf[term] = (counts[term] ?? 0) / n; });
  return tf;
}

export function inverseDocumentFrequency(docs: string[][], vocab: string[]): Record<string, number> {
  const N = docs.length;
  const idf: Record<string, number> = {};
  vocab.forEach(term => {
    const df = docs.filter(doc => doc.includes(term)).length;
    idf[term] = Math.log((N + 1) / (df + 1)) + 1;
  });
  return idf;
}

export interface TFIDFResult {
  vocabulary: string[];
  tfMatrix: Record<string, number>[];
  idf: Record<string, number>;
  tfidfMatrix: Record<string, number>[];
  topKeywords: { term: string; score: number }[][];
}

export function computeTFIDF(rawDocs: string[]): TFIDFResult {
  const docs = rawDocs.map(tokenize);
  const vocabulary = buildVocabulary(docs);
  const tfMatrix = docs.map(doc => termFrequency(doc, vocabulary));
  const idf = inverseDocumentFrequency(docs, vocabulary);
  const tfidfMatrix = tfMatrix.map(tf => {
    const row: Record<string, number> = {};
    vocabulary.forEach(term => { row[term] = tf[term] * idf[term]; });
    return row;
  });
  const topKeywords = tfidfMatrix.map(row =>
    Object.entries(row)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([term, score]) => ({ term, score: parseFloat(score.toFixed(4)) }))
  );
  return { vocabulary, tfMatrix, idf, tfidfMatrix, topKeywords };
}
