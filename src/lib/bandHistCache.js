// src/lib/bandHistCache.js
// z-밴드 7일 히스토리(닫힌 1분봉) IndexedDB 캐시 — TTL 지나면 소멸.
// 과거봉은 불변이므로 (source, symbol, 윈도우 start) 키로 통째 저장해 재방문 시 fetch 생략.
// localStorage는 용량(5MB) 부족(심볼당 ~10080봉) → IndexedDB 사용. 실패 시 조용히 no-op(캐시는 최적화일 뿐).

const DB_NAME = "chartBandCache";
const STORE = "bandHist";
const DB_VER = 1;
export const BAND_HIST_TTL_MS = 8 * 24 * 3600 * 1000; // 8일 후 소멸

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
  return dbPromise;
}

/** 만료 항목 일괄 삭제(앱당 1회면 충분). */
let pruned = false;
export async function bandHistPrune() {
  if (pruned) return;
  pruned = true;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const now = Date.now();
    const req = store.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return;
      if (Number(cur.value?.expireAt || 0) < now) cur.delete();
      cur.continue();
    };
  } catch {}
}

/** @returns bars 배열 또는 null(미스/만료/실패) */
export async function bandHistGet(key) {
  bandHistPrune(); // 첫 호출 시 만료 항목 정리(비동기, 결과 안 기다림)
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = req.result;
        if (!v || Number(v.expireAt || 0) < Date.now() || !Array.isArray(v.bars)) {
          resolve(null);
        } else {
          resolve(v.bars);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function bandHistSet(key, bars, ttlMs = BAND_HIST_TTL_MS) {
  try {
    if (!Array.isArray(bars) || !bars.length) return;
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
      key,
      savedAt: Date.now(),
      expireAt: Date.now() + ttlMs,
      bars,
    });
  } catch {}
}
