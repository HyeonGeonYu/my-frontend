// api/klines.ts
export const config = { runtime: "edge" };
import { Redis } from "@upstash/redis";
import { strFromU8, decompressSync } from "fflate";

// 어떤 타입이 와도 문자열로 강제 변환
function asString(x: any): string {
  if (x == null) return "";
  if (typeof x === "string") return x;
  if (x instanceof Uint8Array) return strFromU8(x);
  try { return String(x); } catch { return ""; }
}

// base64 → Uint8Array
function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// 문자열 입력만 대상으로: 압축/평문 판별
function toPlainJsonText(inputRaw: string): { text: string; decoded: "plain" | "b64+zlib" | "unknown" } {
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
  } catch { /* ignore */ }
  return { text: input, decoded: "unknown" };
}

function json(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    status,
  });
}

export default async function handler(req: Request) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return json({ retCode: -1, retMsg: "Env missing", _debug: { url, hasToken: !!token } }, 500);
  }

  const redis = new Redis({ url, token });

  try {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
    const interval = searchParams.get("interval") || "1";
    const limit = Math.min(Number(searchParams.get("limit") || "300"), 1000);

    const key = `kline:${interval}:json`;
    const rawVal: any = await redis.hget(key, symbol);

    const [updatedAt, schemaVersion] = await Promise.all([
      redis.hget<string>(key, "__updated_at").catch(() => null),
      redis.hget<string>(key, "__schema_version").catch(() => null),
    ]);

    let parsed: any[] | null = null;
    let decoded: "plain" | "b64+zlib" | "unknown" | "object" = "unknown";
    let parseError: string | null = null;
    let sampleTextPrefix: string | undefined;

    if (rawVal == null) {
      return json({ retCode: 0, list: [], _debug: { key, symbol, updatedAt, schemaVersion, reason: "raw=null" } });
    }

    // 1) Upstash 클라이언트가 객체/배열로 돌려준 케이스
    if (Array.isArray(rawVal)) {
      parsed = rawVal;
      decoded = "object";
    } else if (rawVal && typeof rawVal === "object") {
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
      const asStr = asString(rawVal);
      const res = toPlainJsonText(asStr);
      decoded = res.decoded;
      sampleTextPrefix = res.text.slice(0, 60);
      try {
        parsed = JSON.parse(res.text);
      } catch (e: any) {
        parseError = e?.message || String(e);
      }
    }

    if (!Array.isArray(parsed)) {
      return json({
        retCode: 0,
        list: [],
        _debug: {
          key,
          symbol,
          updatedAt,
          schemaVersion,
          decoded,
          parseError,
          sampleTextPrefix,
          typeofRaw: typeof rawVal,
        },
      });
    }

    const list = parsed
      .slice(-limit)
      .map((r: any) => ({
        time: Number(r.time),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
      }));

    return json({
      retCode: 0,
      list,
      _debug: {
        key,
        symbol,
        updatedAt,
        schemaVersion,
        decoded,
        totalLen: parsed.length,
        returned: list.length,
      },
    });
  } catch (e: any) {
    return json({ retCode: -1, retMsg: e?.message || "server error" }, 500);
  }
}
