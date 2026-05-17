import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';
export type TrainingMode = 'manual' | 'auto';
export type TrainingSpeed = 'slow' | 'normal' | 'fast';

const THEME_KEY = 'ml-suite-theme';
const SIDEBAR_KEY = 'ml-suite-sidebar-collapsed';
const TRAINING_MODE_KEY = 'ml-suite-training-mode';
const TRAINING_SPEED_KEY = 'ml-suite-training-speed';
const EXPANDED_CATEGORIES_KEY = 'ml-suite-expanded-categories';
const PRACTICE_MODE_KEY = 'ml-suite-practice-mode';
const TEACHER_MODE_KEY = 'ml-suite-teacher-mode';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
    window.dispatchEvent(new CustomEvent('ml:theme-changed', { detail: { theme } }));
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

export function useSidebarCategoryState(initialCategories: string[] = []) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(EXPANDED_CATEGORIES_KEY);
    if (saved) {
      try {
        return new Set(JSON.parse(saved) as string[]);
      } catch {
        localStorage.removeItem(EXPANDED_CATEGORIES_KEY);
      }
    }
    return new Set(initialCategories);
  });

  useEffect(() => {
    localStorage.setItem(EXPANDED_CATEGORIES_KEY, JSON.stringify([...expandedCategories]));
  }, [expandedCategories]);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const expandCategory = useCallback((category: string) => {
    setExpandedCategories(prev => new Set(prev).add(category));
  }, []);

  return { expandedCategories, setExpandedCategories, toggleCategory, expandCategory };
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

export function useTrainingSpeed() {
  const [trainingSpeed, setTrainingSpeedState] = useState<TrainingSpeed>(() => {
    return (localStorage.getItem(TRAINING_SPEED_KEY) as TrainingSpeed | null) ?? 'normal';
  });

  const setTrainingSpeed = useCallback((speed: TrainingSpeed) => {
    setTrainingSpeedState(speed);
    localStorage.setItem(TRAINING_SPEED_KEY, speed);
    window.dispatchEvent(new CustomEvent('ml:training-speed-changed', { detail: { speed } }));
  }, []);

  return { trainingSpeed, setTrainingSpeed };
}

export function usePracticeMode() {
  const [practiceMode, setPracticeModeState] = useState(() => localStorage.getItem(PRACTICE_MODE_KEY) === 'true');

  useEffect(() => {
    document.documentElement.classList.toggle('practice-mode', practiceMode);
    localStorage.setItem(PRACTICE_MODE_KEY, String(practiceMode));
    window.dispatchEvent(new CustomEvent('ml:practice-mode-changed', { detail: { practiceMode } }));
  }, [practiceMode]);

  const togglePracticeMode = useCallback(() => setPracticeModeState(value => !value), []);
  return { practiceMode, togglePracticeMode };
}

export function useTeacherMode() {
  const [teacherMode, setTeacherModeState] = useState(() => localStorage.getItem(TEACHER_MODE_KEY) === 'true');

  useEffect(() => {
    document.documentElement.classList.toggle('teacher-mode', teacherMode);
    localStorage.setItem(TEACHER_MODE_KEY, String(teacherMode));
    window.dispatchEvent(new CustomEvent('ml:teacher-mode-changed', { detail: { teacherMode } }));
  }, [teacherMode]);

  const toggleTeacherMode = useCallback(() => setTeacherModeState(value => !value), []);
  return { teacherMode, toggleTeacherMode };
}
