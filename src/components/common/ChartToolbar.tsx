import { useMemo, useState, type MouseEvent } from 'react';
import { Copy, Download, HelpCircle, Maximize2, RotateCcw } from 'lucide-react';
import { getAlgorithmByRoute } from '../../data/implementationStatus';
import { getAlgorithmFaqs } from '../../data/algorithmFaqs';
import { getAlgorithmIntroduction } from '../../data/algorithmIntroductions';
import { exportChartContainer, fullscreenChartContainer } from './chartUtils';

export function ChartToolbar({ onCopy, onDownload, onReset, onFullscreen, explanation }: { onCopy?: () => void; onDownload?: () => void; onReset?: () => void; onFullscreen?: () => void; explanation?: string }) {
  const [open, setOpen] = useState(false);
  const chartExplanation = useMemo(() => {
    if (explanation) return explanation;
    const algorithm = getAlgorithmByRoute(window.location.pathname);
    if (!algorithm) return 'This chart shows the current algorithm output. Use the axes and legend to compare how values change after training or parameter updates.';
    const intro = getAlgorithmIntroduction(algorithm);
    const faq = getAlgorithmFaqs(algorithm)[0]?.answer;
    return `This chart visualizes ${algorithm.label}. The axes show the page-specific inputs, outputs, or training steps; a good result usually matches the intended pattern while avoiding the warning signs: ${intro.watchFor} ${faq ?? ''}`;
  }, [explanation]);
  const handleDownload = (event: MouseEvent<HTMLButtonElement>) => {
    if (onDownload) onDownload();
    else exportChartContainer(event.currentTarget);
  };
  const handleFullscreen = (event: MouseEvent<HTMLButtonElement>) => {
    if (onFullscreen) onFullscreen();
    else fullscreenChartContainer(event.currentTarget);
  };

  const buttons = [
    { label: 'Copy chart data to clipboard', icon: <Copy size={14} />, onClick: onCopy },
    { label: 'Download PNG', icon: <Download size={14} />, onClick: handleDownload },
    { label: 'Reset view', icon: <RotateCcw size={14} />, onClick: onReset },
    { label: 'Open fullscreen chart', icon: <Maximize2 size={14} />, onClick: handleFullscreen },
  ];
  return (
    <div className="relative flex items-center gap-1">
      <button type="button" aria-label="Explain this chart" title="Explain this chart" onClick={() => setOpen(value => !value)} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-700">
        <HelpCircle size={14} />
      </button>
      {buttons.map(button => button.onClick && (
        <button key={button.label} type="button" aria-label={button.label} title={button.label} onClick={button.onClick} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-700">
          {button.icon}
        </button>
      ))}
      {open && (
        <div className="absolute right-0 top-9 z-20 w-72 rounded-lg border border-gray-200 bg-white p-3 text-xs leading-5 text-gray-600 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          {chartExplanation}
        </div>
      )}
    </div>
  );
}
