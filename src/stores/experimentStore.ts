import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

export interface Experiment {
  id: string;
  name: string;
  algorithmId: string;
  algorithmName: string;
  createdAt: number;
  params: Record<string, unknown>;
  metrics: Record<string, number>;
  predictions?: unknown[];
  notes?: string;
}

const DB_NAME = 'ml-suite-db';
const DB_VERSION = 2;
const EXPERIMENTS_STORE = 'experiments';
const DATASETS_STORE = 'datasets';
const MODELS_STORE = 'models';

let dbInstance: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (!dbInstance) {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(EXPERIMENTS_STORE)) {
          const store = db.createObjectStore(EXPERIMENTS_STORE, { keyPath: 'id' });
          store.createIndex('algorithmId', 'algorithmId');
          store.createIndex('createdAt', 'createdAt');
        }
        if (!db.objectStoreNames.contains(DATASETS_STORE)) {
          db.createObjectStore(DATASETS_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(MODELS_STORE)) {
          const store = db.createObjectStore(MODELS_STORE, { keyPath: 'id' });
          store.createIndex('algorithmId', 'algorithmId');
          store.createIndex('savedAt', 'savedAt');
        }
      },
    });
  }
  return dbInstance;
}

export async function saveExperiment(exp: Experiment): Promise<void> {
  const db = await getDB();
  await db.put(EXPERIMENTS_STORE, exp);
}

export async function loadExperiments(): Promise<Experiment[]> {
  const db = await getDB();
  return db.getAll(EXPERIMENTS_STORE);
}

export async function deleteExperiment(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(EXPERIMENTS_STORE, id);
}

export async function loadExperiment(id: string): Promise<Experiment | undefined> {
  const db = await getDB();
  return db.get(EXPERIMENTS_STORE, id);
}

export interface SavedDataset {
  id: string;
  name: string;
  columns: string[];
  data: Record<string, unknown>[];
  savedAt: number;
  tags?: string[];
  favorite?: boolean;
  versions?: Array<{ savedAt: number; rows: number; note: string }>;
}

export async function saveDataset(ds: SavedDataset): Promise<void> {
  const db = await getDB();
  await db.put(DATASETS_STORE, ds);
}

export async function loadDatasets(): Promise<SavedDataset[]> {
  const db = await getDB();
  return db.getAll(DATASETS_STORE);
}

export async function deleteDataset(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(DATASETS_STORE, id);
}

export interface SavedModelMetadata {
  id: string;
  name: string;
  algorithmId: string;
  algorithmName: string;
  savedAt: number;
  parameters: Record<string, unknown>;
  metrics?: Record<string, number>;
  artifactType?: 'metadata' | 'tfjs' | 'onnx' | 'weights';
}

export async function saveModelMetadata(model: SavedModelMetadata): Promise<void> {
  const db = await getDB();
  await db.put(MODELS_STORE, model);
}

export async function loadModelMetadata(): Promise<SavedModelMetadata[]> {
  const db = await getDB();
  return db.getAll(MODELS_STORE);
}

export async function deleteModelMetadata(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(MODELS_STORE, id);
}

export function generateExperimentId(): string {
  return `exp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
