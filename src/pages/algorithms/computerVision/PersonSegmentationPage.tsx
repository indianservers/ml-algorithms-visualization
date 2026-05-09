import { useEffect, useRef, useState } from 'react';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';
import { Camera, Layers, Play, Square } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { stopMediaElementStream, stopMediaStream } from '../../../lib/media/streams';

const W = 640;
const H = 360;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

async function loadBodySegmentation() {
  (window as any).tf = tf;
  await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/body-segmentation');
  return (window as any).bodySegmentation;
}

export default function PersonSegmentationPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const segmenterRef = useRef<any>(null);
  const loopRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'mask' | 'blur'>('mask');
  const [people, setPeople] = useState(0);
  const [status, setStatus] = useState('Start the webcam to segment people in the browser.');

  useEffect(() => () => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    segmenterRef.current?.dispose?.();
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    stopMediaElementStream(videoRef.current);
  }, []);

  const tick = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const segmenter = segmenterRef.current;
    const bodySegmentation = (window as any).bodySegmentation;
    if (!video || !canvas || !segmenter || video.readyState < 2) {
      loopRef.current = requestAnimationFrame(tick);
      return;
    }
    const segmentations = await segmenter.segmentPeople(video, { flipHorizontal: false, internalResolution: 'medium', segmentationThreshold: 0.7 });
    setPeople(segmentations.length);
    if (mode === 'blur') {
      await bodySegmentation.drawBokehEffect(canvas, video, segmentations, 0.7, 8, 3, false);
    } else {
      const mask = await bodySegmentation.toBinaryMask(segmentations, { r: 37, g: 99, b: 235, a: 190 }, { r: 0, g: 0, b: 0, a: 80 }, false, 0.7);
      await bodySegmentation.drawMask(canvas, video, mask, 0.75, 2, false);
    }
    loopRef.current = requestAnimationFrame(tick);
  };

  const start = async () => {
    stop(false);
    await tf.setBackend('webgl');
    await tf.ready();
    setStatus('Loading BodyPix segmenter...');
    const bodySegmentation = await loadBodySegmentation();
    segmenterRef.current ??= await bodySegmentation.createSegmenter(bodySegmentation.SupportedModels.BodyPix, {
      architecture: 'MobileNetV1',
      outputStride: 16,
      multiplier: 0.75,
      quantBytes: 2,
    });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: W, height: H }, audio: false });
    if (!videoRef.current) {
      stopMediaStream(stream);
      return;
    }
    streamRef.current = stream;
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    setRunning(true);
    setStatus('Person segmentation is running locally.');
    loopRef.current = requestAnimationFrame(tick);
  };

  const stop = (updateStatus = true) => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    stopMediaElementStream(videoRef.current);
    setRunning(false);
    if (updateStatus) setStatus('Segmentation stopped and webcam released.');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Person Segmentation" subtitle="Real-time TensorFlow.js person masks with overlay and background blur modes." badge="Browser Inference" category="Computer Vision" icon={<Layers size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Controls" icon={<Camera size={14} />}>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={start} disabled={running} className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Play size={14} /> Start</button>
              <button onClick={() => stop()} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-gray-700"><Square size={14} /> Stop</button>
            </div>
            <select value={mode} onChange={event => setMode(event.target.value as 'mask' | 'blur')} className="mt-3 w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
              <option value="mask">Blue person mask</option>
              <option value="blur">Background blur</option>
            </select>
          </Card>
          <MetricsPanel title="Segmentation Metrics" metrics={[
            { label: 'People', value: people, format: 'number', color: 'blue' },
            { label: 'Threshold', value: 0.7, format: 'percent', color: 'green' },
            { label: 'Input Width', value: W, format: 'number' },
            { label: 'Input Height', value: H, format: 'number' },
          ]} />
          <InfoBox type="info" title="Runtime">{status}</InfoBox>
        </div>
        <Card title="Live Segmentation">
          <video ref={videoRef} muted playsInline className="hidden" />
          <canvas ref={canvasRef} width={W} height={H} className="aspect-video w-full rounded-lg bg-gray-950" />
        </Card>
      </div>
    </div>
  );
}
