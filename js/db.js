// Lokale opslag (IndexedDB) — alles blijft op het toestel
const DB_NAME = 'schroeven';
const VERSION = 1;

let dbPromise;
function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('jobs', { keyPath: 'id' });
      db.createObjectStore('photos', { keyPath: 'id' }).createIndex('job', 'jobId');
      db.createObjectStore('settings');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
  });
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const jobs = {
  all: () => tx('jobs', 'readonly', (s) => s.getAll()),
  get: (id) => tx('jobs', 'readonly', (s) => s.get(id)),
  put: (job) => tx('jobs', 'readwrite', (s) => s.put({ ...job, updatedAt: Date.now() })),
  async remove(id) {
    const ps = await photos.forJob(id);
    await tx('photos', 'readwrite', (s) => ps.forEach((p) => s.delete(p.id)));
    return tx('jobs', 'readwrite', (s) => s.delete(id));
  },
};

export const photos = {
  forJob: (jobId) => tx('photos', 'readonly', (s) => s.index('job').getAll(jobId)),
  put: (p) => tx('photos', 'readwrite', (s) => s.put(p)),
  remove: (id) => tx('photos', 'readwrite', (s) => s.delete(id)),
};

export const settings = {
  get: (k) => tx('settings', 'readonly', (s) => s.get(k)),
  set: (k, v) => tx('settings', 'readwrite', (s) => s.put(v, k)),
};

// Foto verkleinen tot max 1600 px (JPEG) zodat de opslag niet volloopt
export async function shrinkImage(file, max = 1600, quality = 0.82) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return { dataUrl: c.toDataURL('image/jpeg', quality), width: c.width, height: c.height };
}
