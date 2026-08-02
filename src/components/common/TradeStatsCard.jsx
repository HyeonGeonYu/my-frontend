// src/components/common/TradeStatsCard.jsx
// 매매 전적 통계 카드 (달별, 기본 이번 달) — 전체 게임수·승률·자산 기여도 + 유니버스별 전략 분해.
//   데이터/정의: src/lib/tradeStats.js (시그널 EXIT 기반, 기여도 = Σ pnl% × 전략 진입비중).
//   시그널 보존 35일 → 이번달 + 지난달(일부)만 조회 가능.
import React, { useEffect, useState } from "react";
import {
  loadTradeStats,
  currentMonthKey, oldestMonthKey, prevMonthKey, nextMonthKey, monthLabel,
} from "../../lib/tradeStats";

const fmtPct = (n, d = 1) =>
  typeof n === "number" && Number.isFinite(n)
    ? `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`
    : "—";
const fmtWin = (n) =>
  typeof n === "number" && Number.isFinite(n) ? `${n.toFixed(0)}%` : "—";
const pnlColor = (n) =>
  typeof n === "number" && Number.isFinite(n)
    ? n > 0 ? "#16a34a" : n < 0 ? "#dc2626" : "#aaa"
    : "#aaa";

// 소속 책 배지 색 — S11=1분봉책 / S22=4시간봉책 / S33=일봉책 / 구=드레인 채널
const BOOK_COLOR = {
  S11: "#ffb86c",
  S22: "#c084fc",
  S33: "#5dcaa5",
  "구": "#888",
};

function BookBadge({ code, tf }) {
  const c = BOOK_COLOR[code] || "#888";
  return (
    <span
      title={tf ? `${code} · ${tf}봉 책` : code}
      style={{
        display: "inline-block", minWidth: 30, textAlign: "center",
        marginRight: 7, padding: "1px 6px", borderRadius: 6,
        fontSize: 10, fontWeight: 900, color: c,
        background: `${c}1f`, border: `1px solid ${c}55`,
        verticalAlign: "middle",
      }}
    >
      {code}
    </span>
  );
}

function SummaryChip({ label, value, color }) {
  return (
    <div
      style={{
        display: "inline-flex", alignItems: "baseline", gap: 6,
        padding: "6px 10px", borderRadius: 999,
        background: "#1a1a1a", border: "1px solid #2a2a2a",
        fontSize: 12, whiteSpace: "nowrap",
      }}
    >
      <span style={{ opacity: 0.7 }}>{label}</span>
      <b style={{ fontSize: 14, color: color || "#fff" }}>{value}</b>
    </div>
  );
}

function MonthNavButton({ dir, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "2px 8px", borderRadius: 8,
        border: "1px solid #333", background: "#1a1a1a",
        color: disabled ? "#444" : "#fff",
        fontWeight: 900, fontSize: 12,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {dir === "prev" ? "◀" : "▶"}
    </button>
  );
}

// ── 월 에쿼티 섹션 (2026-08-02): 평가 USDT/USD 히스토리를 전적 카드의 월 내비와 통합 ──
//   bybit=/api/equity-history(asset_snapshots) · mt5=/api/mt5-equity(daily_equity 해시)
function useEquityRows(source) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!source) return;
    let alive = true;
    const url = source === "mt5" ? "/api/mt5-equity" : "/api/equity-history?days=365";
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const raw = Array.isArray(j?.rows) ? j.rows : [];
        const norm = raw
          .map((r) => ({
            day: String(r.day || ""),
            equity: Number(r.equityUsdt ?? r.equity ?? NaN),
          }))
          .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.day) && Number.isFinite(r.equity))
          .sort((a, b) => a.day.localeCompare(b.day));
        setRows(norm);
      })
      .catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [source]);
  return rows;
}

