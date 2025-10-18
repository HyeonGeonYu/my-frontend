// project/api/signals.ts
export const config = { runtime: "edge" };
import { Redis } from "@upstash/redis";

/* ------------------------- utils ------------------------- */
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    status,
  });
}

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3600 * 1000;

function lastNDaysKST(n: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  const kstNow = now + KST_OFFSET_MS;
  const kstMidnight = Math.floor(kstNow / DAY_MS) * DAY_MS; // KST 자정(UTC 타임라인상)

  for (let i = n - 1; i >= 0; i--) {
    const t = kstMidnight - i * DAY_MS;
    // 여기서는 추가 보정 없이 UTC getter만 사용
    const d = new Date(t);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${dd}`);
  }
  return out;
}


function enumerateDaysKST(fromYmd: string, toYmd: string): string[] {
  const start = new Date(`${fromYmd}T00:00:00+09:00`).getTime();
  const end   = new Date(`${toYmd}T00:00:00+09:00`).getTime();
  const a = Math.min(start, end);
  const b = Math.max(start, end);
  const out: string[] = [];

  for (let t = a; t <= b; t += DAY_MS) {
    const d = new Date(t); // 추가 보정 X
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${dd}`);
  }
  return out;
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

/** "SIG {...}" 같은 로그 라인에서 JSON 부분만 뽑아내기 */
function stripSigPrefixAndExtractJson(s: string): string {
  const trimmed = s.trim();
  // 1) 앞에 "SIG" (대소문자 무관) + 공백/콜론 허용
  const noPrefix = trimmed.replace(/^\s*sig\s*[: ]\s*/i, "");
  if (noPrefix.startsWith("{") || noPrefix.startsWith("[")) return noPrefix;

  // 2) 중괄호 범위로 재시도 (로그 앞뒤 텍스트 제거)
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return trimmed; // 최후의 수단
}

/* --------------------------- handler --------------------------- */
export default async function handler(req: Request): Promise<Response> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return json({ retCode: -1, retMsg: "Env missing UPSTASH_REDIS_REST_URL/TOKEN" }, 500);
  }

  const redis = new Redis({ url, token });
  const key = "trading:signal";

  try {
    const { searchParams } = new URL(req.url);

    const symbolParam = searchParams.get("symbol") || undefined; // e.g., BTCUSDT
    const sideParam = searchParams.get("side") || undefined;     // LONG | SHORT
    const kindParam = searchParams.get("kind") || undefined;     // ENTRY | EXIT

    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const days = Math.min(Math.max(parseInt(searchParams.get("days") || "7", 10) || 7, 1), 365);

    const limitParam = parseInt(searchParams.get("limit") || "0", 10);
    const limit = isNaN(limitParam) ? 0 : limitParam;

    let daysList: string[];
    if (from || to) {
      const fromYmd = from ?? (to as string);
      const toYmd = to ?? (from as string);
      daysList = enumerateDaysKST(fromYmd, toYmd);
    } else {
      daysList = lastNDaysKST(days);
    }

    const wantSymbol = symbolParam?.toUpperCase();
    const wantSide = sideParam?.toUpperCase();
    const wantKind = kindParam?.toUpperCase();

    const signals: any[] = [];
    const matchedFieldsSample: string[] = [];
    let parseErrors = 0;

    for (const day of daysList) {
      let cursor = 0;
      const match = `${day}|*`;
      do {
        const [next, arr] = await hscanTyped(redis, key, cursor, { match, count: 1000 });
        cursor = next;

        for (let i = 0; i + 1 < arr.length; i += 2) {
          const field = arr[i] ?? "";
          const valueStrRaw = arr[i + 1] ?? "";
          if (!valueStrRaw) continue;

          if (matchedFieldsSample.length < 10) matchedFieldsSample.push(field);

          try {
            let obj: any;
            if (typeof valueStrRaw === "string") {
              const cleaned = stripSigPrefixAndExtractJson(valueStrRaw);
              obj = JSON.parse(cleaned);
            } else if (typeof valueStrRaw === "object") {
              // Upstash가 object로 반환할 때 보호
              obj = JSON.parse(JSON.stringify(valueStrRaw));
            } else {
              continue;
            }

            // 대문자 통일 필터
            if (wantSymbol && String(obj.symbol || "").toUpperCase() !== wantSymbol) continue;
            if (wantSide && String(obj.side || "").toUpperCase() !== wantSide) continue;
            if (wantKind && String(obj.kind || "").toUpperCase() !== wantKind) continue;

            // timeSec도 미리 계산(프론트 마커용)
            const ts = String(obj.ts || "");
            const timeSec = ts ? Math.floor(new Date(ts).getTime() / 1000) : undefined;
            signals.push({ ...obj, timeSec, _field: field });
          } catch {
            parseErrors++;
          }
        }
      } while (cursor !== 0);
    }

    // 시간순 정렬
    signals.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    const result = limit > 0 ? signals.slice(-limit) : signals;

    return json({
      retCode: 0,
      signals: result,
      _debug: {
        key,
        mode: from || to ? "range" : "lastNDays",
        from: from || null,
        to: to || null,
        days,
        daysCount: daysList.length,
        symbol: symbolParam || null,
        side: sideParam || null,
        kind: kindParam || null,
        matchedFieldsSample,
        parseErrors,
        returned: result.length,
        total: signals.length,
      },
    });
  } catch (e: any) {
    return json({ retCode: -1, retMsg: e?.message || "server error" }, 500);
  }
}
