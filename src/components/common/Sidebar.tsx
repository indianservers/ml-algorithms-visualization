import React, { useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { navigationData } from '../../data/navigation';
import { Badge } from './Badge';
import type { BadgeType } from '../../data/navigation';
import { getImplementationStatus } from '../../data/implementationStatus';
import {
  TrendingUp, GitBranch, Network, Minimize2, Brain, BarChart2, Filter,
  Activity, MessageSquare, Eye, Star, Play, Lightbulb, Zap, Layers,
  FlaskConical, Upload, ChevronDown, ChevronRight, Search, X, Home,
  Sigma,
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
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [badgeFilter, setBadgeFilter] = useState('All');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    navigationData.forEach(cat => {
      if (cat.items.some(item => location.pathname.startsWith(item.route))) {
        initial.add(cat.category);
      }
    });
    return initial;
  });

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
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className="w-14 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 gap-4 shrink-0">
        <button onClick={onToggle} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
          <ChevronRight size={18} />
        </button>
        <NavLink to="/" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><Home size={18} /></NavLink>
        {navigationData.map(cat => (
          <div key={cat.category} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1" title={cat.category}>
            {iconMap[cat.icon] ?? <Layers size={15} />}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <NavLink to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Brain size={15} className="text-white" />
          </div>
          <span className="font-bold text-sm text-gray-900 dark:text-white leading-tight">Mega ML<br /><span className="text-xs font-normal text-gray-500">Algorithms Suite</span></span>
        </NavLink>
        <button onClick={onToggle} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
          <ChevronDown size={16} className="rotate-90" />
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
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <option>All</option>
            <option>Implemented</option>
            <option>Educational</option>
            <option>Concept</option>
            <option>Scaffold</option>
          </select>
          <select value={badgeFilter} onChange={event => setBadgeFilter(event.target.value)} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <option>All</option>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
            <option>Concept</option>
            <option>Browser Trainable</option>
            <option>Browser Inference</option>
          </select>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center gap-2 mx-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`
          }
          end
        >
          <Home size={13} /> Home
        </NavLink>

        {filteredNav.map(cat => {
          const isExpanded = expandedCategories.has(cat.category) || search.length > 0;
          const hasActive = cat.items.some(item => location.pathname === item.route);
          return (
            <div key={cat.category} className="mt-1">
              <button
                onClick={() => toggleCategory(cat.category)}
                className={`w-full flex items-center gap-2 mx-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${hasActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'} hover:bg-gray-50 dark:hover:bg-gray-800`}
                style={{ width: 'calc(100% - 16px)' }}
              >
                <span className="shrink-0">{iconMap[cat.icon] ?? <Layers size={13} />}</span>
                <span className="flex-1 text-left truncate">{cat.category}</span>
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
                      className={({ isActive }) =>
                        `flex items-center justify-between mx-2 px-3 py-1.5 rounded-md text-xs transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium' : status === 'Scaffold' ? 'text-red-700 bg-red-50/70 hover:bg-red-100 dark:text-red-300 dark:bg-red-900/10 dark:hover:bg-red-900/20' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`
                      }
                    >
                      <span className="truncate">{item.label}</span>
                      <span className="flex items-center gap-1">
                        <Badge type={status} size="sm" />
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
