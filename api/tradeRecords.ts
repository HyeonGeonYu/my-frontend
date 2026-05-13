// api/tradeRecords.ts
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
const DEFAULT_NS = "agent:CopyZannavi:u7c9f14d2a1:BYBIT";

function streamIdFromMs(ms: number): string {
  return `${ms}-0`;
}

function streamIdToMs(ms: number): string {
  return `${ms}-999999`;
}

function parseStreamEntryValue(value: any): Record<string, any> {
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

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function strOrEmpty(x: any): string {
  if (x === null || x === undefined) return "";
  return String(x);
}

function safeNs(ns: string): string {
  const s = String(ns || DEFAULT_NS).trim();

  // agent:CopyZannavi:u7c9f14d2a1:BYBIT 허용
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(s)) {
    throw new Error("Invalid ns");
  }

  return s;
}

function toUpperOrUndef(x: string | null): string | undefined {
  return x ? x.toUpperCase() : undefined;
}

function getSignalKey(msg: Record<string, any>, id: string): string {
  return String(
    msg.signal_id ||
      msg.exit_signal_id ||
      msg.entry_signal_id ||
      msg.close_open_signal_id ||
      id ||
      ""
  );
}

function getTsMs(msg: Record<string, any>, id: string): number | undefined {
  const fromField =
    numOrNull(msg.ts_ms) ??
    numOrNull(msg.timestamp_ms) ??
    numOrNull(msg.saved_ts_ms);

  if (fromField !== null) return fromField;

  const fromId = id && id.includes("-") ? Number(id.split("-")[0]) : undefined;
  return typeof fromId === "number" && Number.isFinite(fromId) ? fromId : undefined;
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

    const ns = safeNs(searchParams.get("ns") || DEFAULT_NS);
    const keyStream = `trading:${ns}:trade_records`;

    const symbolParam = toUpperOrUndef(searchParams.get("symbol"));
    const sideParam = toUpperOrUndef(searchParams.get("side"));
    const kindParam = toUpperOrUndef(searchParams.get("kind"));

    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "10", 10) || 10, 1), 30);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const limitParam = parseInt(searchParams.get("limit") || "1000", 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 5000) : 1000;

    const nowMs = Date.now();
    const fromMs = fromParam ? new Date(fromParam).getTime() : nowMs - days * DAY_MS;
    const toMs = toParam ? new Date(toParam).getTime() : nowMs;

    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
      return json({ retCode: -1, retMsg: "Invalid from/to" }, 400);
    }

    const fromId = streamIdFromMs(fromMs);
    const toId = streamIdToMs(toMs);

    const raw = await redis.xrange(keyStream, fromId, toId, limit);

    const entriesArr: Array<{ id: string; message: any }> = [];

    if (Array.isArray(raw)) {
      for (const ent of raw as any[]) {
        if (ent?.id != null && ent?.message != null) {
          entriesArr.push({ id: String(ent.id), message: ent.message });
          continue;
        }

        if (Array.isArray(ent) && ent.length >= 2) {
          entriesArr.push({ id: String(ent[0]), message: ent[1] });
          continue;
        }
      }
    } else if (raw && typeof raw === "object") {
      for (const [id, message] of Object.entries(raw as Record<string, any>)) {
        entriesArr.push({ id, message });
      }
    }

    const records: any[] = [];
    let filteredOut = 0;

    for (const ent of entriesArr) {
      const id = ent.id;
      const msg = parseStreamEntryValue(ent.message);

      const symbol = msg.symbol ? String(msg.symbol).toUpperCase() : undefined;
      const side = msg.side ? String(msg.side).toUpperCase() : undefined;
      const kind = msg.kind ? String(msg.kind).toUpperCase() : undefined;

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

      const tsMs = getTsMs(msg, id);
      const timeSec = typeof tsMs === "number" && Number.isFinite(tsMs) ? Math.floor(tsMs / 1000) : undefined;

      records.push({
        ...msg,

        _id: id,
        signalKey: getSignalKey(msg, id),

        symbol,
        side,
        kind,

        ts_ms: tsMs,
        timeSec,

        qty: numOrNull(msg.qty),
        price: numOrNull(msg.price),
        entry_price: numOrNull(msg.entry_price),
        exit_price: numOrNull(msg.exit_price),

        gross_pnl_usdt: numOrNull(msg.gross_pnl_usdt),
        fee_usdt: numOrNull(msg.fee_usdt),
        pnl_usdt: numOrNull(msg.pnl_usdt),
      });
    }

    records.sort((a, b) => (Number(a.timeSec) || 0) - (Number(b.timeSec) || 0));

    const payload: any = {
      retCode: 0,
      records,
    };

    if (debugOn) {
      payload._debug = {
        ns,
        keyStream,
        fromMs,
        toMs,
        fromId,
        toId,
        fetched: entriesArr.length,
        filteredOut,
        returned: records.length,
        limit,
        days,
      };
    }

    return json(payload);
  } catch (e: any) {
    const msg = e?.message || "server error";
    const status = msg === "Invalid ns" ? 400 : 500;
    return json({ retCode: -1, retMsg: msg }, status);
  }
}