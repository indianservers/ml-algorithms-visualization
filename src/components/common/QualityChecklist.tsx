import { CheckCircle2, Circle } from 'lucide-react';
import { Card } from './Card';

const defaultItems = ['Dataset', 'Controls', 'Chart', 'Metrics', 'Prediction', 'Export', 'Save', 'Validation'];

export function QualityChecklist({ completeItems = [] }: { completeItems?: string[] }) {
  const complete = new Set(completeItems);
  return (
    <Card title="Quality Checklist">
      <div className="grid grid-cols-2 gap-2 text-xs">
        {defaultItems.map(item => {
          const done = complete.has(item);
          return (
            <div key={item} className={`flex items-center gap-2 rounded p-2 ${done ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-gray-50 text-gray-500 dark:bg-gray-900'}`}>
              {done ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              {item}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
