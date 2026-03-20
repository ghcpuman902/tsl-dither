"use client";

const DB_NAME = "tsl-dither";
const STORE_NAME = "source-image";
const KEY = "current";

export type StoredSourceImage = {
  blob: Blob;
  filename: string;
};

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
  });

/**
 * Save the current source image to IndexedDB (no size limit).
 * Resolves after the write completes so callers can persist-before-updating UI.
 */
export const saveSourceImage = async (file: File): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const entry = { id: KEY, blob: file, filename: file.name };
    const req = store.put(entry);
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      resolve();
    };
  });
};

/**
 * Get the stored source image from IndexedDB, or null if none.
 */
export const getSourceImage = async (): Promise<StoredSourceImage | null> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(KEY);
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      const row = req.result as { blob: Blob; filename: string } | undefined;
      resolve(row?.blob ? { blob: row.blob, filename: row.filename } : null);
    };
  });
};

/**
 * Remove the stored source image (e.g. when resetting to default).
 */
export const clearSourceImage = async (): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const req = tx.objectStore(STORE_NAME).delete(KEY);
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      resolve();
    };
  });
};
