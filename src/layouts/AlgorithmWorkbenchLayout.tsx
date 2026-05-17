import React from 'react';
import { Download, FileJson, Save } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Card, InfoBox } from '../components/common/Card';
import { LearningCompanion } from '../components/learning/LearningCompanion';

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
  const location = useLocation();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {controls}
        {metrics}
        <Card title="Export and Save" subtitle="Keep a copy of this run or add it to your saved experiments.">
          <div className="flex flex-wrap gap-2 text-xs">
            <button disabled={!onExportJson} onClick={onExportJson} title={onExportJson ? 'Export this experiment as JSON' : 'JSON export is not available on this page'} className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700"><FileJson size={14} /> Experiment JSON</button>
            <button disabled={!onExportMarkdown} onClick={onExportMarkdown} title={onExportMarkdown ? 'Export this experiment as Markdown' : 'Markdown export is not available on this page'} className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700"><Download size={14} /> Markdown</button>
            <button disabled={!onSave} onClick={onSave} title={onSave ? 'Save this experiment in the browser' : 'Save is not available on this page'} className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Save size={14} /> Save</button>
          </div>
        </Card>
      </div>
      <div className="space-y-4">
        {visualization}
        {output}
        <LearningCompanion route={location.pathname} />
        <InfoBox type="info" title="Try This Next">
          Change one parameter at a time, run the model again, and compare how the chart and metrics move. Small controlled changes make the lesson easier to see.
        </InfoBox>
        {warning && <InfoBox type="warning" title="Algorithm-Specific Warning">{warning}</InfoBox>}
        {notes}
      </div>
    </div>
  );
}
