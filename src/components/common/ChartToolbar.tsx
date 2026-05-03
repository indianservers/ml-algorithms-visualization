import { Copy, Download, Maximize2, RotateCcw } from 'lucide-react';

export function ChartToolbar({ onCopy, onDownload, onReset, onFullscreen }: { onCopy?: () => void; onDownload?: () => void; onReset?: () => void; onFullscreen?: () => void }) {
  const buttons = [
    { label: 'Copy chart data', icon: <Copy size={14} />, onClick: onCopy },
    { label: 'Download chart image', icon: <Download size={14} />, onClick: onDownload },
    { label: 'Reset chart view', icon: <RotateCcw size={14} />, onClick: onReset },
    { label: 'Fullscreen chart', icon: <Maximize2 size={14} />, onClick: onFullscreen },
  ];
  return (
    <div className="flex items-center gap-1">
      {buttons.map(button => (
        <button key={button.label} type="button" aria-label={button.label} title={button.label} onClick={button.onClick} className="rounded p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-700">
          {button.icon}
        </button>
      ))}
    </div>
  );
}
