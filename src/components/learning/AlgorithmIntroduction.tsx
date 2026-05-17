import React from 'react';
import { BookOpen, ChevronDown, Eye, Target } from 'lucide-react';
import type { AlgorithmNavItem } from '../../data/implementationStatus';
import { getAlgorithmIntroduction } from '../../data/algorithmIntroductions';

interface AlgorithmIntroductionProps {
  algorithm: AlgorithmNavItem;
}

export const AlgorithmIntroduction: React.FC<AlgorithmIntroductionProps> = ({ algorithm }) => {
  const intro = React.useMemo(() => getAlgorithmIntroduction(algorithm), [algorithm]);
  const [open, setOpen] = React.useState(() => typeof window === 'undefined' ? true : window.matchMedia('(min-width: 768px)').matches);

  return (
    <section data-learning-explanation className="mt-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/70 dark:bg-blue-950/20" aria-label={`${algorithm.label} introduction`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm dark:bg-gray-900 dark:text-blue-300">
          <BookOpen size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setOpen(value => !value)}
            className="flex w-full min-h-10 items-center justify-between gap-3 text-left"
            aria-expanded={open}
          >
            <span>
              <span className="block text-sm font-bold text-blue-950 dark:text-blue-100">How It Works</span>
              <span className="mt-1 block text-sm leading-6 text-gray-700 dark:text-gray-200">{intro.summary}</span>
            </span>
            <ChevronDown size={16} className={`shrink-0 text-blue-700 transition-transform dark:text-blue-300 ${open ? 'rotate-180' : ''}`} />
          </button>
          <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
            <div className="overflow-hidden">
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
        </div>
      </div>
    </section>
  );
};
