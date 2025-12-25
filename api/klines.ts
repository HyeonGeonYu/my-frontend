// project/api/klines.ts
/**
 * Bybit v5 Kline Proxy (no Redis)
 * - GET /api/klines?symbol=BTCUSDT&interval=1&limit=10080
 * - cursor: 과거로 더 가져올 때 end ms
 * - pages: 이번 요청에서 허용할 최대 페이지 수 (기본 MAX_PAGES)
 * - 응답이 오래 걸리지 않도록: per-fetch 타임아웃 + 전체 라우트 데드라인 + 페이지 캡
 */

const BYBIT_BASE = process.env.BYBIT_BASE || "https://api.bybit.com";
const CATEGORY = process.env.BYBIT_CATEGORY || "linear";
const PER_CALL_LIMIT = 1000;                                // Bybit 단일 호출 한도
const REQ_TIMEOUT_MS = parseInt(process.env.REQ_TIMEOUT_MS || "6000", 10); // fetch 1회 타임아웃
const ROUTE_DEADLINE_MS = parseInt(process.env.ROUTE_DEADLINE_MS || "12000", 10); // 라우트 전체 타임리밋
const MAX_PAGES = parseInt(process.env.MAX_PAGES || "3", 10); // 요청당 최대 페이지 수
const SKEW_MS_1M = parseInt(process.env.SKEW_MS_1M || "2000", 10); // (1분봉) 마감 직후 소폭 지연

type KlineRow = { time: number; open: number; high: number; low: number; close: number };

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    status,
  });
}

function stepMs(interval: string): number {
  if (interval === "D") return 86_400_000;
  const n = parseInt(interval, 10);
  if (!isNaN(n) && n > 0) return n * 60_000;
  throw new Error("Unsupported interval");
}

function floorCurBarStartMs(nowMs: number, interval: string): number {
  const s = stepMs(interval);
  return Math.floor(nowMs / s) * s;
}

