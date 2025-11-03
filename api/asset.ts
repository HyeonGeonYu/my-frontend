// project/api/asset.ts
export const config = { runtime: "edge" };
import { Redis } from "@upstash/redis";

/* ------------------------- utils ------------------------- */
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    status,
  });
}

/** Upstash HSCAN 결과를 [cursor, array]로 정규화 */
type HScanTuple = readonly [number | string, string[]];
async function hscanTyped(
  redis: Redis,
  key: string,
  cursor: number,
  opts: { match?: string; count?: number }
): Promise<[number, string[]]> {
  const res = (await (redis as any).hscan(key, cursor, opts)) as unknown as HScanTuple;
  const next = typeof res[0] === "string" ? parseInt(res[0], 10) : (res[0] as number);
  const arr = (res[1] ?? []) as string[];
  return [isNaN(next) ? 0 : next, arr];
}

/** positions 필드(JSON 문자열 또는 "[]") 파싱 → null | {LONG,SHORT} */
function parsePositionVal(s: unknown): { LONG: any | null; SHORT: any | null } | null {
  if (s == null) return null;

  // 1) 이미 객체로 역직렬화된 경우 (Upstash 자동 JSON 파싱)
  if (typeof s === "object") {
    const obj = s as any;
    const LONG = obj?.LONG ?? null;
    const SHORT = obj?.SHORT ?? null;

    const isEmpty = (v: any) => v == null || (typeof v === "object" && Object.keys(v).length === 0);
    if (isEmpty(LONG) && isEmpty(SHORT)) return null;
    return { LONG, SHORT };
  }

  // 2) 문자열인 경우만 JSON.parse
  if (typeof s !== "string") return null;
  const trimmed = s.trim();
  if (!trimmed || trimmed === "[]") return null;

  try {
    const obj = JSON.parse(trimmed);
    if (obj && typeof obj === "object") {
      const LONG = (obj as any).LONG ?? null;
      const SHORT = (obj as any).SHORT ?? null;

      const isEmpty = (v: any) => v == null || (typeof v === "object" && Object.keys(v).length === 0);
      if (isEmpty(LONG) && isEmpty(SHORT)) return null;

      return { LONG, SHORT };
    }
  } catch {}
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
  const key = "asset";

  try {
    const { searchParams } = new URL(req.url);

    // query
    const symbolsParam = searchParams.get("symbols") || ""; // "BTCUSDT,ETHUSDT"
    const wantSymbols = symbolsParam
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const walletCoin = (searchParams.get("wallet") || "USDT").toUpperCase();
    const includeEmpty = String(searchParams.get("includeEmpty") || "false").toLowerCase() === "true";
    const scanCount = Math.min(Math.max(parseInt(searchParams.get("count") || "1000", 10) || 1000, 100), 5000);

    /* ---------------- wallet ---------------- */
    // 기본은 단일 코인(USDT)만 조회. 필요하면 wallet.* 전체 스캔으로 확장 가능.
    const walletKey = `wallet.${walletCoin}`;
    const walletStr = await (redis as any).hget(key, walletKey);
    const walletVal = typeof walletStr === "string" ? parseFloat(walletStr) : Number(walletStr);
    const wallet = { [walletCoin]: isFinite(walletVal) ? walletVal : 0 };

    /* ---------------- positions ---------------- */
    const positions: Record<string, any> = {};

    if (wantSymbols.length > 0) {
      // 심볼 지정 시: HGET 반복
      for (const sym of wantSymbols) {
        const field = `positions.${sym}`;
        const v = await (redis as any).hget(key, field);
        const parsed = parsePositionVal(v);
        if (parsed) {
          positions[sym] = { LONG: parsed.LONG ?? null, SHORT: parsed.SHORT ?? null };
        } else if (includeEmpty) {
          positions[sym] = { LONG: null, SHORT: null };
        }
      }
    } else {
      // 전체 스캔: positions.* 만 긁어오기
      let cursor = 0;
      do {
        const [next, arr] = await hscanTyped(redis, key, cursor, { match: "positions.*", count: scanCount });
        cursor = next;
        for (let i = 0; i + 1 < arr.length; i += 2) {
          const field = arr[i] ?? "";
          const val = arr[i + 1] ?? "";
          const sym = field.split(".")[1]; // positions.BTCUSDT → BTCUSDT
          if (!sym) continue;

          const parsed = parsePositionVal(val);
          if (parsed) {
            positions[sym] = { LONG: parsed.LONG ?? null, SHORT: parsed.SHORT ?? null };
          } else if (includeEmpty) {
            positions[sym] = { LONG: null, SHORT: null };
          }
        }
      } while (cursor !== 0);
    }

    /* ---------------- response ---------------- */
    return json({
      retCode: 0,
      asset: { wallet, positions },
      _debug: {
        key,
        walletField: walletKey,
        symbols: wantSymbols.length ? wantSymbols : Object.keys(positions),
        includeEmpty,
      },
    });
  } catch (e: any) {
    return json({ retCode: -1, retMsg: e?.message || "server error" }, 500);
  }
}
