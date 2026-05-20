import { useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Images, Shuffle, Upload } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';

type ImageItem = { id: string; file: File; url: string; className: string; filename: string };
type AugKey = 'hflip' | 'vflip' | 'rotate' | 'brightness' | 'contrast' | 'zoom' | 'noise' | 'hue';
type AugConfig = Record<AugKey, { enabled: boolean; value: number }>;

const initialConfig: AugConfig = {
  hflip: { enabled: true, value: 0.5 },
  vflip: { enabled: false, value: 0.1 },
  rotate: { enabled: true, value: 20 },
  brightness: { enabled: true, value: 1.2 },
  contrast: { enabled: true, value: 1.15 },
  zoom: { enabled: false, value: 1.1 },
  noise: { enabled: false, value: 10 },
  hue: { enabled: false, value: 18 },
};

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function shiftHue(data: ImageData, degrees: number) {
  const shift = degrees / 360;
  for (let index = 0; index < data.data.length; index += 4) {
    let r = data.data[index] / 255, g = data.data[index + 1] / 255, b = data.data[index + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    h = (h + shift) % 1;
    const hue2rgb = (p: number, q: number, t: number) => {
      let next = t;
      if (next < 0) next += 1;
      if (next > 1) next -= 1;
      if (next < 1 / 6) return p + (q - p) * 6 * next;
      if (next < 1 / 2) return q;
      if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
      return p;
    };
    if (s === 0) r = g = b = l;
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    data.data[index] = r * 255;
    data.data[index + 1] = g * 255;
    data.data[index + 2] = b * 255;
  }
}

async function renderAugmented(item: ImageItem, config: AugConfig, seed = Math.random()) {
  const image = await loadImage(item.url);
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.save();
  ctx.translate(80, 80);
  if (config.hflip.enabled && seed < config.hflip.value) ctx.scale(-1, 1);
  if (config.vflip.enabled && seed > 1 - config.vflip.value) ctx.scale(1, -1);
  const angle = config.rotate.enabled ? (seed * 2 - 1) * config.rotate.value : 0;
  ctx.rotate((angle * Math.PI) / 180);
  const zoom = config.zoom.enabled ? Math.max(0.5, config.zoom.value) : 1;
  ctx.filter = `brightness(${config.brightness.enabled ? config.brightness.value : 1}) contrast(${config.contrast.enabled ? config.contrast.value : 1})`;
  ctx.drawImage(image, -80 * zoom, -80 * zoom, 160 * zoom, 160 * zoom);
  ctx.restore();
  const data = ctx.getImageData(0, 0, 160, 160);
  if (config.noise.enabled) {
    for (let index = 0; index < data.data.length; index += 4) {
      const n = (Math.random() * 2 - 1) * config.noise.value;
      data.data[index] += n;
      data.data[index + 1] += n;
      data.data[index + 2] += n;
    }
  }
  if (config.hue.enabled) shiftHue(data, config.hue.value);
  ctx.putImageData(data, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.86);
}

export default function DataAugmentationPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [config, setConfig] = useState<AugConfig>(initialConfig);
  const [preview, setPreview] = useState<string[]>([]);
  const [multiplier, setMultiplier] = useState(3);
  const [generating, setGenerating] = useState('');

  const classCounts = useMemo(() => {
    const counts = new Map<string, number>();
    images.forEach(item => counts.set(item.className, (counts.get(item.className) ?? 0) + 1));
    return [...counts.entries()].map(([className, before]) => ({ className, before, after: before * multiplier }));
  }, [images, multiplier]);

  const addFiles = (files: FileList | null) => {
    const next = Array.from(files ?? []).filter(file => file.type.startsWith('image/')).map(file => ({
      id: `${file.name}_${file.size}_${file.lastModified}`,
      file,
      url: URL.createObjectURL(file),
      className: file.webkitRelativePath?.split('/')[0] || 'unlabeled',
      filename: file.name,
    }));
    setImages(current => [...current, ...next]);
  };

  const updatePreview = async () => {
    const item = images[0];
    if (!item) return;
    setPreview(await Promise.all(Array.from({ length: 8 }, (_, index) => renderAugmented(item, config, (index + 1) / 9))));
  };

  const generate = async () => {
    const bundle: Record<string, Array<{ filename: string; dataURL: string }>> = {};
    let done = 0;
    for (const item of images) {
      for (let copy = 0; copy < multiplier; copy++) {
        const dataURL = await renderAugmented(item, config, Math.random());
        bundle[item.className] ??= [];
        bundle[item.className].push({ filename: `${item.filename.replace(/\.[^.]+$/, '')}_aug_${copy + 1}.jpg`, dataURL });
        done++;
        setGenerating(`Generating ${done} / ${images.length * multiplier} images...`);
      }
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'augmented-images.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setGenerating('Generated augmented image bundle.');
  };

  const rows: Array<[AugKey, string, number, number, number]> = [
    ['hflip', 'Horizontal Flip', 0, 1, 0.05],
    ['vflip', 'Vertical Flip', 0, 1, 0.05],
    ['rotate', 'Rotation degrees', 0, 30, 1],
    ['brightness', 'Brightness factor', 0.5, 1.5, 0.05],
    ['contrast', 'Contrast factor', 0.5, 1.5, 0.05],
    ['zoom', 'Zoom scale', 0.8, 1.2, 0.02],
    ['noise', 'Gaussian Noise sigma', 0, 25, 1],
    ['hue', 'Hue Shift degrees', 0, 30, 1],
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Data Augmentation" subtitle="Generate browser-side image variants for small webcam and folder datasets with Canvas transforms." badge="Browser Tool" category="Lab" icon={<Images size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card title="Image Input">
            <button onClick={() => inputRef.current?.click()} className="inline-flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-3 text-sm font-bold text-white"><Upload size={15} /> Upload Folder</button>
            <input ref={element => {
              inputRef.current = element;
              element?.setAttribute('webkitdirectory', '');
              element?.setAttribute('directory', '');
            }} type="file" accept="image/*" multiple className="hidden" onChange={event => addFiles(event.target.files)} />
            <div className="mt-4 space-y-2">{classCounts.map(item => <div key={item.className} className="flex justify-between rounded bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900"><span className="font-bold">{item.className}</span><span>{item.before} images</span></div>)}</div>
          </Card>

          <Card title="Controls">
            <div className="space-y-3">
              {rows.map(([key, label, min, max, step]) => (
                <label key={key} className="block rounded border border-gray-200 p-3 text-sm dark:border-gray-700">
                  <span className="flex items-center justify-between gap-3"><span className="font-bold">{label}</span><input type="checkbox" checked={config[key].enabled} onChange={event => setConfig(current => ({ ...current, [key]: { ...current[key], enabled: event.target.checked } }))} /></span>
                  <input type="range" min={min} max={max} step={step} value={config[key].value} onChange={event => setConfig(current => ({ ...current, [key]: { ...current[key], value: Number(event.target.value) } }))} className="mt-2 w-full accent-blue-600" />
                  <span className="text-xs text-gray-500">{config[key].value}</span>
                </label>
              ))}
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Live Preview" actions={<button onClick={updatePreview} className="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-1 text-xs font-bold dark:border-gray-700"><Shuffle size={13} /> Randomize</button>}>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="mb-2 text-xs font-bold text-gray-500">Original</p>{images[0] ? <img src={images[0].url} alt="" className="aspect-square w-full rounded object-cover" /> : <div className="grid aspect-square place-items-center rounded border border-dashed text-sm text-gray-500">Upload images</div>}</div>
              <div><p className="mb-2 text-xs font-bold text-gray-500">Augmented</p>{preview[0] ? <img src={preview[0]} alt="" className="aspect-square w-full rounded object-cover" /> : <div className="grid aspect-square place-items-center rounded border border-dashed text-sm text-gray-500">Generate preview</div>}</div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">{preview.map((url, index) => <img key={index} src={url} alt="" className="aspect-square rounded object-cover" />)}</div>
          </Card>

          <Card title="Before / After Class Balance">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={classCounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="className" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="before" fill="#94a3b8" />
                <Bar dataKey="after" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Generate">
            <label className="block text-sm font-bold">Generate {multiplier}x original count<input type="range" min={1} max={10} value={multiplier} onChange={event => setMultiplier(Number(event.target.value))} className="mt-2 w-full accent-green-600" /></label>
            <button onClick={generate} disabled={!images.length} className="mt-3 inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Download size={14} /> Generate Bundle</button>
            {generating && <InfoBox type="success">{generating}</InfoBox>}
          </Card>
        </div>
      </div>
    </div>
  );
}
