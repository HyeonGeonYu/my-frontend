// api/list.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;

const PER_PAGE = 5;

function compactDay(day: string) {
    return String(day || "").replaceAll("-", "");
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

function stripTranscript(rawJson: any) {
    if (!rawJson?.youtube_data) return rawJson;
    const youtube_data: Record<string, any> = {};
    for (const [country, info] of Object.entries(rawJson.youtube_data as Record<string, any>)) {
        const { summary_content, ...rest } = info || {};
        youtube_data[country] = rest;
    }
    return { ...rawJson, youtube_data };
}

function extractAssetSummary(raw: any, assetSnapshot: any = null) {
    if (!raw || typeof raw !== "object") {
        return {
            walletUsdt: 0,
            equityUsdt: 0,
            unrealizedPnlUsdt: 0,
            closePrices: {},
            closePriceAt: null,
            thresholds: {},
            thresholdsSource: null,
            positions: [],
        };
    }

    const walletUsdt = toNum(raw["wallet.USDT"] ?? assetSnapshot?.wallet_usdt);

    const closePrices = raw.close_prices || {};
    const thresholds = raw.thresholds || {};
    const thresholdsSource = raw.thresholds_source || null;

    const savedEquity = Number(raw.equity_usdt ?? assetSnapshot?.equity_usdt);
    const savedUnrealized = Number(raw.unrealized_pnl_usdt);

    const positions = extractPositions(raw);

    let computedUnrealized = 0;

    const enrichedPositions = positions.map((p) => {
        const symbol = String(p.symbol || "").toUpperCase();
        const side = p.side;

        const closeRaw = closePrices[symbol];
        const close = closeRaw == null ? null : Number(closeRaw);

        let qtySum = 0;
        let entryValue = 0;
        let pnl = null;

        for (const e of p.entries || []) {
            const qty = toNum(e.qty);
            const entry = toNum(e.price);

            qtySum += qty;
            entryValue += qty * entry;
        }

        const avgEntry = qtySum > 0 ? entryValue / qtySum : null;

        if (
            close != null &&
            Number.isFinite(close) &&
            avgEntry != null &&
            Number.isFinite(avgEntry)
        ) {
            if (side === "LONG") {
                pnl = (close - avgEntry) * qtySum;
            } else if (side === "SHORT") {
                pnl = (avgEntry - close) * qtySum;
            }

            if (Number.isFinite(pnl)) {
                computedUnrealized += pnl;
            }
        }

        return {
            ...p,
            closePrice: close != null && Number.isFinite(close) ? close : null,
            avgEntry,
            unrealizedPnlUsdt: pnl,
        };
    });

    const unrealizedPnlUsdt = Number.isFinite(savedUnrealized)
        ? savedUnrealized
        : computedUnrealized;

    const equityUsdt = Number.isFinite(savedEquity)
        ? savedEquity
        : walletUsdt + unrealizedPnlUsdt;

    return {
        walletUsdt,
        equityUsdt,
        unrealizedPnlUsdt,
        closePrices,
        closePriceAt: raw.close_price_at || null,
        thresholds,
        thresholdsSource,
        positions: enrichedPositions,
    };
}


// dailyRows(daily_collections 원본 row들)를 프론트 아이템으로 조립
// (trade_records·asset_snapshots 조인 포함) — 페이지 모드와 단일 일자 모드 공용
async function buildItems(supabase: any, dailyRows: any[]) {
    const days = (dailyRows || []).map((r: any) => r.day);

        const [tradeResult, assetResult] = await Promise.all([
            days.length
                ? supabase
                    .from("trade_records")
                    .select("id, day, symbol, side, kind, signal, display_label, price, qty, pnl, raw_json")
                    .in("day", days)
                : Promise.resolve({ data: [], error: null }),

            days.length
                ? supabase
                    .from("asset_snapshots")
                    .select("*")
                    .in("day", days)
                    .order("created_at", { ascending: false })
                : Promise.resolve({ data: [], error: null }),
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

    return (dailyRows || []).map((row: any) => {
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

        return {
            date: compactDay(day),
            day,
            data: stripTranscript(row.raw_json) || {},
            trades: dayTrades,
            tradeCount: dayTrades.length,
            symbols,
            assetSnapshot,
            asset: extractAssetSummary(assetRaw, assetSnapshot),
        };
    });
}

export default async function handler(req: any, res: any) {
    try {
        if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
            return res.status(500).json({
                ok: false,
                error: "SUPABASE_URL / SUPABASE_SECRET_KEY missing",
            });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
            auth: { persistSession: false },
        });

        const monthsParam = String(req.query.months || "");
        const monthParam = String(req.query.month || "");
        const dayParam = String(req.query.day || "");

        // ── 월 목록: day 컬럼만 전량 조회(경량) → 월별 그룹 ──
        if (monthsParam === "1") {
            const { data, error } = await supabase
                .from("daily_collections")
                .select("day")
                .order("day", { ascending: false });

            if (error) throw error;

            const byMonth: Record<string, number> = {};
            for (const r of data || []) {
                const m = String(r.day || "").slice(0, 7);
                if (!/^\d{4}-\d{2}$/.test(m)) continue;
                byMonth[m] = (byMonth[m] || 0) + 1;
            }

            const months = Object.entries(byMonth)
                .map(([month, dayCount]) => ({ month, days: dayCount }))
                .sort((a, b) => b.month.localeCompare(a.month));

            res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
            return res.status(200).json({ ok: true, months });
        }

        // ── 단일 일자 상세: 월 뷰에서 날짜를 펼칠 때 지연 로드 ──
        if (dayParam) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
                return res.status(400).json({ ok: false, error: "day must be YYYY-MM-DD" });
            }

            const { data: dailyRows, error } = await supabase
                .from("daily_collections")
                .select("*")
                .eq("day", dayParam)
                .limit(1);

            if (error) throw error;

            const items = await buildItems(supabase, dailyRows || []);
            return res.status(200).json({ ok: true, data: items });
        }

        // ── 월별 경량 일자 목록: day + 거래건수만 (raw_json 미조회) ──
        if (monthParam) {
            if (!/^\d{4}-\d{2}$/.test(monthParam)) {
                return res.status(400).json({ ok: false, error: "month must be YYYY-MM" });
            }

            const [y, m] = monthParam.split("-").map(Number);
            const fromDay = `${monthParam}-01`;
            const nextMonthDay =
                m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

            const { data: dayRows, error } = await supabase
                .from("daily_collections")
                .select("day")
                .gte("day", fromDay)
                .lt("day", nextMonthDay)
                .order("day", { ascending: false });

            if (error) throw error;

            const days = (dayRows || []).map((r: any) => r.day);

            const { data: trades, error: tradeError } = days.length
                ? await supabase.from("trade_records").select("day").in("day", days)
                : { data: [], error: null };

            if (tradeError) throw tradeError;

            const countByDay: Record<string, number> = {};
            for (const t of trades || []) {
                countByDay[t.day] = (countByDay[t.day] || 0) + 1;
            }

            return res.status(200).json({
                ok: true,
                month: monthParam,
                days: days.map((d: string) => ({
                    day: d,
                    date: compactDay(d),
                    tradeCount: countByDay[d] || 0,
                })),
            });
        }

        // ── (레거시) 페이지 모드 ──
        const page = Math.max(1, Number(req.query.page || 1));
        const from = (page - 1) * PER_PAGE;
        const to = from + PER_PAGE - 1;

        const { data: dailyRows, error: dailyError, count } = await supabase
            .from("daily_collections")
            .select("*", { count: "exact" })
            .order("day", { ascending: false })
            .range(from, to);

        if (dailyError) throw dailyError;

        const items = await buildItems(supabase, dailyRows || []);

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