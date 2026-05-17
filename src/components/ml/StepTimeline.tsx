export function StepTimeline({ steps, active = 0 }: { steps: string[]; active?: number }) {
  const boundedActive = Math.max(0, Math.min(active, steps.length - 1));
  const progress = steps.length <= 1 ? 100 : Math.round((boundedActive / (steps.length - 1)) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
        <span>Step {boundedActive + 1} of {steps.length}</span>
        <span className="text-xs font-semibold text-blue-600 dark:text-blue-300">{steps[boundedActive]}</span>
      </div>
      <div className="relative px-3 pt-2" aria-label={`Step progress ${progress}%`}>
        <div className="absolute left-6 right-6 top-5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="absolute left-6 top-5 h-1.5 rounded-full bg-green-500 transition-all" style={{ width: `calc((100% - 3rem) * ${progress / 100})` }} />
        <ol className="relative flex justify-between gap-2">
          {steps.map((step, i) => {
            const state = i < boundedActive ? 'done' : i === boundedActive ? 'current' : 'pending';
            const fill = state === 'done'
              ? 'border-green-500 bg-green-500 text-white'
              : state === 'current'
                ? 'border-blue-600 bg-blue-600 text-white ring-4 ring-blue-100 step-current-pulse dark:ring-blue-950'
                : 'border-gray-300 bg-white text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300';
            return (
              <li key={step} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${fill}`}>{i + 1}</span>
                <span className={`hidden max-w-28 text-[11px] font-semibold leading-tight sm:block ${state === 'pending' ? 'text-gray-500 dark:text-gray-400' : state === 'done' ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'}`}>
                  {step}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <ol className="space-y-2 text-sm">
        {steps.map((step, i) => (
          <li key={step} className={`flex gap-2 rounded p-2 transition-colors ${i === boundedActive ? 'step-current-highlight bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : i < boundedActive ? 'bg-green-50/70 text-green-700 dark:bg-green-950/20 dark:text-green-300' : 'text-gray-600 dark:text-gray-300'}`}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${i < boundedActive ? 'bg-green-500 text-white' : i === boundedActive ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
