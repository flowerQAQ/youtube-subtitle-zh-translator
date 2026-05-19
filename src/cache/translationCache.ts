import type { TranslatedCue } from "../shared/types";

const DB_NAME = "youtube-zh-caption-translator";
const STORE_NAME = "translations";
const DB_VERSION = 1;

export async function getCachedTranslation(key: string): Promise<TranslatedCue[] | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(Array.isArray(request.result?.cues) ? request.result.cues as TranslatedCue[] : null);
    request.onerror = () => reject(request.error);
  });
}

export async function setCachedTranslation(key: string, cues: TranslatedCue[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put({
      key,
      cues,
      updatedAt: Date.now()
    });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
