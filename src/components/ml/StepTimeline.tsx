export function StepTimeline({ steps, active = 0 }: { steps: string[]; active?: number }) {
  return (
    <ol className="space-y-2 text-sm">
      {steps.map((step, i) => (
        <li key={step} className={`flex gap-2 rounded p-2 ${i === active ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' : 'text-gray-600 dark:text-gray-300'}`}>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-200 text-xs font-bold dark:bg-gray-700">{i + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
