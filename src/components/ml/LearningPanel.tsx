import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Lightbulb } from 'lucide-react';

interface Section {
  title: string;
  content: React.ReactNode;
}

interface LearningPanelProps {
  sections: Section[];
  defaultOpen?: boolean;
}

export const LearningPanel: React.FC<LearningPanelProps> = ({ sections, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));

  const toggleSection = (i: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };
  const allExpanded = expanded.size === sections.length;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-200 dark:border-blue-800 rounded-xl">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">Learning Notes</span>
          <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-gray-900/40 dark:text-blue-300">
            {sections.length} topics
          </span>
        </div>
        {open ? <ChevronDown size={15} className="text-blue-500" /> : <ChevronRight size={15} className="text-blue-500" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-xs text-blue-900 dark:bg-gray-900/30 dark:text-blue-200">
            <span className="inline-flex items-center gap-2"><Lightbulb size={13} /> Start with the first topic, then change one control and compare the result.</span>
            <button
              onClick={() => setExpanded(allExpanded ? new Set([0]) : new Set(sections.map((_, index) => index)))}
              className="rounded border border-blue-200 px-2 py-1 font-semibold hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30"
            >
              {allExpanded ? 'Collapse' : 'Expand all'}
            </button>
          </div>
          {sections.map((s, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection(i)}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-50 text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{i + 1}</span>
                  <span className="truncate">{s.title}</span>
                </span>
                {expanded.has(i) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {expanded.has(i) && (
                <div className="px-3 pb-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {s.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
