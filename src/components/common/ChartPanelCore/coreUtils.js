// src/components/common/ChartPanelCore/coreUtils.js

export const ONE_DAY_SEC = 86400;
export const MA_BUF = 99;
export const MAX_1M_BARS = 43200;

// ✅ digits cache (ChartPanelCore 전용)
export const digitsCache = new Map(); // key: `${sourceKey}|${symbol}` -> digits

export function clampDigits(d) {
  if (!Number.isFinite(d)) return null;
  return Math.min(Math.max(Math.floor(d), 0), 8);
}

// raw string 기준으로 소수점 자리 수 보존(중요)
function countDecimalsFromRaw(v) {
  if (v == null) return 0;
  const s = String(v);
  const dot = s.indexOf(".");
  if (dot < 0) return 0;
  return s.slice(dot + 1).length;
}

export function inferDigitsFromRows(rows, fallback = 2, { sample = 400, maxDigits = 8 } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return fallback;

  let d = 0;
  const start = Math.max(0, rows.length - sample);
  for (let i = start; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    d = Math.max(
      d,
      countDecimalsFromRaw(r?.[1]),
      countDecimalsFromRaw(r?.[2]),
      countDecimalsFromRaw(r?.[3]),
      countDecimalsFromRaw(r?.[4])
    );
    if (d >= maxDigits) break;
  }

  d = clampDigits(d);
  return Number.isFinite(d) ? d : fallback;
}

// WS bar(Number)용 보조 추정 (rows가 최우선)
function countDecimalsSmart(x) {
  if (x == null) return 0;
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;

  const s = String(n);
  if (s.includes("e") || s.includes("E")) {
    const ss = n.toFixed(12).replace(/0+$/, "");
    const dot = ss.indexOf(".");
    return dot >= 0 ? ss.length - dot - 1 : 0;
  }

  const dot = s.indexOf(".");
  if (dot < 0) return 0;

  const frac = s.slice(dot + 1).replace(/0+$/, "");
  return frac.length;
}

export function inferDigitsFromBar(bar) {
  if (!bar) return null;
  const d = Math.max(
    countDecimalsSmart(bar.open),
    countDecimalsSmart(bar.high),
    countDecimalsSmart(bar.low),
    countDecimalsSmart(bar.close)
  );
  return clampDigits(d);
}

/** ------------------------- day window ------------------------- **/
export function getDayWindowByOffset(anchorEndUtcSec, offsetDays = 0) {
  const end = Number(anchorEndUtcSec) + Number(offsetDays) * ONE_DAY_SEC;
  return [end - ONE_DAY_SEC, end];
}

export function rowsToBars(rows) {
  return (rows || [])
    .filter((r) => r && r[0] != null && r[1] != null && r[2] != null && r[3] != null && r[4] != null)
    .map((r) => ({
      time: Math.floor(Number(r[0]) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
    }))
    .sort((a, b) => a.time - b.time);
}

// ✅ getCachedRows가 rows/bars 둘 다일 가능성 방어
export function normalizeCachedToBars(cached) {
  if (!cached) return [];
  const first = cached?.[0];

  // rows: [ [ts, o, h, l, c, ...], ... ]
  if (Array.isArray(first)) return rowsToBars(cached);

  // bars: [ {time, open, high, low, close}, ... ]
  if (typeof first === "object" && first?.time != null) {
    return cached
      .map((b) => ({
        time: Number(b.time),
        open: b.open != null ? Number(b.open) : undefined,
        high: b.high != null ? Number(b.high) : undefined,
        low: b.low != null ? Number(b.low) : undefined,
        close: b.close != null ? Number(b.close) : undefined,
      }))
      .filter((b) => Number.isFinite(b.time))
      .sort((a, b) => a.time - b.time);
  }

  return [];
}