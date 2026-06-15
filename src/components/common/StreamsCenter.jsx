// src/components/common/StreamsCenter.jsx
import React, { useEffect, useMemo, useState } from "react";
import { fmtKSTFull, fmtKSTHMS, fmtComma } from "../../lib/tradeUtils";
import { getDayWindowByOffset } from "./ChartPanelCore/coreUtils";
import { getDayLabel } from "../../utils/date";
import { signalsRepo } from "../../lib/signalsRepo";

/** ------------------------- pnl parse helpers ------------------------- **/
function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

const FEE_RATE = 0.0022; // 0.22%

function pickNum(row, keys) {
  for (const k of keys) {
    const n = toNum(row?.[k]);
    if (n != null) return n;
  }
  return null;
}

function pickStr(row, keys) {
  for (const k of keys) {
    const v = row?.[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return "";
}

function getRealizedPnlUsdt(note) {
  const sideRaw = pickStr(note, [
    "side",
    "position_side",
    "positionSide",
    "pos_side",
    "posSide",
    "direction",
  ]).toUpperCase();

  const qty = Math.abs(
    pickNum(note, [
      "closed_qty",
      "closedQty",
      "close_qty",
      "closeQty",
      "qty",
      "size",
      "amount",
      "position_qty",
      "positionQty",
      "exec_qty",
      "execQty",
    ]) ?? 0
  );

  const entryPrice = pickNum(note, [
    "entry_price",
    "entryPrice",
    "avg_entry_price",
    "avgEntryPrice",
    "open_price",
    "openPrice",
    "entry",
  ]);

  const closePrice = pickNum(note, [
    "close_price",
    "closePrice",
    "avg_close_price",
    "avgClosePrice",
    "exit_price",
    "exitPrice",
    "avgExitPrice",
    "close",
    "price", // EXIT row의 price를 청산가 fallback으로 사용
  ]);

  if (!qty || !entryPrice || !closePrice) {
    // 구버전 데이터 fallback: 이미 USDT PNL이 저장된 경우
    return (
      toNum(note?.pnl_usdt) ??
      toNum(note?.realized_pnl) ??
      toNum(note?.realizedPnl) ??
      toNum(note?.closed_pnl) ??
      null
    );
  }

  const isShort =
    sideRaw.includes("SHORT") ||
    sideRaw === "SELL" ||
    sideRaw === "S";

  const sign = isShort ? -1 : 1;

  // LONG: (청산가 - 진입가) * 수량
  // SHORT: (진입가 - 청산가) * 수량
  const grossPnl = (closePrice - entryPrice) * qty * sign;

  // 진입 거래대금 + 청산 거래대금 양쪽에 0.22% 적용
  const fee = (entryPrice * qty + closePrice * qty) * FEE_RATE;

  return grossPnl - fee;
}


/** ------------------------- component ------------------------- **/
export default function StreamsCenter({
  source, // ChartSource (name 추론용)
  anchorEndUtcSec, // 06:50 anchor
  dayOffset,
  onDayOffsetChange,
  bounds = { min: -7, max: 0 },

  // 표시는 그냥 2로 두거나, 상위에서 넣어도 됨
  priceScale = 2,

  // 한번에 가져오는 설정
  days = 8,
  limit = 500,

  // pnl 계산 포함 여부
  pnlKind = "EXIT", // "EXIT"만 계산(기본), or null이면 전체 합산
}) {
  const name = useMemo(() => {
    const raw = source?.signalName || source?.name || source?.key || "bybit";
    return String(raw).split(":").pop().toLowerCase(); // "cfd:mt5" -> "mt5"
  }, [source]);

  const [loading, setLoading] = useState(false);
  const [allSignals, setAllSignals] = useState([]);
  const [symbolFilter, setSymbolFilter] = useState("ALL");

  // ✅ 기본은 완전 접힘(펼쳐야 보임)
  const [expanded, setExpanded] = useState(false);

  // ✅ 날짜(또는 필터) 바뀌면 기본으로 접힘
  useEffect(() => {
    setExpanded(false);
  }, [dayOffset, anchorEndUtcSec, symbolFilter, name]);

  // ✅ 8일치 한방 fetch
  useEffect(() => {
    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const data = await signalsRepo.load8d({ name, days, limit });
        if (!alive) return;
        setAllSignals(data?.signals || []);
      } catch (e) {
        if (!alive) return;
        setAllSignals([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [name, days, limit]);

  const symbols = useMemo(() => {
    const set = new Set();
    for (const s of allSignals || []) {
      if (s?.symbol) set.add(String(s.symbol).toUpperCase());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allSignals]);

  const [startSec, endSec] = useMemo(
    () => getDayWindowByOffset(anchorEndUtcSec, dayOffset),
    [anchorEndUtcSec, dayOffset]
  );

  const daySignals = useMemo(() => {
    const arr = (allSignals || [])
      .map((x) => ({
        ...x,
        symbol: x?.symbol ? String(x.symbol).toUpperCase() : undefined,
        side: x?.side ? String(x.side).toUpperCase() : undefined,
        kind: x?.kind ? String(x.kind).toUpperCase() : undefined,
        timeSec: Number.isFinite(Number(x?.ts_ms))
          ? Math.floor(Number(x.ts_ms) / 1000)
          : Number(x?.timeSec),
      }))
      .filter((x) => Number.isFinite(Number(x.timeSec)))
      .filter((x) => x.timeSec >= startSec && x.timeSec < endSec)
      // ✅ 시간순 정렬(오래된→최신). 원하면 반대로 바꿔도 됨.
      .sort((a, b) => (a.timeSec ?? 0) - (b.timeSec ?? 0));

    if (symbolFilter !== "ALL") {
      return arr.filter((x) => x.symbol === symbolFilter);
    }
    return arr;
  }, [allSignals, startSec, endSec, symbolFilter]);

  const total = daySignals.length;

  // ✅ 확정 PNL USDT 합산, 수수료 포함
  const realizedPnlUsdt = useMemo(() => {
    const arr = pnlKind
      ? daySignals.filter(
        (x) =>
          String(x?.kind || "").toUpperCase() ===
          String(pnlKind).toUpperCase()
      )
      : daySignals;

    return arr.reduce((sum, x) => {
      const pnl = getRealizedPnlUsdt(x);
      return sum + (Number.isFinite(pnl) ? pnl : 0);
    }, 0);
  }, [daySignals, pnlKind]);

  const atMin = dayOffset <= (bounds?.min ?? -7);
  const atMax = dayOffset >= (bounds?.max ?? 0);

  const COLS = "90px 100px 70px 70px 110px 90px 1fr";

  const CARD = {
    padding: "8px 10px",
    borderRadius: 12,
    background: "#1b1b1b",
    border: "1px solid #2a2a2a",
  };

  const GRID = {
    display: "grid",
    gridTemplateColumns: COLS,
    columnGap: 12,
    alignItems: "center",
    fontSize: 13,
    whiteSpace: "nowrap",
    overflow: "hidden",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div
      style={{
        margin: "12px 0 18px",
        padding: "14px 16px",
        borderRadius: 14,
        background: "#151515",
        border: "1px solid #262626",
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 14 }}>
          Streams
          <span style={{ marginLeft: 8, opacity: 0.7, fontWeight: 700 }}>
            {name.toUpperCase()} · {getDayLabel(anchorEndUtcSec, dayOffset)}{" "}
            (dayOffset {dayOffset})
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            확정 PNL{" "}
            <b style={{ color: realizedPnlUsdt >= 0 ? "#16a34a" : "#dc2626" }}>
              {realizedPnlUsdt >= 0 ? "+" : ""}
              {fmtComma(realizedPnlUsdt, 2)} USDT
            </b>
            <span style={{ opacity: 0.75 }}>
              {pnlKind ? ` · ${pnlKind} 합산 · 수수료 0.22% 반영` : " · 전체 합산 · 수수료 0.22% 반영"}
            </span>
          </div>

          <button
            onClick={() => onDayOffsetChange?.(Math.max(bounds.min, dayOffset - 1))}
            disabled={atMin}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: 0,
              background: atMin ? "#222" : "#2a2a2a",
              color: "#fff",
              fontWeight: 800,
              opacity: atMin ? 0.5 : 1,
              cursor: atMin ? "not-allowed" : "pointer",
            }}
            title="전날"
          >
            ◀
          </button>

          <button
            onClick={() => onDayOffsetChange?.(0)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: 0,
              background: "#00ffcc",
              color: "#000",
              fontWeight: 900,
            }}
            title="오늘"
          >
            오늘
          </button>

          <button
            onClick={() => onDayOffsetChange?.(Math.min(bounds.max, dayOffset + 1))}
            disabled={atMax}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: 0,
              background: atMax ? "#222" : "#2a2a2a",
              color: "#fff",
              fontWeight: 800,
              opacity: atMax ? 0.5 : 1,
              cursor: atMax ? "not-allowed" : "pointer",
            }}
            title="다음날"
          >
            ▶
          </button>

          <select
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #2a2a2a",
              background: "#111",
              color: "#fff",
              fontWeight: 800,
              fontSize: 12,
            }}
            title="심볼 필터"
          >
            <option value="ALL">ALL ({symbols.length})</option>
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* list */}
      <div style={{ marginTop: 10 }}>
        {/* ✅ column header */}
        <div style={CARD}>
          <div style={{ ...GRID, fontWeight: 900, opacity: 0.65 }}>
            <span>시간</span>
            <span>심볼</span>
            <span>방향</span>
            <span>구분</span>
            <span style={{ textAlign: "right" }}>가격</span>
            <span style={{ textAlign: "right" }}>확정PNL</span>
            <span>근거</span>
          </div>
        </div>

        {/* ✅ 항상 보이는 토글 버튼: 기본은 접힘(0개 표시) */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            disabled={loading}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #2a2a2a",
              background: expanded ? "#222" : "#2a2a2a",
              color: "#fff",
              fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 0.95,
            }}
            title={expanded ? "접기" : "펼치기"}
          >
            {loading ? "로딩중..." : expanded ? "접기" : `펼치기 (${total}개)`}
          </button>
        </div>

        {/* ✅ 펼쳤을 때만 내용 표시 */}
        {expanded && (
          loading ? (
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>로딩중...</div>
          ) : total === 0 ? (
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>해당 날짜 시그널 없음</div>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {daySignals.map((n, idx) => {
                const side = String(n.side || "").toUpperCase();
                const kind = String(n.kind || "").toUpperCase();
                const sideColor =
                  side === "LONG" ? "#16a34a" : side === "SHORT" ? "#dc2626" : "#9ca3af";

                const timeTxt = n.timeSec ? fmtKSTHMS(n.timeSec) : "";
                const priceTxt = n.price != null ? fmtComma(Number(n.price), priceScale) : "—";

                const reasons = n.reasons_json || n.reasons;
                const reasonsTxt =
                  Array.isArray(reasons) && reasons.length ? reasons.join(", ") : "—";

                const pnl = getRealizedPnlUsdt(n);
                const pnlTxt =
                  pnl == null ? "—" : `${pnl >= 0 ? "+" : ""}${fmtComma(pnl, 2)} USDT`;
                return (
                  <div key={n._id || n.signal_id || idx} style={CARD}>
                    <div
                      style={{ ...GRID, lineHeight: 1.5 }}
                      title={[
                        timeTxt,
                        n.symbol,
                        side,
                        kind,
                        priceTxt,
                        pnlTxt,
                        n.timeSec ? fmtKSTFull(n.timeSec) : "",
                        reasonsTxt,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    >
                      <span style={{ opacity: 0.9 }}>{timeTxt}</span>
                      <b style={{ opacity: 0.95 }}>{n.symbol || "—"}</b>
                      <span style={{ color: sideColor, fontWeight: 900 }}>{side || "—"}</span>
                      <span style={{ opacity: 0.9 }}>{kind || "—"}</span>

                      <span style={{ textAlign: "right" }}>{priceTxt}</span>
                      <span style={{ textAlign: "right", opacity: pnl == null ? 0.6 : 0.95 }}>
                        {pnlTxt}
                      </span>

                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", opacity: 0.9 }}>
                        {reasonsTxt}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}