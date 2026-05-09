import React from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import type { AlgorithmNavItem } from '../../data/implementationStatus';
import { getAlgorithmFaqs } from '../../data/algorithmFaqs';

interface AlgorithmFAQProps {
  algorithm: AlgorithmNavItem;
}

export const AlgorithmFAQ: React.FC<AlgorithmFAQProps> = ({ algorithm }) => {
  const faqs = React.useMemo(() => getAlgorithmFaqs(algorithm), [algorithm]);

  if (faqs.length === 0) return null;

  return (
    <section className="mx-auto mt-8 max-w-7xl px-4 pb-8" aria-labelledby="algorithm-faq-heading">
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <HelpCircle size={17} className="text-blue-600 dark:text-blue-400" />
            <h2 id="algorithm-faq-heading" className="text-sm font-bold text-gray-900 dark:text-white">
              {algorithm.label} FAQs
            </h2>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Quick answers for common algorithm-specific questions.
          </p>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {faqs.map((faq, index) => (
            <details key={`${faq.question}-${index}`} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-900/30 [&::-webkit-details-marker]:hidden">
                <span>{faq.question}</span>
                <ChevronDown size={16} className="shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};
