import { useEffect, useMemo, useState } from 'react';
import { Clipboard, Download, PackageOpen } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { loadModelMetadata, type SavedModelMetadata } from '../../../stores/experimentStore';

function download(filename: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function labelsOf(model: SavedModelMetadata) {
  return Array.isArray(model.parameters?.labels) ? model.parameters.labels.map(String) : ['class_0', 'class_1'];
}

function pythonScript(model: SavedModelMetadata) {
  const labels = JSON.stringify(labelsOf(model));
  const image = model.parameters?.modality === 'image';
  return [
    'import numpy as np',
    'import tensorflow as tf',
    image ? 'import cv2' : '',
    '',
    `class_labels = ${labels}`,
    "model = tf.keras.models.load_model('model/')",
    image
      ? "img = cv2.resize(cv2.imread('image.jpg'), (64, 64)) / 255.0\npred = model.predict(img[np.newaxis, ...])"
      : "features = np.array([[0.0]], dtype='float32')\npred = model.predict(features)",
    'print(class_labels[int(np.argmax(pred))])',
  ].filter(Boolean).join('\n');
}

export default function ExportHubPage() {
  const [models, setModels] = useState<SavedModelMetadata[]>([]);
  const [copied, setCopied] = useState('');
  const command = 'pip install tf2onnx && python -m tf2onnx.convert --saved-model ./model --output model.onnx';

  useEffect(() => {
    void loadModelMetadata().then(items => setModels(items.sort((a, b) => b.savedAt - a.savedAt)));
  }, []);
  const summary = useMemo(() => ({
    image: models.filter(model => model.parameters?.modality === 'image').length,
    audio: models.filter(model => model.parameters?.modality === 'audio').length,
    total: models.length,
  }), [models]);

  const copyCommand = async () => {
    await navigator.clipboard?.writeText(command);
    setCopied('ONNX command copied');
    window.setTimeout(() => setCopied(''), 1800);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Export Hub" subtitle="Collect trained browser models, labels, README templates, and deployment snippets in one place." badge="Deployment" category="Deployment" icon={<PackageOpen size={22} />} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Models"><p className="text-3xl font-black">{summary.total}</p><p className="text-sm text-gray-500">saved browser experiments</p></Card>
        <Card title="Image"><p className="text-3xl font-black">{summary.image}</p><p className="text-sm text-gray-500">vision models</p></Card>
        <Card title="Audio"><p className="text-3xl font-black">{summary.audio}</p><p className="text-sm text-gray-500">sound models</p></Card>
      </div>

      <Card title="Saved Models">
        <div className="grid gap-4 lg:grid-cols-2">
          {models.map(model => {
            const labels = labelsOf(model);
            const readme = [
              `# ${model.name}`,
              '',
              `Algorithm: ${model.algorithmName}`,
              `Saved: ${new Date(model.savedAt).toLocaleString()}`,
              `Labels: ${labels.join(', ')}`,
              '',
              '## TensorFlow.js',
              "```js\nconst model = await tf.loadLayersModel('model.json');\nconst pred = model.predict(tf.tensor([...input]));\n```",
              '',
              '## Input',
              JSON.stringify(model.parameters, null, 2),
            ].join('\n');

            return (
              <div key={model.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{model.name}</p>
                    <p className="text-xs text-gray-500">{model.algorithmName} · {new Date(model.savedAt).toLocaleDateString()}</p>
                  </div>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700">{((model.metrics?.accuracy ?? 0) * 100).toFixed(1)}%</span>
                </div>
                <pre className="mt-3 overflow-x-auto rounded bg-gray-950 p-3 text-xs text-gray-100">const model = await tf.loadLayersModel('model.json');</pre>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button onClick={() => download(`${model.name}-labels.txt`, labels.join('\n'))} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700"><Download size={14} /> labels.txt</button>
                  <button onClick={() => download(`${model.name}-README.md`, readme, 'text/markdown')} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700"><Download size={14} /> README.md</button>
                  <button onClick={() => download(`${model.name}-inference.py`, pythonScript(model), 'text/x-python')} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700"><Download size={14} /> Python script</button>
                  <button onClick={() => download(`${model.name}-metadata.json`, JSON.stringify(model, null, 2), 'application/json')} className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white"><Download size={14} /> Metadata</button>
                </div>
              </div>
            );
          })}
          {!models.length && <p className="rounded border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-gray-700">No saved models yet. Train a browser model first.</p>}
        </div>
      </Card>

      <InfoBox type="info" title="ONNX Conversion">
        <div className="flex flex-wrap items-center gap-3">
          <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-900">{command}</code>
          <button onClick={copyCommand} className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-xs font-bold dark:border-gray-700"><Clipboard size={13} /> Copy</button>
          {copied && <span className="text-xs font-bold text-green-600">{copied}</span>}
        </div>
      </InfoBox>
    </div>
  );
}
