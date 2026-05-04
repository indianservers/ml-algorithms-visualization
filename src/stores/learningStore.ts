import { getAllAlgorithms, getImplementationStatus } from '../data/implementationStatus';

export interface QuizResult {
  route: string;
  score: number;
  total: number;
  completedAt: number;
}

export interface LearnerNote {
  route: string;
  text: string;
  updatedAt: number;
}

export interface LearnerProgress {
  completedRoutes: string[];
  quizResults: QuizResult[];
  notes: LearnerNote[];
  challengeRuns: Record<string, number>;
  lastUpdated: number;
}

const KEY = 'mlSuiteLearnerProgress';

const emptyProgress: LearnerProgress = {
  completedRoutes: [],
  quizResults: [],
  notes: [],
  challengeRuns: {},
  lastUpdated: Date.now(),
};

function readProgress(): LearnerProgress {
  if (typeof localStorage === 'undefined') return emptyProgress;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as LearnerProgress | null;
    if (!parsed) return emptyProgress;
    return {
      ...emptyProgress,
      ...parsed,
      completedRoutes: Array.isArray(parsed.completedRoutes) ? parsed.completedRoutes : [],
      quizResults: Array.isArray(parsed.quizResults) ? parsed.quizResults : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      challengeRuns: parsed.challengeRuns ?? {},
    };
  } catch {
    return emptyProgress;
  }
}

function writeProgress(progress: LearnerProgress) {
  if (typeof localStorage === 'undefined') return progress;
  const next = { ...progress, lastUpdated: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('ml:learner-progress-changed'));
  return next;
}

export function getLearnerProgress() {
  return readProgress();
}

export function markRouteComplete(route: string) {
  const progress = readProgress();
  if (!progress.completedRoutes.includes(route)) {
    progress.completedRoutes = [route, ...progress.completedRoutes];
  }
  return writeProgress(progress);
}

export function saveQuizResult(result: Omit<QuizResult, 'completedAt'>) {
  const progress = readProgress();
  progress.quizResults = [
    { ...result, completedAt: Date.now() },
    ...progress.quizResults.filter(item => item.route !== result.route),
  ];
  if (result.total > 0 && result.score / result.total >= 0.8 && !progress.completedRoutes.includes(result.route)) {
    progress.completedRoutes = [result.route, ...progress.completedRoutes];
  }
  return writeProgress(progress);
}

export function saveLearnerNote(route: string, text: string) {
  const progress = readProgress();
  progress.notes = [
    { route, text, updatedAt: Date.now() },
    ...progress.notes.filter(note => note.route !== route),
  ];
  return writeProgress(progress);
}

export function getLearnerNote(route: string) {
  return readProgress().notes.find(note => note.route === route)?.text ?? '';
}

export function recordChallengeRun(route: string) {
  const progress = readProgress();
  progress.challengeRuns = {
    ...progress.challengeRuns,
    [route]: (progress.challengeRuns[route] ?? 0) + 1,
  };
  return writeProgress(progress);
}

export function getLearningStats() {
  const progress = readProgress();
  const algorithms = getAllAlgorithms();
  const completable = algorithms.filter(item => getImplementationStatus(item.route) !== 'Scaffold');
  const completedSet = new Set(progress.completedRoutes);
  const completed = completable.filter(item => completedSet.has(item.route));
  const quizAverage = progress.quizResults.length
    ? progress.quizResults.reduce((sum, item) => sum + item.score / Math.max(item.total, 1), 0) / progress.quizResults.length
    : 0;
  const categories = Array.from(new Set(algorithms.map(item => item.category))).map(category => {
    const categoryItems = completable.filter(item => item.category === category);
    const done = categoryItems.filter(item => completedSet.has(item.route)).length;
    return { category, done, total: categoryItems.length };
  });
  const achievements = [
    { id: 'first-run', label: 'First Run', earned: progress.completedRoutes.length >= 1 },
    { id: 'quiz-master', label: 'Quiz Master', earned: progress.quizResults.some(item => item.score === item.total && item.total > 0) },
    { id: 'experimenter', label: 'Experimenter', earned: Object.values(progress.challengeRuns).reduce((sum, value) => sum + value, 0) >= 5 },
    { id: 'category-finisher', label: 'Category Finisher', earned: categories.some(item => item.total > 0 && item.done === item.total) },
    { id: 'halfway', label: 'Halfway There', earned: completable.length > 0 && completed.length / completable.length >= 0.5 },
  ];
  return {
    total: completable.length,
    completed: completed.length,
    quizAverage,
    categories,
    achievements,
    recentNotes: progress.notes.slice(0, 5),
  };
}