function mapBybitRow(row: string[]): KlineRow {
  // [start, open, high, low, close, volume, turnover]
  return {
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchBybitKlinesOnce(params: {
  symbol: string; interval: string; start?: number; end?: number; limit?: number;
}): Promise<KlineRow[]> {
  const { symbol, interval, start, end, limit = PER_CALL_LIMIT } = params;
  const sp = new URLSearchParams({
    category: CATEGORY,
    symbol,
    interval,
    limit: String(limit),
  });
  if (typeof start === "number") sp.set("start", String(start));
  if (typeof end === "number") sp.set("end", String(end));

  const url = `${BYBIT_BASE}/v5/market/kline?${sp.toString()}`;

  let attempt = 0;
  for (;;) {
    const res = await fetchWithTimeout(url, { headers: { accept: "application/json" } }, REQ_TIMEOUT_MS);

    // 재시도 대상
    if (res.status === 429 || res.status >= 500) {
      attempt++;
      if (attempt <= 3) {
        await new Promise((r) => setTimeout(r, 250 * attempt * attempt));
        continue;
      }
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Bybit error ${res.status}: ${text.slice(0, 200)}`);
    }

    const j = await res.json();
    const rows: string[][] = j?.result?.list ?? [];
    const mapped = rows.map(mapBybitRow);
    mapped.sort((a, b) => a.time - b.time);
    return mapped;
  }
}

/**
 * 커서 기반 페이지네이션: end 기준으로 과거 방향으로 여러 페이지를 수집.
 * - pagesBudget: 이번 요청에서 허용할 최대 페이지 수 (하드 캡)
 * - routeDeadlineAt: 라우트 전체 타임리밋 (이 시간 넘기면 즉시 중단)
 */
async function fetchBybitKlinesPaged(params: {
  symbol: string;
  interval: string;
  keep: number;
  cursorEndMs?: number;
  pagesBudget: number;
  routeDeadlineAt: number;
}): Promise<{ rows: KlineRow[]; nextCursorEndMs: number | null }> {
  const { symbol, interval, keep, cursorEndMs, pagesBudget, routeDeadlineAt } = params;

  const nowMs = Date.now();
  const endMs0 =
    typeof cursorEndMs === "number"
      ? cursorEndMs
      : floorCurBarStartMs(nowMs + (interval === "1" ? SKEW_MS_1M : 0), interval) - 1;

  const step = stepMs(interval);
  const startMsTarget = endMs0 - (keep - 1) * step;

  let curEnd = endMs0;
  const minStart = Math.max(0, startMsTarget);
  const out: KlineRow[] = [];
  let pages = 0;

  while (pages < pagesBudget && curEnd >= minStart && out.length < keep) {
    // 라우트 절대 데드라인 체크
    if (Date.now() >= routeDeadlineAt) break;

    const approxSpan = (PER_CALL_LIMIT - 1) * step;
    const curStart = Math.max(minStart, curEnd - approxSpan);

    const chunk = await fetchBybitKlinesOnce({
      symbol, interval, start: curStart, end: curEnd, limit: PER_CALL_LIMIT,
    });

    pages++;
    if (!chunk.length) break;

    const filtered = chunk.filter((b) => b.time * 1000 >= minStart && b.time * 1000 <= curEnd);
    if (!filtered.length) {
      curEnd = curStart - 1;
      continue;
    }

    out.push(...filtered);

    const oldestMs = filtered[0].time * 1000;
    const nextEnd = oldestMs - step;
    if (nextEnd < minStart) {
      curEnd = nextEnd;
      break;
    }
    curEnd = nextEnd;
  }

  // 정렬 + 중복 제거
  out.sort((a, b) => a.time - b.time);
  const dedup: KlineRow[] = [];
  const seen = new Set<number>();
  for (const b of out) {
    if (!seen.has(b.time)) {
      seen.add(b.time);
      dedup.push(b);
    }
  }

  const nextCursorEndMs = curEnd >= minStart ? curEnd : null;
  return { rows: dedup, nextCursorEndMs };
}

// ─────────────────────────── handler
export default async function handler(req: Request): Promise<Response> {
  const startedAt = Date.now();
  const routeDeadlineAt = startedAt + ROUTE_DEADLINE_MS;

  try {
    const { searchParams } = new URL(req.url);
    const symbol = (searchParams.get("symbol") || "BTCUSDT").toUpperCase();
    const interval = searchParams.get("interval") || "1";
    const limit = Math.min(Number(searchParams.get("limit") || "300"), 10080);
    const cursor = searchParams.get("cursor");

    // 이번 요청에서 허용할 페이지 수 (?pages=11)
    const pagesParam = Number(searchParams.get("pages") || "");
    const pagesDesired = Number.isFinite(pagesParam) && pagesParam > 0 ? Math.floor(pagesParam) : MAX_PAGES;
    const neededPages = Math.ceil(limit / PER_CALL_LIMIT); // 10080 => 11
    const pagesBudget = Math.min(neededPages, pagesDesired);

    // (참고) signals는 Bybit에서 제공 X → 항상 빈 배열
    const withSignals = (searchParams.get("withSignals") || "0") === "1";

    const cursorEndMs = cursor ? Number(cursor) : undefined;

    const { rows, nextCursorEndMs } = await fetchBybitKlinesPaged({
      symbol,
      interval,
      keep: limit,
      cursorEndMs,
      pagesBudget,
      routeDeadlineAt,
    });

    const list = rows.slice(-limit);

    return json({
      retCode: 0,
      list,
      signals: withSignals ? [] : [],
      nextCursor: nextCursorEndMs,
      _debug: {
        source: "bybit",
        symbol,
        interval,
        returned: list.length,
        perCallLimit: PER_CALL_LIMIT,
        pagesBudget,
        elapsedMs: Date.now() - startedAt,
        hitDeadline: Date.now() >= routeDeadlineAt,
      },
    });
  } catch (e: any) {
    return json({ retCode: -1, retMsg: e?.message || "server error" }, 500);
  }
}
