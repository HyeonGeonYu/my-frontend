// project/api/thresholds.ts
export const config = { runtime: "edge" };
import { Redis } from "@upstash/redis";
import { loadTradingConfig } from "./tradingConfig"; // 경로는 프로젝트 구조에 맞게

/* ------------------------- utils ------------------------- */
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    status,
  });
}

function toNumberOrNull(s: unknown): number | null {
  if (s == null) return null;
  const n = typeof s === "string" ? Number(s) : (s as number);
  return Number.isFinite(n) ? n : null;
}

function kvArrayToObject(arr: any[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i + 1 < arr.length; i += 2) {
    const k = String(arr[i]);
    const v = arr[i + 1];
    out[k] =
    v == null
      ? ""
      : typeof v === "string"
        ? v
        : (() => { try { return JSON.stringify(v); } catch { return String(v); } })();
  }
  return out;
}

function normalizeXRev(entries: any[]): Array<{ id: string; fields: Record<string, string> }> {
  const out: Array<{ id: string; fields: Record<string, string> }> = [];
  for (const [id, payload] of Object.entries(entries)) {
    if (!payload) continue;
    if (Array.isArray(payload)) {
      out.push({ id, fields: kvArrayToObject(payload) });
    } else if (typeof payload === "object") {
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
       fields[k] =
         v == null
           ? ""
           : typeof v === "string"
             ? v
             : (() => {
                 try {
                   return JSON.stringify(v);
                 } catch {
                   return String(v);
                 }
               })();
      }
      out.push({ id, fields });
    }
  }
  return out;
}

/* ---------- cross_times 정규화 (문자열/튜플/객체 배열 모두 지원) ---------- */
type CrossItem = { dir: string; time: string; price: number; bid: number; ask: number };

function toNum(n: any): number {
  const v = typeof n === "string" ? Number(n) : (n as number);
  return Number.isFinite(v) ? v : NaN;
}

function    normalizeCrossTimes(input: any): CrossItem[] | null {
  if (input == null || input === "") return null;

  let v: any = input;

  // 문자열이면 JSON 파싱 시도
  if (typeof v === "string") {
    try { v = JSON.parse(v); }
    catch { return null; }
  }

  // 튜플 배열: [(dir, time, price, bid, ask), ...]
  if (Array.isArray(v) && v.length && Array.isArray(v[0])) {
    const out: CrossItem[] = [];
    for (const t of v) {
      const [d, ts, p, b, a] = t as any[];
      const price = toNum(p), bid = toNum(b), ask = toNum(a);
      if (!ts || !Number.isFinite(price) || !Number.isFinite(bid) || !Number.isFinite(ask)) continue;
      out.push({ dir: String(d || "").toUpperCase(), time: String(ts), price, bid, ask });
    }
    return out.length ? out : null;
  }

  // 객체 배열: [{dir,time,price,bid,ask}, ...]
  if (Array.isArray(v)) {
    const out: CrossItem[] = [];
    for (const it of v) {
      if (!it) continue;
      const dir = String(it.dir ?? it.direction ?? "").toUpperCase();
      const time = String(it.time ?? it.ts ?? "");
      const price = toNum(it.price);
      const bid = toNum(it.bid);
      const ask = toNum(it.ask);
      if (!time || !Number.isFinite(price) || !Number.isFinite(bid) || !Number.isFinite(ask)) continue;
      out.push({ dir, time, price, bid, ask });
    }
    return out.length ? out : null;
  }

  return null;
}
// 안전 미리보기: 문자열이면 앞부분만, 객체/배열이면 JSON으로 시도
function preview(v: any, max = 300) {
  try {
    if (typeof v === "string") return v.length > max ? v.slice(0, max) + "…(trunc)" : v;
    if (v && typeof v === "object") {
      const s = JSON.stringify(v);
      return s.length > max ? s.slice(0, max) + "…(trunc)" : s;
    }
    return String(v);
  } catch {
    return String(v);
  }
}

/** Stream(OpenPctLog)에서 (sym 매칭) 항목 중 가장 최근의 new(0~1 fraction) + fields */
async function getLatestFracBySymbol(
  redis: Redis,
  symbol: string,
  searchBack = 500
): Promise<{ value: number; id: string; fields: Record<string, string> } | null> {
  const raw = await (redis as any).xrevrange("OpenPctLog", "+", "-", { count: searchBack });
  const items = normalizeXRev(raw);
  const wantSym = symbol.toUpperCase();

  for (const it of items) {
    const f = it.fields || {};
    const sym = String(f.sym ?? f.SYM ?? f.symbol ?? "").toUpperCase();
    if (sym !== wantSym) continue;

    const v = toNumberOrNull(f.new ?? f.NEW);
    if (v != null) return { value: v, id: it.id, fields: f };
  }
  return null;
}

/* --------------------------- handler --------------------------- */
export default async function handler(req: Request): Promise<Response> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return json({ retCode: -1, retMsg: "Env missing UPSTASH_REDIS_REST_URL/TOKEN" }, 500);
  }

  const redis = new Redis({ url, token });

  try {
    const { searchParams } = new URL(req.url);
    const symbolParam = (searchParams.get("symbol") || "").toUpperCase().trim();
    const debug = searchParams.get("debug") === "1";
    const crossLimitParam = parseInt(searchParams.get("cross_limit") || "0", 10);
    const crossLimit = isNaN(crossLimitParam) ? 0 : crossLimitParam; // 0이면 제한 없음

    if (!symbolParam) return json({ retCode: -1, retMsg: "symbol required" }, 400);

    // 1) trading:config 로드 (nullable 유지)
    const cfg = await loadTradingConfig(redis);

    // 2) 최근 임계치(new, 0~1) — name은 고려하지 않음
    const found = await getLatestFracBySymbol(redis, symbolParam, 500);
    const ma_threshold = found?.value ?? null;

    // 3) momentum_threshold: ma/3 규칙
    const momentum_threshold =
      ma_threshold == null ? null : Number.isFinite(ma_threshold) ? ma_threshold / 3 : null;

    // 4) cross_times 파싱 (없으면 null)
    let cross_times: CrossItem[] | null = null;
    if (found?.fields) {
      const rawCross =
        found.fields.cross_times ??
        found.fields.CROSS_TIMES ??
        found.fields.crossTimes ??
        found.fields.crosstimes;


      cross_times = normalizeCrossTimes(rawCross);
      // 필요 시 최근 N개 제한
      if (cross_times && crossLimit > 0 && cross_times.length > crossLimit) {
        cross_times = cross_times.slice(-crossLimit);
      }
    }

    // 5) 공용 설정 그대로 사용 (값 없으면 null 그대로)
    const exit_threshold = cfg.default_exit_ma_threshold;
    const target_cross = cfg.target_cross;
    const closes_num = cfg.closes_num;

    return json({
      symbol: symbolParam,
      ma_threshold,
      momentum_threshold,
      exit_threshold,
      target_cross,
      closes_num,
      cross_times, // 차트 마커용
      ...(debug ? { _debug: { streamKey: "OpenPctLog", foundId: found?.id || null, crossLimit: crossLimit || null } } : {}),
    });
  } catch (e: any) {
    return json({ retCode: -1, retMsg: e?.message || "server error" }, 500);
  }
}
