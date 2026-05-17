import React, { Suspense } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from '../components/common/Sidebar';
import { useTheme, useSidebarState, useTrainingMode, useTrainingSpeed, usePracticeMode, useTeacherMode } from '../stores/uiStore';
import { Sun, Moon, Menu, Search, Play, RotateCcw, StepForward, Save, Download, AlertTriangle, CheckCircle2, Info, ChevronLeft, ChevronRight, Star, Database, Upload, HelpCircle, X, Pencil, Flame, EyeOff, Type, Printer } from 'lucide-react';
import {
  getAdjacentAlgorithms,
  getAlgorithmVisitStats,
  getAllAlgorithms,
  getAlgorithmByRoute,
  getImplementationStatus,
  isFavoriteRoute,
  rememberRoute,
  toggleFavoriteRoute,
} from '../data/implementationStatus';
import type { AlgorithmNavItem } from '../data/implementationStatus';
import { Badge } from '../components/common/Badge';
import { RouteSearchModal } from '../components/common/RouteSearchModal';
import { AlgorithmFAQ } from '../components/learning/AlgorithmFAQ';
import { getSeoMetadata, routeToUrl, siteConfig } from '../data/seo';
import { getLearnerNote, saveLearnerNote } from '../stores/learningStore';
import { VisualizationSkeleton } from '../components/common/EmptyState';

const PageFallback = () => (
  <div className="mx-auto max-w-7xl space-y-4 p-4" aria-label="Loading algorithm page">
    <div className="h-24 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="h-48 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="space-y-3">
        <VisualizationSkeleton />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="h-20 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
          <div className="h-20 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
    </div>
  </div>
);

const GlobalFooter = () => (
  <footer className="border-t border-gray-200 bg-white px-4 py-5 text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 sm:px-6">
    <div className="mx-auto flex max-w-7xl flex-col gap-2 text-center text-xs sm:flex-row sm:items-center sm:justify-between sm:text-left">
      <div>
        <a href="https://www.AimerSociety.com" className="font-bold text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-300">
          www.AimerSociety.com
        </a>
        <p className="mt-1 font-semibold">AI Learning Tools</p>
      </div>
      <div className="sm:text-right">
        <p>Artificial Intelligence Medical & Engineering Researchers Society Tools</p>
        <p className="mt-1 text-gray-500 dark:text-gray-400">All rights reserved.</p>
      </div>
    </div>
  </footer>
);

const shortcutRows = [
  { keys: '?', action: 'Show keyboard shortcuts' },
  { keys: 'Ctrl K', action: 'Search algorithms and routes' },
  { keys: 'T', action: 'Train the current algorithm' },
  { keys: 'R', action: 'Reset the current page' },
  { keys: 'S', action: 'Step through the current algorithm' },
  { keys: 'Ctrl S', action: 'Save the current page form or experiment' },
  { keys: 'E', action: 'Export the current result' },
  { keys: 'Esc', action: 'Close menus and dialogs' },
];

const KeyboardShortcutsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/45 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="mx-auto mt-16 max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <HelpCircle size={17} className="text-blue-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} aria-label="Close keyboard shortcuts" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200">
            <X size={16} />
          </button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {shortcutRows.map(row => (
            <div key={row.keys} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{row.action}</span>
              <kbd className="shrink-0 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-bold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {row.keys}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const NotesPanel: React.FC<{ open: boolean; route?: string; title?: string; onClose: () => void }> = ({ open, route, title, onClose }) => {
  return (
    <div className={`fixed inset-y-0 right-0 z-50 w-[min(380px,100vw)] transform border-l border-gray-200 bg-white shadow-2xl transition-transform duration-300 dark:border-gray-700 dark:bg-gray-900 ${open ? 'translate-x-0' : 'translate-x-full'}`} role="dialog" aria-modal="true" aria-label="Algorithm notes">
      <NotesPanelBody key={route ?? 'no-route'} route={route} title={title} onClose={onClose} />
    </div>
  );
};

const NotesPanelBody: React.FC<{ route?: string; title?: string; onClose: () => void }> = ({ route, title, onClose }) => {
  const [note, setNote] = React.useState(() => route ? getLearnerNote(route) : '');
  const [saved, setSaved] = React.useState(false);

  const save = () => {
    if (!route) return;
    saveLearnerNote(route, note);
    setSaved(true);
  };

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Learning Notes</h2>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">{title ?? 'Open an algorithm to save notes.'}</p>
        </div>
        <button onClick={onClose} aria-label="Close notes" className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200">
          <X size={16} />
        </button>
      </div>
      <div className="flex h-[calc(100%-57px)] flex-col gap-3 p-4">
        <textarea
          value={note}
          onChange={event => {
            setNote(event.target.value);
            setSaved(false);
          }}
          disabled={!route}
          className="min-h-0 flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm leading-6 text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:ring-blue-950"
          placeholder="Write what changed, what you noticed, and what you want to try next..."
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">{saved ? 'Saved locally.' : 'Stored per algorithm in this browser.'}</span>
          <button onClick={save} disabled={!route} className="inline-flex min-h-10 items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            <Pencil size={13} /> Save Note
          </button>
        </div>
      </div>
    </>
  );
};

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

type BreadcrumbItem = {
  label: string;
  route?: string;
};

const AlgorithmBreadcrumbs: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => (
  <nav
    aria-label="Breadcrumb"
    className="shrink-0 border-b border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 sm:px-4"
  >
    <ol className="flex min-w-0 items-center gap-1.5 overflow-x-auto scrollbar-thin">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <li key={`${item.label}-${index}`} className="flex min-w-0 shrink-0 items-center gap-1.5">
            {item.route && !last ? (
              <Link to={item.route} className="font-semibold text-gray-600 hover:text-blue-600 hover:underline dark:text-gray-300 dark:hover:text-blue-300">
                {item.label}
              </Link>
            ) : (
              <span className={last ? 'max-w-[52vw] truncate font-bold text-gray-900 dark:text-white sm:max-w-none' : 'font-semibold text-gray-600 dark:text-gray-300'} aria-current={last ? 'page' : undefined}>
                {item.label}
              </span>
            )}
            {!last && <ChevronRight size={12} className="text-gray-400" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  </nav>
);

const routeFamily = (route: string) => route.split('/').slice(0, 3).join('/');

function getRelatedAlgorithms(currentItem: AlgorithmNavItem) {
  const allAlgorithms = getAllAlgorithms();
  const adjacent = getAdjacentAlgorithms(currentItem.route);
  const candidates = allAlgorithms
    .filter(item => item.route !== currentItem.route)
    .map(item => {
      const reasons = [
        item.category === currentItem.category ? 'Same category' : '',
        item.badge === currentItem.badge ? 'Same level' : '',
        routeFamily(item.route) === routeFamily(currentItem.route) ? 'Related topic' : '',
        item.route === adjacent.previous?.route || item.route === adjacent.next?.route ? 'Nearby lesson' : '',
      ].filter(Boolean);
      const score =
        (item.category === currentItem.category ? 4 : 0) +
        (item.badge === currentItem.badge ? 2 : 0) +
        (routeFamily(item.route) === routeFamily(currentItem.route) ? 2 : 0) +
        (item.route === adjacent.previous?.route || item.route === adjacent.next?.route ? 1 : 0);
      return { item, reasons, score };
    })
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.item.categoryIndex - b.item.categoryIndex || a.item.itemIndex - b.item.itemIndex);

  return candidates.slice(0, 6);
}

const RelatedAlgorithms: React.FC<{ currentItem: AlgorithmNavItem }> = ({ currentItem }) => {
  const related = React.useMemo(() => getRelatedAlgorithms(currentItem), [currentItem]);
  if (related.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6" aria-labelledby="related-algorithms-heading">
      <div className="border-t border-gray-200 pt-5 dark:border-gray-800">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="related-algorithms-heading" className="text-lg font-bold text-gray-950 dark:text-white">Related Algorithms</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Continue with similar modules by category, level, or nearby lesson order.</p>
          </div>
          <Link to="/documentation" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-950/30 dark:hover:text-blue-200">
            All modules
            <ChevronRight size={13} />
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {related.map(({ item, reasons }) => {
            const status = getImplementationStatus(item.route);
            return (
              <Link
                key={item.route}
                to={item.route}
                className="group rounded-lg border border-gray-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50/70 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-blue-950/20"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{item.label}</h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.category}</p>
                  </div>
                  <ChevronRight size={15} className="mt-0.5 shrink-0 text-gray-400 group-hover:text-blue-500" />
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <Badge type={item.badge} />
                  {status !== 'Implemented' && <Badge type={status} />}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {reasons.slice(0, 2).map(reason => (
                    <span key={reason} className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {reason}
                    </span>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const MiniTableOfContents: React.FC<{ items: { id: string; label: string }[] }> = ({ items }) => {
  if (items.length < 4) return null;
  return (
    <nav className="mx-auto max-w-7xl px-4 pb-4 sm:px-6" aria-label="On this page">
      <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">On this page</p>
        <div className="flex flex-wrap gap-2">
          {items.slice(0, 8).map(item => (
            <a key={item.id} href={`#${item.id}`} className="rounded-full border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-950/30 dark:hover:text-blue-200">
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
};

export const RootLayout: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { collapsed, toggle } = useSidebarState();
  const { trainingMode, setTrainingMode } = useTrainingMode();
  const { trainingSpeed, setTrainingSpeed } = useTrainingSpeed();
  const { practiceMode, togglePracticeMode } = usePracticeMode();
  const { teacherMode, toggleTeacherMode } = useTeacherMode();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [routeSearchOpen, setRouteSearchOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [notesOpen, setNotesOpen] = React.useState(false);
  const [visitStats, setVisitStats] = React.useState(() => getAlgorithmVisitStats());
  const [favoriteTick, setFavoriteTick] = React.useState(0);
  const [tocItems, setTocItems] = React.useState<{ id: string; label: string }[]>([]);
  const seo = React.useMemo(() => getSeoMetadata(location.pathname), [location.pathname]);
  const currentItem = getAlgorithmByRoute(location.pathname);
  const categoryRoute = currentItem ? getAllAlgorithms().find(item => item.category === currentItem.category)?.route : undefined;
  const breadcrumbItems = currentItem
    ? [
      { label: 'Home', route: '/' },
      { label: currentItem.category, route: categoryRoute },
      { label: currentItem.label },
    ]
    : [];

  React.useEffect(() => {
    const setMeta = (selector: string, attributes: Record<string, string>) => {
      let element = document.head.querySelector<HTMLMetaElement>(selector);
      if (!element) {
        element = document.createElement('meta');
        document.head.appendChild(element);
      }
      Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
    };

    const setLink = (rel: string, href: string) => {
      let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
      }
      element.setAttribute('href', href);
    };

    const canonicalUrl = routeToUrl(seo.path);
    const ogImageUrl = `${siteConfig.domain}${siteConfig.ogImage}`;
    document.title = seo.title;
    setMeta('meta[name="description"]', { name: 'description', content: seo.description });
    setMeta('meta[name="keywords"]', { name: 'keywords', content: seo.keywords.join(', ') });
    setMeta('meta[name="robots"]', { name: 'robots', content: 'index, follow' });
    setMeta('meta[name="application-name"]', { name: 'application-name', content: siteConfig.name });
    setMeta('meta[property="og:title"]', { property: 'og:title', content: seo.title });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: seo.description });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    setMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: siteConfig.name });
    setMeta('meta[property="og:image"]', { property: 'og:image', content: ogImageUrl });
    setMeta('meta[property="og:image:secure_url"]', { property: 'og:image:secure_url', content: ogImageUrl });
    setMeta('meta[property="og:image:type"]', { property: 'og:image:type', content: 'image/png' });
    setMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '1200' });
    setMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '630' });
    setMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: `${siteConfig.name} preview card` });
    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: seo.description });
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: ogImageUrl });
    setMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt', content: `${siteConfig.name} preview card` });
    setLink('canonical', canonicalUrl);

    const existingBreadcrumbScript = document.getElementById('breadcrumb-jsonld');
    if (currentItem) {
      const breadcrumbScript = existingBreadcrumbScript ?? document.createElement('script');
      breadcrumbScript.id = 'breadcrumb-jsonld';
      breadcrumbScript.setAttribute('type', 'application/ld+json');
      breadcrumbScript.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: routeToUrl('/') },
          { '@type': 'ListItem', position: 2, name: currentItem.category, item: routeToUrl(categoryRoute ?? currentItem.route) },
          { '@type': 'ListItem', position: 3, name: currentItem.label, item: routeToUrl(currentItem.route) },
        ],
      });
      if (!existingBreadcrumbScript) document.head.appendChild(breadcrumbScript);
    } else {
      existingBreadcrumbScript?.remove();
    }
  }, [seo, currentItem, categoryRoute]);

  React.useEffect(() => {
    if (location.pathname.startsWith('/ml/')) rememberRoute(location.pathname);
  }, [location.pathname]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const headings = Array.from(document.querySelectorAll('main h2, main h3')) as HTMLElement[];
      const items = headings
        .map((heading, index) => {
          const label = heading.textContent?.trim();
          if (!label) return null;
          if (!heading.id) heading.id = `section-${index + 1}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
          return { id: heading.id, label };
        })
        .filter(Boolean) as { id: string; label: string }[];
      setTocItems(items);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  React.useEffect(() => {
    const refresh = () => setVisitStats(getAlgorithmVisitStats());
    refresh();
    window.addEventListener('ml:algorithm-visited', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('ml:algorithm-visited', refresh);
      window.removeEventListener('storage', refresh);
    };
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
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false);
        setRouteSearchOpen(false);
        setShortcutsOpen(false);
        setNotesOpen(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        emitCommand('save');
        return;
      }
      if (editing) return;
      if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (event.key.toLowerCase() === 't') emitCommand('train');
      if (event.key.toLowerCase() === 'r') emitCommand('reset');
      if (event.key.toLowerCase() === 's') emitCommand('step');
      if (event.key.toLowerCase() === 'e') emitCommand('export');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const adjacent = getAdjacentAlgorithms(location.pathname);
  const isFavorite = currentItem ? isFavoriteRoute(currentItem.route) : false;
  const algorithmStatus = currentItem ? getImplementationStatus(currentItem.route) : undefined;
  const statusTone = algorithmStatus === 'Implemented'
    ? 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
    : algorithmStatus === 'Scaffold'
      ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100'
      : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
  const implementedCommandButtons = [
    { label: 'Train', hint: 'T', event: 'train', icon: <Play size={14} /> },
    { label: 'Reset', hint: 'R', event: 'reset', icon: <RotateCcw size={14} /> },
    { label: 'Step', hint: 'S', event: 'step', icon: <StepForward size={14} /> },
    { label: 'Save', hint: 'Ctrl+S on page forms', event: 'save', icon: <Save size={14} /> },
    { label: 'Export', hint: 'E', event: 'export', icon: <Download size={14} /> },
  ];
  const conceptCommandButtons = [
    { label: 'Reset', hint: 'R', event: 'reset', icon: <RotateCcw size={14} /> },
    { label: 'Export', hint: 'E', event: 'export', icon: <Download size={14} /> },
  ];
  const commandButtons = algorithmStatus === 'Implemented' ? implementedCommandButtons : conceptCommandButtons;

  return (
    <div className={`flex h-screen w-full overflow-hidden bg-gray-50 dark:bg-gray-950 ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="hidden h-full min-h-0 md:block">
        <Sidebar collapsed={collapsed} onToggle={toggle} />
      </div>
      {!mobileSidebarOpen && (
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="fixed left-3 top-3 z-30 inline-flex min-h-10 items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3 text-xs font-bold text-gray-700 shadow-lg backdrop-blur hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-100 dark:hover:bg-gray-800 md:hidden"
          aria-label="Open menu"
        >
          <Menu size={16} />
          Menu
        </button>
      )}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button aria-label="Close menu backdrop" className="absolute inset-0 bg-gray-950/55 backdrop-blur-[1px]" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative h-full w-fit max-w-[calc(100vw-32px)] shadow-2xl">
            <Sidebar collapsed={false} drawer onToggle={() => setMobileSidebarOpen(false)} onNavigate={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="min-h-12 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-end px-3 pl-24 sm:justify-between sm:px-4 sm:pl-4 shrink-0">
          <div className="hidden items-center gap-2 sm:flex">
            <button
              onClick={() => setRouteSearchOpen(true)}
              className="hidden min-h-10 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 sm:flex"
              title="Search routes (Ctrl+K)"
            >
              <Search size={13} />
              Search
              <kbd className="rounded border border-gray-200 px-1 text-[10px] dark:border-gray-600">Ctrl K</kbd>
            </button>
            <Link
              to="/ml/lab/dataset-manager"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:border-blue-300 hover:bg-blue-100 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-900/40"
              title="Open Dataset Manager to upload, edit, save, or load datasets"
            >
              <Database size={14} />
              Dataset Manager
              <Upload size={13} />
            </Link>
            {location.pathname.startsWith('/ml/') && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('ml:train'))}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                title="Train the current page model"
              >
                <Play size={14} />
                Train
              </button>
            )}
            <div className="inline-flex min-h-10 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs font-bold dark:border-gray-700 dark:bg-gray-800" title="Choose whether pages train after data changes or wait for Train">
              <button
                onClick={() => setTrainingMode('manual')}
                className={`rounded px-2.5 py-1.5 ${trainingMode === 'manual' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-950 dark:text-white' : 'text-gray-500 dark:text-gray-300'}`}
              >
                Manual
              </button>
              <button
                onClick={() => setTrainingMode('auto')}
                className={`rounded px-2.5 py-1.5 ${trainingMode === 'auto' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-950 dark:text-white' : 'text-gray-500 dark:text-gray-300'}`}
              >
                Auto
              </button>
            </div>
            <div className="inline-flex min-h-10 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs font-bold dark:border-gray-700 dark:bg-gray-800" title="Choose training animation speed">
              {(['slow', 'normal', 'fast'] as const).map(speed => (
                <button
                  key={speed}
                  onClick={() => setTrainingSpeed(speed)}
                  className={`rounded px-2.5 py-1.5 capitalize ${trainingSpeed === speed ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-950 dark:text-white' : 'text-gray-500 dark:text-gray-300'}`}
                >
                  {speed}
                </button>
              ))}
            </div>
            <div className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 text-xs font-bold text-orange-700 dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-200" title={`Visited ${visitStats.visitedCount} algorithms`}>
              <Flame size={14} />
              {visitStats.streakDays}d
            </div>
            <button
              onClick={togglePracticeMode}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${practiceMode ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/30 dark:text-purple-200' : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}
              title="Practice mode hides explanations"
            >
              <EyeOff size={14} />
              Practice
            </button>
            <button
              onClick={toggleTeacherMode}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${teacherMode ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}
              title="Teacher mode increases interface text size"
            >
              <Type size={14} />
              Teacher
            </button>
            <button
              onClick={() => window.print()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              title="Print worksheet for this page"
            >
              <Printer size={14} />
              Print
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              to="/ml/lab/dataset-manager"
              className="grid min-h-10 min-w-10 place-items-center rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40 sm:hidden"
              title="Dataset Manager"
              aria-label="Open Dataset Manager"
            >
              <Database size={16} />
            </Link>
            {location.pathname.startsWith('/ml/') && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('ml:train'))}
                className="grid min-h-10 min-w-10 place-items-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 sm:hidden"
                title="Train"
                aria-label="Train current model"
              >
                <Play size={16} />
              </button>
            )}
            <button
              onClick={() => setRouteSearchOpen(true)}
              className="grid min-h-10 min-w-10 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 sm:hidden"
              title="Search routes"
              aria-label="Search routes"
            >
              <Search size={16} />
            </button>
            <button
              onClick={() => setNotesOpen(true)}
              className="grid min-h-10 min-w-10 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              title="Learning notes"
              aria-label="Open learning notes"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => setShortcutsOpen(true)}
              className="grid min-h-10 min-w-10 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              title="Keyboard shortcuts (?)"
              aria-label="Show keyboard shortcuts"
            >
              <HelpCircle size={16} />
            </button>
            <button
              onClick={togglePracticeMode}
              className={`grid min-h-10 min-w-10 place-items-center rounded-lg ${practiceMode ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-200' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
              title="Practice mode"
              aria-label="Toggle practice mode"
            >
              <EyeOff size={16} />
            </button>
            <button
              onClick={toggleTeacherMode}
              className={`grid min-h-10 min-w-10 place-items-center rounded-lg ${teacherMode ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
              title="Teacher mode"
              aria-label="Toggle teacher mode"
            >
              <Type size={16} />
            </button>
            <button
              onClick={toggleTheme}
              className="grid min-h-10 min-w-10 place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
        {breadcrumbItems.length > 0 && <AlgorithmBreadcrumbs items={breadcrumbItems} />}
        {currentItem && algorithmStatus && (
          <div className={`sticky top-0 z-10 shrink-0 border-b px-3 py-2 sm:px-4 ${statusTone}`} key={favoriteTick}>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {algorithmStatus === 'Implemented' ? <CheckCircle2 size={15} /> : algorithmStatus === 'Scaffold' ? <AlertTriangle size={15} /> : <Info size={15} />}
              <Link to="/implementation-matrix" className="text-xs font-bold uppercase tracking-wide hover:underline">
                {algorithmStatus === 'Implemented' ? 'Algorithm Tools' : 'Implementation Status'}
              </Link>
              {algorithmStatus !== 'Implemented' && <Badge type={algorithmStatus} />}
              <span className="text-xs font-semibold">{currentItem.category}</span>
              <span className="hidden text-xs text-gray-500 dark:text-gray-400 sm:inline">/</span>
              <span className="text-xs font-semibold">{currentItem.label}</span>
              <span className="ml-auto hidden text-xs md:inline">
                {algorithmStatus === 'Implemented'
                  ? 'Real computation, controls, chart, metrics, and export/save path.'
                  : 'This route is clearly labeled until real computation and checklist coverage are complete.'}
              </span>
              <button
                onClick={() => {
                  toggleFavoriteRoute(currentItem.route);
                  setFavoriteTick(tick => tick + 1);
                }}
                className="inline-flex min-h-10 items-center gap-1 rounded border border-current/20 bg-white/50 px-2 py-2 text-[11px] font-semibold hover:bg-white/80 dark:bg-gray-900/30 dark:hover:bg-gray-900/50"
                title={isFavorite ? 'Remove from pinned algorithms' : 'Pin this algorithm'}
                aria-label={isFavorite ? 'Remove pinned algorithm' : 'Pin algorithm'}
              >
                <Star size={13} className={isFavorite ? 'fill-current' : ''} />
                <span className="hidden sm:inline">{isFavorite ? 'Pinned' : 'Pin'}</span>
              </button>
              {adjacent.previous && (
                <Link
                  to={adjacent.previous.route}
                  className="inline-flex min-h-10 items-center gap-1 rounded border border-current/20 bg-white/50 px-2 py-2 text-[11px] font-semibold hover:bg-white/80 dark:bg-gray-900/30 dark:hover:bg-gray-900/50"
                  title={`Previous: ${adjacent.previous.label}`}
                >
                  <ChevronLeft size={13} />
                  <span className="hidden sm:inline">Previous</span>
                </Link>
              )}
              {adjacent.next && (
                <Link
                  to={adjacent.next.route}
                  className="inline-flex min-h-10 items-center gap-1 rounded border border-current/20 bg-white/50 px-2 py-2 text-[11px] font-semibold hover:bg-white/80 dark:bg-gray-900/30 dark:hover:bg-gray-900/50"
                  title={`Next: ${adjacent.next.label}`}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight size={13} />
                </Link>
              )}
              <div className="flex w-full gap-1 overflow-x-auto pt-1 scrollbar-thin sm:w-auto sm:flex-wrap sm:overflow-visible sm:pt-0">
                {commandButtons.map(button => (
                  <button
                    key={button.event}
                    onClick={() => window.dispatchEvent(new CustomEvent(`ml:${button.event}`))}
                    className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded border border-current/20 bg-white/50 px-2 py-2 text-[11px] font-semibold hover:bg-white/80 dark:bg-gray-900/30 dark:hover:bg-gray-900/50"
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
        <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              className="min-h-full"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <RouteErrorBoundary key={location.pathname}>
                <Suspense fallback={<PageFallback />}>
                  <Outlet />
                  <MiniTableOfContents items={tocItems} />
                  {currentItem && <AlgorithmFAQ algorithm={currentItem} />}
                  {currentItem && <RelatedAlgorithms currentItem={currentItem} />}
                  <GlobalFooter />
                </Suspense>
              </RouteErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <RouteSearchModal open={routeSearchOpen} onClose={() => setRouteSearchOpen(false)} />
      <KeyboardShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <NotesPanel open={notesOpen} route={currentItem?.route} title={currentItem?.label} onClose={() => setNotesOpen(false)} />
    </div>
  );
};
