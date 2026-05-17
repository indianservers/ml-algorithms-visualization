import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function EmptyState({ title = 'No results yet', message = 'Run the tool or adjust the inputs to generate results.', action }: { title?: string; message?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-900/50">
      <Inbox size={22} className="mx-auto mb-2 text-gray-400" />
      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-gray-500 dark:text-gray-400">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function VisualizationSkeleton({ label = 'Loading visualization' }: { label?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900" aria-busy="true" aria-label={label}>
      <div className="mb-4 flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-gray-200 shimmer dark:bg-gray-700" />
        <div className="h-8 w-20 rounded bg-gray-200 shimmer dark:bg-gray-700" />
      </div>
      <div className="relative h-72 overflow-hidden rounded border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
        <div className="absolute inset-x-5 bottom-8 top-5 grid grid-cols-6 gap-4 opacity-70">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="border-l border-gray-200 dark:border-gray-800" />)}
        </div>
        <div className="absolute inset-y-5 left-8 right-5 grid grid-rows-5 gap-4 opacity-70">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="border-t border-gray-200 dark:border-gray-800" />)}
        </div>
        <div className="absolute bottom-10 left-10 h-28 w-[70%] rounded-t-full border-4 border-blue-300/70 border-b-0 shimmer dark:border-blue-500/40" />
      </div>
    </div>
  );
}
