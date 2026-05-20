import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoxSelect, Download, MousePointer2, Pentagon, Plus, Trash2, Upload, Video } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';

type Tool = 'bbox' | 'polygon' | 'select';
type ClassItem = { id: string; name: string; color: string };
type Point = { x: number; y: number };
type Annotation =
  | { id: string; classId: string; type: 'bbox'; x: number; y: number; w: number; h: number }
  | { id: string; classId: string; type: 'polygon'; points: Point[] };
type AnnotatedImage = { id: string; filename: string; url: string; width: number; height: number; annotations: Annotation[] };

const STORAGE_KEY = 'annotation-project-v1';
const PALETTE = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316'];
const initialClasses: ClassItem[] = [
  { id: 'class_1', name: 'object', color: PALETTE[0] },
  { id: 'class_2', name: 'background item', color: PALETTE[1] },
];

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function loadImageFile(file: File): Promise<AnnotatedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({
      id: `${file.name}_${file.size}_${file.lastModified}`,
      filename: file.webkitRelativePath || file.name,
      url,
      width: image.naturalWidth,
      height: image.naturalHeight,
      annotations: [],
    });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not load ${file.name}`));
    };
    image.src = url;
  });
}

function rgba(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function pointInAnnotation(annotation: Annotation, point: Point, image: AnnotatedImage) {
  if (annotation.type === 'bbox') {
    const x = annotation.x * image.width;
    const y = annotation.y * image.height;
    const w = annotation.w * image.width;
    const h = annotation.h * image.height;
    return point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h;
  }
  let inside = false;
  const pts = annotation.points.map(p => ({ x: p.x * image.width, y: p.y * image.height }));
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if (((pts[i].y > point.y) !== (pts[j].y > point.y)) && point.x < ((pts[j].x - pts[i].x) * (point.y - pts[i].y)) / (pts[j].y - pts[i].y) + pts[i].x) inside = !inside;
  }
  return inside;
}

export default function ImageAnnotationPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const folderRef = useRef<HTMLInputElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const [images, setImages] = useState<AnnotatedImage[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [activeClassId, setActiveClassId] = useState(initialClasses[0].id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tool, setTool] = useState<Tool>('bbox');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftBox, setDraftBox] = useState<{ start: Point; end: Point } | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [videoUrl, setVideoUrl] = useState('');
  const [frameInterval, setFrameInterval] = useState(2);
  const [message, setMessage] = useState('Load images to start annotating.');

  const current = images[currentIndex];
  const activeClass = classes.find(item => item.id === activeClassId) ?? classes[0];
  const annotatedCount = images.filter(image => image.annotations.length > 0).length;
  const classCounts = useMemo(() => Object.fromEntries(classes.map(cls => [cls.id, images.reduce((sum, image) => sum + image.annotations.filter(annotation => annotation.classId === cls.id).length, 0)])), [classes, images]);

  const updateCurrent = useCallback((updater: (image: AnnotatedImage) => AnnotatedImage) => {
    setImages(existing => existing.map((image, index) => index === currentIndex ? updater(image) : image));
  }, [currentIndex]);

  const imagePointFromEvent = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    if (!current) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(current.width, ((event.clientX - rect.left) / rect.width) * current.width)),
      y: Math.max(0, Math.min(current.height, ((event.clientY - rect.top) / rect.height) * current.height)),
    };
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !current) return;
    const maxW = 800;
    const maxH = 600;
    const scale = Math.min(maxW / current.width, maxH / current.height, 1);
    canvas.width = Math.round(current.width * scale);
    canvas.height = Math.round(current.height * scale);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const image = imageElementRef.current;
    if (image) ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const sx = canvas.width / current.width;
    const sy = canvas.height / current.height;

    current.annotations.forEach(annotation => {
      const cls = classes.find(item => item.id === annotation.classId) ?? classes[0];
      ctx.save();
      ctx.strokeStyle = cls.color;
      ctx.fillStyle = cls.color;
      ctx.lineWidth = annotation.id === selectedId ? 3 : 2;
      if (annotation.id === selectedId) ctx.setLineDash([6, 4]);
      if (annotation.type === 'bbox') {
        const x = annotation.x * current.width * sx;
        const y = annotation.y * current.height * sy;
        const w = annotation.w * current.width * sx;
        const h = annotation.h * current.height * sy;
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
        ctx.fillRect(x, Math.max(0, y - 20), Math.max(50, cls.name.length * 7 + 12), 20);
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.fillText(cls.name, x + 6, Math.max(13, y - 6));
        if (annotation.id === selectedId) {
          ctx.fillStyle = '#fff';
          [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].forEach(([hx, hy]) => {
            ctx.fillRect(hx - 4, hy - 4, 8, 8);
            ctx.strokeRect(hx - 4, hy - 4, 8, 8);
          });
        }
      } else {
        ctx.beginPath();
        annotation.points.forEach((point, index) => {
          const x = point.x * current.width * sx;
          const y = point.y * current.height * sy;
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = rgba(cls.color, 0.2);
        ctx.fill();
        ctx.strokeStyle = cls.color;
        ctx.stroke();
      }
      ctx.restore();
    });

    if (draftBox) {
      ctx.strokeStyle = activeClass.color;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(draftBox.start.x * sx, draftBox.start.y * sy, (draftBox.end.x - draftBox.start.x) * sx, (draftBox.end.y - draftBox.start.y) * sy);
    }
    if (polygonPoints.length > 0) {
      ctx.strokeStyle = activeClass.color;
      ctx.fillStyle = activeClass.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      polygonPoints.forEach((point, index) => index === 0 ? ctx.moveTo(point.x * sx, point.y * sy) : ctx.lineTo(point.x * sx, point.y * sy));
      if (cursorPoint) ctx.lineTo(cursorPoint.x * sx, cursorPoint.y * sy);
      ctx.stroke();
      polygonPoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x * sx, point.y * sy, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [activeClass.color, classes, current, cursorPoint, draftBox, polygonPoints, selectedId]);

  useEffect(() => {
    if (!current) return;
    const image = new Image();
    image.onload = () => {
      imageElementRef.current = image;
      draw();
    };
    image.src = current.url;
  }, [current, draw]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      images: images.map(({ url: _url, ...image }) => image),
      classes,
    }));
  }, [classes, images]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setCurrentIndex(index => Math.max(0, index - 1));
      if (event.key === 'ArrowRight') setCurrentIndex(index => Math.min(images.length - 1, index + 1));
      if (event.key === 'Delete' && selectedId) {
        updateCurrent(image => ({ ...image, annotations: image.annotations.filter(annotation => annotation.id !== selectedId) }));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, selectedId, updateCurrent]);

  const addFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    const loaded = await Promise.all(imageFiles.map(loadImageFile));
    setImages(currentImages => [...currentImages, ...loaded]);
    setMessage(`Loaded ${loaded.length} image${loaded.length === 1 ? '' : 's'}.`);
  };

  const loadVideo = (file: File | undefined) => {
    if (!file) return;
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(URL.createObjectURL(file));
    setMode('video');
    setMessage(`Loaded video: ${file.name}. Choose an interval and extract frames.`);
  };

  const seekVideo = (video: HTMLVideoElement, time: number) => new Promise<void>(resolve => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });

  const extractFrames = async () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 360;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const extracted: AnnotatedImage[] = [];
    for (let time = 0; time <= video.duration; time += frameInterval) {
      await seekVideo(video, Math.min(video.duration, time));
      ctx.drawImage(video, 0, 0, width, height);
      const url = canvas.toDataURL('image/jpeg', 0.82);
      extracted.push({
        id: `video_frame_${Date.now()}_${extracted.length}`,
        filename: `video-frame-${String(extracted.length + 1).padStart(4, '0')}.jpg`,
        url,
        width,
        height,
        annotations: [],
      });
    }
    setImages(currentImages => [...currentImages, ...extracted]);
    setMode('image');
    setCurrentIndex(images.length);
    setMessage(`Extracted ${extracted.length} video frames into the filmstrip.`);
  };

  const addAnnotation = (annotation: Annotation) => updateCurrent(image => ({ ...image, annotations: [...image.annotations, annotation] }));

  const finishPolygon = () => {
    if (!current || polygonPoints.length < 3) return;
    addAnnotation({
      id: `ann_${Date.now()}`,
      classId: activeClassId,
      type: 'polygon',
      points: polygonPoints.map(point => ({ x: point.x / current.width, y: point.y / current.height })),
    });
    setPolygonPoints([]);
    setCursorPoint(null);
  };

  const exportCoco = () => {
    const categoryIds = new Map(classes.map((cls, index) => [cls.id, index + 1]));
    let annotationId = 1;
    const annotations = images.flatMap((image, imageIndex) => image.annotations.map(annotation => {
      const categoryId = categoryIds.get(annotation.classId) ?? 1;
      if (annotation.type === 'bbox') {
        const bbox = [annotation.x * image.width, annotation.y * image.height, annotation.w * image.width, annotation.h * image.height];
        return { id: annotationId++, image_id: imageIndex + 1, category_id: categoryId, bbox, segmentation: [], area: bbox[2] * bbox[3], iscrowd: 0 };
      }
      const points = annotation.points.flatMap(point => [point.x * image.width, point.y * image.height]);
      const xs = annotation.points.map(point => point.x * image.width);
      const ys = annotation.points.map(point => point.y * image.height);
      const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
      return { id: annotationId++, image_id: imageIndex + 1, category_id: categoryId, bbox, segmentation: [points], area: bbox[2] * bbox[3], iscrowd: 0 };
    }));
    download('annotations-coco.json', JSON.stringify({
      info: { version: '1.0', date_created: new Date().toISOString() },
      images: images.map((image, index) => ({ id: index + 1, file_name: image.filename, width: image.width, height: image.height })),
      annotations,
      categories: classes.map((cls, index) => ({ id: index + 1, name: cls.name, supercategory: 'object' })),
    }, null, 2), 'application/json');
  };

  const exportYolo = () => {
    const classIds = new Map(classes.map((cls, index) => [cls.id, index]));
    const files = Object.fromEntries(images.map(image => [image.filename.replace(/\.[^.]+$/, '.txt'), image.annotations.map(annotation => {
      const classId = classIds.get(annotation.classId) ?? 0;
      if (annotation.type === 'bbox') return `${classId} ${(annotation.x + annotation.w / 2).toFixed(6)} ${(annotation.y + annotation.h / 2).toFixed(6)} ${annotation.w.toFixed(6)} ${annotation.h.toFixed(6)}`;
      const xs = annotation.points.map(point => point.x);
      const ys = annotation.points.map(point => point.y);
      const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
      return `${classId} ${(x + w / 2).toFixed(6)} ${(y + h / 2).toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
    }).join('\n')]));
    download('annotations-yolo-files.json', JSON.stringify(files, null, 2), 'application/json');
  };

  const exportCsv = () => {
    const rows = ['filename,class,x,y,w,h'];
    images.forEach(image => image.annotations.forEach(annotation => {
      const cls = classes.find(item => item.id === annotation.classId)?.name ?? annotation.classId;
      if (annotation.type === 'bbox') rows.push([image.filename, cls, annotation.x, annotation.y, annotation.w, annotation.h].join(','));
    }));
    download('annotation-labels.csv', rows.join('\n'), 'text/csv');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader title="Image Annotation Tool" subtitle="Browser-only bounding boxes and polygons with COCO, YOLO, and CSV export." badge="Browser Trainable" category="Lab" icon={<BoxSelect size={22} />} />

      <div className="grid gap-4 lg:grid-cols-[72px_1fr_300px]">
        <Card title="">
          <div className="flex flex-col gap-2">
            {[
              { id: 'bbox' as const, icon: BoxSelect, label: 'Bounding box' },
              { id: 'polygon' as const, icon: Pentagon, label: 'Polygon' },
              { id: 'select' as const, icon: MousePointer2, label: 'Select' },
            ].map(item => <button key={item.id} title={item.label} onClick={() => setTool(item.id)} className={`grid h-12 place-items-center rounded-lg border ${tool === item.id ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40' : 'border-gray-200 dark:border-gray-700'}`}><item.icon size={18} /></button>)}
            <button onClick={() => folderRef.current?.click()} title="Load folder" className="grid h-12 place-items-center rounded-lg border border-gray-200 dark:border-gray-700"><Upload size={18} /></button>
            <input ref={folderRef} type="file" accept="image/*" multiple className="hidden" onChange={event => event.target.files && void addFiles(event.target.files)} />
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Input Mode">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <button onClick={() => setMode('image')} className={`rounded border px-3 py-2 font-bold ${mode === 'image' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700'}`}>Images</button>
              <button onClick={() => setMode('video')} className={`inline-flex items-center gap-2 rounded border px-3 py-2 font-bold ${mode === 'video' ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-700'}`}><Video size={14} /> Video</button>
              {mode === 'video' && (
                <>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-gray-200 px-3 py-2 font-bold dark:border-gray-700">
                    Upload video
                    <input type="file" accept="video/*" className="hidden" onChange={event => loadVideo(event.target.files?.[0])} />
                  </label>
                  <label className="inline-flex items-center gap-2 font-bold text-gray-600 dark:text-gray-300">Every
                    <select value={frameInterval} onChange={event => setFrameInterval(Number(event.target.value))} className="rounded border border-gray-200 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-900">
                      {[1, 2, 5, 10].map(value => <option key={value} value={value}>{value}s</option>)}
                    </select>
                  </label>
                  <button onClick={() => void extractFrames()} disabled={!videoUrl} className="rounded bg-emerald-600 px-3 py-2 font-bold text-white disabled:opacity-50">Extract frames</button>
                </>
              )}
            </div>
            {mode === 'video' && videoUrl && <video ref={videoRef} src={videoUrl} controls className="mt-3 max-h-72 w-full rounded bg-black" />}
          </Card>

          <Card title="Canvas" subtitle={current ? `${currentIndex + 1} / ${images.length} - ${current.filename}` : 'Drop images here or upload a folder'}>
            <div
              onDragOver={event => event.preventDefault()}
              onDrop={event => {
                event.preventDefault();
                void addFiles(event.dataTransfer.files);
              }}
              className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-950"
            >
              {current ? (
                <canvas
                  ref={canvasRef}
                  className="max-h-[600px] max-w-full rounded bg-white shadow dark:bg-gray-900"
                  onMouseDown={event => {
                    if (!current) return;
                    const point = imagePointFromEvent(event);
                    if (tool === 'bbox') setDraftBox({ start: point, end: point });
                    if (tool === 'select') {
                      const found = [...current.annotations].reverse().find(annotation => pointInAnnotation(annotation, point, current));
                      setSelectedId(found?.id ?? null);
                    }
                  }}
                  onMouseMove={event => {
                    const point = imagePointFromEvent(event);
                    setCursorPoint(point);
                    if (draftBox) setDraftBox({ ...draftBox, end: point });
                  }}
                  onMouseUp={() => {
                    if (!current || !draftBox) return;
                    const x1 = Math.min(draftBox.start.x, draftBox.end.x);
                    const y1 = Math.min(draftBox.start.y, draftBox.end.y);
                    const w = Math.abs(draftBox.end.x - draftBox.start.x);
                    const h = Math.abs(draftBox.end.y - draftBox.start.y);
                    if (w > 10 && h > 10) addAnnotation({ id: `ann_${Date.now()}`, classId: activeClassId, type: 'bbox', x: x1 / current.width, y: y1 / current.height, w: w / current.width, h: h / current.height });
                    setDraftBox(null);
                  }}
                  onClick={event => {
                    if (tool === 'polygon') setPolygonPoints(points => [...points, imagePointFromEvent(event)]);
                  }}
                  onDoubleClick={finishPolygon}
                />
              ) : <p className="text-sm text-gray-500">Upload or drag image files here.</p>}
            </div>
          </Card>

          <Card title="Annotations">
            <div className="flex flex-wrap gap-2">
              {current?.annotations.map(annotation => {
                const cls = classes.find(item => item.id === annotation.classId) ?? classes[0];
                return <button key={annotation.id} onClick={() => setSelectedId(annotation.id)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${selectedId === annotation.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40' : 'border-gray-200 dark:border-gray-700'}`}><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cls.color }} />{cls.name}<Trash2 size={12} onClick={event => { event.stopPropagation(); updateCurrent(image => ({ ...image, annotations: image.annotations.filter(item => item.id !== annotation.id) })); }} /></button>;
              })}
              {!current?.annotations.length && <p className="text-sm text-gray-500">No annotations on this image.</p>}
            </div>
          </Card>

          <Card title="Filmstrip">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => <button key={image.id} onClick={() => setCurrentIndex(index)} className={`relative h-[60px] w-[80px] shrink-0 overflow-hidden rounded border ${index === currentIndex ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 dark:border-gray-700'}`}><img src={image.url} alt="" className="h-full w-full object-cover" />{image.annotations.length > 0 && <span className="absolute bottom-1 right-1 rounded bg-green-600 px-1 text-[10px] font-bold text-white">{image.annotations.length}</span>}</button>)}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Classes" actions={<button onClick={() => {
            const name = newClassName.trim() || `class ${classes.length + 1}`;
            const cls = { id: `class_${Date.now()}`, name, color: PALETTE[classes.length % PALETTE.length] };
            setClasses(currentClasses => [...currentClasses, cls]);
            setActiveClassId(cls.id);
            setNewClassName('');
          }} className="rounded border border-gray-200 px-2 py-1 text-xs dark:border-gray-700"><Plus size={12} /></button>}>
            <input value={newClassName} onChange={event => setNewClassName(event.target.value)} placeholder="New class name" className="mb-3 min-h-10 w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" />
            <div className="space-y-2">
              {classes.map(cls => <button key={cls.id} onClick={() => setActiveClassId(cls.id)} className={`flex min-h-10 w-full items-center gap-2 rounded border px-3 py-2 text-left text-sm ${activeClassId === cls.id ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-gray-200 dark:border-gray-700'}`}><span className="h-4 w-4 rounded" style={{ backgroundColor: cls.color }} /><span className="flex-1 font-semibold">{cls.name}</span><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{classCounts[cls.id] ?? 0}</span></button>)}
            </div>
          </Card>

          <Card title="Progress">
            <p className="text-sm font-semibold">Annotated: {annotatedCount} / {images.length} images</p>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full bg-green-500" style={{ width: `${images.length ? (annotatedCount / images.length) * 100 : 0}%` }} /></div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm">
              <div className="rounded bg-gray-50 p-3 dark:bg-gray-900"><p className="text-xs text-gray-500">Total annotations</p><p className="text-xl font-black">{images.reduce((sum, image) => sum + image.annotations.length, 0)}</p></div>
              <div className="rounded bg-gray-50 p-3 dark:bg-gray-900"><p className="text-xs text-gray-500">Empty images</p><p className={`text-xl font-black ${images.length && (images.length - annotatedCount) / images.length > 0.3 ? 'text-red-600' : ''}`}>{images.length - annotatedCount}</p></div>
            </div>
          </Card>

          <Card title="Export">
            <div className="grid gap-2">
              <button onClick={exportCoco} className="inline-flex min-h-10 items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white"><Download size={14} /> Export COCO JSON</button>
              <button onClick={exportYolo} className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700"><Download size={14} /> Export YOLO TXT Map</button>
              <button onClick={exportCsv} className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700"><Download size={14} /> Export Labels CSV</button>
            </div>
          </Card>

          <InfoBox type="info">{message}</InfoBox>
        </div>
      </div>
    </div>
  );
}
