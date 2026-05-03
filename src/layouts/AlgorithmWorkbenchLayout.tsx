import React from 'react';
import { Download, FileJson, Save } from 'lucide-react';
import { Card, InfoBox } from '../components/common/Card';

interface AlgorithmWorkbenchLayoutProps {
  controls: React.ReactNode;
  visualization: React.ReactNode;
  metrics: React.ReactNode;
  output: React.ReactNode;
  notes: React.ReactNode;
  warning?: React.ReactNode;
  onExportJson?: () => void;
  onExportMarkdown?: () => void;
  onSave?: () => void;
}

export function AlgorithmWorkbenchLayout({
  controls,
  visualization,
  metrics,
  output,
  notes,
  warning,
  onExportJson,
  onExportMarkdown,
  onSave,
}: AlgorithmWorkbenchLayoutProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4">
        {controls}
        {metrics}
        <Card title="Export and Save">
          <div className="flex flex-wrap gap-2 text-xs">
            <button onClick={onExportJson} className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 dark:border-gray-700"><FileJson size={14} /> Experiment JSON</button>
            <button onClick={onExportMarkdown} className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 dark:border-gray-700"><Download size={14} /> Markdown</button>
            <button onClick={onSave} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 font-semibold text-white"><Save size={14} /> Save</button>
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        {visualization}
        {output}
        {warning && <InfoBox type="warning" title="Algorithm-Specific Warning">{warning}</InfoBox>}
        {notes}
      </div>
    </div>
  );
}
