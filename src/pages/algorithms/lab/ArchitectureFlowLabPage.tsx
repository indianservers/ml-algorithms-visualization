import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, BrainCircuit, Download, Eye, GitBranch, Info, Layers3, Maximize2, MousePointer2, Network, Pause, Play, RotateCcw, Route, Save, Share2, Sparkles, StepBack, StepForward, Target, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card } from '../../../components/common/Card';

type Token = {
  text: string;
  y: number;
};

type Stream = {
  label: 'Q' | 'K' | 'V';
  color: string;
  fromX: number;
  toX: number;
  yOffset: number;
};

type StreamLabel = Stream['label'];
type MatrixCell = { row: number; col: number } | null;
type FlowStepId = 'embedding' | 'qkv' | 'attention' | 'mlp' | 'output';
type Speed = 'Slow' | 'Normal' | 'Fast';
type VisualMode = 'transformer' | 'tree' | 'graph';
type LearningMode = 'teaching' | 'learning' | 'practice';
type VisibleLayer = 'signal' | 'qkv' | 'attention' | 'mlp' | 'output';
type VisibleLayerState = Record<VisibleLayer, boolean>;

type TreeNode = {
  id: string;
  label: string;
  detail: string;
  x: number;
  y: number;
  kind: 'root' | 'split' | 'leaf';
  color: string;
};

type TreeEdge = {
  from: string;
  to: string;
  label: string;
};

type GraphNode = {
  id: string;
  label: string;
  detail: string;
  x: number;
  y: number;
  color: string;
};

type GraphEdge = {
  from: string;
  to: string;
  weight: number;
  label: string;
};

type GraphEdgeSelection = string | null;

type VisualPreset = {
  id: string;
  label: string;
  visualMode: VisualMode;
  activeTreeNodeId: string;
  activeGraphNodeId: string;
  lockedTokenIndex: number | null;
  head: number;
  block: number;
  activeStepIndex: number;
  speed: Speed;
};

const tokens: Token[] = [
  { text: 'Data', y: 102 },
  { text: 'visualization', y: 152 },
  { text: 'makes', y: 202 },
  { text: 'models', y: 252 },
  { text: 'easier', y: 302 },
  { text: 'to', y: 352 },
  { text: 'read', y: 402 },
];

const streams: Stream[] = [
  { label: 'Q', color: '#2563eb', fromX: 238, toX: 464, yOffset: -14 },
  { label: 'K', color: '#ef4444', fromX: 238, toX: 512, yOffset: 0 },
  { label: 'V', color: '#10b981', fromX: 238, toX: 560, yOffset: 14 },
];

const probabilities = [
  ['quickly', 0.192, '#6d28d9'],
  ['clearly', 0.151, '#2563eb'],
  ['visually', 0.118, '#0891b2'],
  ['better', 0.091, '#64748b'],
  ['together', 0.074, '#64748b'],
  ['through', 0.062, '#64748b'],
  ['stepwise', 0.051, '#64748b'],
  ['now', 0.043, '#64748b'],
];

const matrixValues = [
  [0.92, 0.68, 0.54, 0.36, 0.23, 0.14, 0.1],
  [0.5, 0.88, 0.79, 0.58, 0.31, 0.21, 0.18],
  [0.28, 0.45, 0.82, 0.69, 0.51, 0.24, 0.16],
  [0.16, 0.3, 0.5, 0.9, 0.75, 0.42, 0.26],
  [0.11, 0.2, 0.32, 0.55, 0.86, 0.65, 0.39],
  [0.1, 0.16, 0.25, 0.38, 0.58, 0.8, 0.61],
  [0.08, 0.12, 0.19, 0.3, 0.46, 0.62, 0.84],
];

const flowSteps: Array<{ id: FlowStepId; label: string; summary: string; detail: string }> = [
  {
    id: 'embedding',
    label: 'Embedding',
    summary: 'Each token becomes a vector.',
    detail: 'The model first converts words into numeric positions in a high-dimensional space. Similar ideas land near each other, which gives later layers something mathematical to compare.',
  },
  {
    id: 'qkv',
    label: 'Q / K / V',
    summary: 'One token creates three views.',
    detail: 'Query asks what the token is looking for, Key describes what every token offers, and Value carries the information that will be mixed into the next representation.',
  },
  {
    id: 'attention',
    label: 'Attention',
    summary: 'The selected token chooses context.',
    detail: 'The attention matrix scores how strongly one token should listen to another. Brighter dots mean more context flows through that connection.',
  },
  {
    id: 'mlp',
    label: 'MLP',
    summary: 'The mixed context is transformed.',
    detail: 'After attention combines information across tokens, the MLP reshapes each token representation. The residual path preserves useful earlier signal.',
  },
  {
    id: 'output',
    label: 'Output',
    summary: 'The model ranks possible next tokens.',
    detail: 'The final representation is converted into probabilities. Higher bars are words the model currently considers more likely.',
  },
];

const speedDelays: Record<Speed, number> = {
  Slow: 1800,
  Normal: 1100,
  Fast: 650,
};

const PRESETS_KEY = 'mlSuite.architectureFlow.presets';

const visualModes: Array<{ id: VisualMode; label: string; summary: string }> = [
  { id: 'transformer', label: 'Transformer Flow', summary: 'See how words pass through attention and become the next-word guess.' },
  { id: 'tree', label: 'Decision Tree', summary: 'Follow yes/no questions until the model reaches a prediction.' },
  { id: 'graph', label: 'Graph Flow', summary: 'See how information moves between states, memory, scores, and decisions.' },
];

const defaultVisibleLayers: VisibleLayerState = {
  signal: true,
  qkv: true,
  attention: true,
  mlp: true,
  output: true,
};

const layerControls: Array<{ id: VisibleLayer; label: string; detail: string; color: string }> = [
  { id: 'signal', label: 'Signal', detail: 'Animated current-step path', color: 'bg-indigo-600' },
  { id: 'qkv', label: 'Q / K / V', detail: 'Query, key, and value streams', color: 'bg-emerald-600' },
  { id: 'attention', label: 'Attention', detail: 'Weights and context mixing', color: 'bg-violet-600' },
  { id: 'mlp', label: 'MLP', detail: 'Residual transform lanes', color: 'bg-cyan-600' },
  { id: 'output', label: 'Output', detail: 'Next-token probability bars', color: 'bg-fuchsia-600' },
];

