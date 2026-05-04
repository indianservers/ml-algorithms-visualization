import React, { useState, useCallback, useMemo } from 'react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { Tabs } from '../../../components/common/Tabs';
import { LearningPanel } from '../../../components/ml/LearningPanel';
import { Eye, Grid, Layers, RefreshCw } from 'lucide-react';

// ── Preset pixel grids (8×8) ──────────────────────────────────────────────
const GRID_SIZE = 8;

function emptyGrid(size = GRID_SIZE): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function diagonalPreset(): number[][] {
  const g = emptyGrid();
  for (let i = 0; i < GRID_SIZE; i++) g[i][i] = 255;
  return g;
}

function crossPreset(): number[][] {
  const g = emptyGrid();
  const mid = Math.floor(GRID_SIZE / 2);
  for (let i = 0; i < GRID_SIZE; i++) { g[mid][i] = 255; g[i][mid] = 255; }
  return g;
}

function circlePreset(): number[][] {
  const g = emptyGrid();
  const cx = (GRID_SIZE - 1) / 2, cy = (GRID_SIZE - 1) / 2, r = (GRID_SIZE / 2) - 1;
  for (let row = 0; row < GRID_SIZE; row++)
    for (let col = 0; col < GRID_SIZE; col++) {
      const d = Math.sqrt((row - cy) ** 2 + (col - cx) ** 2);
      if (Math.abs(d - r) < 1.2) g[row][col] = 255;
    }
  return g;
}

function checkerPreset(): number[][] {
  const g = emptyGrid();
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      g[r][c] = (r + c) % 2 === 0 ? 255 : 0;
  return g;
}

// ── Filter kernels ────────────────────────────────────────────────────────
type FilterName = 'sobelX' | 'sobelY' | 'blur' | 'sharpen' | 'identity' | 'custom';

const FILTERS: Record<Exclude<FilterName, 'custom'>, { label: string; kernel: number[][] }> = {
  sobelX:   { label: 'Sobel X (edge ↔)', kernel: [[-1,0,1],[-2,0,2],[-1,0,1]] },
  sobelY:   { label: 'Sobel Y (edge ↕)', kernel: [[-1,-2,-1],[0,0,0],[1,2,1]] },
  blur:     { label: 'Blur (avg 3×3)',   kernel: [[1,1,1],[1,1,1],[1,1,1]] },
  sharpen:  { label: 'Sharpen',          kernel: [[0,-1,0],[-1,5,-1],[0,-1,0]] },
  identity: { label: 'Identity',         kernel: [[0,0,0],[0,1,0],[0,0,0]] },
};

// ── Convolution helper ────────────────────────────────────────────────────
function applyConvolution(
  input: number[][],
  kernel: number[][],
  stride: 1 | 2,
  padding: 'valid' | 'same',
  divisor = 1
): number[][] {
  const H = input.length, W = input[0].length;
  const kH = kernel.length, kW = kernel[0].length;
  const pad = padding === 'same' ? Math.floor(kH / 2) : 0;

  const padded: number[][] = Array.from({ length: H + 2 * pad }, (_, r) =>
    Array.from({ length: W + 2 * pad }, (_, c) => {
      const or = r - pad, oc = c - pad;
      return or >= 0 && or < H && oc >= 0 && oc < W ? input[or][oc] : 0;
    })
  );

  const outH = Math.floor((H + 2 * pad - kH) / stride) + 1;
  const outW = Math.floor((W + 2 * pad - kW) / stride) + 1;
  const output: number[][] = Array.from({ length: outH }, () => Array(outW).fill(0));

  for (let r = 0; r < outH; r++)
    for (let c = 0; c < outW; c++) {
      let sum = 0;
      for (let m = 0; m < kH; m++)
        for (let n = 0; n < kW; n++)
          sum += padded[r * stride + m][c * stride + n] * kernel[m][n];
      output[r][c] = sum / divisor;
    }
  return output;
}

