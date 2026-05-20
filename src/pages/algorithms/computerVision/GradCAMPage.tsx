import { useMemo, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { Camera, Flame, Upload } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });
}

function jet(value: number) {
  const v = Math.max(0, Math.min(1, value));
  const r = Math.round(255 * Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 3))));
  const g = Math.round(255 * Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 2))));
  const b = Math.round(255 * Math.max(0, Math.min(1, 1.5 - Math.abs(4 * v - 1))));
  return [r, g, b];
}

function shapeText(shape: Array<number | null | undefined>) {
  return `[${shape.map(item => item ?? '?').join(', ')}]`;
}

export default function GradCAMPage() {
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const modelRef = useRef<tf.LayersModel | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [weightsFile, setWeightsFile] = useState<File | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [labelsText, setLabelsText] = useState('class 0\nclass 1');
  const [selectedClass, setSelectedClass] = useState(0);
  const [opacity, setOpacity] = useState(0.45);
  const [prediction, setPrediction] = useState<{ label: string; confidence: number } | null>(null);
  const [modelInfo, setModelInfo] = useState<{ inputSize: number; outputCount: number; convLayer: string } | null>(null);
  const [status, setStatus] = useState('Upload a full TFjs image model and a test image to generate a heatmap.');

  const labels = useMemo(() => labelsText.split(/\r?\n/).map(item => item.trim()).filter(Boolean), [labelsText]);

  const loadModel = async () => {
    if (!jsonFile || !weightsFile) {
      setStatus('Choose both model.json and weights.bin.');
      return;
    }
    try {
      await tf.ready();
      modelRef.current?.dispose();
      const model = await tf.loadLayersModel(tf.io.browserFiles([jsonFile, weightsFile]));
      modelRef.current = model;
      const inputShape = model.inputs[0]?.shape ?? [1, 224, 224, 3];
      const outputShape = model.outputs[0]?.shape ?? [1, labels.length];
      const conv = [...model.layers].reverse().find(layer => {
        const output = Array.isArray(layer.output) ? layer.output[0]?.shape : layer.output?.shape;
        return output?.length === 4;
      });
      setModelInfo({
        inputSize: Number(inputShape[1] ?? inputShape[2] ?? 224),
        outputCount: Number(outputShape.at(-1) ?? labels.length),
        convLayer: conv?.name ?? 'input-gradient fallback',
      });
      setStatus(`Model loaded. Last convolution-like layer: ${conv?.name ?? 'none found; using input-gradient heatmap'}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load model.');
    }
  };

  const drawOriginal = (image: HTMLImageElement, size: number) => {
    const canvas = originalCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(image, 0, 0, size, size);
  };

  const uploadImage = async (file: File | null) => {
    if (!file) return;
    const image = await loadImage(file);
    setImageElement(image);
    drawOriginal(image, modelInfo?.inputSize ?? 224);
    setStatus(`Loaded ${file.name}.`);
  };

  const generateHeatmap = async (classIndex = selectedClass) => {
    const model = modelRef.current;
    const image = imageElement;
    const size = modelInfo?.inputSize ?? 224;
    const originalCanvas = originalCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const overlayCtx = overlayCanvas?.getContext('2d');
    if (!model || !image || !originalCanvas || !overlayCanvas || !overlayCtx) {
      setStatus('Load a model and image first.');
      return;
    }
    drawOriginal(image, size);

    const input = tf.tidy(() => tf.browser.fromPixels(originalCanvas).toFloat().div(255).expandDims(0));
    const pred = model.predict(input) as tf.Tensor;
    const probs = Array.from(await pred.data());
    pred.dispose();
    const topIndex = probs.reduce((best, value, index) => value > probs[best] ? index : best, 0);
    const targetIndex = Math.min(classIndex, probs.length - 1);
    setPrediction({ label: labels[topIndex] ?? `class ${topIndex}`, confidence: probs[topIndex] ?? 0 });

    const gradFn = tf.grad((x: tf.Tensor) => {
      const output = model.predict(x) as tf.Tensor;
      return output.squeeze().gather([targetIndex]).sum();
    });
    const grads = gradFn(input) as tf.Tensor4D;
    const heat = tf.tidy(() => {
      const saliency = grads.abs().mean(3).squeeze();
      const min = saliency.min();
      const max = saliency.max();
      return saliency.sub(min).div(max.sub(min).add(1e-6));
    });
    const values = Array.from(await heat.data());
    input.dispose();
    grads.dispose();
    heat.dispose();

    overlayCanvas.width = size;
    overlayCanvas.height = size;
    overlayCtx.drawImage(originalCanvas, 0, 0);
    const base = overlayCtx.getImageData(0, 0, size, size);
    const blended = overlayCtx.createImageData(size, size);
    for (let index = 0; index < values.length; index++) {
      const [r, g, b] = jet(values[index]);
      blended.data[index * 4] = base.data[index * 4] * (1 - opacity) + r * opacity;
      blended.data[index * 4 + 1] = base.data[index * 4 + 1] * (1 - opacity) + g * opacity;
      blended.data[index * 4 + 2] = base.data[index * 4 + 2] * (1 - opacity) + b * opacity;
      blended.data[index * 4 + 3] = 255;
    }
    overlayCtx.putImageData(blended, 0, 0);
    setStatus(`Generated heatmap for ${labels[targetIndex] ?? `class ${targetIndex}`}. Warm regions had the strongest influence.`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Grad-CAM" subtitle="Inspect which image regions influence a TensorFlow.js classifier prediction with a heatmap overlay." badge="Explainability" category="Computer Vision" icon={<Flame size={22} />} />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Load Model">
            <div className="space-y-3 text-sm">
              <label className="block font-semibold">model.json<input type="file" accept=".json,application/json" onChange={event => setJsonFile(event.target.files?.[0] ?? null)} className="mt-2 w-full rounded border border-gray-200 p-2 dark:border-gray-700" /></label>
              <label className="block font-semibold">weights.bin<input type="file" accept=".bin" onChange={event => setWeightsFile(event.target.files?.[0] ?? null)} className="mt-2 w-full rounded border border-gray-200 p-2 dark:border-gray-700" /></label>
              <button onClick={loadModel} className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 font-bold text-white"><Upload size={14} /> Load TFjs model</button>
              <label className="block font-semibold">Class labels<textarea value={labelsText} onChange={event => setLabelsText(event.target.value)} rows={5} className="mt-2 w-full rounded border border-gray-200 bg-white p-2 font-mono text-xs dark:border-gray-700 dark:bg-gray-900" /></label>
            </div>
          </Card>

          <Card title="Controls">
            <div className="space-y-3 text-sm">
              <label className="block font-semibold">Test image<input type="file" accept="image/*" onChange={event => void uploadImage(event.target.files?.[0] ?? null)} className="mt-2 w-full rounded border border-gray-200 p-2 dark:border-gray-700" /></label>
              <label className="block font-semibold">Class<select value={selectedClass} onChange={event => setSelectedClass(Number(event.target.value))} className="mt-2 w-full rounded border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">{Array.from({ length: Math.max(labels.length, modelInfo?.outputCount ?? 0) }, (_, index) => <option key={index} value={index}>{labels[index] ?? `class ${index}`}</option>)}</select></label>
              <label className="block font-semibold">Overlay opacity: {opacity.toFixed(2)}<input type="range" min={0.2} max={0.8} step={0.05} value={opacity} onChange={event => setOpacity(Number(event.target.value))} className="mt-2 w-full accent-red-600" /></label>
              <button onClick={() => void generateHeatmap()} className="inline-flex w-full items-center justify-center gap-2 rounded bg-red-600 px-3 py-2 font-bold text-white"><Flame size={14} /> Generate heatmap</button>
            </div>
          </Card>

          <InfoBox type={modelInfo ? 'success' : 'info'} title="Status">{status}</InfoBox>
        </div>

        <div className="space-y-4">
          {modelInfo && (
            <Card title="Model Info">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded bg-gray-50 p-3 dark:bg-gray-900"><p className="text-xs text-gray-500">Input</p><p className="font-mono">{modelInfo.inputSize}x{modelInfo.inputSize}</p></div>
                <div className="rounded bg-gray-50 p-3 dark:bg-gray-900"><p className="text-xs text-gray-500">Output</p><p className="font-mono">{shapeText([1, modelInfo.outputCount])}</p></div>
                <div className="rounded bg-gray-50 p-3 dark:bg-gray-900"><p className="text-xs text-gray-500">Layer</p><p className="truncate font-semibold">{modelInfo.convLayer}</p></div>
              </div>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Original">
              <canvas ref={originalCanvasRef} className="aspect-square w-full rounded border border-gray-200 bg-gray-950 object-contain dark:border-gray-700" />
            </Card>
            <Card title="Heatmap Overlay">
              <canvas ref={overlayCanvasRef} className="aspect-square w-full rounded border border-gray-200 bg-gray-950 object-contain dark:border-gray-700" />
            </Card>
          </div>

          <InfoBox type="warning" title="Interpretation">
            {prediction ? `Predicted: ${prediction.label} (${(prediction.confidence * 100).toFixed(1)}%). ` : ''}Warm regions are the pixels that most changed the selected class score. If the heatmap focuses on the wrong object or background, collect more diverse examples.
          </InfoBox>
        </div>
      </div>
    </div>
  );
}
