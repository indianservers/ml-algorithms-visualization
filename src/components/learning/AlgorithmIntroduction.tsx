import React from 'react';
import { BookOpen, Eye, Target } from 'lucide-react';
import type { AlgorithmNavItem } from '../../data/implementationStatus';
import { getAlgorithmIntroduction } from '../../data/algorithmIntroductions';

interface AlgorithmIntroductionProps {
  algorithm: AlgorithmNavItem;
}

export const AlgorithmIntroduction: React.FC<AlgorithmIntroductionProps> = ({ algorithm }) => {
  const intro = React.useMemo(() => getAlgorithmIntroduction(algorithm), [algorithm]);

  return (
    <section className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/70 dark:bg-blue-950/20" aria-label={`${algorithm.label} introduction`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-300">
          <BookOpen size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-blue-950 dark:text-blue-100">Introduction</h2>
          <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-200">{intro.summary}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-white/75 p-3 text-xs leading-5 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
              <p className="mb-1 flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                <Target size={14} className="text-blue-600 dark:text-blue-300" />
                When to use it
              </p>
              {intro.useWhen}
            </div>
            <div className="rounded-lg bg-white/75 p-3 text-xs leading-5 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
              <p className="mb-1 flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                <Eye size={14} className="text-blue-600 dark:text-blue-300" />
                Watch for
              </p>
              {intro.watchFor}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
