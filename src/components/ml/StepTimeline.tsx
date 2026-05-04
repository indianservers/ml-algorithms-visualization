export function StepTimeline({ steps, active = 0 }: { steps: string[]; active?: number }) {
  const progress = steps.length <= 1 ? 100 : Math.round((Math.min(active, steps.length - 1) / (steps.length - 1)) * 100);

  return (
    <div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" aria-label={`Step progress ${progress}%`}>
        <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
      <ol className="space-y-2 text-sm">
        {steps.map((step, i) => (
          <li key={step} className={`flex gap-2 rounded p-2 ${i === active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : i < active ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-300'}`}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${i <= active ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
