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

function signalKey(name: string): string {
  const n = (name || "bybit").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(n)) throw new Error("Invalid name");
  return `trading:${n}:signal`;
}

type SignalOut = {
  ts?: string;
  symbol?: string;
  side?: string;
  kind?: string;
  extra?: { ts_ms?: number };
  timeSec?: number;
  _field?: string;
  [k: string]: any;
};

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
    const keyMain = signalKey(name);
    const keyTime = `${keyMain}:time`;

    const symbolParam = searchParams.get("symbol")?.toUpperCase();
    const sideParam = searchParams.get("side")?.toUpperCase();
    const kindParam = searchParams.get("kind")?.toUpperCase();

    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "7", 10) || 7, 1), 365);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const limitParam = parseInt(searchParams.get("limit") || "0", 10);
    const limit = isNaN(limitParam) ? 0 : limitParam;

    const nowMs = Date.now();
    const fromMs = fromParam ? new Date(fromParam).getTime() : (toParam ? 0 : nowMs - days * DAY_MS);
    const toMs = toParam ? new Date(toParam).getTime() : nowMs;

    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      return json({ retCode: -1, retMsg: "Invalid from/to" }, 400);
    }

    // 1) ZSET: field 목록
    const fieldsRaw = await redis.zrange(keyTime, fromMs, toMs, { byScore: true });
    const fields: string[] = Array.isArray(fieldsRaw)
      ? fieldsRaw.map((v) => (typeof v === "string" ? v : String(v)))
      : [];

    if (fields.length === 0) {
      return json({ retCode: 0, signals: [] });
    }

    // 2) HASH: body들 (edge에서 hmget 불안정 케이스 회피: hget 병렬)
    const valuesRaw = await Promise.all(fields.map((f) => redis.hget(keyMain, f)));
    const values: (string | null)[] = valuesRaw.map((v) => {
      if (v == null) return null;
      if (typeof v === "string") return v;
      try { return JSON.stringify(v); } catch { return String(v); }
    });

    const signals: SignalOut[] = [];
    let parseErrors = 0;

    for (let i = 0; i < values.length; i++) {
      const raw = values[i];
      if (!raw) continue;

      try {
        const obj = JSON.parse(raw) as SignalOut;

        if (symbolParam && String(obj.symbol || "").toUpperCase() !== symbolParam) continue;
        if (sideParam && String(obj.side || "").toUpperCase() !== sideParam) continue;
        if (kindParam && String(obj.kind || "").toUpperCase() !== kindParam) continue;

        const tsMs = obj?.extra?.ts_ms;
        const timeSec =
          typeof tsMs === "number" && Number.isFinite(tsMs)
            ? Math.floor(tsMs / 1000)
            : obj.ts
              ? Math.floor(new Date(String(obj.ts)).getTime() / 1000)
              : undefined;

        signals.push({ ...obj, timeSec, _field: fields[i] });
      } catch {
        parseErrors++;
      }
    }

    signals.sort((a, b) => (Number(a.timeSec) || 0) - (Number(b.timeSec) || 0));
    const result = limit > 0 ? signals.slice(-limit) : signals;

    const nonNullValues = values.reduce((acc, v) => acc + (v ? 1 : 0), 0);

    const payload: any = { retCode: 0, signals: result };

    if (debugOn) {
      payload._debug = {
        name,
        keyMain,
        keyTime,
        fromMs,
        toMs,
        requested: fields.length,
        nonNullValues,
        returned: result.length,
        parseErrors,
      };
    }

    return json(payload);
  } catch (e: any) {
    const msg = e?.message || "server error";
    const status = msg === "Invalid name" ? 400 : 500;
    return json({ retCode: -1, retMsg: msg }, status);
  }
}
