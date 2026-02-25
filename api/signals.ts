// api/signals.ts
export const config = { runtime: "edge" };

import { Redis } from "@upstash/redis";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    status,
  });
}

const DAY_MS = 86_400_000;

function nameKey(name: string): string {
  const n = (name || "bybit").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(n)) throw new Error("Invalid name");
  return `trading:${n}`;
}

type SignalOut = {
  signal_id?: string;
  ts_ms?: number;
  symbol?: string;
  side?: string;
  kind?: string;
  price?: number | string;
  reasons_json?: any;

  // ✅ 표준 pnl (없으면 null)
  pnl_pct?: number | null;

  // 호환/기존 필드
  ts?: string;
  extra?: { ts_ms?: number };
  timeSec?: number;

  _id?: string; // stream id
  [k: string]: any;
};

function toUpperOrUndef(x: string | null): string | undefined {
  return x ? x.toUpperCase() : undefined;
}

function streamIdFromMs(ms: number): string {
  return `${ms}-0`;
}
function streamIdToMs(ms: number): string {
  return `${ms}-999999`;
}

function parseStreamEntryValue(value: any): Record<string, any> {
  // Upstash/@upstash/redis 는 환경에 따라 value가:
  // 1) object: { field: value, ... }
  // 2) array: [field1, value1, field2, value2, ...]
  // 로 올 수 있어서 둘 다 처리
  if (!value) return {};
  if (Array.isArray(value)) {
    const obj: Record<string, any> = {};
    for (let i = 0; i + 1 < value.length; i += 2) {
      const k = String(value[i]);
      obj[k] = value[i + 1];
    }
    return obj;
  }
  if (typeof value === "object") return value as Record<string, any>;
  return {};
}

