import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ExternalLink, FileText, Search, ShieldCheck } from 'lucide-react';
import { Badge } from '../components/common/Badge';
import { getDocumentationGroups, getAllSeoRoutes, routeToUrl } from '../data/seo';

export default function DocumentationPage() {
  const groups = getDocumentationGroups();
  const routes = getAllSeoRoutes();
  const moduleCount = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 border-b border-gray-200 pb-5 dark:border-gray-800">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
          <BookOpen size={14} />
          Documentation
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-950 dark:text-white">Mega ML Algorithms Suite Documentation</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              A complete route index for every learning module, browser lab, implementation status, and search metadata entry.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-lg font-bold text-gray-950 dark:text-white">{groups.length}</p>
              <p className="text-gray-500">categories</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-lg font-bold text-gray-950 dark:text-white">{moduleCount}</p>
              <p className="text-gray-500">modules</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-lg font-bold text-gray-950 dark:text-white">{routes.length}</p>
              <p className="text-gray-500">indexed</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <Link to="/sitemap" className="flex min-h-20 items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-800 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-blue-950/30">
          <Search size={18} className="text-blue-600 dark:text-blue-300" />
          Search sitemap page
          <ExternalLink size={14} className="ml-auto text-gray-400" />
        </Link>
        <a href="/sitemap.xml" className="flex min-h-20 items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-800 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-blue-950/30">
          <FileText size={18} className="text-blue-600 dark:text-blue-300" />
          XML sitemap
          <ExternalLink size={14} className="ml-auto text-gray-400" />
        </a>
        <a href="/robots.txt" className="flex min-h-20 items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-800 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-blue-950/30">
          <ShieldCheck size={18} className="text-blue-600 dark:text-blue-300" />
          Robots directives
          <ExternalLink size={14} className="ml-auto text-gray-400" />
        </a>
      </div>

      <div className="space-y-5">
        {groups.map(group => (
          <section key={group.category} className="border-t border-gray-200 pt-5 dark:border-gray-800">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-gray-950 dark:text-white">{group.category}</h2>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {group.items.length} links
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map(item => (
                <Link key={item.route} to={item.route} className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50/70 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-blue-950/20">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{item.label}</h3>
                    <ExternalLink size={13} className="mt-0.5 shrink-0 text-gray-400" />
                  </div>
                  <p className="mb-3 text-xs leading-5 text-gray-500 dark:text-gray-400">{item.metadata.description}</p>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <Badge type={item.badge} />
                    {item.status !== 'Implemented' && <Badge type={item.status} />}
                  </div>
                  <code className="block truncate rounded bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {item.route}
                  </code>
                  <p className="mt-2 truncate text-[11px] text-gray-400">{routeToUrl(item.route)}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
