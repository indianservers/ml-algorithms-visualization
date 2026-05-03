import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { GitBranch } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { Tabs } from '../../../components/common/Tabs';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { HyperparameterPanel, HyperparamDef } from '../../../components/ml/HyperparameterPanel';
import { LearningPanel } from '../../../components/ml/LearningPanel';
import {
  buildDecisionTree, predictTree, treeDepth, TreeNode, SplitCriterion,
} from '../../../../lib/algorithms/classification/decisionTree';
import { irisDataset } from '../../../../data/sampleDatasets';

const CLASS_COLORS = ['#3b82f6', '#ef4444', '#10b981'];
const CLASS_NAMES = ['setosa', 'versicolor', 'virginica'];
const FEATURE_NAMES = ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'];
const FEATURE_LABELS = ['Sepal Len', 'Sepal Wid', 'Petal Len', 'Petal Wid'];

// ─── Tree SVG renderer ───────────────────────────────────────────────────────

interface NodeRenderInfo {
  node: TreeNode;
  x: number;
  y: number;
  width: number;
  depth: number;
  path: boolean; // is this node on the prediction path?
}

function collectNodes(
  node: TreeNode,
  x: number,
  y: number,
  width: number,
  depth: number,
  pathNodes: Set<TreeNode>,
  result: NodeRenderInfo[],
): void {
  result.push({ node, x, y, width, depth, path: pathNodes.has(node) });
  if (node.left) collectNodes(node.left, x - width / 4, y + 80, width / 2, depth + 1, pathNodes, result);
  if (node.right) collectNodes(node.right, x + width / 4, y + 80, width / 2, depth + 1, pathNodes, result);
}

function collectEdges(
  node: TreeNode,
  x: number,
  y: number,
  width: number,
  pathNodes: Set<TreeNode>,
  result: { x1: number; y1: number; x2: number; y2: number; onPath: boolean }[],
): void {
  if (node.left) {
    const cx = x - width / 4, cy = y + 80;
    result.push({ x1: x, y1: y + 28, x2: cx, y2: cy - 28, onPath: pathNodes.has(node.left) && pathNodes.has(node) });
    collectEdges(node.left, cx, cy, width / 2, pathNodes, result);
  }
  if (node.right) {
    const cx = x + width / 4, cy = y + 80;
    result.push({ x1: x, y1: y + 28, x2: cx, y2: cy - 28, onPath: pathNodes.has(node.right) && pathNodes.has(node) });
    collectEdges(node.right, cx, cy, width / 2, pathNodes, result);
  }
}

