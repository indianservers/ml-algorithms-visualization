import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { LearningPanel } from '../../../components/ml/LearningPanel';
import { TrainingControls } from '../../../components/ml/TrainingControls';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { qLearning, createDefaultGrid } from '../../../lib/algorithms/reinforcement/qLearning';
import type { Action, QLearningResult, GridConfig, Cell } from '../../../lib/algorithms/reinforcement/qLearning';
import { Grid, Play, ChevronRight, Table } from 'lucide-react';
import { mean } from '../../../lib/math/statistics';

// ── Cell colour map ───────────────────────────────────────────────────────
const CELL_COLORS: Record<Cell, string> = {
  empty:   'bg-gray-100 dark:bg-gray-700',
  wall:    'bg-gray-700 dark:bg-gray-900',
  goal:    'bg-green-400 dark:bg-green-600',
  start:   'bg-blue-400 dark:bg-blue-600',
  penalty: 'bg-red-400 dark:bg-red-600',
};

const CELL_LABEL: Record<Cell, string> = {
  empty:   '',
  wall:    '▒',
  goal:    'G +10',
  start:   'S',
  penalty: 'P −5',
};

const ACTION_ARROW: Record<Action, string> = {
  up: '↑', down: '↓', left: '←', right: '→',
};

// ── Smooth episode rewards for chart ─────────────────────────────────────
function smoothRewards(rewards: number[], w = 20): { episode: number; reward: number; smoothed: number }[] {
  return rewards.map((r, i) => {
    const window = rewards.slice(Math.max(0, i - w + 1), i + 1);
    return { episode: i + 1, reward: r, smoothed: mean(window) };
  });
}

