export type CaptureKind = 'image' | 'video';

export interface CaptureItem {
  id: string;
  kind: CaptureKind;
  blob: Blob;
  name: string;
  width: number;
  height: number;
  createdAt: number;
  durationMs?: number;
}

const STORE = 'captures';

let dbName = 'shotinclean';
let dbPromise: Promise<IDBDatabase> | null = null;

/** Each local profile gets its own capture database. */
export function configureHistoryScope(scope: string | null): void {
  const next = scope ? `shotinclean-${scope}` : 'shotinclean';
  if (next === dbName) return;
  dbName = next;
  dbPromise = null;
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Capture history persisted in IndexedDB, like CleanShot's "Open History". */
export const history = {
  put: (item: CaptureItem) => run('readwrite', (s) => s.put(item)),
  get: (id: string) => run<CaptureItem | undefined>('readonly', (s) => s.get(id)),
  remove: (id: string) => run('readwrite', (s) => s.delete(id)),
  clear: () => run('readwrite', (s) => s.clear()),
  async list(): Promise<CaptureItem[]> {
    const items = await run<CaptureItem[]>('readonly', (s) => s.getAll());
    return items.sort((a, b) => b.createdAt - a.createdAt);
  },
};