// ── Color mapping helpers ─────────────────────────────────────────────────
function valToInputColor(v: number): string {
  const n = Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${n},${n},${n})`;
}

function valToOutputColor(v: number, min: number, max: number): string {
  if (max === min) return 'rgb(128,128,200)';
  const t = (v - min) / (max - min);
  const r = Math.round(t * 220);
  const b = Math.round((1 - t) * 220);
  return `rgb(${r},80,${b})`;
}

function valToKernelColor(v: number): string {
  if (v > 0) return `rgba(59,130,246,${Math.min(1, v / 5)})`;
  if (v < 0) return `rgba(239,68,68,${Math.min(1, Math.abs(v) / 5)})`;
  return 'rgb(243,244,246)';
}

// ── Cell size for display ─────────────────────────────────────────────────
const CELL = 36;
const KCELL = 44;

// ─────────────────────────────────────────────────────────────────────────
export default function CNNFilterExplorerPage() {
  const [inputGrid, setInputGrid] = useState<number[][]>(crossPreset);
  const [filterName, setFilterName] = useState<FilterName>('sobelX');
  const [customKernel, setCustomKernel] = useState<number[][]>([[0,-1,0],[-1,4,-1],[0,-1,0]]);
  const [stride, setStride] = useState<1 | 2>(1);
  const [padding, setPadding] = useState<'valid' | 'same'>('same');
  const [highlighted, setHighlighted] = useState<[number, number] | null>(null);

  // Active kernel
  const kernel: number[][] = filterName === 'custom'
    ? customKernel
    : FILTERS[filterName as Exclude<FilterName, 'custom'>].kernel;
  const divisor = filterName === 'blur' ? 9 : 1;

  // Compute output
  const output = useMemo(
    () => applyConvolution(inputGrid, kernel, stride, padding, divisor),
    [inputGrid, kernel, stride, padding, divisor]
  );

  const outMin = useMemo(() => Math.min(...output.flat()), [output]);
  const outMax = useMemo(() => Math.max(...output.flat()), [output]);

  // Input cell change
  const setCell = (r: number, c: number, val: number) => {
    setInputGrid(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = Math.max(0, Math.min(255, val));
      return next;
    });
  };

  const applyPreset = (preset: () => number[][]) => setInputGrid(preset());

  // Output dims formula
  const H = GRID_SIZE, W = GRID_SIZE, kH = 3, kW = 3;
  const pad = padding === 'same' ? 1 : 0;
  const outHCalc = Math.floor((H + 2 * pad - kH) / stride) + 1;
  const outWCalc = Math.floor((W + 2 * pad - kW) / stride) + 1;

  // Highlighted patch (which input region is used for a given output cell)
  const patchRows = useMemo(() => highlighted
    ? Array.from({ length: kH }, (_, m) => highlighted[0] * stride + m - pad)
    : [],
  [highlighted, stride, pad, kH]);
  const patchCols = useMemo(() => highlighted
    ? Array.from({ length: kW }, (_, n) => highlighted[1] * stride + n - pad)
    : [],
  [highlighted, stride, pad, kW]);
  const isPatch = useCallback(
    (r: number, c: number) =>
      patchRows.some((pr, m) => pr === r && patchCols[m] !== undefined) &&
      patchCols.some(pc => pc === c) &&
      patchRows.some(pr => pr === r),
    [patchRows, patchCols]
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6">
      <PageHeader
        title="CNN Filter Explorer"
        subtitle="Visualise how convolutional kernels transform 2-D pixel grids — step by step."
        badge="Intermediate"
        category="Computer Vision"
        icon={<Eye size={22} />}
      />

      {/* Formula strip */}
      <InfoBox type="info" title="Convolution Formula">
        <p className="font-mono text-xs">
          output[i][j] = Σ<sub>m</sub>Σ<sub>n</sub> input[i·s + m][j·s + n] × kernel[m][n]
        </p>
        <p className="mt-1 text-xs">
          Output size: ⌊(H + 2p − kH) / s⌋ + 1 = <strong>{outHCalc}</strong> rows ×
          ⌊(W + 2p − kW) / s⌋ + 1 = <strong>{outWCalc}</strong> cols
          &nbsp;(stride={stride}, padding={padding}, kernel=3×3)
        </p>
      </InfoBox>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left: controls ── */}
        <div className="space-y-4">
          <Card title="Presets & Input">
            <p className="text-xs text-gray-500 mb-2">Choose a preset image pattern:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { label: 'Cross',     fn: crossPreset },
                { label: 'Diagonal',  fn: diagonalPreset },
                { label: 'Circle',    fn: circlePreset },
                { label: 'Checker',   fn: checkerPreset },
                { label: 'Blank',     fn: () => emptyGrid() },
              ].map(({ label, fn }) => (
                <button
                  key={label}
                  onClick={() => applyPreset(fn)}
                  className="px-3 py-1.5 text-xs rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </Card>

          <Card title="Filter Selector">
            <div className="space-y-1">
              {(Object.keys(FILTERS) as Exclude<FilterName, 'custom'>[]).map(k => (
                <label key={k} className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    type="radio"
                    name="filter"
                    value={k}
                    checked={filterName === k}
                    onChange={() => setFilterName(k)}
                    className="accent-blue-600"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{FILTERS[k].label}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <input
                  type="radio"
                  name="filter"
                  value="custom"
                  checked={filterName === 'custom'}
                  onChange={() => setFilterName('custom')}
                  className="accent-blue-600"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">Custom (editable below)</span>
              </label>
            </div>
          </Card>

          <Card title="Convolution Settings">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Stride</label>
                <div className="flex gap-2 mt-1">
                  {([1, 2] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setStride(s)}
                      className={`px-3 py-1 text-xs rounded border transition-colors ${
                        stride === s
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-300'
                      }`}
                    >
                      s={s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Padding</label>
                <div className="flex gap-2 mt-1">
                  {(['valid', 'same'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPadding(p)}
                      className={`px-3 py-1 text-xs rounded border capitalize transition-colors ${
                        padding === p
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Centre: grids ── */}
        <div className="xl:col-span-2 space-y-4">
          <Tabs
            tabs={[
              { id: 'visual', label: 'Visual Grids', icon: <Grid size={12} /> },
              { id: 'edit',   label: 'Edit Input',   icon: <Layers size={12} /> },
            ]}
          >
            {activeTab => (
              <div>
                {activeTab === 'visual' && (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500">
                      Hover an <strong>output cell</strong> to highlight the corresponding input patch used in the convolution.
                    </p>
                    <div className="flex flex-wrap gap-8 items-start">
                      {/* Input */}
                      <div>
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Input ({GRID_SIZE}×{GRID_SIZE})</p>
                        <div className="inline-grid" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL}px)`, gap: 1 }}>
                          {inputGrid.map((row, r) =>
                            row.map((val, c) => {
                              const inPatch = highlighted !== null && isPatch(r, c);
                              return (
                                <div
                                  key={`${r}-${c}`}
                                  style={{
                                    width: CELL, height: CELL,
                                    background: valToInputColor(val),
                                    outline: inPatch ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                                    outlineOffset: inPatch ? '-2px' : '-1px',
                                  }}
                                  title={`[${r},${c}] = ${val}`}
                                />
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Kernel */}
                      <div>
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                          Kernel (3×3){filterName === 'blur' ? ' ÷ 9' : ''}
                        </p>
                        <div className="inline-grid" style={{ gridTemplateColumns: `repeat(3, ${KCELL}px)`, gap: 2 }}>
                          {kernel.map((row, m) =>
                            row.map((v, n) => (
                              filterName === 'custom' ? (
                                <input
                                  key={`k${m}-${n}`}
                                  type="number"
                                  value={v}
                                  onChange={e => {
                                    const nv = Number(e.target.value);
                                    setCustomKernel(prev => {
                                      const next = prev.map(r => [...r]);
                                      next[m][n] = nv;
                                      return next;
                                    });
                                  }}
                                  style={{ width: KCELL, height: KCELL, background: valToKernelColor(v) }}
                                  className="text-center text-xs font-mono font-bold border border-gray-300 rounded"
                                />
                              ) : (
                                <div
                                  key={`k${m}-${n}`}
                                  style={{ width: KCELL, height: KCELL, background: valToKernelColor(v) }}
                                  className="flex items-center justify-center text-xs font-mono font-bold rounded border border-gray-300 dark:border-gray-600"
                                >
                                  {v}
                                </div>
                              )
                            ))
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1 text-center">
                          Blue = positive · Red = negative
                        </p>
                      </div>

                      {/* Output */}
                      <div>
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                          Output Feature Map ({outHCalc}×{outWCalc})
                        </p>
                        <div className="inline-grid" style={{ gridTemplateColumns: `repeat(${outWCalc}, ${CELL}px)`, gap: 1 }}>
                          {output.map((row, r) =>
                            row.map((val, c) => (
                              <div
                                key={`o${r}-${c}`}
                                style={{
                                  width: CELL, height: CELL,
                                  background: valToOutputColor(val, outMin, outMax),
                                  cursor: 'crosshair',
                                }}
                                className="flex items-center justify-center text-white text-[9px] font-mono rounded-sm"
                                onMouseEnter={() => setHighlighted([r, c])}
                                onMouseLeave={() => setHighlighted(null)}
                                title={`[${r},${c}] = ${val.toFixed(1)}`}
                              >
                                {Math.round(val)}
                              </div>
                            ))
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">range [{outMin.toFixed(0)}, {outMax.toFixed(0)}]</p>
                      </div>
                    </div>

                    {/* Step detail */}
                    {highlighted && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs">
                        <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                          Step-by-step: output[{highlighted[0]}][{highlighted[1]}]
                        </p>
                        <p className="font-mono text-amber-700 dark:text-amber-400 break-all">
                          {kernel.map((row, m) =>
                            row.map((kv, n) => {
                              const ir = highlighted[0] * stride + m - pad;
                              const ic = highlighted[1] * stride + n - pad;
                              const iv = ir >= 0 && ir < GRID_SIZE && ic >= 0 && ic < GRID_SIZE
                                ? inputGrid[ir][ic] : 0;
                              return `(${iv}×${kv})`;
                            }).join('+')
                          ).join(' + ')}
                          {divisor !== 1 ? ` ÷ ${divisor}` : ''}
                          {' = '}<strong>{output[highlighted[0]][highlighted[1]].toFixed(2)}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'edit' && (
                  <div>
                    <p className="text-xs text-gray-500 mb-3">
                      Click a cell and type a value (0–255). 0 = black, 255 = white.
                    </p>
                    <div className="flex items-start gap-4 flex-wrap">
                      <div className="inline-grid" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 40px)`, gap: 2 }}>
                        {inputGrid.map((row, r) =>
                          row.map((val, c) => (
                            <input
                              key={`e${r}-${c}`}
                              type="number"
                              min={0} max={255}
                              value={val}
                              onChange={e => setCell(r, c, Number(e.target.value))}
                              style={{ background: valToInputColor(val), color: val > 128 ? '#000' : '#fff' }}
                              className="w-10 h-10 text-center text-xs font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          ))
                        )}
                      </div>
                      <div className="space-y-2">
                        <button
                          onClick={() => setInputGrid(emptyGrid())}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          <RefreshCw size={12} /> Clear
                        </button>
                        <button
                          onClick={() => setInputGrid(prev => prev.map(row => row.map(() => Math.round(Math.random() * 255))))}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          Random Fill
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Tabs>
        </div>
      </div>

      {/* Learning Notes */}
      <LearningPanel
        defaultOpen={false}
        sections={[
          {
            title: 'What is a Convolutional Filter?',
            content: (
              <div>
                <p>A convolutional filter (kernel) is a small matrix that slides over the input image. At each position it computes a dot product between the kernel weights and the local input patch, producing one value in the output feature map.</p>
              </div>
            ),
          },
          {
            title: 'Stride and Padding',
            content: (
              <div>
                <p><strong>Stride</strong> controls how many pixels the kernel moves each step. Stride=1 produces a larger output; stride=2 halves it.</p>
                <p className="mt-1"><strong>Padding=same</strong> adds zeros around the border so the output has the same spatial size as the input (with stride=1). <strong>Padding=valid</strong> uses no padding, so the output shrinks.</p>
              </div>
            ),
          },
          {
            title: 'Common Filters Explained',
            content: (
              <ul className="list-disc ml-4 space-y-1">
                <li><strong>Sobel X/Y</strong>: detect horizontal or vertical edges by computing intensity gradients.</li>
                <li><strong>Blur</strong>: averages neighbouring pixels – smooths noise.</li>
                <li><strong>Sharpen</strong>: amplifies the centre pixel relative to neighbours – enhances edges.</li>
                <li><strong>Identity</strong>: passes the image through unchanged.</li>
              </ul>
            ),
          },
        ]}
      />
    </div>
  );
}