// ─────────────────────────────────────────────────────────────────────────
export default function QLearningGridWorldPage() {
  const grid: GridConfig = createDefaultGrid();

  // Hyper-params
  const [lr, setLr] = useState(0.1);
  const [gamma, setGamma] = useState(0.95);
  const [epsilon, setEpsilon] = useState(0.1);
  const [episodes, setEpisodes] = useState(300);

  // Results
  const [result, setResult] = useState<QLearningResult | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [showQTable, setShowQTable] = useState(false);
  const [showValueMap, setShowValueMap] = useState(false);

  // Animation
  const [agentPos, setAgentPos] = useState<[number, number] | null>(null);
  const [animating, setAnimating] = useState(false);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const train = useCallback(() => {
    setIsTraining(true);
    setResult(null);
    setAgentPos(null);
    setTimeout(() => {
      const res = qLearning(grid, lr, gamma, epsilon, episodes);
      setResult(res);
      setIsTraining(false);
    }, 10);
  }, [grid, lr, gamma, epsilon, episodes]);

  const reset = () => {
    setResult(null);
    setAgentPos(null);
    setAnimating(false);
    if (animRef.current) clearTimeout(animRef.current);
  };

  // Animate policy
  const animateAgent = useCallback(() => {
    if (!result) return;
    setAnimating(true);
    let [r, c] = grid.startPos;
    setAgentPos([r, c]);
    let steps = 0;

    const tick = () => {
      if (steps > 30) { setAnimating(false); return; }
      const key = `${r},${c}`;
      const action = result.policy[key];
      if (!action) { setAnimating(false); return; }
      const moves: Record<Action, [number, number]> = {
        up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1],
      };
      const [dr, dc] = moves[action];
      const nr = Math.max(0, Math.min(grid.rows - 1, r + dr));
      const nc = Math.max(0, Math.min(grid.cols - 1, c + dc));
      if (grid.cells[nr][nc] !== 'wall') { r = nr; c = nc; }
      setAgentPos([r, c]);
      steps++;
      if (grid.cells[r][c] === 'goal') { setAnimating(false); return; }
      animRef.current = setTimeout(tick, 500);
    };
    animRef.current = setTimeout(tick, 400);
  }, [result, grid]);

  useEffect(() => () => { if (animRef.current) clearTimeout(animRef.current); }, []);

  // Chart data
  const chartData = result ? smoothRewards(result.episodeRewards) : [];
  const finalReward = result ? result.episodeRewards[result.episodeRewards.length - 1].toFixed(2) : '-';
  const avgReward = result ? mean(result.episodeRewards.slice(-50)).toFixed(2) : '-';

  // Max Q per cell
  const maxQPerCell = useCallback((r: number, c: number): number | null => {
    if (!result) return null;
    const key = `${r},${c}`;
    const qs = result.qTable[key];
    if (!qs) return null;
    return Math.max(...Object.values(qs));
  }, [result]);

  const allQMax = result
    ? Object.values(result.qTable).map(qs => Math.max(...Object.values(qs)))
    : [];
  const qMin = allQMax.length ? Math.min(...allQMax) : 0;
  const qMax = allQMax.length ? Math.max(...allQMax) : 1;

  function qColor(val: number): string {
    if (!result) return '';
    const t = qMax === qMin ? 0.5 : (val - qMin) / (qMax - qMin);
    const hue = 220 - t * 220;
    return `hsla(${hue}, 85%, 52%, ${0.22 + t * 0.42})`;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      <PageHeader
        title="Q-Learning Grid World"
        subtitle="Train a reinforcement learning agent to navigate a 5×5 grid with obstacles, penalties and a goal."
        badge="Intermediate"
        category="Reinforcement Learning"
        icon={<Grid size={22} />}
      />

      <InfoBox type="info" title="Q-Learning Update Rule">
        <span className="font-mono">Q(s,a) ← Q(s,a) + α · [r + γ · max Q(s′,a′) − Q(s,a)]</span>
      </InfoBox>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Hyperparameters ── */}
        <div className="space-y-4">
          <Card title="Hyperparameters">
            <div className="space-y-4">
              {[
                { label: `Learning Rate (α) = ${lr}`,   val: lr,      set: setLr,      min: 0.01, max: 1,    step: 0.01 },
                { label: `Discount (γ) = ${gamma}`,      val: gamma,   set: setGamma,   min: 0.5,  max: 0.999, step: 0.001 },
                { label: `Epsilon (ε) = ${epsilon}`,     val: epsilon, set: setEpsilon, min: 0.01, max: 0.5,  step: 0.01 },
              ].map(({ label, val, set, min, max, step }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
                  <input type="range" min={min} max={max} step={step} value={val}
                    onChange={e => set(Number(e.target.value))}
                    className="w-full accent-blue-600 mt-1" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Episodes = {episodes}
                </label>
                <input type="range" min={50} max={1000} step={50} value={episodes}
                  onChange={e => setEpisodes(Number(e.target.value))}
                  className="w-full accent-blue-600 mt-1" />
              </div>
            </div>
          </Card>

          <Card title="Controls">
            <div className="space-y-3">
              <TrainingControls
                onTrain={train}
                onReset={reset}
                isTraining={isTraining}
                trainLabel="Train Agent"
              />
              {result && (
                <div className="space-y-2">
                  <button
                    onClick={animateAgent}
                    disabled={animating}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Play size={14} />
                    {animating ? 'Replaying...' : 'Replay Greedy Policy'}
                  </button>
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                    <input type="checkbox" checked={showValueMap} onChange={event => setShowValueMap(event.target.checked)} className="accent-blue-600" />
                    Value map overlay
                  </label>
                </div>
              )}
            </div>
          </Card>

          {result && (
            <MetricsPanel
              title="Training Results"
              metrics={[
                { label: 'Episodes', value: episodes, format: 'number' },
                { label: 'Final Reward', value: Number(finalReward) },
                { label: 'Avg Last 50', value: Number(avgReward) },
                { label: 'States', value: Object.keys(result.qTable).length, format: 'number' },
              ]}
            />
          )}
        </div>

        {/* ── Centre: Grid World ── */}
        <div className="space-y-4">
          <Card title="Grid World (5×5)">
            <div
              className="inline-grid mx-auto"
              style={{ gridTemplateColumns: 'repeat(5, 72px)', gap: 4 }}
            >
              {grid.cells.map((row, r) =>
                row.map((cell, c) => {
                  const isAgent = agentPos?.[0] === r && agentPos?.[1] === c;
                  const policy = result?.policy[`${r},${c}`];
                  const maxQ = maxQPerCell(r, c);
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`relative flex flex-col items-center justify-center rounded-lg border text-xs font-bold
                        ${CELL_COLORS[cell]}
                        ${cell === 'wall'
                          ? 'text-gray-400'
                          : cell === 'goal' ? 'text-white' : cell === 'start' ? 'text-white'
                          : cell === 'penalty' ? 'text-white' : 'text-gray-600 dark:text-gray-300'}
                        border-gray-200 dark:border-gray-600`}
                      style={{
                        width: 72, height: 72,
                        background: result && showValueMap && cell !== 'wall' && maxQ !== null
                          ? qColor(maxQ)
                          : undefined,
                      }}
                    >
                      {/* Agent marker */}
                      {isAgent && (
                        <span className="absolute top-0.5 right-0.5 text-lg z-10">🤖</span>
                      )}
                      {/* Policy arrow */}
                      {result && cell !== 'wall' && cell !== 'goal' && policy && (
                        <span className="text-2xl leading-none">{ACTION_ARROW[policy]}</span>
                      )}
                      {/* Cell label */}
                      <span className="text-[10px] mt-0.5 opacity-80">{CELL_LABEL[cell]}</span>
                      {/* Q value */}
                      {result && maxQ !== null && (
                        <span className="text-[9px] opacity-60 font-mono">{maxQ.toFixed(1)}</span>
                      )}
                      {/* Coords */}
                      <span className="text-[8px] opacity-40 font-mono absolute bottom-0.5 left-1">{r},{c}</span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-x-4 gap-y-1 text-[10px] text-gray-500">
              {(['empty', 'wall', 'goal', 'start', 'penalty'] as Cell[]).map(t => (
                <div key={t} className="flex items-center gap-1">
                  <span className={`w-3 h-3 rounded ${CELL_COLORS[t]} border border-gray-300 inline-block`} />
                  <span className="capitalize">{t}</span>
                </div>
              ))}
            </div>
          </Card>

          {result && showValueMap && (
            <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-1 flex items-center justify-between text-gray-500">
                <span>Low value {qMin.toFixed(1)}</span>
                <span>High value {qMax.toFixed(1)}</span>
              </div>
              <div className="h-3 rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 via-yellow-300 to-red-500" />
            </div>
          )}

          {result && (
            <InfoBox type="success" title="Training complete!">
              Policy arrows show the best action in each non-wall cell. Toggle the value map to color each state by V(s)=max Q(s,a), then replay the greedy policy step by step.
            </InfoBox>
          )}
        </div>

        {/* ── Right: Charts ── */}
        <div className="space-y-4">
          {result ? (
            <>
              <Card title="Episode Rewards">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="episode" tick={{ fontSize: 10 }} label={{ value: 'Episode', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => v.toFixed(2)} />
                    <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" />
                    <Line type="monotone" dataKey="reward" stroke="#cbd5e1" strokeWidth={1} dot={false} />
                    <Line type="monotone" dataKey="smoothed" stroke="#3b82f6" strokeWidth={2} dot={false} name="Smoothed" />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card
                title="Q-Table"
                collapsible
                actions={
                  <button
                    onClick={() => setShowQTable(s => !s)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    <Table size={11} />
                    {showQTable ? 'Hide' : 'Show'}
                    <ChevronRight size={11} className={`transition-transform ${showQTable ? 'rotate-90' : ''}`} />
                  </button>
                }
              >
                {showQTable && (
                  <div className="overflow-x-auto">
                    <table className="text-[10px] font-mono w-full">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700">
                          <th className="px-2 py-1 text-left">State</th>
                          <th className="px-2 py-1">↑ Up</th>
                          <th className="px-2 py-1">↓ Down</th>
                          <th className="px-2 py-1">← Left</th>
                          <th className="px-2 py-1">→ Right</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(result.qTable)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([state, vals]) => (
                            <tr key={state} className="border-t border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                              <td className="px-2 py-1 font-bold text-blue-600">[{state}]</td>
                              {(['up', 'down', 'left', 'right'] as Action[]).map(a => (
                                <td
                                  key={a}
                                  className={`px-2 py-1 text-center ${
                                    result.policy[state] === a ? 'text-green-600 font-bold' : 'text-gray-500'
                                  }`}
                                >
                                  {vals[a].toFixed(2)}
                                </td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!showQTable && (
                  <p className="text-xs text-gray-400 text-center py-2">
                    Click "Show" to expand Q-table ({Object.keys(result.qTable).length} states × 4 actions)
                  </p>
                )}
              </Card>
            </>
          ) : (
            <Card title="Episode Rewards">
              <div className="h-40 flex items-center justify-center text-sm text-gray-400">
                Train the agent to see reward chart.
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Learning Notes */}
      <LearningPanel
        sections={[
          {
            title: 'Q-Learning Algorithm',
            content: (
              <div className="space-y-1">
                <p>Q-Learning is a model-free, off-policy algorithm. It maintains a Q-table mapping (state, action) pairs to expected cumulative rewards.</p>
                <p className="font-mono bg-gray-100 dark:bg-gray-700 p-1 rounded mt-1">
                  Q(s,a) ← Q(s,a) + α[r + γ·max_a′ Q(s′,a′) − Q(s,a)]
                </p>
              </div>
            ),
          },
          {
            title: 'Hyperparameter Effects',
            content: (
              <ul className="list-disc ml-4 space-y-1">
                <li><strong>α (learning rate)</strong>: how fast Q-values update. Too high → unstable; too low → slow.</li>
                <li><strong>γ (discount)</strong>: future reward weight. Near 1 = long-sighted; near 0 = greedy.</li>
                <li><strong>ε (epsilon)</strong>: exploration rate. Decaying epsilon is common in practice.</li>
              </ul>
            ),
          },
          {
            title: 'Grid World Setup',
            content: (
              <ul className="list-disc ml-4 space-y-1">
                <li>Start: (0,0) — agent begins here each episode.</li>
                <li>Goal: (4,4) reward +10 — episode ends on arrival.</li>
                <li>Penalty: (2,2) reward −5.</li>
                <li>Walls: impassable cells.</li>
                <li>Step cost: −0.01 per move to encourage short paths.</li>
              </ul>
            ),
          },
        ]}
      />
    </div>
  );
}
