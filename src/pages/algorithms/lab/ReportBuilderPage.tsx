import React from 'react';
import { FileText, Download } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { loadExperiments, type Experiment } from '../../../stores/experimentStore';
import { getLearningStats } from '../../../stores/learningStore';

function downloadText(filename: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildReport(experiments: Experiment[], includeModelCards: boolean) {
  const stats = getLearningStats();
  const lines = [
    '# Mega ML Suite Learning Report',
    '',
    `Generated: ${new Date().toLocaleString()}`,
    '',
    '## Curriculum Progress',
    `Completed routes: ${stats.completed}/${stats.total}`,
    `Quiz average: ${Math.round(stats.quizAverage * 100)}%`,
    `Achievements earned: ${stats.achievements.filter(item => item.earned).length}/${stats.achievements.length}`,
    '',
    '## Experiment Summary',
    `Saved experiments included: ${experiments.length}`,
    '',
  ];

  experiments.forEach((experiment, index) => {
    lines.push(`### ${index + 1}. ${experiment.name}`);
    lines.push(`Algorithm: ${experiment.algorithmName}`);
    lines.push(`Created: ${new Date(experiment.createdAt).toLocaleString()}`);
    lines.push('');
    lines.push('Parameters:');
    lines.push('```json');
    lines.push(JSON.stringify(experiment.params, null, 2));
    lines.push('```');
    lines.push('Metrics:');
    lines.push('```json');
    lines.push(JSON.stringify(experiment.metrics, null, 2));
    lines.push('```');
    if (experiment.notes) lines.push(`Notes: ${experiment.notes}`);
    if (includeModelCards) {
      lines.push('');
      lines.push('Model Card:');
      lines.push('- Intended use: education, controlled comparison, and browser-local experimentation.');
      lines.push('- Dataset context: verify row count, feature meaning, split, leakage risk, and class balance before interpreting metrics.');
      lines.push('- Limitations: browser-sized computation, educational approximations on some routes, no production monitoring.');
    }
    lines.push('');
  });
  return lines.join('\n');
}

export default function ReportBuilderPage() {
  const [experiments, setExperiments] = React.useState<Experiment[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [includeModelCards, setIncludeModelCards] = React.useState(true);

  React.useEffect(() => {
    loadExperiments()
      .then(items => {
        const sorted = items.sort((a, b) => b.createdAt - a.createdAt);
        setExperiments(sorted);
        setSelectedIds(sorted.slice(0, 5).map(item => item.id));
      })
      .catch(() => setExperiments([]));
  }, []);

  const selected = experiments.filter(item => selectedIds.includes(item.id));
  const report = React.useMemo(() => buildReport(selected, includeModelCards), [selected, includeModelCards]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title="Report Builder" subtitle="Generate reproducible Markdown reports with progress, experiment metrics, parameters, notes, and model-card sections." badge="Intermediate" category="Lab" icon={<FileText size={22} />} />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card title="Report Controls" subtitle="Choose saved experiments and reporting sections.">
          <label className="mb-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input type="checkbox" checked={includeModelCards} onChange={event => setIncludeModelCards(event.target.checked)} />
            Include model-card sections
          </label>
          <div className="max-h-96 space-y-2 overflow-auto pr-1">
            {experiments.length === 0 ? (
              <p className="text-sm text-gray-500">Save experiments from algorithm pages to include them here.</p>
            ) : experiments.map(experiment => (
              <label key={experiment.id} className="flex gap-2 rounded border border-gray-200 p-2 text-xs dark:border-gray-700">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(experiment.id)}
                  onChange={event => {
                    setSelectedIds(current => event.target.checked
                      ? [experiment.id, ...current]
                      : current.filter(id => id !== experiment.id)
                    );
                  }}
                />
                <span>
                  <span className="block font-semibold text-gray-800 dark:text-gray-100">{experiment.name}</span>
                  <span className="text-gray-500">{experiment.algorithmName}</span>
                </span>
              </label>
            ))}
          </div>
          <button
            onClick={() => downloadText('mega-ml-suite-report.md', report, 'text/markdown')}
            className="mt-4 inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
          >
            <Download size={14} /> Export Markdown
          </button>
        </Card>
        <Card title="Report Preview" subtitle={`${selected.length} experiments selected.`}>
          <InfoBox type="info" title="Best Practice">
            A useful ML report includes parameters, data context, metrics, interpretation notes, and limitations.
          </InfoBox>
          <pre className="mt-3 max-h-[640px] overflow-auto rounded bg-gray-950 p-4 text-xs leading-relaxed text-gray-100">{report}</pre>
        </Card>
      </div>
    </div>
  );
}
