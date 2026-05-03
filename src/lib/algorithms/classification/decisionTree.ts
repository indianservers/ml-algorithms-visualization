import { gini, entropy } from '../../math/statistics';

export type SplitCriterion = 'gini' | 'entropy';

export interface TreeNode {
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  classLabel?: number;
  samples?: number;
  impurity?: number;
  classCounts?: Record<number, number>;
}

function classCounts(y: number[]): Record<number, number> {
  const counts: Record<number, number> = {};
  y.forEach(v => { counts[v] = (counts[v] ?? 0) + 1; });
  return counts;
}

function impurity(y: number[], criterion: SplitCriterion): number {
  const n = y.length;
  if (n === 0) return 0;
  const counts = classCounts(y);
  const probs = Object.values(counts).map(c => c / n);
  return criterion === 'gini' ? gini(probs) : entropy(probs);
}

function majorityClass(y: number[]): number {
  const counts = classCounts(y);
  return parseInt(Object.entries(counts).reduce((a, b) => b[1] > a[1] ? b : a)[0]);
}

function bestSplit(X: number[][], y: number[], criterion: SplitCriterion, minSamples: number): { featureIndex: number; threshold: number; gain: number } | null {
  const n = y.length;
  const p = X[0].length;
  let bestGain = -Infinity;
  let bestFeature = -1;
  let bestThreshold = 0;
  const parentImpurity = impurity(y, criterion);

  for (let j = 0; j < p; j++) {
    const vals = [...new Set(X.map(row => row[j]))].sort((a, b) => a - b);
    for (let k = 0; k < vals.length - 1; k++) {
      const threshold = (vals[k] + vals[k + 1]) / 2;
      const leftIdx = X.map((row, i) => row[j] <= threshold ? i : -1).filter(i => i >= 0);
      const rightIdx = X.map((row, i) => row[j] > threshold ? i : -1).filter(i => i >= 0);
      if (leftIdx.length < minSamples || rightIdx.length < minSamples) continue;
      const leftY = leftIdx.map(i => y[i]);
      const rightY = rightIdx.map(i => y[i]);
      const gain = parentImpurity - (leftY.length / n) * impurity(leftY, criterion) - (rightY.length / n) * impurity(rightY, criterion);
      if (gain > bestGain) { bestGain = gain; bestFeature = j; bestThreshold = threshold; }
    }
  }

  if (bestFeature === -1) return null;
  return { featureIndex: bestFeature, threshold: bestThreshold, gain: bestGain };
}

export function buildDecisionTree(
  X: number[][],
  y: number[],
  maxDepth: number,
  minSamples: number,
  criterion: SplitCriterion = 'gini',
  depth = 0
): TreeNode {
  const counts = classCounts(y);
  const node: TreeNode = { samples: y.length, impurity: impurity(y, criterion), classCounts: counts };

  if (depth >= maxDepth || y.length < minSamples * 2 || new Set(y).size === 1) {
    node.classLabel = majorityClass(y);
    return node;
  }

  const split = bestSplit(X, y, criterion, minSamples);
  if (!split) { node.classLabel = majorityClass(y); return node; }

  node.featureIndex = split.featureIndex;
  node.threshold = split.threshold;
  const leftIdx = X.map((row, i) => row[split.featureIndex!] <= split.threshold! ? i : -1).filter(i => i >= 0);
  const rightIdx = X.map((row, i) => row[split.featureIndex!] > split.threshold! ? i : -1).filter(i => i >= 0);
  node.left = buildDecisionTree(leftIdx.map(i => X[i]), leftIdx.map(i => y[i]), maxDepth, minSamples, criterion, depth + 1);
  node.right = buildDecisionTree(rightIdx.map(i => X[i]), rightIdx.map(i => y[i]), maxDepth, minSamples, criterion, depth + 1);
  return node;
}

export function predictTree(node: TreeNode, x: number[]): number {
  if (node.classLabel !== undefined) return node.classLabel;
  if (x[node.featureIndex!] <= node.threshold!) return predictTree(node.left!, x);
  return predictTree(node.right!, x);
}

export function treeDepth(node: TreeNode): number {
  if (node.classLabel !== undefined) return 0;
  return 1 + Math.max(treeDepth(node.left!), treeDepth(node.right!));
}
