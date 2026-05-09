import React from 'react';
import { BookOpen, CheckCircle2, Code2, GraduationCap, Lightbulb, NotebookPen, Play, Trophy } from 'lucide-react';
import { Card, InfoBox } from '../common/Card';
import { Formula } from '../common/Formula';
import { getLearningContent } from '../../data/learningContent';
import { getLearnerNote, markRouteComplete, recordChallengeRun, saveLearnerNote, saveQuizResult } from '../../stores/learningStore';

interface LearningCompanionProps {
  route: string;
  compact?: boolean;
}

export function LearningCompanion({ route, compact = false }: LearningCompanionProps) {
  return <LearningCompanionBody key={route} route={route} compact={compact} />;
}

function LearningCompanionBody({ route, compact = false }: LearningCompanionProps) {
  const content = React.useMemo(() => getLearningContent(route), [route]);
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [score, setScore] = React.useState<number | null>(null);
  const [note, setNote] = React.useState(() => getLearnerNote(route));
  const [message, setMessage] = React.useState('');

  const submitQuiz = () => {
    const nextScore = content.quiz.reduce((sum, question, index) => sum + (answers[index] === question.answer ? 1 : 0), 0);
    setScore(nextScore);
    saveQuizResult({ route, score: nextScore, total: content.quiz.length });
    setMessage(nextScore === content.quiz.length ? 'Perfect quiz. Marked complete.' : 'Quiz saved. Review the explanations and try again.');
  };

  const saveNote = () => {
    saveLearnerNote(route, note);
    setMessage('Learning note saved locally.');
  };

  const complete = () => {
    markRouteComplete(route);
    setMessage('Algorithm marked complete in your curriculum.');
  };

  const runChallenge = () => {
    recordChallengeRun(route);
    setMessage('Challenge attempt recorded. Compare one changed parameter with your previous run.');
  };

  const formula = React.useMemo(() => toKatexFormula(content.formula), [content.formula]);

  return (
    <div className="space-y-4">
      <Card title="Learning Companion" subtitle="Objectives, intuition, quiz, notes, and challenge tracking for this route." icon={<GraduationCap size={15} />}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500"><BookOpen size={13} /> Objectives</h4>
              <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
                {content.objectives.map(item => <li key={item} className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-green-500" />{item}</li>)}
              </ul>
            </div>
            <InfoBox type="info" title="Intuition">{content.intuition}</InfoBox>
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500"><Play size={13} /> Pseudocode</h4>
              <ol className="space-y-1 text-sm text-gray-700 dark:text-gray-200">
                {content.pseudocode.map((step, index) => <li key={step}><span className="font-mono text-xs text-gray-400">{index + 1}.</span> {step}</li>)}
              </ol>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
              <h4 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500"><Lightbulb size={13} /> Core Formula</h4>
              <Formula value={formula} block />
            </div>
            {!compact && (
              <>
                <div className="grid gap-2 md:grid-cols-2">
                  <pre className="overflow-auto rounded-lg bg-gray-950 p-3 text-[11px] text-gray-100"><code>{content.code}</code></pre>
                  <pre className="overflow-auto rounded-lg bg-gray-950 p-3 text-[11px] text-gray-100"><code>{content.python}</code></pre>
                </div>
                <InfoBox type="warning" title="Common Mistakes">
                  <ul className="space-y-1">
                    {content.mistakes.map(item => <li key={item}>{item}</li>)}
                  </ul>
                </InfoBox>
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Mini Challenge" subtitle={content.challenge} icon={<Trophy size={15} />}>
          <div className="flex flex-wrap gap-2">
            <button onClick={runChallenge} className="rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Record Challenge Attempt</button>
            <button onClick={complete} className="rounded border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900">Mark Complete</button>
          </div>
        </Card>
        <Card title="Learning Note" subtitle="Saved locally in this browser." icon={<NotebookPen size={15} />}>
          <textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            rows={4}
            className="w-full resize-y rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="What changed? What did the model do? What assumption matters?"
          />
          <button onClick={saveNote} className="mt-2 rounded bg-gray-900 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-gray-900">Save Note</button>
        </Card>
      </div>

      <Card title="Quick Quiz" subtitle="Three checks for durable understanding." icon={<Code2 size={15} />} collapsible>
        <div className="space-y-3">
          {content.quiz.map((question, index) => (
            <div key={question.question} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{index + 1}. {question.question}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {question.options.map((option, optionIndex) => (
                  <button
                    key={option}
                    onClick={() => setAnswers(current => ({ ...current, [index]: optionIndex }))}
                    className={`rounded border px-3 py-2 text-left text-xs ${answers[index] === optionIndex ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {score !== null && <p className="mt-2 text-xs text-gray-500">{question.explanation}</p>}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={submitQuiz} className="rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Submit Quiz</button>
            {score !== null && <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Score: {score}/{content.quiz.length}</span>}
            {message && <span className="text-xs text-green-600 dark:text-green-300">{message}</span>}
          </div>
        </div>
      </Card>
    </div>
  );
}

function toKatexFormula(value: string) {
  if (value.includes('\\') || value.includes('^') || value.includes('_')) return value;

  const normalized = value
    .replace(/mean squared error/gi, '\\text{mean squared error}')
    .replace(/minimize/gi, '\\text{minimize}')
    .replace(/optimize/gi, '\\text{optimize}')
    .replace(/group points by/gi, '\\text{group points by}')
    .replace(/project high-dimensional data into fewer dimensions while preserving variance or neighborhoods/gi, '\\text{project data while preserving variance or neighborhoods}')
    .replace(/forward pass -> loss -> backpropagation -> weight update/gi, '\\text{forward pass} \\rightarrow \\text{loss} \\rightarrow \\text{backpropagation} \\rightarrow \\text{weight update}')
    .replace(/theta <- theta - learning_rate \* gradient\(loss\)/gi, '\\theta \\leftarrow \\theta - \\eta \\nabla L(\\theta)')
    .replace(/Q\(s,a\) <- Q\(s,a\) \+ alpha \[r \+ gamma max Q\(s',a'\) - Q\(s,a\)\]/gi, "Q(s,a) \\leftarrow Q(s,a) + \\alpha [r + \\gamma \\max_{a'} Q(s',a') - Q(s,a)]")
    .replace(/J\(theta\)/g, 'J(\\theta)')
    .replace(/y_hat/g, '\\hat{y}')
    .replace(/\(1\/n\) sum/g, '\\frac{1}{n}\\sum')
    .replace(/learning_rate/g, '\\eta')
    .replace(/->/g, '\\rightarrow')
    .replace(/<-/g, '\\leftarrow');

  if (normalized === value) return `\\text{${value.replace(/[{}]/g, '')}}`;
  return normalized;
}
