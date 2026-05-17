import React, { useState, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { navigationData } from '../../data/navigation';
import { Badge } from './Badge';
import type { BadgeType } from '../../data/navigation';
import {
  getAllAlgorithms,
  getCategoryProgress,
  getFavoriteRoutes,
  getImplementationStatus,
  getRecentRoutes,
} from '../../data/implementationStatus';
import {
  TrendingUp, GitBranch, Network, Minimize2, Brain, BarChart2, Filter,
  Activity, MessageSquare, Eye, Star, Play, Lightbulb, Zap, Layers,
  FlaskConical, Upload, ChevronDown, ChevronRight, Search, X, Home,
  Sigma, BookOpen, Map,
} from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  TrendingUp: <TrendingUp size={15} />, GitBranch: <GitBranch size={15} />,
  Network: <Network size={15} />, Minimize2: <Minimize2 size={15} />,
  Brain: <Brain size={15} />, BarChart2: <BarChart2 size={15} />,
  Filter: <Filter size={15} />, Activity: <Activity size={15} />,
  MessageSquare: <MessageSquare size={15} />, Eye: <Eye size={15} />,
  Star: <Star size={15} />, Play: <Play size={15} />,
  Lightbulb: <Lightbulb size={15} />, Zap: <Zap size={15} />,
  Layers: <Layers size={15} />, Sigma: <Sigma size={15} />,
  Upload: <Upload size={15} />, FlaskConical: <FlaskConical size={15} />,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  drawer?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, onNavigate, drawer = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [badgeFilter, setBadgeFilter] = useState('All');
  const [favoriteRoutes, setFavoriteRoutes] = useState<string[]>(() => getFavoriteRoutes());
  const [recentRoutes, setRecentRoutes] = useState<string[]>(() => getRecentRoutes());
  const [recentOpen, setRecentOpen] = useState(() => localStorage.getItem('ml-suite-recent-open') !== 'false');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('ml-suite-expanded-categories');
    if (saved) return new Set(JSON.parse(saved) as string[]);
    const initial = new Set<string>();
    navigationData.forEach(cat => {
      if (cat.items.some(item => location.pathname.startsWith(item.route))) {
        initial.add(cat.category);
      }
    });
    return initial;
  });

  const allAlgorithms = useMemo(() => getAllAlgorithms(), []);
  const favoriteItems = favoriteRoutes
    .map(route => allAlgorithms.find(item => item.route === route))
    .filter(Boolean)
    .slice(0, 5);
  const recentItems = recentRoutes
    .map(route => allAlgorithms.find(item => item.route === route))
    .filter(Boolean)
    .slice(0, 5);
  const filtersActive = search.trim() || statusFilter !== 'All' || badgeFilter !== 'All';

  React.useEffect(() => {
    const refresh = () => {
      setFavoriteRoutes(getFavoriteRoutes());
      setRecentRoutes(getRecentRoutes());
    };
    window.addEventListener('ml:favorites-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('ml:favorites-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  React.useEffect(() => {
    const id = window.setTimeout(() => setRecentRoutes(getRecentRoutes()), 0);
    return () => window.clearTimeout(id);
  }, [location.pathname]);

  React.useEffect(() => {
    localStorage.setItem('ml-suite-expanded-categories', JSON.stringify([...expandedCategories]));
  }, [expandedCategories]);

  React.useEffect(() => {
    localStorage.setItem('ml-suite-recent-open', String(recentOpen));
  }, [recentOpen]);

  const filteredNav = useMemo(() => {
    const statusMatch = (route: string) => statusFilter === 'All' || getImplementationStatus(route) === statusFilter;
    const badgeMatch = (badge: string) => badgeFilter === 'All' || badge === badgeFilter;
    const q = search.toLowerCase();
    return navigationData
      .map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
          statusMatch(item.route) &&
          badgeMatch(item.badge) &&
          (!search.trim() || item.label.toLowerCase().includes(q) || item.badge.toLowerCase().includes(q) || getImplementationStatus(item.route).toLowerCase().includes(q))
        ),
      }))
      .filter(cat => cat.items.length > 0);
  }, [search, statusFilter, badgeFilter]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className="h-full min-h-0 w-14 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center overflow-y-auto py-4 gap-4 shrink-0">
        <button onClick={onToggle} className="min-h-10 min-w-10 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500" aria-label="Expand navigation">
          <ChevronRight size={18} />
        </button>
        <NavLink to="/" onClick={onNavigate} className="grid min-h-10 min-w-10 place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><Home size={18} /></NavLink>
        <NavLink to="/documentation" onClick={onNavigate} className="grid min-h-10 min-w-10 place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500" title="Documentation"><BookOpen size={18} /></NavLink>
        <NavLink to="/sitemap" onClick={onNavigate} className="grid min-h-10 min-w-10 place-items-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500" title="Sitemap"><Map size={18} /></NavLink>
        {navigationData.map(cat => (
          <button
            key={cat.category}
            onClick={() => {
              onToggle();
              setExpandedCategories(prev => new Set(prev).add(cat.category));
              navigate(cat.items[0]?.route ?? '/');
            }}
            className="grid min-h-10 min-w-10 place-items-center rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title={`${cat.category} (${getCategoryProgress(cat.category).implemented}/${getCategoryProgress(cat.category).total})`}
          >
            {iconMap[cat.icon] ?? <Layers size={15} />}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`${drawer ? 'w-[min(292px,calc(100vw-32px))]' : 'w-72'} h-full min-h-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <NavLink to="/" onClick={onNavigate} className="flex min-w-0 items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Brain size={15} className="text-white" />
          </div>
          <span className="font-bold text-sm text-gray-900 dark:text-white leading-tight">Mega ML<br /><span className="text-xs font-normal text-gray-500">Algorithms Suite</span></span>
        </NavLink>
        <button onClick={onToggle} className="grid min-h-10 min-w-10 place-items-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400" aria-label={drawer ? 'Close menu' : 'Collapse navigation'}>
          {drawer ? <X size={18} /> : <ChevronDown size={16} className="rotate-90" />}
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search algorithms..."
            className="min-h-10 w-full pl-8 pr-7 py-2 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-1 top-1/2 grid min-h-8 min-w-8 -translate-y-1/2 place-items-center text-gray-400 hover:text-gray-600" aria-label="Clear search">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="min-h-10 rounded-md border border-gray-200 bg-gray-50 px-2 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <option>All</option>
            <option>Educational</option>
            <option>Concept</option>
            <option>Scaffold</option>
          </select>
          <select value={badgeFilter} onChange={event => setBadgeFilter(event.target.value)} className="min-h-10 rounded-md border border-gray-200 bg-gray-50 px-2 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <option>All</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
            <option>Browser Trainable</option>
            <option>Browser Inference</option>
          </select>
        </div>
        {filtersActive && (
          <button
            onClick={() => {
              setSearch('');
              setStatusFilter('All');
              setBadgeFilter('All');
            }}
            className="mt-2 min-h-10 w-full rounded-md border border-gray-200 px-2 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin py-2">
        <NavLink
          to="/"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex min-h-10 items-center gap-2 mx-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`
          }
          end
        >
          <Home size={13} /> Home
        </NavLink>
        <NavLink
          to="/documentation"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex min-h-10 items-center gap-2 mx-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`
          }
        >
          <BookOpen size={13} /> Documentation
        </NavLink>
        <NavLink
          to="/sitemap"
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex min-h-10 items-center gap-2 mx-2 px-3 py-2 rounded-md text-xs font-medium transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`
          }
        >
          <Map size={13} /> Sitemap
        </NavLink>

        {!filtersActive && favoriteItems.length > 0 && (
          <div className="mx-2 mt-2 rounded-lg border border-yellow-200 bg-yellow-50/70 p-2 dark:border-yellow-900/60 dark:bg-yellow-950/20">
            <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-yellow-700 dark:text-yellow-300">Pinned</p>
            {favoriteItems.map(item => item && (
              <NavLink key={item.route} to={item.route} onClick={onNavigate} className="flex min-h-10 items-center justify-between rounded px-2 py-2 text-xs text-yellow-900 hover:bg-yellow-100 dark:text-yellow-100 dark:hover:bg-yellow-900/30">
                <span className="truncate">{item.label}</span>
                <Star size={11} className="fill-current" />
              </NavLink>
            ))}
          </div>
        )}

        {!filtersActive && recentItems.length > 0 && (
          <div className="mx-2 mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/60">
            <button
              onClick={() => setRecentOpen(open => !open)}
              className="mb-1 flex min-h-10 w-full items-center justify-between rounded px-1 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-500 hover:bg-white dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <span>Recent</span>
              {recentOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {recentOpen && recentItems.map(item => item && (
              <NavLink key={item.route} to={item.route} onClick={onNavigate} className="block min-h-10 rounded px-2 py-2 text-xs text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-700">
                <span className="block leading-snug">{item.label}</span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {getImplementationStatus(item.route) !== 'Implemented' && <Badge type={getImplementationStatus(item.route)} size="sm" />}
                  <Badge type={item.badge as BadgeType} size="sm" />
                </span>
              </NavLink>
            ))}
          </div>
        )}

        {filteredNav.length === 0 && (
          <div className="mx-3 mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-center text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            No algorithms match these filters.
          </div>
        )}

        {filteredNav.map(cat => {
          const isExpanded = expandedCategories.has(cat.category) || search.length > 0;
          const hasActive = cat.items.some(item => location.pathname === item.route);
          const progress = getCategoryProgress(cat.category);
          return (
            <div key={cat.category} className="mt-1">
              <button
                onClick={() => toggleCategory(cat.category)}
                className={`w-full flex min-h-10 items-center gap-2 mx-2 px-3 py-2 rounded-md text-xs font-semibold transition-colors ${hasActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'} hover:bg-gray-50 dark:hover:bg-gray-800`}
                style={{ width: 'calc(100% - 16px)' }}
              >
                <span className="shrink-0">{iconMap[cat.icon] ?? <Layers size={13} />}</span>
                <span className="flex-1 text-left truncate">{cat.category}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {progress.implemented}/{progress.total}
                </span>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {isExpanded && (
                <div className="ml-4">
                  {cat.items.map(item => {
                    const status = getImplementationStatus(item.route);
                    return (
                    <NavLink
                      key={item.route}
                      to={item.route}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `block min-h-10 mx-2 px-3 py-2 rounded-md text-xs transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' : status === 'Scaffold' ? 'text-red-700 bg-red-50/70 hover:bg-red-100 dark:text-red-300 dark:bg-red-900/10 dark:hover:bg-red-900/20' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`
                      }
                    >
                      <span className="block whitespace-normal break-words leading-snug">{item.label}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1">
                        {status !== 'Implemented' && <Badge type={status} size="sm" />}
                        <Badge type={item.badge as BadgeType} size="sm" />
                      </span>
                    </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 text-center">100% Browser-Based ML</p>
      </div>
    </div>
  );
};