function TreeDiagram({ root, pathNodes }: { root: TreeNode; pathNodes: Set<TreeNode> }) {
  const nodes: NodeRenderInfo[] = [];
  const edges: { x1: number; y1: number; x2: number; y2: number; onPath: boolean }[] = [];
  const depth = treeDepth(root);
  const svgWidth = Math.min(900, Math.max(400, 100 * Math.pow(2, depth)));
  const svgHeight = (depth + 1) * 90 + 40;

  collectNodes(root, svgWidth / 2, 50, svgWidth, 0, pathNodes, nodes);
  collectEdges(root, svgWidth / 2, 50, svgWidth, pathNodes, edges);

  return (
    <div className="overflow-x-auto">
      <svg width={svgWidth} height={svgHeight} className="text-xs">
        {/* Edges */}
        {edges.map((e, i) => (
          <line
            key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke={e.onPath ? '#f59e0b' : '#9ca3af'}
            strokeWidth={e.onPath ? 2.5 : 1.5}
            strokeDasharray={e.onPath ? undefined : '4 2'}
          />
        ))}
        {/* Nodes */}
        {nodes.map((n, i) => {
          const isLeaf = n.node.classLabel !== undefined;
          const boxW = 90, boxH = isLeaf ? 44 : 58;
          const classLabel = n.node.classLabel ?? -1;
          const featureIdx = n.node.featureIndex ?? 0;
          const impurity = n.node.impurity ?? 0;
          const samples = n.node.samples ?? 0;
          const fillColor = isLeaf
            ? CLASS_COLORS[classLabel % CLASS_COLORS.length] + '33'
            : n.path ? '#fef3c7' : '#f9fafb';
          const strokeColor = n.path ? '#f59e0b' : isLeaf ? CLASS_COLORS[classLabel % CLASS_COLORS.length] : '#d1d5db';

          return (
            <g key={i} transform={`translate(${n.x - boxW / 2}, ${n.y - boxH / 2})`}>
              <rect
                width={boxW} height={boxH} rx={6}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={n.path ? 2 : 1}
              />
              {isLeaf ? (
                <>
                  <text x={boxW / 2} y={16} textAnchor="middle" fontSize={10} fontWeight="bold"
                    fill={CLASS_COLORS[classLabel % CLASS_COLORS.length]}>
                    {CLASS_NAMES[classLabel] ?? `C${classLabel}`}
                  </text>
                  <text x={boxW / 2} y={30} textAnchor="middle" fontSize={9} fill="#6b7280">n={samples}</text>
                  <text x={boxW / 2} y={42} textAnchor="middle" fontSize={9} fill="#6b7280">imp={impurity.toFixed(3)}</text>
                </>
              ) : (
                <>
                  <text x={boxW / 2} y={14} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#1d4ed8">
                    {FEATURE_LABELS[featureIdx]}
                  </text>
                  <text x={boxW / 2} y={27} textAnchor="middle" fontSize={10} fill="#374151">
                    ≤ {n.node.threshold?.toFixed(2)}
                  </text>
                  <text x={boxW / 2} y={40} textAnchor="middle" fontSize={9} fill="#6b7280">n={samples}</text>
                  <text x={boxW / 2} y={52} textAnchor="middle" fontSize={9} fill="#6b7280">imp={impurity.toFixed(3)}</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Count leaves ─────────────────────────────────────────────────────────────
function countLeaves(node: TreeNode): number {
  if (node.classLabel !== undefined) return 1;
  return (node.left ? countLeaves(node.left) : 0) + (node.right ? countLeaves(node.right) : 0);
}

// ─── Collect prediction path ──────────────────────────────────────────────────
function collectPath(node: TreeNode, x: number[], path: Set<TreeNode>): void {
  path.add(node);
  if (node.classLabel !== undefined) return;
  if (x[node.featureIndex!] <= node.threshold!) {
    if (node.left) collectPath(node.left, x, path);
  } else {
    if (node.right) collectPath(node.right, x, path);
  }
}

// ─── Feature importance ───────────────────────────────────────────────────────
function computeFeatureImportance(node: TreeNode, importance: number[] = Array(4).fill(0), totalSamples: number): number[] {
  if (node.classLabel !== undefined) return importance;
  const fi = node.featureIndex!;
  const leftN = node.left?.samples ?? 0;
  const rightN = node.right?.samples ?? 0;
  const n = node.samples ?? totalSamples;
  const gain = n * (node.impurity ?? 0)
    - leftN * (node.left?.impurity ?? 0)
    - rightN * (node.right?.impurity ?? 0);
  importance[fi] += gain / totalSamples;
  if (node.left) computeFeatureImportance(node.left, importance, totalSamples);
  if (node.right) computeFeatureImportance(node.right, importance, totalSamples);
  return importance;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DecisionTreeClassificationPage() {
  const [maxDepth, setMaxDepth] = useState(3);
  const [minSamples, setMinSamples] = useState(2);
  const [criterion, setCriterion] = useState<SplitCriterion>('gini');
  const [predInput, setPredInput] = useState({
    sepal_length: '5.5',
    sepal_width: '3.0',
    petal_length: '4.0',
    petal_width: '1.3',
  });

  const rawData = irisDataset.data as Record<string, unknown>[];
  const X = rawData.map(d => FEATURE_NAMES.map(f => d[f] as number));
  const y = rawData.map(d => {
    const sp = d['species'] as string;
    return sp === 'setosa' ? 0 : sp === 'versicolor' ? 1 : 2;
  });

  const tree = useMemo(() =>
    buildDecisionTree(X, y, maxDepth, minSamples, criterion),
    [maxDepth, minSamples, criterion]
  );

  const predictions = useMemo(() => X.map(xi => predictTree(tree, xi)), [tree, X]);
  const accuracy = useMemo(() => predictions.filter((p, i) => p === y[i]).length / y.length, [predictions, y]);
  const depth = useMemo(() => treeDepth(tree), [tree]);
  const leaves = useMemo(() => countLeaves(tree), [tree]);

  // Confusion matrix (3×3)
  const confMatrix = useMemo(() => {
    const mat = Array.from({ length: 3 }, () => Array(3).fill(0));
    y.forEach((actual, i) => {
      mat[actual][predictions[i]]++;
    });
    return mat;
  }, [y, predictions]);

  // Query point
  const queryFeatures = FEATURE_NAMES.map(f => parseFloat(predInput[f as keyof typeof predInput]) || 0);
  const predictedClass = useMemo(() => predictTree(tree, queryFeatures), [tree, queryFeatures]);

  const pathNodes = useMemo(() => {
    const path = new Set<TreeNode>();
    collectPath(tree, queryFeatures, path);
    return path;
  }, [tree, queryFeatures]);

  // Feature importance
  const importance = useMemo(() => {
    const imp = computeFeatureImportance(tree, Array(4).fill(0), X.length);
    const total = imp.reduce((a, b) => a + b, 0) || 1;
    return imp.map(v => v / total);
  }, [tree, X.length]);

  const importanceData = FEATURE_LABELS.map((label, i) => ({
    feature: label,
    importance: parseFloat((importance[i] * 100).toFixed(2)),
  })).sort((a, b) => b.importance - a.importance);

  const hyperparamDefs: HyperparamDef[] = [
    { key: 'maxDepth', label: 'Max Depth', type: 'range', min: 1, max: 8, step: 1, value: maxDepth },
    { key: 'minSamples', label: 'Min Samples Split', type: 'range', min: 2, max: 20, step: 1, value: minSamples },
    {
      key: 'criterion', label: 'Split Criterion', type: 'select', value: criterion,
      options: [
        { value: 'gini', label: 'Gini Impurity' },
        { value: 'entropy', label: 'Information Gain (Entropy)' },
      ],
    },
  ];

  const handleParamChange = useCallback((key: string, value: number | string | boolean) => {
    if (key === 'maxDepth') setMaxDepth(value as number);
    if (key === 'minSamples') setMinSamples(value as number);
    if (key === 'criterion') setCriterion(value as SplitCriterion);
  }, []);

  return (
    <div className="space-y-6 p-4 max-w-7xl mx-auto">
      <PageHeader
        title="Decision Tree Classifier"
        subtitle="Recursive binary splitting on feature thresholds to build an interpretable tree for classification."
        badge="Intermediate"
        category="Supervised Learning › Classification"
        icon={<GitBranch size={22} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <HyperparameterPanel params={hyperparamDefs} onChange={handleParamChange} />

          <MetricsPanel
            title="Tree Performance"
            metrics={[
              { label: 'Accuracy', value: accuracy, format: 'percent', color: accuracy > 0.85 ? 'green' : 'default' },
              { label: 'Tree Depth', value: depth, format: 'fixed2' },
              { label: 'Num Leaves', value: leaves, format: 'fixed2' },
              { label: 'Samples', value: X.length, format: 'fixed2' },
            ]}
          />

          <Card title="Query Prediction">
            <div className="grid grid-cols-2 gap-2 mb-3">
              {FEATURE_NAMES.map((f, i) => (
                <div key={f}>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{FEATURE_LABELS[i]}</label>
                  <input
                    type="number" step="0.1"
                    value={predInput[f as keyof typeof predInput]}
                    onChange={e => setPredInput(prev => ({ ...prev, [f]: e.target.value }))}
                    className="w-full text-xs font-mono bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-gray-800 dark:text-gray-100"
                  />
                </div>
              ))}
            </div>
            <div
              className="text-center py-3 rounded-xl font-bold text-base"
              style={{ backgroundColor: CLASS_COLORS[predictedClass] + '33', color: CLASS_COLORS[predictedClass] }}
            >
              Predicted: {CLASS_NAMES[predictedClass]}
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              Path highlighted in amber on the tree diagram
            </p>
          </Card>

          <Card title="Confusion Matrix (3×3)">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-center">
                <thead>
                  <tr>
                    <th className="py-1 text-gray-400 text-left">Act \ Pred</th>
                    {CLASS_NAMES.map(n => <th key={n} className="py-1 text-gray-500">{n.slice(0, 4)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {CLASS_NAMES.map((name, i) => (
                    <tr key={i}>
                      <td className="py-1 font-medium text-left" style={{ color: CLASS_COLORS[i] }}>{name.slice(0, 4)}</td>
                      {CLASS_NAMES.map((_, j) => (
                        <td
                          key={j}
                          className={`py-2 font-mono font-bold rounded ${i === j ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : confMatrix[i][j] > 0 ? 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'text-gray-400'}`}
                        >
                          {confMatrix[i][j]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right charts */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs
            tabs={[
              { id: 'tree', label: 'Tree Diagram' },
              { id: 'importance', label: 'Feature Importance' },
              { id: 'impurity', label: 'Impurity Concepts' },
            ]}
          >
            {(activeTab) => (
              <>
                {activeTab === 'tree' && (
                  <Card title="Decision Tree Structure" subtitle="Blue = internal node (split) | Coloured = leaf (class) | Amber path = query route">
                    <TreeDiagram root={tree} pathNodes={pathNodes} />
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                      {CLASS_NAMES.map((n, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: CLASS_COLORS[i] + '55', border: `2px solid ${CLASS_COLORS[i]}` }} />
                          {n}
                        </span>
                      ))}
                      <span className="flex items-center gap-1">
                        <span className="w-8 h-0.5 bg-yellow-400 inline-block" />
                        Prediction path
                      </span>
                    </div>
                  </Card>
                )}

                {activeTab === 'importance' && (
                  <Card title="Feature Importances" subtitle="Weighted impurity reduction from splits on each feature">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={importanceData} layout="vertical" margin={{ top: 10, right: 30, bottom: 10, left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          type="number" tickFormatter={v => `${v.toFixed(1)}%`}
                          tick={{ fontSize: 11 }}
                          label={{ value: 'Importance (%)', position: 'insideBottom', offset: -5, fontSize: 11 }}
                        />
                        <YAxis type="category" dataKey="feature" tick={{ fontSize: 11 }} width={65} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                        <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                          {importanceData.map((_, i) => (
                            <Cell key={i} fill={['#3b82f6', '#ef4444', '#10b981', '#f59e0b'][i % 4]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-1 text-gray-500">Feature</th>
                            <th className="text-right py-1 text-gray-500">Importance</th>
                            <th className="text-right py-1 text-gray-500">Rank</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importanceData.map((d, i) => (
                            <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                              <td className="py-1.5 text-gray-700 dark:text-gray-300">{d.feature}</td>
                              <td className="text-right font-mono text-blue-600 dark:text-blue-400">{d.importance.toFixed(2)}%</td>
                              <td className="text-right text-gray-400">#{i + 1}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {activeTab === 'impurity' && (
                  <Card title="Gini vs Entropy" subtitle="Two measures of node impurity used to find the best splits">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Gini Impurity</h4>
                        <pre className="font-mono text-xs bg-gray-900 text-green-400 rounded-lg p-3 whitespace-pre-wrap">{`Gini(t) = 1 - Σ pᵢ²

For a 2-class split:
- Pure node: Gini = 0
- 50/50 split: Gini = 0.5

Gain = Gini(parent)
     - wL·Gini(left)
     - wR·Gini(right)`}</pre>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Entropy (Info Gain)</h4>
                        <pre className="font-mono text-xs bg-gray-900 text-yellow-400 rounded-lg p-3 whitespace-pre-wrap">{`H(t) = -Σ pᵢ·log₂(pᵢ)

For a 2-class split:
- Pure node: H = 0
- 50/50 split: H = 1.0

Gain = H(parent)
     - wL·H(left)
     - wR·H(right)`}</pre>
                      </div>
                    </div>

                    {/* Visual comparison: impurity vs fraction */}
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Impurity vs Class Fraction (2-class)</h4>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart
                          data={Array.from({ length: 11 }, (_, i) => {
                            const p = i / 10;
                            const gini = 1 - p * p - (1 - p) * (1 - p);
                            const entropy = p > 0 && p < 1 ? -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p)) : 0;
                            return { p: p.toFixed(1), gini: parseFloat(gini.toFixed(4)), entropy: parseFloat(entropy.toFixed(4)) };
                          })}
                          margin={{ top: 5, right: 20, bottom: 20, left: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="p" tick={{ fontSize: 10 }} label={{ value: 'P(class=1)', position: 'insideBottom', offset: -10, fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} domain={[0, 1.2]} />
                          <Tooltip formatter={(v: number) => v.toFixed(4)} />
                          <Bar dataKey="gini" fill="#3b82f6" opacity={0.7} name="Gini" />
                          <Bar dataKey="entropy" fill="#f59e0b" opacity={0.7} name="Entropy (scaled)" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}
              </>
            )}
          </Tabs>
        </div>
      </div>

      <LearningPanel
        sections={[
          {
            title: 'How Decision Trees Are Built',
            content: (
              <div className="space-y-2">
                <p>A decision tree is built recursively using a greedy top-down strategy called CART (Classification and Regression Trees):</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>At each node, try every possible split (feature × threshold)</li>
                  <li>Choose the split that maximises information gain (or minimises weighted impurity)</li>
                  <li>Recurse on left and right subsets</li>
                  <li>Stop when max depth is reached, node has &lt; minSamples, or all samples are the same class</li>
                </ol>
              </div>
            ),
          },
          {
            title: 'Information Gain',
            content: (
              <div className="space-y-2">
                <p>Information gain measures how much a split reduces impurity:</p>
                <pre className="bg-gray-100 dark:bg-gray-700 rounded p-2 text-xs">{`IG = Impurity(parent) - (nL/n)·Impurity(left) - (nR/n)·Impurity(right)

We choose the split that maximises IG at each node.`}</pre>
              </div>
            ),
          },
          {
            title: 'Overfitting & Pruning',
            content: (
              <div className="space-y-2">
                <p>Deep trees memorise training data. Regularisation strategies:</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li><strong>Max depth:</strong> Limit tree growth directly</li>
                  <li><strong>Min samples split:</strong> Require minimum samples to split</li>
                  <li><strong>Post-pruning:</strong> Grow full tree, then prune back using validation set</li>
                  <li><strong>Ensembles:</strong> Random forests / gradient boosting average many trees</li>
                </ul>
              </div>
            ),
          },
          {
            title: 'Prediction Path',
            content: (
              <p>Prediction is O(depth) — start at the root and follow left if xⱼ ≤ threshold, else right, until a leaf is reached. The amber highlighted path in the tree diagram shows which nodes your query traverses.</p>
            ),
          },
        ]}
      />
    </div>
  );
}
