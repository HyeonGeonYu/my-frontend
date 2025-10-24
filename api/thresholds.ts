// project/api/thresholds.ts
export const config = { runtime: "edge" };
import { Redis } from "@upstash/redis";

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
    out[k] = typeof v === "string" ? v : v == null ? "" : String(v);
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
          fields[k] = typeof v === "string" ? v : v == null ? "" : String(v);
        }
        out.push({ id, fields });
      }
    }
  return out;
}

/** Stream(OpenPctLog)에서 (sym 매칭) 항목 중 가장 최근의 new(0~1 fraction) */
async function getLatestFracBySymbol(redis: Redis, symbol: string, searchBack = 500) {
  const raw = await (redis as any).xrevrange("OpenPctLog", "+", "-", { count: searchBack });

  const items = normalizeXRev(raw);
  const wantSym = symbol.toUpperCase();

  for (const it of items) {
    const f = it.fields || {};
    const sym = String(f.sym ?? f.SYM ?? f.symbol ?? "").toUpperCase();
    if (sym !== wantSym) continue;

    const v = toNumberOrNull(f.new ?? f.NEW);
    if (v != null) return { value: v, id: it.id };
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
    if (!symbolParam) return json({ retCode: -1, retMsg: "symbol required" }, 400);

    // 최신 임계치(new, 0~1) — name은 고려하지 않음
    const found = await getLatestFracBySymbol(redis, symbolParam, 500);
    const ma_threshold = found?.value ?? null;

    // momentum_threshold: 별도 로그를 보지 않고 ma/3 규칙
    const momentum_threshold =
      ma_threshold == null ? null : Number.isFinite(ma_threshold) ? ma_threshold / 3 : null;

    // 서버 기본값(봇 설정과 맞춰주세요)
    const exit_threshold = 0.0005; // 0.05%
    const target_cross = 5;
    const closes_num = 10080;

    return json({
      symbol: symbolParam,
      ma_threshold,
      momentum_threshold,
      exit_threshold,
      target_cross,
      closes_num,
      ...(debug ? { _debug: { streamKey: "OpenPctLog", foundId: found?.id || null } } : {}),
    });
  } catch (e: any) {
    return json({ retCode: -1, retMsg: e?.message || "server error" }, 500);
  }
}
