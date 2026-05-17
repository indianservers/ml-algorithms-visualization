import React from 'react';
import { Link } from 'react-router-dom';
import { Search, FileText } from 'lucide-react';
import { getAllSeoRoutes, routeToUrl } from '../data/seo';

export default function SitemapPage() {
  const routes = getAllSeoRoutes();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 border-b border-gray-200 pb-5 dark:border-gray-800">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
          <Search size={14} />
          Sitemap
        </div>
        <h1 className="text-3xl font-bold text-gray-950 dark:text-white">Search Engine Sitemap</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">
          Public index of canonical pages available to crawlers. The XML version is available at <a href="/sitemap.xml" className="font-semibold text-blue-600 hover:underline dark:text-blue-300">/sitemap.xml</a>.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{routes.length} canonical URLs</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Generated from the same route metadata used by the app head tags.</p>
        </div>
        <a href="/sitemap.xml" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">
          <FileText size={14} />
          XML Sitemap
        </a>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          <span>URL</span>
          <span>Priority</span>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-800">
          {routes.map(route => (
            <Link key={route.path} to={route.path} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-sm hover:bg-blue-50 dark:hover:bg-blue-950/20">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-gray-900 dark:text-white">{route.title}</span>
                <span className="mt-1 block truncate text-xs text-gray-500 dark:text-gray-400">{routeToUrl(route.path)}</span>
              </span>
              <span className="self-center rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {route.priority.toFixed(1)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
