// api/config.ts
export const config = { runtime: "edge" };

import { Redis } from "@upstash/redis";

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    status,
  });
}

// name -> trading:{name}:config
function configKey(name: string): string {
  const n = (name || "bybit").trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(n)) throw new Error("Invalid name");
  return `trading:${n}:config`;
}

// Upstash Hash에서 값이 문자열로 들어오는 경우가 많아서 JSON 파싱 보조
function parseMaybeJson(v: any) {
  if (v == null) return v;
  if (Array.isArray(v) || typeof v === "object") return v;
  if (typeof v !== "string") return v;

  const s = v.trim();
  if (!s) return v;

  // "false"/"true"/"123" 같은 것도 살려줌
  if (s === "true") return true;
  if (s === "false") return false;
  if (!Number.isNaN(Number(s)) && /^-?\d+(\.\d+)?$/.test(s)) return Number(s);

  // JSON 배열/객체
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      return JSON.parse(s);
    } catch {
      return v;
    }
  }
  return v;
}

export default async function handler(req: Request): Promise<Response> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return json({ error: "Env missing UPSTASH_REDIS_REST_URL/TOKEN" }, 500);
  }

  try {
    const redis = new Redis({ url, token });

    const { searchParams } = new URL(req.url);
    const nameParam = searchParams.get("name") || "bybit";
    const key = configKey(nameParam);

    // ✅ 해시 전체 읽기
    const raw = await redis.hgetall(key);

    if (!raw || Object.keys(raw).length === 0) {
      return json(
        {
          retCode: -1,
          retMsg: "config_not_found",
          _debug: { key, name: nameParam },
        },
        404
      );
    }

    // ✅ 값들 파싱(특히 symbols가 '["BTCUSDT","ETHUSDT"]' 문자열일 때 배열로 변환)
    const parsed: any = {};
    for (const [k, v] of Object.entries(raw)) {
      parsed[k] = parseMaybeJson(v);
    }

    // ✅ symbols가 문자열이면 배열로 보정
    // (혹시 "BTCUSDT,ETHUSDT" 형태면 split)
    if (typeof parsed.symbols === "string") {
      const s = parsed.symbols.trim();
      if (s.startsWith("["))
        parsed.symbols = parseMaybeJson(s);
      else
        parsed.symbols = s
          .split(/[,\s]+/)
          .map((x: string) => x.trim())
          .filter(Boolean);
    }

    // ✅ 최종적으로 대문자 정리
    if (Array.isArray(parsed.symbols)) {
      parsed.symbols = parsed.symbols.map((x) => String(x).trim().toUpperCase()).filter(Boolean);
    }

    return json({
      retCode: 0,
      config: parsed,
      _debug: {
        key,
        name: nameParam,
        rawKeys: Object.keys(raw),
        symbolsType: typeof raw["symbols"],
      },
    });
  } catch (e: any) {
    const msg = e?.message || "server error";
    const status = msg === "Invalid name" ? 400 : 500;
    return json({ retCode: -1, retMsg: msg }, status);
  }
}
