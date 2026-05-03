import React, { Suspense } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { useTheme, useSidebarState } from '../stores/uiStore';
import { Sun, Moon, Menu, Search, Play, RotateCcw, StepForward, Save, Download, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { getImplementationStatus, rememberRoute } from '../data/implementationStatus';
import { navigationData } from '../data/navigation';
import { Badge } from '../components/common/Badge';
import { RouteSearchModal } from '../components/common/RouteSearchModal';

const PageFallback = () => (
  <div className="mx-auto max-w-7xl space-y-4 p-4" aria-label="Loading algorithm page">
    <div className="h-24 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="h-48 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="space-y-3">
        <div className="h-72 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="h-20 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="h-20 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
    </div>
  </div>
);

class RouteErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100">
          <h2 className="text-lg font-bold">Algorithm route failed to render</h2>
          <p className="mt-2 text-sm">The lazy route boundary caught this error, so the rest of the suite is still usable.</p>
          <pre className="mt-3 overflow-auto rounded bg-white/70 p-3 text-xs dark:bg-gray-900/50">{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export const RootLayout: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { collapsed, toggle } = useSidebarState();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [routeSearchOpen, setRouteSearchOpen] = React.useState(false);

  React.useEffect(() => {
    if (location.pathname.startsWith('/ml/')) rememberRoute(location.pathname);
  }, [location.pathname]);

  React.useEffect(() => {
    const emitCommand = (name: string) => window.dispatchEvent(new CustomEvent(`ml:${name}`));
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setRouteSearchOpen(true);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        emitCommand('save');
        return;
      }
      if (editing) return;
      if (event.key.toLowerCase() === 't') emitCommand('train');
      if (event.key.toLowerCase() === 'r') emitCommand('reset');
      if (event.key.toLowerCase() === 's') emitCommand('step');
      if (event.key.toLowerCase() === 'e') emitCommand('export');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const currentItem = navigationData
    .flatMap(category => category.items.map(item => ({ ...item, category: category.category })))
    .find(item => item.route === location.pathname);
  const algorithmStatus = currentItem ? getImplementationStatus(currentItem.route) : undefined;
  const statusTone = algorithmStatus === 'Implemented'
    ? 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100'
    : algorithmStatus === 'Scaffold'
      ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100'
      : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
  const commandButtons = [
    { label: 'Train', hint: 'T', event: 'train', icon: <Play size={14} /> },
    { label: 'Reset', hint: 'R', event: 'reset', icon: <RotateCcw size={14} /> },
    { label: 'Step', hint: 'S', event: 'step', icon: <StepForward size={14} /> },
    { label: 'Save', hint: 'Ctrl+S on page forms', event: 'save', icon: <Save size={14} /> },
    { label: 'Export', hint: 'E', event: 'export', icon: <Download size={14} /> },
  ];

  return (
    <div className={`flex h-screen w-full overflow-hidden bg-gray-50 dark:bg-gray-950 ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </div>
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button aria-label="Close sidebar overlay" className="absolute inset-0 bg-gray-950/50" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative h-full w-72 max-w-[85vw] shadow-2xl">
            <Sidebar collapsed={false} onToggle={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="h-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 md:hidden"
              aria-label="Open sidebar"
              title="Open sidebar"
            >
              <Menu size={16} />
            </button>
            <button
              onClick={() => setRouteSearchOpen(true)}
              className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:flex"
              title="Search routes (Ctrl+K)"
            >
              <Search size={13} />
              Search
              <kbd className="rounded border border-gray-200 px-1 text-[10px] dark:border-gray-600">Ctrl K</kbd>
            </button>
          </div>
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
        {currentItem && algorithmStatus && (
          <div className={`shrink-0 border-b px-4 py-2 ${statusTone}`}>
            <div className="flex flex-wrap items-center gap-2">
              {algorithmStatus === 'Implemented' ? <CheckCircle2 size={15} /> : algorithmStatus === 'Scaffold' ? <AlertTriangle size={15} /> : <Info size={15} />}
              <Link to="/implementation-matrix" className="text-xs font-bold uppercase tracking-wide hover:underline">Implementation Status</Link>
              <Badge type={algorithmStatus} />
              <span className="text-xs font-semibold">{currentItem.category}</span>
              <span className="hidden text-xs text-gray-500 dark:text-gray-400 sm:inline">/</span>
              <span className="text-xs font-semibold">{currentItem.label}</span>
              <span className="ml-auto hidden text-xs md:inline">
                {algorithmStatus === 'Implemented'
                  ? 'Quality gate: real computation, unique controls, chart, metrics, export/save path.'
                  : 'This route is clearly labeled until real computation and checklist coverage are complete.'}
              </span>
              <div className="flex w-full flex-wrap gap-1 pt-1 sm:w-auto sm:pt-0">
                {algorithmStatus === 'Implemented' && ['data', 'controls', 'chart', 'metrics', 'export', 'save'].map(item => (
                  <span key={item} className="hidden rounded bg-white/50 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide dark:bg-gray-900/30 lg:inline">
                    {item}
                  </span>
                ))}
                {commandButtons.map(button => (
                  <button
                    key={button.event}
                    onClick={() => window.dispatchEvent(new CustomEvent(`ml:${button.event}`))}
                    className="inline-flex items-center gap-1 rounded border border-current/20 bg-white/50 px-2 py-1 text-[11px] font-semibold hover:bg-white/80 dark:bg-gray-900/30 dark:hover:bg-gray-900/50"
                    title={`${button.label} (${button.hint})`}
                    aria-label={`${button.label} command`}
                  >
                    {button.icon}
                    {button.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Main content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <RouteErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>
      <RouteSearchModal open={routeSearchOpen} onClose={() => setRouteSearchOpen(false)} />
    </div>
  );
};
