// project/api/klines.ts
export const config = { runtime: "edge" };
import { Redis } from "@upstash/redis";
import { strFromU8, decompressSync } from "fflate";

/* -------------------- utils: coercion & decoding -------------------- */
type HScanTuple = readonly [number | string, string[]];

async function hscanTyped(
  redis: Redis,
  key: string,
  cursor: number,
  opts: { match?: string; count?: number }
): Promise<[number, string[]]> {
  const res = (await (redis as any).hscan(key, cursor, opts)) as unknown as HScanTuple;
  const next = typeof res[0] === "string" ? parseInt(res[0], 10) : res[0];
  const arr = res[1] ?? [];
  return [next, arr];
}

// 어떤 타입이 와도 문자열로 강제 변환
function asString(x: unknown): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (x instanceof Uint8Array) return strFromU8(x);
  try {
    return String(x);
  } catch {
    return "";
  }
}

// base64 → Uint8Array
function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// 문자열 입력만 대상으로: 압축/평문 판별
function toPlainJsonText(
  inputRaw: string
): { text: string; decoded: "plain" | "b64+zlib" | "unknown" } {
  const input = asString(inputRaw);
  const trimmed = input.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return { text: input, decoded: "plain" };
  }
  try {
    const maybeB64 = /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed) && trimmed.length > 64;
    if (maybeB64) {
      const raw = decompressSync(b64ToU8(trimmed)); // zlib
      return { text: strFromU8(raw), decoded: "b64+zlib" };
    }
  } catch {
    // ignore
  }
  return { text: input, decoded: "unknown" };
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    status,
  });
}

/* -------------------- KST helpers -------------------- */

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3600 * 1000;

// KST 오늘 기준 n일 목록 (YYYY-MM-DD)
function lastNDaysKST(n: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  const kstNow = now + KST_OFFSET_MS;
  const kstMidnight = Math.floor(kstNow / DAY_MS) * DAY_MS; // KST 자정(ms)
  for (let i = 0; i < n; i++) {
    const d = new Date(kstMidnight - i * DAY_MS);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${dd}`);
  }
  return out;
}

/* -------------------- signals loader (HSCAN by day) -------------------- */

// trading:signal 해시에서 날짜별로 HSCAN하여 symbol 매칭된 신호를 모아 반환
async function loadSignals(
  redis: Redis,
  symbol: string,
  days: number
): Promise<any[]> {
  const key = "trading:signal"; // 해시: field = "YYYY-MM-DD|<id>", value = JSON string
  const wantedDays: string[] = lastNDaysKST(days);

  const collected: any[] = [];
  for (const d of wantedDays) {
    let cursor: number = 0;
    const match: string = `${d}|*`;

    do {
      // Upstash hscan: Promise<[cursor: number, arr: string[]]>
      const [next, arr] = await hscanTyped(redis, key, cursor, { match, count: 1000 });


      cursor = next;

      // arr = [field, value, field, value, ...]
      for (let i = 0; i + 1 < arr.length; i += 2) {
        const valueStr: string = arr[i + 1] ?? "";
        if (!valueStr) continue;
        try {
          const obj = JSON.parse(valueStr);
          if (!obj || obj.symbol !== symbol) continue;
          collected.push(obj);
        } catch {
          // ignore invalid JSON
        }
      }
    } while (cursor !== 0);
  }

  collected.sort(
    (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
  );
  return collected;
}

/* -------------------- handler -------------------- */

export default async function handler(req: Request): Promise<Response> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return json(
      { retCode: -1, retMsg: "Env missing", _debug: { url, hasToken: !!token } },
      500
    );
  }

  const redis = new Redis({ url, token });

  try {
    const { searchParams } = new URL(req.url);
    const symbol: string = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
    const interval: string = searchParams.get("interval") || "1";
    const limit: number = Math.min(
      Number(searchParams.get("limit") || "300"),
      10080
    );

    // 신호 동봉 옵션
    const withSignals: boolean =
      (searchParams.get("withSignals") || "0") === "1";
    const days: number = Math.min(
      Math.max(parseInt(searchParams.get("days") || "7", 10) || 7, 1),
      30
    );

    const key = `kline:${interval}:json`;
    const rawVal: unknown = await redis.hget(key, symbol);

    const [updatedAt, schemaVersion] = await Promise.all([
      redis.hget<string>(key, "__updated_at").catch(() => null),
      redis.hget<string>(key, "__schema_version").catch(() => null),
    ]);

    let parsed: any[] | null = null;
    let decoded: "plain" | "b64+zlib" | "unknown" | "object" = "unknown";
    let parseError: string | null = null;
    let sampleTextPrefix: string | undefined;

    if (rawVal == null) {
      // 그래도 signals는 옵션이면 가져오자
      const signals = withSignals ? await loadSignals(redis, symbol, days) : [];
      return json({
        retCode: 0,
        list: [],
        signals,
        _debug: { key, symbol, interval, updatedAt, schemaVersion, reason: "raw=null" },
      });
    }

    // 1) Upstash 클라이언트가 객체/배열로 돌려준 케이스
    if (Array.isArray(rawVal)) {
      parsed = rawVal as any[];
      decoded = "object";
    } else if (typeof rawVal === "object") {
      // 안전하게 직렬화 후 파싱 (순수 객체 배열일 때)
      try {
        parsed = JSON.parse(JSON.stringify(rawVal));
        decoded = "object";
      } catch (e: any) {
        parseError = e?.message || String(e);
      }
    }

    // 2) 문자열로 온 케이스 (압축/평문 처리)
    if (!parsed) {
      const asStr: string = asString(rawVal as any);
      const res = toPlainJsonText(asStr);
      decoded = res.decoded;
      sampleTextPrefix = res.text.slice(0, 80);
      try {
        parsed = JSON.parse(res.text);
      } catch (e: any) {
        parseError = e?.message || String(e);
      }
    }

    if (!Array.isArray(parsed)) {
      const signals = withSignals ? await loadSignals(redis, symbol, days) : [];
      return json({
        retCode: 0,
        list: [],
        signals,
        _debug: {
          key,
          symbol,
          interval,
          updatedAt,
          schemaVersion,
          decoded,
          parseError,
          sampleTextPrefix,
          typeofRaw: typeof rawVal,
        },
      });
    }

    const list = parsed.slice(-limit).map((r: any) => ({
      time: Number(r.time),
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
    }));

    const signals = withSignals ? await loadSignals(redis, symbol, days) : [];

    return json({
      retCode: 0,
      list,
      signals,
      _debug: {
        key,
        symbol,
        interval,
        updatedAt,
        schemaVersion,
        decoded,
        totalLen: parsed.length,
        returned: list.length,
        withSignals,
        days,
      },
    });
  } catch (e: any) {
    return json({ retCode: -1, retMsg: e?.message || "server error" }, 500);
  }
}
