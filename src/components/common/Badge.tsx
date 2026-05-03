import React from 'react';
import type { BadgeType } from '../../data/navigation';

const badgeStyles: Record<string, string> = {
  Beginner: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Intermediate: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Advanced: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Concept: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Browser Trainable': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Browser Inference': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  Educational: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Educational Simplified': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Implemented: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Scaffold: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

interface BadgeProps {
  type: BadgeType | string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ type, size = 'sm' }) => (
  <span className={`inline-flex items-center rounded-full font-medium ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'} ${badgeStyles[type as BadgeType] ?? badgeStyles.Concept}`}>
    {type}
  </span>
);