function LayerPreview({ layer }: { layer: VisibleLayer }) {
  if (layer === 'signal') {
    return (
      <svg viewBox="0 0 48 24" className="h-7 w-14" aria-hidden="true">
        <path d="M 5 12 C 18 3, 28 21, 43 10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
        <path d="M 39 6 L 44 10 L 38 14" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  if (layer === 'qkv') {
    return (
      <svg viewBox="0 0 48 24" className="h-7 w-14" aria-hidden="true">
        {[5, 12, 19].map((y, index) => <path key={y} d={`M 4 ${y} C 18 ${y - 6}, 28 ${y + 6}, 44 ${y}`} fill="none" stroke="currentColor" strokeWidth={index === 1 ? 2.5 : 1.8} />)}
      </svg>
    );
  }
  if (layer === 'attention') {
    return (
      <svg viewBox="0 0 48 24" className="h-7 w-14" aria-hidden="true">
        {Array.from({ length: 9 }, (_, index) => <circle key={index} cx={14 + (index % 3) * 10} cy={5 + Math.floor(index / 3) * 7} r={index === 4 ? 3.5 : 2.2} fill="currentColor" opacity={index === 4 ? 1 : 0.45} />)}
      </svg>
    );
  }
  if (layer === 'mlp') {
    return (
      <svg viewBox="0 0 48 24" className="h-7 w-14" aria-hidden="true">
        <rect x="5" y="5" width="14" height="14" rx="3" fill="currentColor" opacity="0.4" />
        <rect x="28" y="5" width="14" height="14" rx="3" fill="currentColor" opacity="0.85" />
        <path d="M 19 12 L 28 12" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 24" className="h-7 w-14" aria-hidden="true">
      {[8, 16, 24, 32].map((x, index) => <rect key={x} x={x} y={15 - index * 3} width="5" height={5 + index * 3} rx="2" fill="currentColor" opacity={0.45 + index * 0.15} />)}
    </svg>
  );
}

const treeNodes: TreeNode[] = [
  { id: 'root', label: 'feature_1 <= 0.48', detail: 'Root split. The tree first asks the most useful question and sends each row left or right.', x: 520, y: 72, kind: 'root', color: '#2563eb' },
  { id: 'left', label: 'feature_2 <= 1.20', detail: 'Second split. Rows on this side still need another question before the class is clear.', x: 300, y: 190, kind: 'split', color: '#7c3aed' },
  { id: 'right', label: 'feature_3 <= 2.10', detail: 'Second split. This branch separates high-confidence positives from uncertain examples.', x: 740, y: 190, kind: 'split', color: '#0891b2' },
  { id: 'leaf-a', label: 'Class A', detail: 'Leaf prediction. Rows that arrive here are mostly class A, so the model predicts class A.', x: 180, y: 330, kind: 'leaf', color: '#16a34a' },
  { id: 'leaf-b', label: 'Class B', detail: 'Leaf prediction. This path catches mixed rows where feature_2 is larger.', x: 420, y: 330, kind: 'leaf', color: '#f59e0b' },
  { id: 'leaf-c', label: 'Class C', detail: 'Leaf prediction. This branch catches strong class C evidence.', x: 640, y: 330, kind: 'leaf', color: '#06b6d4' },
  { id: 'leaf-d', label: 'Class B', detail: 'Leaf prediction. A high feature_3 value sends the row to this class B leaf.', x: 880, y: 330, kind: 'leaf', color: '#f59e0b' },
];

const treeEdges: TreeEdge[] = [
  { from: 'root', to: 'left', label: 'yes' },
  { from: 'root', to: 'right', label: 'no' },
  { from: 'left', to: 'leaf-a', label: 'yes' },
  { from: 'left', to: 'leaf-b', label: 'no' },
  { from: 'right', to: 'leaf-c', label: 'yes' },
  { from: 'right', to: 'leaf-d', label: 'no' },
];

const graphNodes: GraphNode[] = [
  { id: 'raw', label: 'Raw data', detail: 'Incoming rows, tokens, images, or states enter the model pipeline here.', x: 150, y: 210, color: '#2563eb' },
  { id: 'features', label: 'Features', detail: 'The model transforms raw values into numeric features it can compare.', x: 360, y: 120, color: '#0891b2' },
  { id: 'memory', label: 'Memory', detail: 'A state, cache, or embedding bank stores useful context from earlier steps.', x: 360, y: 300, color: '#7c3aed' },
  { id: 'score', label: 'Score', detail: 'Features and memory combine into scores, logits, distances, or rewards.', x: 610, y: 210, color: '#f59e0b' },
  { id: 'decision', label: 'Decision', detail: 'The highest-scoring option becomes a prediction, action, or next token.', x: 850, y: 210, color: '#16a34a' },
];

const graphEdges: GraphEdge[] = [
  { from: 'raw', to: 'features', weight: 0.78, label: 'encode' },
  { from: 'raw', to: 'memory', weight: 0.42, label: 'context' },
  { from: 'features', to: 'score', weight: 0.86, label: 'project' },
  { from: 'memory', to: 'score', weight: 0.64, label: 'retrieve' },
  { from: 'score', to: 'decision', weight: 0.91, label: 'argmax' },
  { from: 'decision', to: 'memory', weight: 0.31, label: 'feedback' },
];

const teachingNotes: Record<VisualMode, Array<{ label: string; detail: string }>> = {
  transformer: [
    { label: 'Token focus', detail: 'Lock one token and watch how Q, K, V, attention, MLP, and probability output change around it.' },
    { label: 'Head behavior', detail: 'Switch heads to show that every attention head can emphasize a different pattern.' },
    { label: 'Layer depth', detail: 'Move across blocks to explain how later layers remix earlier representations.' },
  ],
  tree: [
    { label: 'Path logic', detail: 'Every prediction is a route from the root through yes/no split decisions.' },
    { label: 'Leaf meaning', detail: 'Leaves are not magic answers; they summarize the training rows that reached that endpoint.' },
    { label: 'Model limits', detail: 'A shallow tree is readable, while deeper trees can overfit and become harder to trust.' },
  ],
  graph: [
    { label: 'Node roles', detail: 'Nodes represent states or transformations; edges explain how information moves.' },
    { label: 'Edge strength', detail: 'Thicker edges indicate stronger or more confident transitions in the illustrated flow.' },
    { label: 'Feedback loops', detail: 'Loops are useful for memory, recurrence, reinforcement learning, and graph message passing.' },
  ],
};

const beginnerGuides: Record<VisualMode, { plain: string; readOrder: string[]; tryThis: string }> = {
  transformer: {
    plain: 'A transformer reads the input words, decides which words matter to each other, then ranks likely next words. You do not need to understand every line at once. Start from the selected word, follow the purple signal, then look at the probability bars on the right.',
    readOrder: ['Pick or hover a word on the left.', 'Press Play lesson to move one stage at a time.', 'Use layer visibility to hide parts that feel noisy.', 'Read the output bars as the model\'s next-word guesses.'],
    tryThis: 'Click the word "visualization", then hide MLP and Output to focus only on attention.',
  },
  tree: {
    plain: 'A decision tree is a chain of simple questions. Each answer sends the example down one branch. The final leaf is the prediction.',
    readOrder: ['Start at the top question.', 'Follow the highlighted blue route.', 'Read each yes/no branch label.', 'The final highlighted box is the predicted class.'],
    tryThis: 'Click each leaf and compare how the prediction path changes.',
  },
  graph: {
    plain: 'A graph view shows parts of a model as connected steps. Circles are model states or operations. Lines show where information flows next.',
    readOrder: ['Click a circle to inspect a model part.', 'Click a line to inspect a transition.', 'Thicker lines mean stronger flow.', 'A loop means information can feed back into memory.'],
    tryThis: 'Click the feedback edge from Decision to Memory and read the selected edge card.',
  },
};

const learningModes: Array<{ id: LearningMode; label: string; summary: string }> = [
  { id: 'teaching', label: 'Teaching Mode', summary: 'Full step-by-step walkthrough with explanations and usage guidance.' },
  { id: 'learning', label: 'Learning Mode', summary: 'Short mental model, what to notice, and quick checks.' },
  { id: 'practice', label: 'Practice Mode', summary: 'Try tasks first, then reveal hints only when needed.' },
];

const learningModelCards: Record<VisualMode, Array<{ label: string; detail: string }>> = {
  transformer: [
    { label: 'Input', detail: 'Words become numbers so the model can compare them.' },
    { label: 'Attention', detail: 'Each word chooses which other words give useful context.' },
    { label: 'Output', detail: 'The model turns the final signal into next-word probabilities.' },
  ],
  tree: [
    { label: 'Question', detail: 'Each split asks one yes/no rule about the data.' },
    { label: 'Route', detail: 'Answers move the example through the highlighted path.' },
    { label: 'Prediction', detail: 'The leaf at the end is the model decision.' },
  ],
  graph: [
    { label: 'Node', detail: 'A circle is a state, memory, feature, score, or decision.' },
    { label: 'Edge', detail: 'A line is information moving from one model part to another.' },
    { label: 'Loop', detail: 'Feedback sends decisions back into memory for future steps.' },
  ],
};

const practiceTasks: Record<VisualMode, Array<{ task: string; hint: string; answer: string }>> = {
  transformer: [
    { task: 'Lock the token "visualization".', hint: 'Click the token text on the left side of the transformer canvas.', answer: 'The selected token chip should read visualization.' },
    { task: 'Hide the output layer and focus only on attention.', hint: 'Use Reduce visual noise, then toggle Output off.', answer: 'The probability bars disappear, leaving the attention flow easier to inspect.' },
    { task: 'Find which word the selected token attends to most.', hint: 'Read the What changed? card above the canvas.', answer: 'The strongest attention word is shown in violet in the What changed? card.' },
  ],
  tree: [
    { task: 'Click a leaf and trace the prediction route.', hint: 'Leaves are the bottom boxes named Class A, Class B, or Class C.', answer: 'The blue highlighted route shows every question the model used.' },
    { task: 'Explain why a leaf is a prediction.', hint: 'Read the Selected question or answer panel.', answer: 'A leaf summarizes rows that reached that endpoint, so it becomes the class prediction.' },
    { task: 'Compare two leaves.', hint: 'Click different bottom boxes and watch the path list change.', answer: 'Different leaves can share early questions but split apart near the end.' },
  ],
  graph: [
    { task: 'Click an edge and read its strength.', hint: 'Click a curved line between two circles.', answer: 'The Selected edge card shows its transition name and strength percentage.' },
    { task: 'Find the feedback loop.', hint: 'Look for a line that goes back to Memory.', answer: 'Decision to Memory is the feedback edge.' },
    { task: 'Explain what Score does.', hint: 'Click the Score circle.', answer: 'Score combines features and memory into values used for the decision.' },
  ],
};

function getAttentionValue(rowIndex: number, colIndex: number, head: number, block: number) {
  const source = matrixValues[(rowIndex + block - 1) % matrixValues.length];
  const shifted = source[(colIndex + head - 1) % source.length];
  const focusBoost = rowIndex === (head + block) % tokens.length ? 0.08 : 0;
  return Math.min(0.98, Math.max(0.06, shifted * (0.88 + head * 0.012) + focusBoost));
}

function getTokenProbability(index: number, selectedTokenIndex: number, head: number, block: number) {
  const base = Number(probabilities[index][1]);
  const tokenBoost = ((selectedTokenIndex + 1) * (index + 2) + head + block) % 7;
  return Math.min(0.34, Math.max(0.024, base + tokenBoost * 0.011 - index * 0.004));
}

function curvePath(fromX: number, fromY: number, toX: number, toY: number) {
  const bend = Math.max(70, Math.abs(toX - fromX) * 0.45);
  return `M ${fromX} ${fromY} C ${fromX + bend} ${fromY}, ${toX - bend} ${toY}, ${toX} ${toY}`;
}

function loadPresets(): VisualPreset[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]') as VisualPreset[];
  } catch {
    return [];
  }
}

function safeNumber(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function getInitialVisualState() {
  if (typeof window === 'undefined') {
    return {
      visualMode: 'transformer' as VisualMode,
      activeTreeNodeId: 'root',
      activeGraphNodeId: 'raw',
      lockedTokenIndex: 0 as number | null,
      head: 3,
      block: 1,
      activeStepIndex: 0,
      speed: 'Normal' as Speed,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') as VisualMode | null;
  const tree = params.get('tree');
  const graph = params.get('graph');
  const nextSpeed = params.get('speed') as Speed | null;
  const token = params.get('token');
  return {
    visualMode: mode && visualModes.some(item => item.id === mode) ? mode : 'transformer',
    activeTreeNodeId: tree && treeNodes.some(node => node.id === tree) ? tree : 'root',
    activeGraphNodeId: graph && graphNodes.some(node => node.id === graph) ? graph : 'raw',
    lockedTokenIndex: token === 'none' ? null : safeNumber(token, 0, 0, tokens.length - 1),
    head: safeNumber(params.get('head'), 3, 1, 12),
    block: safeNumber(params.get('block'), 1, 1, 8),
    activeStepIndex: safeNumber(params.get('step'), 0, 0, flowSteps.length - 1),
    speed: nextSpeed && nextSpeed in speedDelays ? nextSpeed : 'Normal',
  };
}

function StepHighlight({ activeStep }: { activeStep: FlowStepId }) {
  const boxes: Record<FlowStepId, { x: number; y: number; width: number; height: number; color: string }> = {
    embedding: { x: 148, y: 70, width: 102, height: 368, color: '#2563eb' },
    qkv: { x: 438, y: 70, width: 146, height: 230, color: '#10b981' },
    attention: { x: 564, y: 98, width: 172, height: 176, color: '#7c3aed' },
    mlp: { x: 846, y: 86, width: 238, height: 340, color: '#0891b2' },
    output: { x: 1118, y: 78, width: 282, height: 318, color: '#6d28d9' },
  };
  const box = boxes[activeStep];
  return (
    <g>
      <rect
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        rx="22"
        fill={box.color}
        opacity="0.08"
        stroke={box.color}
        strokeWidth="2"
        strokeDasharray="8 8"
        className="animate-pulse"
      />
    </g>
  );
}

function AnimatedSignal({ activeStep, selectedTokenIndex }: { activeStep: FlowStepId; selectedTokenIndex: number }) {
  const y = tokens[selectedTokenIndex].y;
  const paths: Record<FlowStepId, string> = {
    embedding: `M 150 ${y} L 245 ${y}`,
    qkv: curvePath(248, y, 538, 118 + selectedTokenIndex * 13),
    attention: curvePath(536, 118 + selectedTokenIndex * 13, 706, 118 + selectedTokenIndex * 22),
    mlp: curvePath(740, 118 + selectedTokenIndex * 22, 872, 112 + selectedTokenIndex * 42),
    output: curvePath(1076, 112 + selectedTokenIndex * 42, 1230, 94),
  };
  const id = `phase3-signal-${activeStep}-${selectedTokenIndex}`;
  return (
    <g>
      <path id={id} d={paths[activeStep]} fill="none" stroke="#6d28d9" strokeWidth="3" strokeOpacity="0.24" strokeDasharray="6 8" />
      <circle r="7" fill="#6d28d9" opacity="0.92">
        <animateMotion dur="1.3s" repeatCount="indefinite" path={paths[activeStep]} />
      </circle>
    </g>
  );
}

function StreamPath({
  token,
  stream,
  index,
  selectedTokenIndex,
  activeStream,
  onStreamHover,
}: {
  token: Token;
  stream: Stream;
  index: number;
  selectedTokenIndex: number;
  activeStream: StreamLabel | null;
  onStreamHover: (stream: StreamLabel | null) => void;
}) {
  const toY = 116 + index * 13 + stream.yOffset;
  const selected = index === selectedTokenIndex;
  const streamActive = activeStream === null || activeStream === stream.label;
  return (
    <path
      d={curvePath(stream.fromX, token.y + stream.yOffset, stream.toX, toY)}
      fill="none"
      stroke={stream.color}
      strokeWidth={selected ? 4.4 : streamActive ? 2.2 : 1.2}
      strokeOpacity={selected ? 0.78 : streamActive ? 0.34 : 0.08}
      className="cursor-pointer transition-opacity"
      onMouseEnter={() => onStreamHover(stream.label)}
      onMouseLeave={() => onStreamHover(null)}
    />
  );
}

function AttentionMatrix({
  selectedTokenIndex,
  head,
  block,
  focusedCell,
  onCellHover,
}: {
  selectedTokenIndex: number;
  head: number;
  block: number;
  focusedCell: MatrixCell;
  onCellHover: (cell: MatrixCell) => void;
}) {
  return (
    <g>
      <text x="574" y="92" className="fill-gray-500 text-[13px] font-bold dark:fill-gray-300">Attention weights</text>
      {tokens.map((rowToken, rowIndex) => tokens.map((colToken, colIndex) => {
        const value = getAttentionValue(rowIndex, colIndex, head, block);
        const selectedRow = rowIndex === selectedTokenIndex;
        const focused = focusedCell?.row === rowIndex && focusedCell?.col === colIndex;
        return (
          <circle
            key={`${rowToken.text}-${colToken.text}`}
            cx={584 + colIndex * 22}
            cy={118 + rowIndex * 22}
            r={focused ? 13 : 7 + value * 4}
            fill={selectedRow ? '#6d28d9' : '#7c3aed'}
            opacity={focused ? 0.95 : selectedRow ? 0.34 + value * 0.62 : 0.1 + value * 0.48}
            className="cursor-crosshair transition-all"
            onMouseEnter={() => onCellHover({ row: rowIndex, col: colIndex })}
            onMouseLeave={() => onCellHover(null)}
          />
        );
      }))}
      <rect x={578} y={112 + selectedTokenIndex * 22} width="150" height="12" rx="6" fill="#a78bfa" opacity="0.16" />
      <rect x="568" y="102" width="164" height="164" rx="18" fill="none" stroke="currentColor" className="text-violet-200 dark:text-violet-800" />
      {focusedCell && (
        <text x="574" y="290" className="fill-violet-700 text-[12px] font-bold dark:fill-violet-300">
          {tokens[focusedCell.row].text} {'->'} {tokens[focusedCell.col].text}: {(getAttentionValue(focusedCell.row, focusedCell.col, head, block) * 100).toFixed(1)}% attention
        </text>
      )}
    </g>
  );
}

function TokenRows({
  selectedTokenIndex,
  lockedTokenIndex,
  onTokenHover,
  onTokenClick,
}: {
  selectedTokenIndex: number;
  lockedTokenIndex: number | null;
  onTokenHover: (index: number | null) => void;
  onTokenClick: (index: number) => void;
}) {
  return (
    <g>
      <text x="38" y="55" className="fill-gray-500 text-[15px] font-bold dark:fill-gray-300">Input tokens</text>
      {tokens.map((token, index) => {
        const selected = selectedTokenIndex === index;
        const locked = lockedTokenIndex === index;
        return (
        <g
          key={token.text}
          role="button"
          tabIndex={0}
          aria-label={`Inspect token ${token.text}`}
          className="cursor-pointer outline-none"
          onMouseEnter={() => onTokenHover(index)}
          onMouseLeave={() => onTokenHover(null)}
          onClick={() => onTokenClick(index)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') onTokenClick(index);
          }}
        >
          <title>Click to lock this token. Click again to unlock.</title>
          <rect x="28" y={token.y - 22} width="224" height="44" rx="12" fill={selected ? '#eef2ff' : 'transparent'} className="dark:fill-indigo-950" opacity={selected ? 0.92 : 0} />
          <text x="40" y={token.y + 5} className={`text-[15px] font-semibold ${selected ? 'fill-indigo-700 dark:fill-indigo-200' : 'fill-gray-800 dark:fill-gray-100'}`}>{token.text}</text>
          <rect x="154" y={token.y - 18} width="18" height="36" rx="4" fill={selected ? '#818cf8' : '#cbd5e1'} opacity={selected ? 0.9 : 0.75} />
          <rect x="180" y={token.y - 18} width="18" height="36" rx="4" fill={selected ? '#60a5fa' : '#dbeafe'} />
          <rect x="206" y={token.y - 18} width="18" height="36" rx="4" fill={selected ? '#38bdf8' : '#bfdbfe'} />
          <g transform={`translate(236 ${token.y - 8})`} opacity={locked ? 1 : selected ? 0.75 : 0.35}>
            <rect x="3" y="7" width="12" height="9" rx="2" fill={locked ? '#6d28d9' : '#94a3b8'} />
            <path d="M 6 7 V 5 C 6 2.8 7.3 1.5 9 1.5 C 10.7 1.5 12 2.8 12 5 V 7" fill="none" stroke={locked ? '#6d28d9' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
        );
      })}
    </g>
  );
}

function QkvStreams({
  selectedTokenIndex,
  activeStream,
  onStreamHover,
}: {
  selectedTokenIndex: number;
  activeStream: StreamLabel | null;
  onStreamHover: (stream: StreamLabel | null) => void;
}) {
  return (
    <g>
      {streams.map(stream => (
        <g key={stream.label}>
          <text x={stream.toX - 12} y={82 + stream.yOffset} fill={stream.color} className="text-[13px] font-bold">{stream.label === 'Q' ? 'Query' : stream.label === 'K' ? 'Key' : 'Value'}</text>
          {tokens.map((token, index) => (
            <StreamPath
              key={`${stream.label}-${token.text}`}
              token={token}
              stream={stream}
              index={index}
              selectedTokenIndex={selectedTokenIndex}
              activeStream={activeStream}
              onStreamHover={onStreamHover}
            />
          ))}
          {tokens.map((token, index) => (
            <rect key={`${stream.label}-bar-${token.text}`} x={stream.toX + 4} y={105 + index * 13 + stream.yOffset} width={34 - index * 2} height="4" rx="2" fill={stream.color} opacity={selectedTokenIndex === index ? 0.96 : 0.42} />
          ))}
        </g>
      ))}
    </g>
  );
}

function MlpBlock({ selectedTokenIndex }: { selectedTokenIndex: number }) {
  const lanes = tokens.map((token, index) => ({ ...token, y: 112 + index * 42 }));
  return (
    <g>
      <text x="830" y="55" className="fill-gray-500 text-[15px] font-bold dark:fill-gray-300">MLP + residual flow</text>
      {lanes.map((lane, index) => (
        <g key={lane.text}>
          <path d={curvePath(745, 118 + index * 22, 850, lane.y)} fill="none" stroke="#7c3aed" strokeWidth={index === selectedTokenIndex ? 4.2 : 2.2} strokeOpacity={index === selectedTokenIndex ? 0.72 : 0.24} />
          <rect x="862" y={lane.y - 16} width="120" height="32" rx="10" fill={index === selectedTokenIndex ? '#ddd6fe' : '#ede9fe'} className="dark:fill-violet-950" />
          <rect x="993" y={lane.y - 16} width="82" height="32" rx="10" fill={index === selectedTokenIndex ? '#bfdbfe' : '#dbeafe'} className="dark:fill-blue-950" />
          <text x="882" y={lane.y + 5} className={`text-[13px] font-semibold ${index === selectedTokenIndex ? 'fill-violet-800 dark:fill-violet-100' : 'fill-gray-800 dark:fill-gray-100'}`}>{lane.text}</text>
          {index < lanes.length - 1 && (
            <path d={`M 960 ${lane.y + 16} C 990 ${lane.y + 32}, 990 ${lane.y + 26}, 1012 ${lanes[index + 1].y - 16}`} fill="none" stroke="#c4b5fd" strokeWidth="8" strokeLinecap="round" opacity="0.34" />
          )}
        </g>
      ))}
      <path d="M 846 79 C 894 56, 980 58, 1028 78" fill="none" stroke="#cbd5e1" strokeWidth="2" />
      <text x="925" y="73" className="fill-gray-400 text-[12px] font-bold dark:fill-gray-500">residual</text>
    </g>
  );
}

function ProbabilityBars({ selectedTokenIndex, head, block }: { selectedTokenIndex: number; head: number; block: number }) {
  const ranked = probabilities
    .map(([word, , color], index) => ({
      word: word as string,
      color: color as string,
      value: getTokenProbability(index, selectedTokenIndex, head, block),
    }))
    .sort((a, b) => b.value - a.value);
  return (
    <g>
      <text x="1128" y="55" className="fill-gray-500 text-[15px] font-bold dark:fill-gray-300">Next-token probabilities</text>
      {ranked.map(({ word, value, color }, index) => {
        return (
          <g key={word}>
            <text x="1130" y={106 + index * 36} className={`text-[14px] font-bold ${index === 0 ? 'fill-violet-700 dark:fill-violet-300' : 'fill-gray-500 dark:fill-gray-400'}`}>{word as string}</text>
            <rect x="1220" y={94 + index * 36} width="132" height="6" rx="3" fill="#e5e7eb" className="dark:fill-gray-700" />
            <rect x="1220" y={94 + index * 36} width={Math.max(14, value * 520)} height="6" rx="3" fill={index === 0 ? '#6d28d9' : color} />
            <text x="1362" y={101 + index * 36} className="fill-gray-400 text-[12px] font-semibold dark:fill-gray-500">{(value * 100).toFixed(1)}%</text>
          </g>
        );
      })}
    </g>
  );
}

function TransformerFlowCanvas({
  selectedTokenIndex,
  lockedTokenIndex,
  head,
  block,
  activeStep,
  visibleLayers,
  activeStream,
  focusedCell,
  onTokenHover,
  onTokenClick,
  onStreamHover,
  onCellHover,
}: {
  selectedTokenIndex: number;
  lockedTokenIndex: number | null;
  head: number;
  block: number;
  activeStep: FlowStepId;
  visibleLayers: VisibleLayerState;
  activeStream: StreamLabel | null;
  focusedCell: MatrixCell;
  onTokenHover: (index: number | null) => void;
  onTokenClick: (index: number) => void;
  onStreamHover: (stream: StreamLabel | null) => void;
  onCellHover: (cell: MatrixCell) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-950">
      <svg data-architecture-canvas="true" viewBox="0 0 1440 500" role="img" aria-label="Interactive transformer architecture flow from tokens through embeddings, Q K V attention, MLP, and output probabilities" className="min-w-[1120px] text-gray-300">
        <defs>
          <linearGradient id="attentionFan" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="embeddingGlow" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="50%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#93c5fd" />
          </linearGradient>
        </defs>

        <rect x="8" y="8" width="1424" height="484" rx="28" fill="currentColor" className="text-gray-50 dark:text-gray-900" />
        {visibleLayers.signal && <StepHighlight activeStep={activeStep} />}
        {visibleLayers.signal && <AnimatedSignal activeStep={activeStep} selectedTokenIndex={selectedTokenIndex} />}
        <text x="236" y="38" className="fill-gray-500 text-[18px] font-bold dark:fill-gray-300">Transformer Block {block}</text>
        <text x="236" y="62" className="fill-gray-400 text-[14px] font-semibold dark:fill-gray-500">multi-head self attention</text>

        <TokenRows
          selectedTokenIndex={selectedTokenIndex}
          lockedTokenIndex={lockedTokenIndex}
          onTokenHover={onTokenHover}
          onTokenClick={onTokenClick}
        />
        <g>
          <rect x="412" y="76" width="386" height="342" rx="18" fill="#ffffff" className="dark:fill-gray-900" opacity="0.86" />
          <rect x="402" y="86" width="386" height="342" rx="18" fill="none" stroke="#e5e7eb" className="dark:stroke-gray-800" />
          <text x="600" y="398" className="fill-gray-500 text-[15px] font-bold dark:fill-gray-300">Head {head} of 12</text>
        </g>
        {visibleLayers.qkv && <QkvStreams selectedTokenIndex={selectedTokenIndex} activeStream={activeStream} onStreamHover={onStreamHover} />}
        {visibleLayers.attention && <AttentionMatrix selectedTokenIndex={selectedTokenIndex} head={head} block={block} focusedCell={focusedCell} onCellHover={onCellHover} />}

        {visibleLayers.attention && (
          <>
            <path d="M 732 185 C 778 185, 792 178, 818 154 L 860 116" fill="none" stroke="#8b5cf6" strokeWidth="9" strokeLinecap="round" opacity="0.22" />
            <path d="M 732 210 C 784 210, 801 214, 838 242 L 862 262" fill="none" stroke="#8b5cf6" strokeWidth="20" strokeLinecap="round" opacity="0.18" />
          </>
        )}
        {visibleLayers.qkv && (
          <>
            <path d="M 250 83 C 294 84, 310 104, 328 130" fill="none" stroke="#bfdbfe" strokeWidth="7" strokeLinecap="round" opacity="0.75" />
            <path d="M 250 425 C 308 414, 332 376, 350 330" fill="none" stroke="#86efac" strokeWidth="9" strokeLinecap="round" opacity="0.52" />
          </>
        )}

        {visibleLayers.mlp && <MlpBlock selectedTokenIndex={selectedTokenIndex} />}
        {visibleLayers.output && <ProbabilityBars selectedTokenIndex={selectedTokenIndex} head={head} block={block} />}

        <g>
          <text x="1088" y="90" className="fill-gray-400 text-[13px] font-bold dark:fill-gray-500">7 more identical blocks</text>
          <path d="M 1084 101 L 1084 156" stroke="#cbd5e1" strokeWidth="2" />
          <path d="M 1077 148 L 1084 158 L 1091 148" fill="none" stroke="#cbd5e1" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

function nodeById<T extends { id: string }>(nodes: T[], id: string) {
  const node = nodes.find(item => item.id === id);
  if (!node) throw new Error(`Unknown node: ${id}`);
  return node;
}

function graphEdgeId(edge: GraphEdge) {
  return `${edge.from}-${edge.to}`;
}

function getTreePath(nodeId: string) {
  const parentByChild = new Map(treeEdges.map(edge => [edge.to, edge.from]));
  const path = [nodeId];
  let cursor = nodeId;
  while (parentByChild.has(cursor)) {
    const parent = parentByChild.get(cursor);
    if (!parent) break;
    path.unshift(parent);
    cursor = parent;
  }
  return path;
}

function getTreePathEdges(nodeId: string) {
  const path = getTreePath(nodeId);
  return new Set(path.slice(1).map((nodeIdInPath, index) => `${path[index]}-${nodeIdInPath}`));
}

function DecisionTreeCanvas({
  activeNodeId,
  onNodeSelect,
}: {
  activeNodeId: string;
  onNodeSelect: (id: string) => void;
}) {
  const pathEdges = getTreePathEdges(activeNodeId);
  const pathNodes = new Set(getTreePath(activeNodeId));
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-950">
      <svg data-architecture-canvas="true" viewBox="0 0 1040 430" role="img" aria-label="Interactive decision tree architecture with split and leaf nodes" className="min-w-[920px] text-gray-300">
        <rect x="10" y="10" width="1020" height="410" rx="28" fill="currentColor" className="text-gray-50 dark:text-gray-900" />
        {treeEdges.map(edge => {
          const from = nodeById(treeNodes, edge.from);
          const to = nodeById(treeNodes, edge.to);
          const active = pathEdges.has(`${edge.from}-${edge.to}`);
          return (
            <g key={`${edge.from}-${edge.to}`}>
              <path d={curvePath(from.x, from.y + 32, to.x, to.y - 32)} fill="none" stroke={active ? '#2563eb' : '#cbd5e1'} strokeWidth={active ? 4 : 2} strokeOpacity={active ? 0.82 : 0.65} />
              <text x={(from.x + to.x) / 2 - 10} y={(from.y + to.y) / 2 - 4} className="fill-gray-500 text-[12px] font-bold dark:fill-gray-400">{edge.label}</text>
            </g>
          );
        })}
        {treeNodes.map(node => {
          const active = activeNodeId === node.id;
          const onPath = pathNodes.has(node.id);
          return (
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={`Inspect ${node.label}`}
              className="cursor-pointer outline-none"
              onClick={() => onNodeSelect(node.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') onNodeSelect(node.id);
              }}
            >
              <rect x={node.x - 84} y={node.y - 30} width="168" height="60" rx="14" fill={active ? node.color : onPath ? '#eff6ff' : '#ffffff'} className={active ? '' : 'dark:fill-gray-900'} stroke={node.color} strokeWidth={active ? 3 : onPath ? 2.4 : 1.5} />
              <text x={node.x} y={node.y - 3} textAnchor="middle" className={`text-[13px] font-bold ${active ? 'fill-white' : 'fill-gray-800 dark:fill-gray-100'}`}>{node.label}</text>
              <text x={node.x} y={node.y + 17} textAnchor="middle" className={`text-[11px] font-semibold ${active ? 'fill-white' : 'fill-gray-500 dark:fill-gray-400'}`}>{node.kind}</text>
            </g>
          );
        })}
        <text x="36" y="52" className="fill-gray-500 text-[16px] font-bold dark:fill-gray-300">Decision Tree Flow</text>
        <text x="36" y="76" className="fill-gray-400 text-[13px] font-semibold dark:fill-gray-500">Click a split or leaf to inspect the prediction path.</text>
      </svg>
    </div>
  );
}

function GraphFlowCanvas({
  activeNodeId,
  activeEdgeId,
  onNodeSelect,
  onEdgeSelect,
}: {
  activeNodeId: string;
  activeEdgeId: GraphEdgeSelection;
  onNodeSelect: (id: string) => void;
  onEdgeSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-950">
      <svg data-architecture-canvas="true" viewBox="0 0 1040 430" role="img" aria-label="Interactive graph architecture with feature, memory, score, and decision nodes" className="min-w-[920px] text-gray-300">
        <rect x="10" y="10" width="1020" height="410" rx="28" fill="currentColor" className="text-gray-50 dark:text-gray-900" />
        <defs>
          <marker id="graph-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
          <marker id="graph-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#6d28d9" />
          </marker>
        </defs>
        {graphEdges.map(edge => {
          const from = nodeById(graphNodes, edge.from);
          const to = nodeById(graphNodes, edge.to);
          const id = graphEdgeId(edge);
          const active = activeEdgeId === id || activeNodeId === edge.from || activeNodeId === edge.to;
          return (
            <g
              key={id}
              role="button"
              tabIndex={0}
              aria-label={`Inspect edge ${edge.label} from ${from.label} to ${to.label}`}
              className="cursor-pointer outline-none"
              onClick={() => onEdgeSelect(id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') onEdgeSelect(id);
              }}
            >
              <path d={curvePath(from.x, from.y, to.x, to.y)} fill="none" stroke={active ? '#6d28d9' : '#94a3b8'} strokeWidth={2 + edge.weight * 3} strokeOpacity={active ? 0.78 : 0.34} markerEnd={active ? 'url(#graph-arrow-active)' : 'url(#graph-arrow)'} />
              <path d={curvePath(from.x, from.y, to.x, to.y)} fill="none" stroke="transparent" strokeWidth="18" />
              <text x={(from.x + to.x) / 2 - 18} y={(from.y + to.y) / 2 - 8} className="fill-gray-500 text-[12px] font-bold dark:fill-gray-400">{edge.label}</text>
            </g>
          );
        })}
        {graphNodes.map(node => {
          const active = activeNodeId === node.id;
          return (
            <g
              key={node.id}
              role="button"
              tabIndex={0}
              aria-label={`Inspect ${node.label}`}
              className="cursor-pointer outline-none"
              onClick={() => onNodeSelect(node.id)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') onNodeSelect(node.id);
              }}
            >
              <circle cx={node.x} cy={node.y} r={active ? 52 : 44} fill={active ? node.color : '#ffffff'} className={active ? '' : 'dark:fill-gray-900'} stroke={node.color} strokeWidth={active ? 4 : 2} />
              <text x={node.x} y={node.label.includes(' ') ? node.y - 5 : node.y + 4} textAnchor="middle" className={`text-[13px] font-bold ${active ? 'fill-white' : 'fill-gray-800 dark:fill-gray-100'}`}>
                {node.label.split(' ').map((part, index) => (
                  <tspan key={part} x={node.x} dy={index === 0 ? 0 : 14}>{part}</tspan>
                ))}
              </text>
            </g>
          );
        })}
        <text x="36" y="52" className="fill-gray-500 text-[16px] font-bold dark:fill-gray-300">Graph / State Flow</text>
        <text x="36" y="76" className="fill-gray-400 text-[13px] font-semibold dark:fill-gray-500">Useful for MDPs, HMMs, GNN message passing, and recommendation graphs.</text>
      </svg>
    </div>
  );
}

export default function ArchitectureFlowLabPage() {
  const initialState = useMemo(() => getInitialVisualState(), []);
  const canvasPanelRef = useRef<HTMLDivElement | null>(null);
  const [visualMode, setVisualMode] = useState<VisualMode>(initialState.visualMode);
  const [activeTreeNodeId, setActiveTreeNodeId] = useState(initialState.activeTreeNodeId);
  const [activeGraphNodeId, setActiveGraphNodeId] = useState(initialState.activeGraphNodeId);
  const [activeGraphEdgeId, setActiveGraphEdgeId] = useState<GraphEdgeSelection>(null);
  const [hoveredTokenIndex, setHoveredTokenIndex] = useState<number | null>(null);
  const [lockedTokenIndex, setLockedTokenIndex] = useState<number | null>(initialState.lockedTokenIndex);
  const [head, setHead] = useState(initialState.head);
  const [block, setBlock] = useState(initialState.block);
  const [activeStream, setActiveStream] = useState<StreamLabel | null>(null);
  const [focusedCell, setFocusedCell] = useState<MatrixCell>(null);
  const [activeStepIndex, setActiveStepIndex] = useState(initialState.activeStepIndex);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(initialState.speed);
  const [learningMode, setLearningMode] = useState<LearningMode>('teaching');
  const [showPracticeHints, setShowPracticeHints] = useState(false);
  const [completedPractice, setCompletedPractice] = useState<number[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<VisibleLayerState>(defaultVisibleLayers);
  const [savedPresets, setSavedPresets] = useState<VisualPreset[]>(loadPresets);
  const [draftPreset, setDraftPreset] = useState<VisualPreset | null>(null);
  const [draftPresetLabel, setDraftPresetLabel] = useState('');
  const [notice, setNotice] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const activeStep = flowSteps[activeStepIndex];
  const activeTreeNode = treeNodes.find(node => node.id === activeTreeNodeId) ?? treeNodes[0];
  const activeGraphNode = graphNodes.find(node => node.id === activeGraphNodeId) ?? graphNodes[0];
  const activeGraphEdge = graphEdges.find(edge => graphEdgeId(edge) === activeGraphEdgeId) ?? null;
  const activeTreePath = getTreePath(activeTreeNodeId).map(id => nodeById(treeNodes, id));
  const selectedTokenIndex = lockedTokenIndex ?? hoveredTokenIndex ?? 0;
  const selectedToken = tokens[selectedTokenIndex];
  const selectedAttention = useMemo(() => {
    const row = tokens.map((_, index) => getAttentionValue(selectedTokenIndex, index, head, block));
    const bestIndex = row.indexOf(Math.max(...row));
    return { word: tokens[bestIndex].text, value: row[bestIndex] };
  }, [block, head, selectedTokenIndex]);
  const beginnerGuide = beginnerGuides[visualMode];
  const modeLabel = learningModes.find(mode => mode.id === learningMode)?.label ?? 'Teaching Mode';
  const currentPracticeTasks = practiceTasks[visualMode];

  const stats = [
    { label: 'Canvas mode', value: visualModes.find(mode => mode.id === visualMode)?.label ?? 'Transformer' },
    { label: 'Learning mode', value: modeLabel },
    { label: visualMode === 'transformer' ? 'Attention head' : 'Selected node', value: visualMode === 'transformer' ? `${head} / 12` : visualMode === 'tree' ? activeTreeNode.label : activeGraphNode.label },
    { label: 'Phase', value: visualMode === 'transformer' ? `${activeStepIndex + 1} / ${flowSteps.length}` : '-' },
  ];

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setActiveStepIndex(index => (index + 1) % flowSteps.length);
    }, speedDelays[speed]);
    return () => window.clearInterval(timer);
  }, [playing, speed]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === canvasPanelRef.current);
    };
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  const resetInteraction = () => {
    setActiveStream(null);
    setFocusedCell(null);
    setActiveStepIndex(0);
    setActiveGraphEdgeId(null);
    setVisibleLayers(defaultVisibleLayers);
    setPlaying(false);
  };
  const resetSelection = () => {
    setHoveredTokenIndex(null);
    setLockedTokenIndex(0);
    setHead(3);
    setBlock(1);
    setActiveGraphEdgeId(null);
    setNotice('Selection reset');
  };
  const previousStep = () => setActiveStepIndex(index => (index === 0 ? flowSteps.length - 1 : index - 1));
  const nextStep = () => setActiveStepIndex(index => (index + 1) % flowSteps.length);
  const currentPreset = (): VisualPreset => ({
    id: `${Date.now()}`,
    label: `${visualModes.find(mode => mode.id === visualMode)?.label ?? 'Visual'} - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
    visualMode,
    activeTreeNodeId,
    activeGraphNodeId,
    lockedTokenIndex,
    head,
    block,
    activeStepIndex,
    speed,
  });
  const applyPreset = (preset: VisualPreset) => {
    setVisualMode(preset.visualMode);
    setActiveTreeNodeId(preset.activeTreeNodeId);
    setActiveGraphNodeId(preset.activeGraphNodeId);
    setActiveGraphEdgeId(null);
    setLockedTokenIndex(preset.lockedTokenIndex);
    setHead(preset.head);
    setBlock(preset.block);
    setActiveStepIndex(preset.activeStepIndex);
    setSpeed(preset.speed);
    setPlaying(false);
    setNotice(`Loaded ${preset.label}`);
  };
  const savePreset = () => {
    const preset = currentPreset();
    setDraftPreset(preset);
    setDraftPresetLabel(preset.label);
    setNotice('Label this preset, then press Enter.');
  };
  const confirmPresetLabel = () => {
    if (!draftPreset) return;
    const label = draftPresetLabel.trim() || draftPreset.label;
    const next = [{ ...draftPreset, label }, ...savedPresets].slice(0, 6);
    setSavedPresets(next);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
    setDraftPreset(null);
    setDraftPresetLabel('');
    setNotice('Visual preset saved');
  };
  const cancelPresetLabel = () => {
    setDraftPreset(null);
    setDraftPresetLabel('');
    setNotice('');
  };
  const deletePreset = (id: string) => {
    const next = savedPresets.filter(preset => preset.id !== id);
    setSavedPresets(next);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(next));
  };
  const shareState = async () => {
    const params = new URLSearchParams();
    params.set('mode', visualMode);
    params.set('tree', activeTreeNodeId);
    params.set('graph', activeGraphNodeId);
    params.set('token', lockedTokenIndex === null ? 'none' : String(lockedTokenIndex));
    params.set('head', String(head));
    params.set('block', String(block));
    params.set('step', String(activeStepIndex));
    params.set('speed', speed);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', url);
    await navigator.clipboard.writeText(url);
    setNotice('Share link copied');
  };
  const exportPng = async () => {
    const svg = canvasPanelRef.current?.querySelector('svg[data-architecture-canvas="true"]');
    if (!(svg instanceof SVGSVGElement)) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = '.fill-gray-500,.dark\\:fill-gray-300,.fill-gray-400,.dark\\:fill-gray-500{fill:#64748b}.fill-gray-800,.dark\\:fill-gray-100{fill:#111827}.text-gray-50{color:#f9fafb}.text-gray-300{color:#d1d5db}.dark\\:fill-gray-900{fill:#111827}.dark\\:stroke-gray-800{stroke:#1f2937}text{font-family:Inter,Arial,sans-serif}';
    clone.insertBefore(style, clone.firstChild);
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(svg.viewBox.baseVal.width || svg.clientWidth));
      canvas.height = Math.max(1, Math.round(svg.viewBox.baseVal.height || svg.clientHeight));
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (!blob) return;
        const anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(blob);
        anchor.download = `architecture-flow-${visualMode}.png`;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
        setNotice('PNG exported');
      });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };
  const openFullscreen = async () => {
    await canvasPanelRef.current?.requestFullscreen?.();
    setNotice('Fullscreen opened');
  };
  const exitFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  };
  const selectGraphNode = (id: string) => {
    setActiveGraphNodeId(id);
    setActiveGraphEdgeId(null);
  };
  const selectGraphEdge = (id: string) => {
    const edge = graphEdges.find(item => graphEdgeId(item) === id);
    if (!edge) return;
    setActiveGraphEdgeId(id);
    setActiveGraphNodeId(edge.to);
  };
  const toggleLayer = (layer: VisibleLayer) => {
    setVisibleLayers(current => ({ ...current, [layer]: !current[layer] }));
  };
  const updateLearningMode = (mode: LearningMode) => {
    setLearningMode(mode);
    setShowPracticeHints(false);
    setCompletedPractice([]);
    setPlaying(mode === 'teaching' && visualMode === 'transformer');
    if (mode === 'practice') setNotice('Practice mode: try the tasks before opening hints.');
  };
  const updateVisualMode = (mode: VisualMode) => {
    setVisualMode(mode);
    setCompletedPractice([]);
    setShowPracticeHints(false);
  };
  const togglePracticeTask = (index: number) => {
    setCompletedPractice(current => current.includes(index) ? current.filter(item => item !== index) : [...current, index]);
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <PageHeader
        title="Architecture Flow Lab"
        subtitle="A beginner-friendly visual lab for model graphs, transformer blocks, and decision paths. Phase 9 adds Teaching, Learning, and Practice modes."
        badge="Educational"
        category="Lab"
        icon={<Network size={22} />}
        showAlgorithmIntro={false}
        showAlgorithmTools={false}
      />

      <section className="space-y-4" aria-labelledby="architecture-flow-canvas">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(item => (
            <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{item.label}</p>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {visualModes.map(mode => (
            <button
              key={mode.id}
              onClick={() => updateVisualMode(mode.id)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                visualMode === mode.id
                  ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-100'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50/60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <span className="block text-sm font-bold">{mode.label}</span>
              <span className="mt-1 block text-xs leading-5 opacity-80">{mode.summary}</span>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Learning mode</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Choose how much help the lab should show.</p>
            </div>
            {learningMode === 'practice' && (
              <button
                onClick={() => setShowPracticeHints(value => !value)}
                className="inline-flex min-h-9 items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <Eye size={13} /> {showPracticeHints ? 'Hide hints' : 'Show hints'}
              </button>
            )}
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {learningModes.map(mode => (
              <button
                key={mode.id}
                onClick={() => updateLearningMode(mode.id)}
                className={`min-h-24 rounded-lg border p-3 text-left transition-colors ${
                  learningMode === mode.id
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800 shadow-sm dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-100'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50/60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <span className="block text-sm font-bold">{mode.label}</span>
                <span className="mt-1 block text-xs leading-5 opacity-80">{mode.summary}</span>
              </button>
            ))}
          </div>
        </div>

        {learningMode === 'teaching' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr_0.9fr]">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                <BookOpen size={14} /> Teaching walkthrough
              </p>
              <p className="mt-2 text-sm leading-6 text-blue-950 dark:text-blue-100">{beginnerGuide.plain}</p>
            </div>
            <div className="rounded-lg bg-white p-3 dark:bg-gray-950">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">How to use it</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {beginnerGuide.readOrder.map((item, index) => (
                  <div key={item} className="flex gap-2 text-xs leading-5 text-gray-600 dark:text-gray-300">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-600 font-bold text-white">{index + 1}</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white p-3 dark:border-blue-900 dark:bg-gray-950">
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">Try this</p>
              <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">{beginnerGuide.tryThis}</p>
            </div>
          </div>
        </div>
        )}

        {learningMode === 'learning' && (
        <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900 dark:bg-cyan-950/20">
          <div className="mb-3">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
              <BookOpen size={14} /> Learning model
            </p>
            <p className="mt-2 text-sm leading-6 text-cyan-950 dark:text-cyan-100">Read the diagram as a chain of small jobs. Each card names one job and what it contributes to the final answer.</p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {learningModelCards[visualMode].map(card => (
              <div key={card.label} className="rounded-lg border border-cyan-200 bg-white p-3 dark:border-cyan-900 dark:bg-gray-950">
                <dt className="text-sm font-bold text-gray-900 dark:text-white">{card.label}</dt>
                <dd className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-300">{card.detail}</dd>
              </div>
            ))}
          </dl>
        </div>
        )}

        {learningMode === 'practice' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  <Target size={14} /> Practice checklist
                </p>
                <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">Try the task on the diagram, then mark it done. Open hints only if you get stuck.</p>
              </div>
              <p className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800 dark:bg-gray-950 dark:text-amber-200">
                {completedPractice.length} / {currentPracticeTasks.length} done
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {currentPracticeTasks.map((task, index) => {
                const done = completedPractice.includes(index);
                return (
                  <button
                    key={task.task}
                    onClick={() => togglePracticeTask(index)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      done
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
                        : 'border-amber-200 bg-white text-gray-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-amber-950/40'
                    }`}
                  >
                    <span className="block text-xs font-bold uppercase tracking-wide">{done ? 'Done' : `Task ${index + 1}`}</span>
                    <span className="mt-1 block text-sm font-semibold">{task.task}</span>
                    {showPracticeHints && <span className="mt-2 block text-xs leading-5 text-gray-500 dark:text-gray-400">Hint: {task.hint}</span>}
                    {done && <span className="mt-2 block text-xs leading-5 text-emerald-700 dark:text-emerald-300">Check: {task.answer}</span>}
                  </button>
                );
              })}
            </div>
            {completedPractice.length > 0 && completedPractice.length === currentPracticeTasks.length && (
              <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">All tasks complete</p>
                <p className="mt-1 text-sm leading-6 text-emerald-800 dark:text-emerald-200">Switch to another visual mode or return to Teaching Mode.</p>
                <button
                  onClick={() => updateLearningMode('teaching')}
                  className="mt-2 inline-flex min-h-9 items-center rounded bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Return to Teaching Mode
                </button>
              </div>
            )}
          </div>
        )}

        {learningMode === 'teaching' && (
        <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 lg:grid-cols-[220px_1fr]">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-violet-600 text-white">
              <Eye size={18} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Simple guide</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{visualModes.find(mode => mode.id === visualMode)?.label}</p>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {teachingNotes[visualMode].map(note => (
              <div key={note.label} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950">
                <p className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                  <Target size={13} className="text-violet-600 dark:text-violet-300" /> {note.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{note.detail}</p>
              </div>
            ))}
          </div>
        </div>
        )}

        <div className="grid gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900 lg:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={openFullscreen} className="inline-flex min-h-10 items-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              <Maximize2 size={14} /> Fullscreen
            </button>
            <button onClick={exportPng} className="inline-flex min-h-10 items-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              <Download size={14} /> Export PNG
            </button>
            <button onClick={shareState} className="inline-flex min-h-10 items-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              <Share2 size={14} /> Copy Link
            </button>
            <button onClick={savePreset} className="inline-flex min-h-10 items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
              <Save size={14} /> Save Preset
            </button>
          </div>
          <div className="flex min-h-10 items-center text-xs font-semibold text-gray-500 dark:text-gray-400">
            {notice || 'Export, share, or save the current visual state.'}
          </div>
          {draftPreset && (
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400" htmlFor="architecture-preset-label">
                Preset label
              </label>
              <input
                id="architecture-preset-label"
                autoFocus
                value={draftPresetLabel}
                onChange={event => setDraftPresetLabel(event.target.value)}
                onBlur={confirmPresetLabel}
                onKeyDown={event => {
                  if (event.key === 'Enter') confirmPresetLabel();
                  if (event.key === 'Escape') cancelPresetLabel();
                }}
                placeholder="Label this preset..."
                className="mt-1 min-h-10 w-full rounded border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-gray-900 outline-none ring-blue-500 transition focus:ring-2 dark:border-blue-900 dark:bg-blue-950/30 dark:text-white"
              />
            </div>
          )}
        </div>

        {savedPresets.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Saved presets</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {savedPresets.map(preset => (
                <div key={preset.id} className="flex items-center gap-2 rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-950">
                  <button onClick={() => applyPreset(preset)} className="min-h-10 min-w-0 flex-1 rounded px-2 text-left text-xs font-bold text-gray-700 hover:bg-blue-50 dark:text-gray-200 dark:hover:bg-blue-950/30">
                    <span className="block truncate">{preset.label}</span>
                    <span className="block truncate font-mono text-[10px] font-normal text-gray-400">{preset.visualMode}</span>
                  </button>
                  <button onClick={() => deletePreset(preset.id)} aria-label={`Delete ${preset.label}`} className="grid min-h-10 min-w-10 place-items-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <Card title={visualMode === 'transformer' ? 'Transformer Architecture Flow' : visualMode === 'tree' ? 'Decision Tree Flow' : 'Graph / State Flow'} icon={<BrainCircuit size={16} />}>
          <div ref={canvasPanelRef} className="space-y-4 rounded-lg bg-white p-0 dark:bg-gray-950">
            {isFullscreen && (
              <div className="fixed left-3 right-3 top-3 z-50 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white/95 p-2 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-950/95">
                {visualMode === 'transformer' && (
                  <>
                    <button onClick={() => setPlaying(value => !value)} className="inline-flex min-h-9 items-center gap-2 rounded bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700">
                      {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? 'Pause' : 'Play'}
                    </button>
                    <button onClick={previousStep} className="inline-flex min-h-9 items-center gap-2 rounded border border-gray-200 px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                      <StepBack size={13} /> Back
                    </button>
                    <button onClick={nextStep} className="inline-flex min-h-9 items-center gap-2 rounded border border-gray-200 px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                      <StepForward size={13} /> Next
                    </button>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200">
                      Step {activeStepIndex + 1} of {flowSteps.length}
                    </span>
                  </>
                )}
                <button onClick={exitFullscreen} className="ml-auto inline-flex min-h-9 items-center rounded bg-gray-900 px-3 text-xs font-bold text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200">
                  Exit fullscreen
                </button>
              </div>
            )}
            {visualMode === 'transformer' && (
              <>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  <Layers3 size={12} /> embeddings
                </span>
                <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 font-semibold text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
                  <Network size={12} /> attention matrix
                </span>
                <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <Sparkles size={12} /> output probabilities
                </span>
                <span className="inline-flex min-h-8 items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
                  <MousePointer2 size={12} /> selected: {selectedToken.text}
                </span>
              </div>
              <button
                onClick={resetInteraction}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <RotateCcw size={13} /> Reset view
              </button>
            </div>

            <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900 lg:grid-cols-[1fr_1fr_1.1fr]">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Transformer block</p>
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 8 }, (_, index) => index + 1).map(value => (
                    <button
                      key={value}
                      onClick={() => setBlock(value)}
                      className={`min-h-9 rounded text-xs font-bold ${block === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-blue-50 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Attention head</p>
                <div className="grid grid-cols-6 gap-1">
                  {Array.from({ length: 12 }, (_, index) => index + 1).map(value => (
                    <button
                      key={value}
                      onClick={() => setHead(value)}
                      className={`min-h-9 rounded text-xs font-bold ${head === value ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-violet-50 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-950">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">What changed?</p>
                <p className="mt-2 text-gray-700 dark:text-gray-200">
                  Token <span className="font-bold text-indigo-700 dark:text-indigo-300">{selectedToken.text}</span> attends most to <span className="font-bold text-violet-700 dark:text-violet-300">{selectedAttention.word}</span>.
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  In plain English: the selected word is borrowing context from another word. Strongest link: {(selectedAttention.value * 100).toFixed(1)}%.
                </p>
                <button
                  onClick={resetSelection}
                  className="mt-3 inline-flex min-h-9 items-center gap-2 rounded border border-gray-200 px-3 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <RotateCcw size={13} /> Reset selection
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Reduce visual noise</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Show only the parts you want to explain</p>
                </div>
                <button
                  onClick={() => setVisibleLayers(defaultVisibleLayers)}
                  className="inline-flex min-h-9 items-center gap-2 rounded border border-gray-200 px-3 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Eye size={13} /> Show all
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {layerControls.map(layer => {
                  const enabled = visibleLayers[layer.id];
                  return (
                    <button
                      key={layer.id}
                      onClick={() => toggleLayer(layer.id)}
                      className={`min-h-20 rounded-lg border p-3 text-left transition-colors ${
                        enabled
                          ? 'border-gray-300 bg-gray-50 text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white'
                          : 'border-gray-200 bg-white text-gray-400 opacity-70 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-500'
                      }`}
                    >
                      <span className={`mb-2 block ${enabled ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-700'}`}>
                        <LayerPreview layer={layer.id} />
                      </span>
                      <span className="flex items-center gap-2 text-xs font-bold">
                        <span className={`h-2.5 w-2.5 rounded-full ${enabled ? layer.color : 'bg-gray-300 dark:bg-gray-700'}`} />
                        {layer.label}
                      </span>
                      <span className="mt-1 block text-[11px] leading-4">{layer.detail}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950/20 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setPlaying(value => !value)}
                    className="inline-flex min-h-10 items-center gap-2 rounded bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                    {playing ? 'Pause' : 'Play'} lesson
                  </button>
                  <button onClick={previousStep} className="inline-flex min-h-10 items-center gap-2 rounded border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-gray-950 dark:text-indigo-200 dark:hover:bg-indigo-950">
                    <StepBack size={14} /> Back
                  </button>
                  <button onClick={nextStep} className="inline-flex min-h-10 items-center gap-2 rounded border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-gray-950 dark:text-indigo-200 dark:hover:bg-indigo-950">
                    <StepForward size={14} /> Next
                  </button>
                  <div className="ml-auto flex rounded-lg border border-indigo-200 bg-white p-1 dark:border-indigo-800 dark:bg-gray-950">
                    {(['Slow', 'Normal', 'Fast'] as Speed[]).map(value => (
                      <button
                        key={value}
                        onClick={() => setSpeed(value)}
                        className={`min-h-8 rounded px-2.5 text-xs font-bold ${speed === value ? 'bg-indigo-600 text-white' : 'text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-950'}`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  {flowSteps.map((step, index) => (
                    <React.Fragment key={step.id}>
                      <button
                        onClick={() => setActiveStepIndex(index)}
                        className={`min-h-12 flex-1 rounded-lg border px-2 py-2 text-left text-xs font-bold transition-colors ${
                          index === activeStepIndex
                            ? 'border-indigo-500 bg-white text-indigo-700 shadow-sm dark:bg-gray-950 dark:text-indigo-200'
                            : 'border-indigo-100 bg-indigo-100/70 text-indigo-500 hover:bg-white dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300'
                        }`}
                      >
                        <span className="block text-[10px] uppercase tracking-wide">Step {index + 1}</span>
                        {step.label}
                      </button>
                      {index < flowSteps.length - 1 && (
                        <div className="hidden items-center sm:flex" aria-hidden="true">
                          <div className={`h-0.5 w-4 ${index < activeStepIndex ? 'bg-indigo-500' : 'bg-indigo-200 dark:bg-indigo-900'}`} />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-white p-3 dark:border-indigo-800 dark:bg-gray-950">
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-500 dark:text-indigo-300">Step {activeStepIndex + 1} of {flowSteps.length}</p>
                <h3 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{activeStep.label}: {activeStep.summary}</h3>
                {learningMode === 'practice'
                  ? <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">Try to explain this step yourself first. Turn on hints in the practice checklist if you need a nudge.</p>
                  : <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{activeStep.detail}</p>}
              </div>
            </div>
            <TransformerFlowCanvas
              selectedTokenIndex={selectedTokenIndex}
              lockedTokenIndex={lockedTokenIndex}
              head={head}
              block={block}
              activeStep={activeStep.id}
              visibleLayers={visibleLayers}
              activeStream={activeStream}
              focusedCell={focusedCell}
              onTokenHover={setHoveredTokenIndex}
              onTokenClick={index => setLockedTokenIndex(current => current === index ? null : index)}
              onStreamHover={setActiveStream}
              onCellHover={setFocusedCell}
            />
              </>
            )}
            {visualMode === 'tree' && (
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <DecisionTreeCanvas activeNodeId={activeTreeNodeId} onNodeSelect={setActiveTreeNodeId} />
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Selected question or answer</p>
                  <h3 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{activeTreeNode.label}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">{activeTreeNode.kind}</p>
                  {learningMode === 'practice'
                    ? <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">Use the highlighted route to explain what this node means before opening hints.</p>
                    : <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{activeTreeNode.detail}</p>}
                  <div className="mt-4 rounded-lg border border-blue-200 bg-white p-3 dark:border-blue-900 dark:bg-gray-950">
                    <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                      <Route size={13} /> How the model got here
                    </p>
                    <div className="space-y-2">
                      {activeTreePath.map((node, index) => (
                        <div key={node.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-600 font-bold text-white">{index + 1}</span>
                          <span className="font-semibold">{node.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
                    Tree mode is for decision trees, random forests, boosting stumps, and any model where rows move through rules toward leaves.
                  </div>
                </div>
              </div>
            )}
            {visualMode === 'graph' && (
              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <GraphFlowCanvas activeNodeId={activeGraphNodeId} activeEdgeId={activeGraphEdgeId} onNodeSelect={selectGraphNode} onEdgeSelect={selectGraphEdge} />
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Selected model part</p>
                  <h3 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">{activeGraphNode.label}</h3>
                  {learningMode === 'practice'
                    ? <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">Describe the selected part in your own words, then use the checklist to confirm.</p>
                    : <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">{activeGraphNode.detail}</p>}
                  {activeGraphEdge && (
                    <div className="mt-4 rounded-lg border border-violet-200 bg-white p-3 dark:border-violet-900 dark:bg-gray-950">
                      <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300">
                        <Info size={13} /> Selected edge
                      </p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {nodeById(graphNodes, activeGraphEdge.from).label} to {nodeById(graphNodes, activeGraphEdge.to).label}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Transition: {activeGraphEdge.label}. Strength: {(activeGraphEdge.weight * 100).toFixed(0)}%.
                      </p>
                    </div>
                  )}
                  <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400">
                    Graph mode is for Markov chains, HMMs, GNN message passing, recommendation user-item graphs, and pipeline DAGs.
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card title="Phase 9 Scope" icon={<GitBranch size={16} />}>
            <div className="grid gap-3 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2">
              {[
                'Teaching Mode with guided walkthroughs',
                'Learning Mode with compact mental models',
                'Practice Mode with hidden hints and checks',
                'Mode-aware explanation visibility',
              ].map(item => (
                <div key={item} className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Future Upgrades" icon={<Layers3 size={16} />}>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              {['Real model-backed attention values', 'More graph templates', 'Drag-to-rearrange nodes', 'Teacher worksheet export'].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">{index + 1}</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
