import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';
export type TrainingMode = 'manual' | 'auto';

const THEME_KEY = 'ml-suite-theme';
const SIDEBAR_KEY = 'ml-suite-sidebar-collapsed';
const TRAINING_MODE_KEY = 'ml-suite-training-mode';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);
  return { theme, toggleTheme };
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(SIDEBAR_KEY) === 'true';
  });

  const toggle = useCallback(() => {
    setCollapsed(c => {
      const next = !c;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }, []);

  return { collapsed, toggle };
}

export function useTrainingMode() {
  const [trainingMode, setTrainingModeState] = useState<TrainingMode>(() => {
    return (localStorage.getItem(TRAINING_MODE_KEY) as TrainingMode | null) ?? 'manual';
  });

  const setTrainingMode = useCallback((mode: TrainingMode) => {
    setTrainingModeState(mode);
    localStorage.setItem(TRAINING_MODE_KEY, mode);
    window.dispatchEvent(new CustomEvent('ml:training-mode-changed', { detail: { mode } }));
  }, []);

  return { trainingMode, setTrainingMode };
}
