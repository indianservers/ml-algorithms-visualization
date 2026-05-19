export type Cell = 'empty' | 'wall' | 'goal' | 'start' | 'penalty';

export interface GridConfig {
  rows: number;
  cols: number;
  cells: Cell[][];
  rewards: Record<string, number>;
  startPos: [number, number];
  goalPos: [number, number];
}

export type Action = 'up' | 'down' | 'left' | 'right';
const ACTIONS: Action[] = ['up', 'down', 'left', 'right'];

function stateKey(r: number, c: number): string { return `${r},${c}`; }

function step(grid: GridConfig, r: number, c: number, action: Action): [number, number] {
  const moves: Record<Action, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
  const [dr, dc] = moves[action];
  const nr = r + dr, nc = c + dc;
  if (nr < 0 || nr >= grid.rows || nc < 0 || nc >= grid.cols || grid.cells[nr][nc] === 'wall') return [r, c];
  return [nr, nc];
}

function getReward(grid: GridConfig, r: number, c: number): number {
  const key = stateKey(r, c);
  return grid.rewards[key] ?? -0.01;
}

export interface QLearningResult {
  qTable: Record<string, Record<Action, number>>;
  policy: Record<string, Action>;
  episodeRewards: number[];
}

export function qLearning(
  grid: GridConfig,
  learningRate = 0.1,
  discount = 0.95,
  epsilon = 0.1,
  episodes = 500
): QLearningResult {
  const qTable: Record<string, Record<Action, number>> = {};
  const episodeRewards: number[] = [];

  const initQ = (r: number, c: number) => {
    const key = stateKey(r, c);
    if (!qTable[key]) qTable[key] = { up: 0, down: 0, left: 0, right: 0 };
  };

  for (let row = 0; row < grid.rows; row++)
    for (let col = 0; col < grid.cols; col++) initQ(row, col);

  for (let ep = 0; ep < episodes; ep++) {
    let [r, c] = grid.startPos;
    let totalReward = 0;
    let steps = 0;

    while (steps < 200) {
      const key = stateKey(r, c);
      if (grid.cells[r][c] === 'goal') break;
      let action: Action;
      if (Math.random() < epsilon) {
        action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
      } else {
        action = ACTIONS.reduce((best, a) => qTable[key][a] > qTable[key][best] ? a : best, ACTIONS[0]);
      }
      const [nr, nc] = step(grid, r, c, action);
      const reward = getReward(grid, nr, nc);
      totalReward += reward;
      const nextKey = stateKey(nr, nc);
      const terminal = grid.cells[nr][nc] === 'goal';
      const maxNextQ = terminal ? 0 : Math.max(...ACTIONS.map(a => qTable[nextKey]?.[a] ?? 0));
      qTable[key][action] += learningRate * (reward + discount * maxNextQ - qTable[key][action]);
      r = nr; c = nc;
      steps++;
    }
    episodeRewards.push(totalReward);
  }

  const policy: Record<string, Action> = {};
  Object.entries(qTable).forEach(([key, vals]) => {
    policy[key] = ACTIONS.reduce((best, a) => vals[a] > vals[best] ? a : best, ACTIONS[0]);
  });

  return { qTable, policy, episodeRewards };
}

export function createDefaultGrid(): GridConfig {
  const rows = 5, cols = 5;
  const cells: Cell[][] = Array.from({ length: rows }, () => Array(cols).fill('empty'));
  cells[1][1] = 'wall'; cells[1][2] = 'wall'; cells[2][3] = 'wall'; cells[3][1] = 'wall';
  cells[4][4] = 'goal'; cells[0][0] = 'start'; cells[2][2] = 'penalty';
  const rewards: Record<string, number> = { '4,4': 10, '2,2': -5 };
  return { rows, cols, cells, rewards, startPos: [0, 0], goalPos: [4, 4] };
}
