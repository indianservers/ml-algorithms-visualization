import { useEffect, useRef, useState } from 'react';
import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';
import { Activity, Camera, Download, Play, Square } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { MetricsPanel } from '../../../components/ml/MetricsPanel';
import { stopMediaElementStream, stopMediaStream } from '../../../lib/media/streams';

const W = 640;
const H = 360;

type PosePoint = { name?: string; x: number; y: number; score?: number };

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

async function loadPoseDetection() {
  (window as any).tf = tf;
  await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection');
  return (window as any).poseDetection;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function PoseDetectionPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<any>(null);
  const loopRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('Start the webcam to run MoveNet pose detection.');
  const [poseCount, setPoseCount] = useState(0);
  const [keypointCount, setKeypointCount] = useState(0);
  const [score, setScore] = useState(0);
  const [latest, setLatest] = useState<any[]>([]);

  useEffect(() => () => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    detectorRef.current?.dispose?.();
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    stopMediaElementStream(videoRef.current);
  }, []);

  const draw = (poses: any[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, W, H);
    ctx.lineWidth = 3;
    ctx.font = '12px sans-serif';
    const poseDetection = (window as any).poseDetection;
    poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet).forEach(([a, b]: [number, number]) => {
      poses.forEach(pose => {
        const p1 = pose.keypoints[a] as PosePoint;
        const p2 = pose.keypoints[b] as PosePoint;
        if ((p1.score ?? 0) > 0.25 && (p2.score ?? 0) > 0.25) {
          ctx.strokeStyle = '#22c55e';
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });
    });
    poses.flatMap(pose => pose.keypoints as PosePoint[]).forEach(point => {
      if ((point.score ?? 0) < 0.25) return;
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
      if (point.name) ctx.fillText(point.name, point.x + 5, point.y - 5);
    });
  };

  const tick = async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;
    if (!detector || !video || video.readyState < 2) {
      loopRef.current = requestAnimationFrame(tick);
      return;
    }
    const poses = await detector.estimatePoses(video, { maxPoses: 1, flipHorizontal: false });
    setLatest(poses);
    setPoseCount(poses.length);
    const visible = poses.flatMap((pose: any) => pose.keypoints).filter((point: PosePoint) => (point.score ?? 0) > 0.25);
    setKeypointCount(visible.length);
    setScore(poses[0]?.score ?? visible.reduce((sum: number, point: PosePoint) => sum + (point.score ?? 0), 0) / Math.max(1, visible.length));
    draw(poses);
    loopRef.current = requestAnimationFrame(tick);
  };

  const start = async () => {
    stop(false);
    await tf.setBackend('webgl');
    await tf.ready();
    setStatus('Loading MoveNet...');
    const poseDetection = await loadPoseDetection();
    detectorRef.current ??= await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
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
    setStatus('MoveNet is running live on the webcam.');
    loopRef.current = requestAnimationFrame(tick);
  };

  const stop = (updateStatus = true) => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    stopMediaElementStream(videoRef.current);
    setRunning(false);
    if (updateStatus) setStatus('Pose detection stopped and webcam released.');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Pose Detection" subtitle="Real-time MoveNet body keypoints from the webcam with skeleton overlay and exportable pose JSON." badge="Browser Inference" category="Computer Vision" icon={<Activity size={22} />} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card title="Controls" icon={<Camera size={14} />}>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={start} disabled={running} className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Play size={14} /> Start</button>
              <button onClick={() => stop()} className="inline-flex items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-gray-700"><Square size={14} /> Stop</button>
            </div>
            <button onClick={() => downloadJson('pose-detection-frame.json', latest)} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-semibold dark:border-gray-700"><Download size={14} /> Export Pose</button>
          </Card>
          <MetricsPanel title="Live Pose Metrics" metrics={[
            { label: 'Poses', value: poseCount, format: 'number', color: 'blue' },
            { label: 'Keypoints', value: keypointCount, format: 'number', color: 'green' },
            { label: 'Score', value: score, format: 'percent', color: 'green' },
            { label: 'FPS Target', value: 30, format: 'number' },
          ]} />
          <InfoBox type="info" title="Runtime">{status}</InfoBox>
        </div>
        <Card title="Webcam Skeleton">
          <video ref={videoRef} muted playsInline className="hidden" />
          <canvas ref={canvasRef} className="aspect-video w-full rounded-lg bg-gray-950" />
        </Card>
      </div>
    </div>
  );
}
