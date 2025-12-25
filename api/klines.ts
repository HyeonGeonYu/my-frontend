import type { VercelRequest, VercelResponse } from "@vercel/node";

const BYBIT_BASE = process.env.BYBIT_BASE || "https://api.bybit.com";
const CATEGORY = process.env.BYBIT_CATEGORY || "linear";

const PER_CALL_LIMIT = 1000;
const HARD_LIMIT_PER_REQUEST = parseInt(process.env.HARD_LIMIT_PER_REQUEST || "1000", 10);

const REQ_TIMEOUT_MS = parseInt(process.env.REQ_TIMEOUT_MS || "6000", 10);
const ROUTE_DEADLINE_MS = parseInt(process.env.ROUTE_DEADLINE_MS || "12000", 10);
const MAX_PAGES = parseInt(process.env.MAX_PAGES || "1", 10);
const SKEW_MS_1M = parseInt(process.env.SKEW_MS_1M || "2000", 10);

type KlineRow = { time: number; open: number; high: number; low: number; close: number };

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
  return {
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  };
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; klines-proxy/1.0)",
      },
      signal: controller.signal,
    });
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
    const res = await fetchWithTimeout(url, REQ_TIMEOUT_MS);

    if (res.status === 429 || res.status >= 500) {
      attempt++;
      if (attempt <= 3) {
        await new Promise((r) => setTimeout(r, 250 * attempt * attempt));
        continue;
      }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Bybit error ${res.status}: ${text.slice(0, 200)}`);
    }

    const j = await res.json();
    const rows: string[][] = j?.result?.list ?? [];
    const mapped = rows.map(mapBybitRow);
    mapped.sort((a, b) => a.time - b.time);
    return mapped;
  }
}

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

  let curEnd = endMs0;
  const out: KlineRow[] = [];
  let pages = 0;

  while (pages < pagesBudget && out.length < keep) {
    if (Date.now() >= routeDeadlineAt) break;

    const approxSpan = (PER_CALL_LIMIT - 1) * step;
    const curStart = Math.max(0, curEnd - approxSpan);

    const chunk = await fetchBybitKlinesOnce({
      symbol,
      interval,
      start: curStart,
      end: curEnd,
      limit: PER_CALL_LIMIT,
    });

    pages++;
    if (!chunk.length) break;

    // end 범위까지만 반영(안전)
    const filtered = chunk.filter((b) => b.time * 1000 <= curEnd);
    if (!filtered.length) break;

    out.push(...filtered);

    // ✅ 다음 커서는 "이번에 받은 가장 오래된 봉 - step"
    const oldestMs = filtered[0].time * 1000;
    curEnd = oldestMs - step;

    // 더 과거로 갈 수 없으면 종료
    if (curEnd <= 0) break;
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

  // ✅ 핵심: 뭘 받았으면 nextCursor는 계속 준다
  const nextCursorEndMs = dedup.length ? curEnd : null;
  return { rows: dedup.slice(-keep), nextCursorEndMs };
}





export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startedAt = Date.now();
  const routeDeadlineAt = startedAt + ROUTE_DEADLINE_MS;

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  try {
    // 🔥 pending 디버깅용: 여기 로그가 vercel dev 터미널에 찍혀야 정상
    console.log("[api/klines] hit", req.url);

    const provider = String(req.query.provider || "bybit").toLowerCase();
    const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
    const interval = String(req.query.interval || "1");
    const requestedLimit = Number(req.query.limit || "300");
    const limit = Math.min(Math.max(1, requestedLimit), HARD_LIMIT_PER_REQUEST);

    const cursor = req.query.cursor;
    const cursorEndMs = cursor != null ? Number(cursor) : undefined;

    const pagesParam = Number(req.query.pages || "");
    const pagesDesired = Number.isFinite(pagesParam) && pagesParam > 0 ? Math.floor(pagesParam) : MAX_PAGES;
    const neededPages = Math.ceil(limit / PER_CALL_LIMIT);
    const pagesBudget = Math.min(neededPages, pagesDesired);

    if (provider !== "bybit") {
      return res.status(400).json({ retCode: -1, retMsg: `unknown provider: ${provider}` });
    }

    const { rows, nextCursorEndMs } = await fetchBybitKlinesPaged({
      symbol,
      interval,
      keep: limit,
      cursorEndMs,
      pagesBudget,
      routeDeadlineAt,
    });

    return res.status(200).json({
      retCode: 0,
      list: rows.slice(-limit),
      nextCursor: nextCursorEndMs,
      _debug: {
        provider,
        symbol,
        interval,
        returned: rows.length,
        pagesBudget,
        elapsedMs: Date.now() - startedAt,
        hitDeadline: Date.now() >= routeDeadlineAt,
      },
    });
  } catch (e: any) {
    const msg = e?.message || "server error";
    const status = String(msg).startsWith("Bybit error") ? 502 : 500;
    return res.status(status).json({ retCode: -1, retMsg: msg });
  }
}
