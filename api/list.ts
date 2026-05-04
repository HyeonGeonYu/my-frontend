// api/list.ts
import {createClient} from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const PER_PAGE = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function compactDay(day: string) {
    return String(day || "").replaceAll("-", "");
}

function kst0650StartMs(day: string) {
    // day = "2026-05-04"
    // KST 06:50 = UTC 전날/당일 21:50
    const [y, m, d] = String(day).split("-").map(Number);
    return Date.UTC(y, m - 1, d, 6 - 9, 50, 0, 0);
}

function getArchiveWindowMs(day: string) {
    const startMs = kst0650StartMs(day);
    const endMs = startMs + ONE_DAY_MS;
    return {startMs, endMs};
}

function toNum(v: any, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function extractPositions(raw: any) {
    if (!raw || typeof raw !== "object") return [];

    return Object.entries(raw)
        .filter(([key]) => key.startsWith("positions."))
        .flatMap(([key, value]: any) => {
            const symbol = key.replace("positions.", "");
            const pos = value || {};
            const out: any[] = [];

            for (const side of ["LONG", "SHORT"]) {
                const sidePos = pos?.[side];
                if (!sidePos) continue;

                out.push({
                    symbol,
                    side,
                    qty: toNum(sidePos.qty),
                    entries: Array.isArray(sidePos.entries) ? sidePos.entries : [],
                });
            }

            return out;
        });
}

function extractPositionSymbols(raw: any) {
    return Array.from(
        new Set(
            extractPositions(raw)
                .map((p) => p.symbol)
                .filter(Boolean)
                .map((s) => String(s).toUpperCase())
        )
    );
}

function extractAssetSummary(raw: any, closePrices: Record<string, number> = {}) {
    if (!raw || typeof raw !== "object") {
        return {
            walletUsdt: 0,
            equityUsdt: 0,
            unrealizedPnlUsdt: 0,
            positionValueUsdt: 0,
            closePrices: {},
            positions: [],
        };
    }

    const walletUsdt = toNum(raw["wallet.USDT"]);
    const positions = extractPositions(raw);

    let unrealizedPnlUsdt = 0;
    let positionValueUsdt = 0;

    const enrichedPositions = positions.map((p) => {
        const symbol = String(p.symbol || "").toUpperCase();
        const side = p.side;
        const close = toNum(closePrices[symbol], NaN);

        let qtySum = 0;
        let entryValue = 0;
        let pnl = 0;
        let notional = 0;

        for (const e of p.entries || []) {
            const qty = toNum(e.qty);
            const entry = toNum(e.price);

            qtySum += qty;
            entryValue += qty * entry;

            if (Number.isFinite(close)) {
                notional += close * qty;

                if (side === "LONG") {
                    pnl += (close - entry) * qty;
                } else if (side === "SHORT") {
                    pnl += (entry - close) * qty;
                }
            }
        }

        unrealizedPnlUsdt += pnl;
        positionValueUsdt += notional;

        return {
            ...p,
            closePrice: Number.isFinite(close) ? close : null,
            avgEntry: qtySum > 0 ? entryValue / qtySum : null,
            unrealizedPnlUsdt: pnl,
            positionValueUsdt: notional,
        };
    });

    return {
        walletUsdt,
        equityUsdt: walletUsdt + unrealizedPnlUsdt,
        unrealizedPnlUsdt,
        positionValueUsdt,
        closePrices,
        positions: enrichedPositions,
    };
}

async function fetchBybitLastClose(symbol: string, day: string) {
    const {endMs} = getArchiveWindowMs(day);

    // 마지막 2시간만 조회해서 day_end 직전 마지막 1분봉 close를 잡음
    const startMs = endMs - 2 * 60 * 60 * 1000;

    const url = new URL("https://api.bybit.com/v5/market/kline");
    url.searchParams.set("category", "linear");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", "1");
    url.searchParams.set("start", String(startMs));
    url.searchParams.set("end", String(endMs));
    url.searchParams.set("limit", "120");

    const res = await fetch(url.toString(), {cache: "no-store"});
    const json = await res.json();

    const rows = json?.result?.list || [];
    if (!Array.isArray(rows) || rows.length === 0) return null;

    // Bybit kline list는 최신순으로 올 수 있으니 정렬
    const sorted = rows
        .map((r: any[]) => ({
            tsMs: Number(r[0]),
            open: Number(r[1]),
            high: Number(r[2]),
            low: Number(r[3]),
            close: Number(r[4]),
            volume: Number(r[5]),
        }))
        .filter((r) => Number.isFinite(r.tsMs) && Number.isFinite(r.close))
        .sort((a, b) => a.tsMs - b.tsMs);

    const last = [...sorted].reverse().find((r) => r.tsMs < endMs);
    return last?.close ?? null;
}

async function fetchClosePrices(symbols: string[], day: string) {
    const out: Record<string, number> = {};

    await Promise.all(
        symbols.map(async (symbol) => {
            try {
                const close = await fetchBybitLastClose(symbol, day);
                if (Number.isFinite(Number(close))) {
                    out[symbol] = Number(close);
                }
            } catch (e) {
                console.warn("fetch close failed", symbol, e);
            }
        })
    );

    return out;
}

export default async function handler(req: any, res: any) {
    try {
        if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
            return res.status(500).json({
                ok: false,
                error: "SUPABASE_URL / SUPABASE_SECRET_KEY missing",
            });
        }

        const page = Math.max(1, Number(req.query.page || 1));
        const from = (page - 1) * PER_PAGE;
        const to = from + PER_PAGE - 1;

        const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
            auth: {persistSession: false},
        });

        const {data: dailyRows, error: dailyError, count} = await supabase
            .from("daily_collections")
            .select("*", {count: "exact"})
            .order("day", {ascending: false})
            .range(from, to);

        if (dailyError) throw dailyError;

        const days = (dailyRows || []).map((r: any) => r.day);

        const [tradeResult, assetResult] = await Promise.all([
            days.length
                ? supabase
                    .from("trade_records")
                    .select("*")
                    .in("day", days)
                : Promise.resolve({data: [], error: null}),

            days.length
                ? supabase
                    .from("asset_snapshots")
                    .select("*")
                    .in("day", days)
                    .order("created_at", {ascending: false})
                : Promise.resolve({data: [], error: null}),
        ]);

        const trades = tradeResult.data || [];
        const assets = assetResult.data || [];

        if (tradeResult.error) throw tradeResult.error;
        if (assetResult.error) throw assetResult.error;

        const tradesByDay: Record<string, any[]> = {};
        for (const t of trades) {
            if (!tradesByDay[t.day]) tradesByDay[t.day] = [];
            tradesByDay[t.day].push(t);
        }

        for (const day of Object.keys(tradesByDay)) {
            tradesByDay[day].sort((a, b) => {
                const aTs = Number(a.raw_json?.ts_ms || a.raw_json?.timestamp_ms || 0);
                const bTs = Number(b.raw_json?.ts_ms || b.raw_json?.timestamp_ms || 0);
                return aTs - bTs;
            });
        }

        const assetByDay: Record<string, any> = {};
        for (const a of assets) {
            if (!assetByDay[a.day]) {
                assetByDay[a.day] = a;
            }
        }

        const items = await Promise.all(
            (dailyRows || []).map(async (row: any) => {
                const day = row.day;
                const dayTrades = tradesByDay[day] || [];
                const assetSnapshot = assetByDay[day] || null;
                const assetRaw = assetSnapshot?.raw_json || null;

                const tradeSymbols = dayTrades
                    .map((t: any) => t.symbol)
                    .filter(Boolean)
                    .map((s: string) => String(s).toUpperCase());

                const assetSymbols = extractPositionSymbols(assetRaw);

                const symbols = Array.from(
                    new Set([...tradeSymbols, ...assetSymbols])
                ).sort();

                const closePrices = await fetchClosePrices(assetSymbols, day);

                return {
                    date: compactDay(day),
                    day,
                    data: row.raw_json || {},
                    trades: dayTrades,
                    tradeCount: dayTrades.length,
                    symbols,
                    assetSnapshot,
                    asset: extractAssetSummary(assetRaw, closePrices),
                };
            })
        );

        return res.status(200).json({
            ok: true,
            page,
            perPage: PER_PAGE,
            total: count || 0,
            data: items,
        });
    } catch (e: any) {
        return res.status(500).json({
            ok: false,
            error: e?.message || String(e),
        });
    }
}