function Sparkline({ points, width = 560, height = 56 }) {
  if (!points || points.length < 2) return null;
  const vals = points.map((p) => p.equity);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const y = (v) => 4 + (height - 8) * (1 - (v - min) / span);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${y(p.equity).toFixed(1)}`).join(" ");
  const up = vals[vals.length - 1] >= vals[0];
  const color = up ? "#16a34a" : "#dc2626";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height, display: "block" }} preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function EquitySection({ rows, month, currency, currentEquity }) {
  if (rows === null) return <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>평가 불러오는 중...</div>;

  const inMonth = rows.filter((r) => r.day.startsWith(month));
  const isCurrent = month === currentMonthKey();
  const points = [...inMonth];
  if (isCurrent && Number.isFinite(currentEquity) && currentEquity > 0) {
    points.push({ day: "지금", equity: currentEquity });
  }
  if (!points.length) {
    return <div style={{ marginTop: 12, fontSize: 12, opacity: 0.55 }}>이 달의 평가 기록이 없습니다.</div>;
  }

  // 월 손익 기준선 = 전월 마지막 평가(없으면 이 달 첫 값)
  const prev = rows.filter((r) => r.day < `${month}-01`);
  const base = prev.length ? prev[prev.length - 1].equity : points[0].equity;
  const last = points[points.length - 1].equity;
  const chg = last - base;
  const chgPct = base > 0 ? (chg / base) * 100 : null;
  const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "#101010", border: "1px solid #242424" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: "#00ffcc" }}>평가 {currency}</span>
        <b style={{ fontSize: 16 }}>{fmt(last)}</b>
        <b style={{ fontSize: 13, color: pnlColor(chg) }}>
          {chg >= 0 ? "+" : ""}{fmt(chg)}{chgPct != null ? ` (${chgPct >= 0 ? "+" : ""}${chgPct.toFixed(2)}%)` : ""}
        </b>
        <span style={{ fontSize: 11, opacity: 0.55 }}>
          월 손익 · 기록 {inMonth.length}일{isCurrent ? " + 현재" : ""}
        </span>
      </div>
      <div style={{ marginTop: 6 }}>
        <Sparkline points={points} />
      </div>
    </div>
  );
}

export default function TradeStatsCard({
  page, nsList, title = "매매 전적",
  equitySource = null,      // "bybit" | "mt5" — 지정 시 월 평가 섹션 표시
  equityCurrency = "USDT",
  currentEquity = null,     // 이번 달 마지막 점으로 붙일 현재 평가(라이브)
}) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [view, setView] = useState("strat"); // "strat" 전략별 | "sym" 심볼별
  const [month, setMonth] = useState(currentMonthKey()); // "2026-07"
  const equityRows = useEquityRows(equitySource);

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(null);
    loadTradeStats(page, nsList, month)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setErr(e?.message || "load failed"); });
    return () => { alive = false; };
    // nsList는 페이지 모듈 상수(안정 참조) 전제
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, month]);

  const cell = { padding: "5px 8px", borderBottom: "1px solid #222", fontSize: 12, whiteSpace: "nowrap" };
  const head = { ...cell, fontWeight: 900, color: "#00ffcc", fontSize: 11 };
  const num = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div
      style={{
        padding: 16, borderRadius: 16,
        background: "#151515", border: "1px solid #2a2a2a",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        width: "100%", boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
            <MonthNavButton
              dir="prev"
              disabled={month <= oldestMonthKey()}
              onClick={() => setMonth(prevMonthKey(month))}
            />
            <b style={{ fontSize: 13, color: "#00ffcc", minWidth: 72, textAlign: "center" }}>
              {monthLabel(month)}
            </b>
            <MonthNavButton
              dir="next"
              disabled={month >= currentMonthKey()}
              onClick={() => setMonth(nextMonthKey(month))}
            />
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>청산(EXIT) 신호 기준 · 게임=청산 1건</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { key: "strat", label: "전략별" },
            { key: "sym", label: "심볼별" },
          ].map((t) => {
            const on = view === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                style={{
                  padding: "6px 12px", borderRadius: 999,
                  border: `1px solid ${on ? "#00ffcc" : "#333"}`,
                  background: on ? "#00ffcc" : "#1a1a1a",
                  color: on ? "#000" : "#fff",
                  fontWeight: 900, fontSize: 12, cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>전적을 불러오지 못했습니다: {String(err)}</div>
      )}
      {!err && !data && (
        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>불러오는 중...</div>
      )}

      {/* 월 평가(에쿼티) — 전적과 같은 달을 따라감 */}
      {equitySource && (
        <EquitySection rows={equityRows} month={month} currency={equityCurrency} currentEquity={currentEquity} />
      )}

      {data && (
        <>
          {/* 전체 요약 */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <SummaryChip label="게임" value={data.total.games} />
            <SummaryChip label="승률" value={fmtWin(data.total.winRatePct)} />
            <SummaryChip
              label="게임당 평균"
              value={fmtPct(data.total.avgPnlPct, 2)}
              color={pnlColor(data.total.avgPnlPct)}
            />
            <SummaryChip
              label="자산 기여도"
              value={fmtPct(data.total.contribPct, 2)}
              color={pnlColor(data.total.contribPct)}
            />
          </div>

          {data.total.games === 0 ? (
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>{monthLabel(month)} 청산 기록이 없습니다.</div>
          ) : (
            data.groups.map((g) => (
              <div key={g.universe} style={{ marginTop: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, color: "#00ffcc" }}>{g.universe}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    {g.total.games}게임 · 승률 {fmtWin(g.total.winRatePct)} · 평균{" "}
                    <b style={{ color: pnlColor(g.total.avgPnlPct) }}>{fmtPct(g.total.avgPnlPct, 2)}</b> ·{" "}
                    <b style={{ color: pnlColor(g.total.contribPct) }}>{fmtPct(g.total.contribPct, 2)}</b>
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 300 }}>
                    <thead>
                      <tr>
                        <th style={{ ...head, textAlign: "left" }}>{view === "strat" ? "전략" : "심볼"}</th>
                        <th style={{ ...head, textAlign: "right" }}>게임</th>
                        <th style={{ ...head, textAlign: "right" }}>승률</th>
                        <th style={{ ...head, textAlign: "right" }}>평균수익</th>
                        <th style={{ ...head, textAlign: "right" }}>기여도</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(view === "strat" ? g.rows : g.symRows || []).map((r) => (
                        <tr key={r.key}>
                          <td style={{ ...cell, fontWeight: 700 }}>
                            {view === "strat" && <BookBadge code={r.book} tf={r.tf} />}
                            {r.label}
                          </td>
                          <td style={num}>{r.games}</td>
                          <td style={num}>{fmtWin(r.winRatePct)}</td>
                          <td style={{ ...num, color: pnlColor(r.avgPnlPct) }}>{fmtPct(r.avgPnlPct, 2)}</td>
                          <td style={{ ...num, fontWeight: 800, color: pnlColor(r.contribPct) }}>
                            {fmtPct(r.contribPct, 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          <div style={{ marginTop: 10, fontSize: 11, opacity: 0.55, lineHeight: 1.5 }}>
            * 평균수익 = 게임당 청산 수익률(포지션 기준) 단순평균 · 기여도 = Σ(청산 수익률 × 전략별 진입비중) — 자산 대비 추정치(수수료 반영, 복리·부분체결 미반영).
            {data.missingPnl > 0 ? ` · 수익률 미기록 ${data.missingPnl}건은 승률·기여도에서 제외.` : ""}
            {data.partialFromDay ? ` · ⚠️ 시그널 보존 한계로 ${data.partialFromDay} 이후 기록만 포함(부분 집계).` : ""}
          </div>
        </>
      )}
    </div>
  );
}
