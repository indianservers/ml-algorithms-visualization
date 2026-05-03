export type DataRow = Record<string, unknown>;

export interface ColumnProfile {
  name: string;
  type: 'numeric' | 'categorical' | 'empty' | 'mixed';
  missing: number;
  unique: number;
  outliers: number;
  constant: boolean;
  likelyId: boolean;
  mean?: number;
}

export interface DatasetProfile {
  rows: number;
  columns: number;
  missing: number;
  duplicates: number;
  numericColumns: string[];
  categoricalColumns: string[];
  columnsProfile: ColumnProfile[];
}

const isMissing = (value: unknown) => value === null || value === undefined || value === '';
const asNumber = (value: unknown) => typeof value === 'number' ? value : Number(value);

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

export function profileDataset(rows: DataRow[], target?: string): DatasetProfile {
  const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const rowKeys = rows.map(row => JSON.stringify(columns.map(column => row[column] ?? null)));
  const duplicates = rowKeys.length - new Set(rowKeys).size;
  const columnsProfile = columns.map(name => {
    const values = rows.map(row => row[name]);
    const present = values.filter(value => !isMissing(value));
    const numeric = present.map(asNumber).filter(Number.isFinite);
    const unique = new Set(present.map(value => String(value))).size;
    const missing = values.length - present.length;
    const numericShare = present.length ? numeric.length / present.length : 0;
    const type: ColumnProfile['type'] = present.length === 0
      ? 'empty'
      : numericShare > 0.9
        ? 'numeric'
        : numericShare < 0.1
          ? 'categorical'
          : 'mixed';
    const q1 = quantile(numeric, 0.25);
    const q3 = quantile(numeric, 0.75);
    const iqr = q3 - q1;
    const outliers = type === 'numeric' && iqr > 0
      ? numeric.filter(value => value < q1 - 1.5 * iqr || value > q3 + 1.5 * iqr).length
      : 0;
    const nameLower = name.toLowerCase();
    return {
      name,
      type,
      missing,
      unique,
      outliers,
      constant: unique <= 1 && present.length > 0,
      likelyId: name !== target && (nameLower === 'id' || nameLower.endsWith('_id') || unique === rows.length),
      mean: numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : undefined,
    };
  });

  return {
    rows: rows.length,
    columns: columns.length,
    missing: columnsProfile.reduce((sum, column) => sum + column.missing, 0),
    duplicates,
    numericColumns: columnsProfile.filter(column => column.type === 'numeric').map(column => column.name),
    categoricalColumns: columnsProfile.filter(column => column.type === 'categorical').map(column => column.name),
    columnsProfile,
  };
}

export function validateDataset(rows: DataRow[], features: string[], target?: string) {
  const profile = profileDataset(rows, target);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (rows.length < 8) errors.push('Dataset needs at least 8 rows for a meaningful train/test split.');
  if (!features.length) errors.push('Select at least one feature column.');
  if (target && !profile.columnsProfile.some(column => column.name === target)) errors.push(`Target column "${target}" was not found.`);
  features.forEach(feature => {
    const column = profile.columnsProfile.find(item => item.name === feature);
    if (!column) errors.push(`Feature "${feature}" was not found.`);
    if (column?.type !== 'numeric') errors.push(`Feature "${feature}" must be numeric for this browser model.`);
    if (column?.constant) warnings.push(`Feature "${feature}" is constant and cannot help the model.`);
    if (column?.likelyId) warnings.push(`Feature "${feature}" looks like an ID column. IDs often cause leakage or memorization.`);
    if (target && feature.toLowerCase().includes(target.toLowerCase())) warnings.push(`Feature "${feature}" looks target-like and may leak answer information.`);
  });
  if (profile.duplicates > 0) warnings.push(`${profile.duplicates} duplicate row(s) detected.`);
  if (profile.missing > 0) warnings.push(`${profile.missing} missing value(s) detected.`);
  return { profile, errors, warnings };
}
