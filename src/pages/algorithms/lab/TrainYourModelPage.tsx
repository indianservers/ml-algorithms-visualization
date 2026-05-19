import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Boxes, Camera, Hand, Mic, Network, Trash2 } from 'lucide-react';
import { PageHeader } from '../../../components/common/PageHeader';
import { Card, InfoBox } from '../../../components/common/Card';
import { deleteModelMetadata, loadModelMetadata, type SavedModelMetadata } from '../../../stores/experimentStore';

const launchers = [
  {
    title: 'Image Model',
    icon: Camera,
    route: '/ml/computer-vision/image-classification',
    description: 'Train a custom image classifier using your webcam or uploaded photos. Uses MobileNet transfer learning and trains in seconds.',
    capabilities: ['Live webcam capture', '2-10 classes', 'Exports TFjs model'],
    color: 'from-blue-600 to-cyan-500',
  },
  {
    title: 'Audio Model',
    icon: Mic,
    route: '/ml/computer-vision/audio-classification',
    description: 'Record audio clips per class and train a sound classifier for keywords, claps, instruments, or distinct sounds.',
    capabilities: ['Mel spectrogram features', '2-8 classes', 'Live prediction'],
    color: 'from-purple-600 to-fuchsia-500',
  },
  {
    title: 'Pose Model',
    icon: Activity,
    route: '/ml/computer-vision/pose-detection',
    description: 'Capture body poses via webcam and train a pose classifier for yoga poses, gestures, or exercises in real time.',
    capabilities: ['MoveNet keypoints', '2-6 classes', 'Skeleton overlay'],
    color: 'from-emerald-600 to-lime-500',
  },
];

const advancedLinks = [
  { label: 'Hand Gesture Model', route: '/ml/computer-vision/hand-gesture-recognition', icon: Hand },
  { label: 'Object Detection', route: '/ml/computer-vision/object-detection-demo', icon: Boxes },
  { label: 'Custom Neural Net', route: '/ml/deep-learning/nn-playground', icon: Network },
];

function metricValue(model: SavedModelMetadata, key: string) {
  const value = model.metrics?.[key];
  return typeof value === 'number' ? value : undefined;
}

export default function TrainYourModelPage() {
  const [models, setModels] = useState<SavedModelMetadata[]>([]);

  useEffect(() => {
    void loadModelMetadata().then(items => setModels(items.sort((a, b) => b.savedAt - a.savedAt)));
  }, []);

  const removeModel = async (id: string) => {
    await deleteModelMetadata(id);
    setModels(current => current.filter(model => model.id !== id));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4">
      <PageHeader
        title="Train Your Model"
        subtitle="A browser-only training hub for image, audio, and pose models. No backend, no installation, no account."
        badge="Browser Trainable"
        category="Lab"
        icon={<Activity size={22} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {launchers.map(item => {
          const Icon = item.icon;
          return (
            <Card key={item.title} title="">
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-white shadow-sm`}>
                <Icon size={24} />
              </div>
              <h2 className="text-2xl font-black text-gray-950 dark:text-gray-50">{item.title}</h2>
              <p className="mt-2 min-h-20 text-sm leading-6 text-gray-600 dark:text-gray-300">{item.description}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {item.capabilities.map(capability => (
                  <li key={capability} className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {capability}
                  </li>
                ))}
              </ul>
              <Link to={item.route} className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-gray-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950">
                Get Started →
              </Link>
            </Card>
          );
        })}
      </div>

      <Card title="Advanced Training">
        <div className="grid gap-3 md:grid-cols-3">
          {advancedLinks.map(item => {
            const Icon = item.icon;
            return (
              <Link key={item.route} to={item.route} className="flex items-center justify-between rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900">
                <span className="flex items-center gap-3 font-semibold text-gray-900 dark:text-gray-100">
                  <Icon size={18} />
                  {item.label}
                </span>
                <span className="text-gray-400">→</span>
              </Link>
            );
          })}
        </div>
      </Card>

      <Card title="Recently Trained Models" subtitle="Saved metadata from browser-local IndexedDB">
        {models.length === 0 ? (
          <InfoBox type="info">
            No saved model metadata yet. Train and save a model from an image, audio, pose, or lab page and it will appear here.
          </InfoBox>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {models.slice(0, 9).map(model => {
              const accuracy = metricValue(model, 'accuracy') ?? metricValue(model, 'acc') ?? metricValue(model, 'val_acc');
              const classCount = Number(model.parameters.classCount ?? model.parameters.classes ?? model.parameters.labels ?? 0);
              return (
                <div key={model.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-gray-950 dark:text-gray-50">{model.name}</h3>
                      <p className="text-xs text-gray-500">{model.algorithmName}</p>
                    </div>
                    <button onClick={() => void removeModel(model.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" title="Delete model metadata">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900">
                      <p className="text-gray-500">Modality</p>
                      <p className="font-bold">{String(model.parameters.modality ?? model.algorithmId).split('/').at(-1)}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900">
                      <p className="text-gray-500">Classes</p>
                      <p className="font-bold">{classCount || 'n/a'}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900">
                      <p className="text-gray-500">Accuracy</p>
                      <p className="font-bold">{accuracy === undefined ? 'n/a' : `${(accuracy * 100).toFixed(1)}%`}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">{new Date(model.savedAt).toLocaleString()}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
