import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, FileText, Printer } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card } from '../../../components/common/Card';
import { loadModelMetadata, type SavedModelMetadata } from '../../../stores/experimentStore';

function download(filename: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ModelCardPage() {
  const [models, setModels] = useState<SavedModelMetadata[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({
    name: 'Browser ML Model',
    version: '1.0',
    use: 'Classify examples collected in the browser.',
    outOfScope: 'Not for safety-critical, medical, legal, or high-stakes automated decisions.',
    users: 'Learners, teachers, and prototyping teams.',
    data: 'Collected through webcam or uploaded folders.',
    collection: 'webcam',
    validation: '',
    failureModes: 'Low light, blurry images, unseen backgrounds, and class imbalance.',
    environments: 'Desktop Chrome, Mobile Chrome, Firefox',
    bias: 'May reflect the capture environment and sample imbalance.',
    privacy: 'Training data stays in the browser unless exported by the user.',
    limitations: 'Small datasets can overfit. Test on held-out examples before deployment.',
  });

  useEffect(() => {
    void loadModelMetadata().then(items => {
      setModels(items);
      if (items[0]) setSelectedId(items[0].id);
    });
  }, []);

  const selected = models.find(model => model.id === selectedId);
  useEffect(() => {
    if (!selected) return;
    setForm(current => ({
      ...current,
      name: selected.name,
      data: String(selected.parameters?.dataset ?? current.data),
      validation: selected.metrics?.accuracy ? `${(selected.metrics.accuracy * 100).toFixed(1)}% validation accuracy` : current.validation,
    }));
  }, [selected]);

  const labels = useMemo(() => {
    const raw = selected?.parameters?.labels ?? selected?.parameters?.classLabels ?? ['Class 1', 'Class 2'];
    return Array.isArray(raw) ? raw.map(String) : ['Class 1', 'Class 2'];
  }, [selected]);
  const sampleCounts = useMemo(() => labels.map((label, index) => ({ label, count: Number((selected?.parameters?.sampleCounts as Record<string, number> | undefined)?.[label] ?? 10 + index * 4) })), [labels, selected]);
  const markdown = `# ${form.name}\n\n## Model Details\n- Version: ${form.version}\n- Modality: ${selected?.algorithmName ?? 'Browser model'}\n- Created: ${selected ? new Date(selected.savedAt).toLocaleString() : 'Manual'}\n- Labels: ${labels.join(', ')}\n\n## Intended Use\n${form.use}\n\nOut of scope: ${form.outOfScope}\n\nUsers: ${form.users}\n\n## Training Data\n${form.data}\n\nCollection method: ${form.collection}\n\n## Performance\nTraining accuracy: ${selected?.metrics?.accuracy ? `${(selected.metrics.accuracy * 100).toFixed(1)}%` : 'Not recorded'}\n\nValidation: ${form.validation || 'Not recorded'}\n\nKnown failure modes: ${form.failureModes}\n\n## Ethical Considerations\nBias: ${form.bias}\n\nPrivacy: ${form.privacy}\n\nLimitations: ${form.limitations}\n`;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Model Card Generator" subtitle="Document what a browser-trained model does, how it was trained, and where it should not be used." badge="Intermediate" category="Deployment" icon={<FileText size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Model Details">
            <div className="space-y-3 text-sm">
              <select value={selectedId} onChange={event => setSelectedId(event.target.value)} className="w-full rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"><option value="">Manual card</option>{models.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select>
              {(['name', 'version', 'use', 'outOfScope', 'users', 'data', 'validation', 'failureModes', 'environments', 'bias', 'privacy', 'limitations'] as const).map(key => (
                <label key={key} className="block font-bold capitalize">{key.replace(/([A-Z])/g, ' $1')}<textarea value={form[key]} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} rows={key === 'name' || key === 'version' ? 1 : 2} className="mt-1 w-full rounded border border-gray-200 bg-white p-2 text-xs dark:border-gray-700 dark:bg-gray-900" /></label>
              ))}
            </div>
          </Card>
          <Card title="Export">
            <div className="grid gap-2 text-sm">
              <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-bold text-white"><Printer size={14} /> Print / PDF</button>
              <button onClick={() => download('model-card.md', markdown)} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-bold dark:border-gray-700"><Download size={14} /> Markdown</button>
              <button onClick={() => download('model-card.json', JSON.stringify({ ...form, labels, metrics: selected?.metrics }, null, 2), 'application/json')} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 font-bold dark:border-gray-700"><Download size={14} /> JSON</button>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Class Balance">
            <ResponsiveContainer width="100%" height={240}><BarChart data={sampleCounts}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#2563eb" /></BarChart></ResponsiveContainer>
          </Card>
          <Card title="Preview">
            <article className="prose max-w-none dark:prose-invert">
              <pre className="whitespace-pre-wrap rounded bg-gray-50 p-4 text-sm leading-6 dark:bg-gray-900">{markdown}</pre>
            </article>
          </Card>
        </div>
      </div>
    </div>
  );
}
