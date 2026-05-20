import { useMemo, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { FileJson, Play, UploadCloud } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';

type LoadedInfo = { layers: Array<{ name: string; input: string; output: string; params: number }>; inputShape: number[]; outputShape: number[]; params: number };

function shapeText(shape: unknown) {
  return Array.isArray(shape) ? `[${shape.map(item => item ?? '?').join(', ')}]` : String(shape ?? '?');
}

export default function BrowserModelLoaderPage() {
  const modelRef = useRef<tf.LayersModel | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [weightsFile, setWeightsFile] = useState<File | null>(null);
  const [modelUrl, setModelUrl] = useState('');
  const [info, setInfo] = useState<LoadedInfo | null>(null);
  const [inputs, setInputs] = useState<number[]>([]);
  const [prediction, setPrediction] = useState<number[]>([]);
  const [status, setStatus] = useState('Upload model.json and weights.bin, or paste a hosted model.json URL.');

  const modality = useMemo(() => {
    const dims = info?.inputShape ?? [];
    if (dims.length >= 4) return 'image';
    if (dims[1] === 40) return 'audio';
    return 'tabular';
  }, [info]);

  const loadModel = async () => {
    try {
      await tf.ready();
      modelRef.current?.dispose();
      const model = modelUrl.trim()
        ? await tf.loadLayersModel(modelUrl.trim())
        : jsonFile && weightsFile
          ? await tf.loadLayersModel(tf.io.browserFiles([jsonFile, weightsFile]))
          : null;
      if (!model) {
        setStatus('Choose both local files or a hosted model.json URL.');
        return;
      }
      modelRef.current = model;
      const inputShape = (model.inputs[0]?.shape ?? []).map(value => value ?? 1);
      const outputShape = (model.outputs[0]?.shape ?? []).map(value => value ?? 1);
      setInfo({
        inputShape: inputShape as number[],
        outputShape: outputShape as number[],
        params: model.countParams(),
        layers: model.layers.map(layer => ({
          name: layer.name,
          input: shapeText(Array.isArray(layer.input) ? layer.input[0]?.shape : layer.input?.shape),
          output: shapeText(Array.isArray(layer.output) ? layer.output[0]?.shape : layer.output?.shape),
          params: layer.countParams(),
        })),
      });
      const featureCount = Math.max(1, Number(inputShape.at(-1) ?? 1));
      setInputs(Array.from({ length: Math.min(24, featureCount) }, () => 0));
      setPrediction([]);
      setStatus('Model loaded. Run a tabular test vector or inspect the architecture summary.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load this model.');
    }
  };

  const predict = async () => {
    const model = modelRef.current;
    if (!model || !info) return;
    const shape = info.inputShape.map((value, index) => index === 0 ? 1 : value || 1);
    const size = shape.slice(1).reduce((product, value) => product * value, 1);
    const values = Array.from({ length: size }, (_, index) => inputs[index % inputs.length] ?? 0);
    const tensor = tf.tensor(values, shape);
    const output = model.predict(tensor) as tf.Tensor;
    setPrediction(Array.from(await output.data()).slice(0, 20));
    tensor.dispose();
    output.dispose();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Browser Model Loader" subtitle="Load exported TensorFlow.js models directly in the browser and inspect their inputs, outputs, layers, and quick inference behavior." badge="Browser Inference" category="Deployment" icon={<UploadCloud size={22} />} />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Load Model">
            <div className="space-y-3 text-sm">
              <label className="block font-semibold">model.json<input type="file" accept=".json,application/json" onChange={event => setJsonFile(event.target.files?.[0] ?? null)} className="mt-2 w-full rounded border border-gray-200 p-2 dark:border-gray-700" /></label>
              <label className="block font-semibold">weights.bin<input type="file" accept=".bin" onChange={event => setWeightsFile(event.target.files?.[0] ?? null)} className="mt-2 w-full rounded border border-gray-200 p-2 dark:border-gray-700" /></label>
              <label className="block font-semibold">Hosted model URL<input value={modelUrl} onChange={event => setModelUrl(event.target.value)} placeholder="https://.../model.json" className="mt-2 w-full rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900" /></label>
              <button onClick={loadModel} className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-bold text-white"><FileJson size={15} /> Load</button>
            </div>
          </Card>

          <InfoBox type={info ? 'success' : 'info'} title="Status">{status}</InfoBox>
        </div>

        <div className="space-y-4">
          {info && (
            <>
              <Card title="Model Info">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded bg-gray-50 p-3 dark:bg-gray-900"><p className="text-xs text-gray-500">Modality</p><p className="font-black">{modality}</p></div>
                  <div className="rounded bg-gray-50 p-3 dark:bg-gray-900"><p className="text-xs text-gray-500">Input</p><p className="font-mono text-sm">{shapeText(info.inputShape)}</p></div>
                  <div className="rounded bg-gray-50 p-3 dark:bg-gray-900"><p className="text-xs text-gray-500">Output</p><p className="font-mono text-sm">{shapeText(info.outputShape)}</p></div>
                  <div className="rounded bg-gray-50 p-3 dark:bg-gray-900"><p className="text-xs text-gray-500">Params</p><p className="font-black">{info.params.toLocaleString()}</p></div>
                </div>
              </Card>

              <Card title="Quick Inference">
                {modality === 'tabular' ? (
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-4">
                      {inputs.map((value, index) => <input key={index} type="number" value={value} onChange={event => setInputs(current => current.map((item, itemIndex) => itemIndex === index ? Number(event.target.value) : item))} className="rounded border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-900" aria-label={`Feature ${index + 1}`} />)}
                    </div>
                    <button onClick={predict} className="inline-flex items-center gap-2 rounded bg-emerald-600 px-3 py-2 text-sm font-bold text-white"><Play size={14} /> Predict</button>
                  </div>
                ) : (
                  <InfoBox type="warning" title="Input Helper">This model shape looks like {modality}. Use the exported app page or attach preprocessing code so the loader can transform webcam/microphone input exactly like training.</InfoBox>
                )}
                {prediction.length > 0 && <pre className="mt-3 overflow-x-auto rounded bg-gray-950 p-3 text-xs text-gray-100">{JSON.stringify(prediction.map(value => Number(value.toFixed(4))), null, 2)}</pre>}
              </Card>

              <Card title="Architecture Summary">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase text-gray-500"><tr><th className="p-2">Layer</th><th className="p-2">Input</th><th className="p-2">Output</th><th className="p-2">Params</th></tr></thead>
                    <tbody>{info.layers.map(layer => <tr key={layer.name} className="border-t border-gray-100 dark:border-gray-800"><td className="p-2 font-semibold">{layer.name}</td><td className="p-2 font-mono text-xs">{layer.input}</td><td className="p-2 font-mono text-xs">{layer.output}</td><td className="p-2">{layer.params.toLocaleString()}</td></tr>)}</tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
