import React from 'react';

export type ChartPalette = {
  axis: string;
  grid: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  surface: string;
  series: string[];
};

const lightPalette: ChartPalette = {
  axis: '#4b5563',
  grid: '#e5e7eb',
  tooltipBg: '#ffffff',
  tooltipBorder: '#d1d5db',
  tooltipText: '#111827',
  surface: '#ffffff',
  series: ['#2563eb', '#059669', '#dc2626', '#9333ea', '#ea580c', '#0891b2'],
};

const darkPalette: ChartPalette = {
  axis: '#cbd5e1',
  grid: '#334155',
  tooltipBg: '#0f172a',
  tooltipBorder: '#475569',
  tooltipText: '#f8fafc',
  surface: '#111827',
  series: ['#60a5fa', '#34d399', '#f87171', '#c084fc', '#fb923c', '#22d3ee'],
};

function isDarkMode() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

export function useChartPalette() {
  const [dark, setDark] = React.useState(isDarkMode);

  React.useEffect(() => {
    const refresh = () => setDark(isDarkMode());
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('ml:theme-changed', refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener('ml:theme-changed', refresh);
    };
  }, []);

  return dark ? darkPalette : lightPalette;
}

export function themedTooltipProps(palette: ChartPalette) {
  return {
    contentStyle: {
      backgroundColor: palette.tooltipBg,
      borderColor: palette.tooltipBorder,
      color: palette.tooltipText,
    },
    labelStyle: { color: palette.tooltipText },
    itemStyle: { color: palette.tooltipText },
  };
}

export function useSeriesVisibility(keys: string[]) {
  const keySignature = keys.join('\u0000');
  const normalizedKeys = React.useMemo(() => keySignature ? keySignature.split('\u0000') : [], [keySignature]);
  const keySet = React.useMemo(() => new Set(normalizedKeys), [normalizedKeys]);
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());
  const filteredHidden = React.useMemo(() => new Set([...hidden].filter(key => keySet.has(key))), [hidden, keySet]);

  const toggle = React.useCallback((key: string) => {
    setHidden(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const legendClick = React.useCallback((entry: { dataKey?: unknown }) => {
    if (typeof entry.dataKey === 'string' || typeof entry.dataKey === 'number') {
      toggle(String(entry.dataKey));
    }
  }, [toggle]);

  return { hidden: filteredHidden, legendClick, toggle };
}

type Domain = [number, number] | undefined;

export function useRechartsZoom() {
  const [refAreaLeft, setRefAreaLeft] = React.useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = React.useState<number | null>(null);
  const [xDomain, setXDomain] = React.useState<Domain>(undefined);

  const mouseDown = React.useCallback((event: { activeLabel?: string | number }) => {
    const value = Number(event?.activeLabel);
    if (Number.isFinite(value)) setRefAreaLeft(value);
  }, []);

  const mouseMove = React.useCallback((event: { activeLabel?: string | number }) => {
    if (refAreaLeft === null) return;
    const value = Number(event?.activeLabel);
    if (Number.isFinite(value)) setRefAreaRight(value);
  }, [refAreaLeft]);

  const mouseUp = React.useCallback(() => {
    if (refAreaLeft === null || refAreaRight === null || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }
    setXDomain([Math.min(refAreaLeft, refAreaRight), Math.max(refAreaLeft, refAreaRight)]);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, [refAreaLeft, refAreaRight]);

  const resetZoom = React.useCallback(() => {
    setXDomain(undefined);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  }, []);

  return {
    xDomain,
    refAreaLeft,
    refAreaRight,
    mouseDown,
    mouseMove,
    mouseUp,
    resetZoom,
  };
}

export function exportChartContainer(button: HTMLElement) {
  const container = button.closest('[data-chart-container]') ?? document.body;
  const canvas = container.querySelector('canvas');
  if (canvas) {
    canvas.toBlob(blob => {
      if (blob) downloadBlob(blob, 'ml-chart.png');
    });
    return;
  }

  const svg = container.querySelector('svg');
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const bounds = svg.getBoundingClientRect();
  clone.setAttribute('width', String(Math.max(1, Math.round(bounds.width))));
  clone.setAttribute('height', String(Math.max(1, Math.round(bounds.height))));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  const image = new Image();
  image.onload = () => {
    const output = document.createElement('canvas');
    output.width = Math.max(1, Math.round(bounds.width));
    output.height = Math.max(1, Math.round(bounds.height));
    const ctx = output.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }
    ctx.fillStyle = isDarkMode() ? darkPalette.surface : lightPalette.surface;
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.drawImage(image, 0, 0, output.width, output.height);
    output.toBlob(blob => {
      if (blob) downloadBlob(blob, 'ml-chart.png');
      URL.revokeObjectURL(url);
    });
  };
  image.src = url;
}

export function fullscreenChartContainer(button: HTMLElement) {
  const container = button.closest('[data-chart-container]') as HTMLElement | null;
  const target = container ?? document.documentElement;
  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }
  target.requestFullscreen?.();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
