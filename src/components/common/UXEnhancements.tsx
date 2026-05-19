import React from 'react';
import { ArrowUp, CheckCircle2, WifiOff } from 'lucide-react';

const commandLabels: Record<string, string> = {
  train: 'Train command sent',
  reset: 'Reset command sent',
  step: 'Step command sent',
  save: 'Save command sent',
  export: 'Export command sent',
};

export function UXEnhancements({ routeLabel }: { routeLabel?: string }) {
  const [scrollPercent, setScrollPercent] = React.useState(0);
  const [showBackToTop, setShowBackToTop] = React.useState(false);
  const [toast, setToast] = React.useState('');
  const [online, setOnline] = React.useState(() => navigator.onLine);

  React.useEffect(() => {
    const scroller = document.querySelector('main');
    if (!scroller) return;

    const update = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      const percent = max <= 0 ? 0 : Math.min(100, Math.max(0, (scroller.scrollTop / max) * 100));
      setScrollPercent(percent);
      setShowBackToTop(scroller.scrollTop > 520);
    };

    update();
    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [routeLabel]);

  React.useEffect(() => {
    const listeners = Object.keys(commandLabels).map(command => {
      const handler = () => {
        setToast(commandLabels[command]);
        window.setTimeout(() => setToast(''), 1500);
      };
      window.addEventListener(`ml:${command}`, handler);
      return () => window.removeEventListener(`ml:${command}`, handler);
    });
    return () => listeners.forEach(remove => remove());
  }, []);

  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const scrollTop = () => {
    const scroller = document.querySelector('main');
    scroller?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 h-1 bg-transparent print:hidden">
        <div className="h-full bg-blue-600 transition-[width] duration-150 dark:bg-blue-400" style={{ width: `${scrollPercent}%` }} />
      </div>
      <div aria-live="polite" className="sr-only">
        {routeLabel ? `Current page: ${routeLabel}` : ''}
      </div>
      {!online && (
        <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800 shadow-lg dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 print:hidden">
          <WifiOff size={14} />
          Offline mode
        </div>
      )}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-xl dark:border-emerald-900 dark:bg-gray-900 dark:text-emerald-300 print:hidden" role="status">
          <CheckCircle2 size={16} />
          {toast}
        </div>
      )}
      {showBackToTop && (
        <button
          onClick={scrollTop}
          className="fixed bottom-4 left-4 z-40 grid min-h-11 min-w-11 place-items-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-lg hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 print:hidden"
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp size={18} />
        </button>
      )}
    </>
  );
}
