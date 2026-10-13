"use client";

const DB_NAME = "tsl-dither";
const STORE_NAME = "source-image";
const KEY = "v2-current";

export type StoredV2SourceImage = {
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

export const saveV2SourceImage = async (file: File): Promise<void> => {
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

export const getV2SourceImage = async (): Promise<StoredV2SourceImage | null> => {
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

export const clearV2SourceImage = async (): Promise<void> => {
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
