// src/components/common/StreamsCenter.jsx
import React, {useEffect, useMemo, useState} from "react";
import {fmtKSTFull, fmtKSTHMS, fmtComma} from "../../lib/tradeUtils";
import {signalsRepo} from "../../lib/signalsRepo";

const ONE_DAY_SEC = 86400;

/** ------------------------- day window/label ------------------------- **/
function dayWindow(anchorEndUtcSec, dayOffset) {
  const end = Number(anchorEndUtcSec) + Number(dayOffset) * ONE_DAY_SEC;
  return [end - ONE_DAY_SEC, end]; // [startSec, endSec)
}

function dayLabel(anchorEndUtcSec, dayOffset) {
  const [startSec] = dayWindow(anchorEndUtcSec, dayOffset);
  const kstSec = startSec + 9 * 3600;
  const d = new Date(kstSec * 1000);
  const m = d.getUTCMonth() + 1;
  const dd = d.getUTCDate();
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${m}월 ${dd}일(${dow})`;
}

/** ------------------------- pnl parse helpers ------------------------- **/
function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function getPnlPct(note) {
  // ✅ 1) stream이 이미 주는 정규화 필드 우선
  const direct = toNum(note?.pnl_pct) ?? toNum(note?.pnlPct) ?? toNum(note?.pnl);
  if (direct != null) return direct;
}

function compoundEquityFromPnls(pnlsPct, start = 100) {
  let eq = start;
  for (const p of pnlsPct) {
    if (!Number.isFinite(p)) continue;
    eq *= 1 + p / 100;
  }
  return eq;
}

/** ------------------------- component ------------------------- **/
export default function StreamsCenter({
  source, // ChartSource (name 추론용)
  anchorEndUtcSec, // 06:50 anchor
  dayOffset,
  onDayOffsetChange,
  bounds = {min: -7, max: 0},

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
        const data = await signalsRepo.load8d({name, days, limit});
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
    () => dayWindow(anchorEndUtcSec, dayOffset),
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

  // ✅ pnl -> equity (리스트 펼침 여부와 무관하게 계산)
  const equity = useMemo(() => {
    const arr = pnlKind
      ? daySignals.filter(
          (x) =>
            String(x?.kind || "").toUpperCase() ===
            String(pnlKind).toUpperCase()
        )
      : daySignals;

    const pnls = arr.map(getPnlPct).filter((p) => Number.isFinite(p));
    return compoundEquityFromPnls(pnls, 100);
  }, [daySignals, pnlKind]);

  const equityChgPct = equity - 100;

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
        <div style={{fontWeight: 800, fontSize: 14}}>
          Streams
          <span style={{marginLeft: 8, opacity: 0.7, fontWeight: 700}}>
            {name.toUpperCase()} · {dayLabel(anchorEndUtcSec, dayOffset)}{" "}
            (dayOffset {dayOffset})
          </span>
        </div>

        <div style={{display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap"}}>
          <div style={{fontSize: 12, opacity: 0.85}}>
            시작 100 → <b>{equity.toFixed(2)}</b>{" "}
            <span style={{opacity: 0.75}}>
              ({equityChgPct >= 0 ? "+" : ""}
              {equityChgPct.toFixed(2)}%{pnlKind ? `, ${pnlKind} 복리` : ""})
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
      <div style={{marginTop: 10}}>
        {/* ✅ column header */}
        <div style={CARD}>
          <div style={{...GRID, fontWeight: 900, opacity: 0.65}}>
            <span>시간</span>
            <span>심볼</span>
            <span>방향</span>
            <span>구분</span>
            <span style={{textAlign: "right"}}>가격</span>
            <span style={{textAlign: "right"}}>PNL</span>
            <span>근거</span>
          </div>
        </div>

        {/* ✅ 항상 보이는 토글 버튼: 기본은 접힘(0개 표시) */}
        <div style={{display: "flex", justifyContent: "center", marginTop: 8}}>
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
            <div style={{fontSize: 12, opacity: 0.75, marginTop: 8}}>로딩중...</div>
          ) : total === 0 ? (
            <div style={{fontSize: 12, opacity: 0.75, marginTop: 8}}>해당 날짜 시그널 없음</div>
          ) : (
            <div style={{display: "grid", gap: 8, marginTop: 8}}>
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

                const pnl = getPnlPct(n);
                const pnlTxt = pnl == null ? "—" : `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`;

                return (
                  <div key={n._id || n.signal_id || idx} style={CARD}>
                    <div
                      style={{...GRID, lineHeight: 1.5}}
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
                      <span style={{opacity: 0.9}}>{timeTxt}</span>
                      <b style={{opacity: 0.95}}>{n.symbol || "—"}</b>
                      <span style={{color: sideColor, fontWeight: 900}}>{side || "—"}</span>
                      <span style={{opacity: 0.9}}>{kind || "—"}</span>

                      <span style={{textAlign: "right"}}>{priceTxt}</span>
                      <span style={{textAlign: "right", opacity: pnl == null ? 0.6 : 0.95}}>
                        {pnlTxt}
                      </span>

                      <span style={{overflow: "hidden", textOverflow: "ellipsis", opacity: 0.9}}>
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