function numOrNull(x: any): number | null {
  if (x === null || x === undefined) return null;
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const s = String(x).trim();
  if (!s) return null;

  // "-0.89" / "-0.89%" 모두 허용
  const m = s.match(/^([+-]?\d+(\.\d+)?)(%)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

// ✅ (옵션) reasons_json에서 pnl=...% 추출 (pnl 미반영 구형 데이터 fallback)
function parsePnlFromReasons(reasons: any): number | null {
  if (!Array.isArray(reasons)) return null;
  for (const r of reasons) {
    const s = String(r);
    const m = s.match(/pnl=([+-]?\d+(\.\d+)?)%/i);
    if (m) {
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

export async function GET(req: Request): Promise<Response> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return json({ retCode: -1, retMsg: "Env missing UPSTASH_REDIS_REST_URL/TOKEN" }, 500);
  }

  const redis = new Redis({ url, token });

  try {
    const { searchParams } = new URL(req.url);
    const debugOn = searchParams.get("debug") === "1";

    const name = searchParams.get("name") || "bybit";
    const base = nameKey(name);
    const keyStream = `${base}:signals`; // ✅ stream key

    // 서버단 필터(선택): 심볼/사이드/종류
    const symbolParam = toUpperOrUndef(searchParams.get("symbol"));
    const sideParam = toUpperOrUndef(searchParams.get("side"));
    const kindParam = toUpperOrUndef(searchParams.get("kind"));

    // ✅ 요청 범위: from/to 또는 days
    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "7", 10) || 7, 1), 365);
    const fromParam = searchParams.get("from"); // ISO or ms parse 가능한 문자열
    const toParam = searchParams.get("to");

    // ✅ limit: 기본 500 (8일치가 500 미만이라는 전제)
    const limitParam = parseInt(searchParams.get("limit") || "500", 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 500;

    const nowMs = Date.now();
    const fromMs = fromParam ? new Date(fromParam).getTime() : toParam ? 0 : nowMs - days * DAY_MS;
    const toMs = toParam ? new Date(toParam).getTime() : nowMs;

    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      return json({ retCode: -1, retMsg: "Invalid from/to" }, 400);
    }

    const fromId = streamIdFromMs(fromMs);
    const toId = streamIdToMs(toMs);

    // ✅ 한번에 가져오기 (최대 500)
    const raw = await redis.xrange(keyStream, fromId, toId, limit);

    // ✅ raw 형태 표준화
    const entriesArr: Array<{ id: string; message: any }> = [];

    if (Array.isArray(raw)) {
      for (const ent of raw as any[]) {
        // { id, message }
        if (ent?.id != null && ent?.message != null) {
          entriesArr.push({ id: String(ent.id), message: ent.message });
          continue;
        }
        // [id, message]
        if (Array.isArray(ent) && ent.length >= 2) {
          entriesArr.push({ id: String(ent[0]), message: ent[1] });
          continue;
        }
      }
    } else if (raw && typeof raw === "object") {
      // { [id]: message }
      for (const [id, message] of Object.entries(raw as Record<string, any>)) {
        entriesArr.push({ id, message });
      }
    }

    if (entriesArr.length === 0) {
      return json({ retCode: 0, signals: [] });
    }

    const signals: SignalOut[] = [];
    let filteredOut = 0;

    for (const ent of entriesArr) {
      const id = ent.id;
      const msg = parseStreamEntryValue(ent.message);

      // ✅ 최소 정규화(대문자)
      const symbol = msg.symbol ? String(msg.symbol).toUpperCase() : undefined;
      const side = msg.side ? String(msg.side).toUpperCase() : undefined;
      const kind = msg.kind ? String(msg.kind).toUpperCase() : undefined;

      // ✅ 선택 필터(요청에 있으면 서버에서 거름)
      if (symbolParam && symbol !== symbolParam) {
        filteredOut++;
        continue;
      }
      if (sideParam && side !== sideParam) {
        filteredOut++;
        continue;
      }
      if (kindParam && kind !== kindParam) {
        filteredOut++;
        continue;
      }

      // ✅ ts_ms 추출: field 우선, 없으면 stream id에서 추정
      const tsMsFromField =
        typeof msg.ts_ms === "number"
          ? msg.ts_ms
          : typeof msg.ts_ms === "string"
          ? Number(msg.ts_ms)
          : undefined;

      const tsMsFromId = id && id.includes("-") ? Number(id.split("-")[0]) : undefined;

      const tsMs =
        typeof tsMsFromField === "number" && Number.isFinite(tsMsFromField)
          ? tsMsFromField
          : typeof tsMsFromId === "number" && Number.isFinite(tsMsFromId)
          ? tsMsFromId
          : undefined;

      const timeSec = typeof tsMs === "number" && Number.isFinite(tsMs) ? Math.floor(tsMs / 1000) : undefined;

      // ✅ pnl 정규화: number|null (없으면 null)
      let pnl_pct: number | null =
        numOrNull(msg.pnl_pct) ?? numOrNull(msg.pnlPct) ?? numOrNull(msg.pnl);

      // ✅ 구형 데이터 fallback: reasons_json에서 pnl=...% 파싱
      if (pnl_pct === null) pnl_pct = parsePnlFromReasons(msg.reasons_json);

      signals.push({
        ...msg,
        symbol,
        side,
        kind,
        ts_ms: tsMs,
        timeSec,
        pnl_pct,
        _id: id,
      });
    }

    // ✅ 안전 정렬(오래된→최신)
    signals.sort((a, b) => (Number(a.timeSec) || 0) - (Number(b.timeSec) || 0));

    const payload: any = { retCode: 0, signals };

    if (debugOn) {
      payload._debug = {
        name,
        keyStream,
        fromMs,
        toMs,
        fromId,
        toId,
        fetched: entriesArr.length,
        filteredOut,
        returned: signals.length,
        limit,
        days,
      };
    }

    return json(payload);
  } catch (e: any) {
    const msg = e?.message || "server error";
    const status = msg === "Invalid name" ? 400 : 500;
    return json({ retCode: -1, retMsg: msg }, status);
  }
}