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

// 월별 에쿼티 그래프: x=월(월말 평가), 보고 있는 달의 점을 강조. 점 클릭 = 그 달로 이동(전적 조회 가능 범위 내).
function MonthlySparkline({ points, viewedMonth, onSelect, isSelectable }) {
  if (!points.length) return null;
  const W = 560, H = 92, padX = 24, padTop = 12, padBot = 26;
  const vals = points.map((p) => p.equity);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => (points.length === 1 ? W / 2 : padX + ((W - 2 * padX) * i) / (points.length - 1));
  const y = (v) => padTop + (H - padTop - padBot) * (1 - (v - min) / span);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.equity).toFixed(1)}`)
    .join(" ");
  const up = vals[vals.length - 1] >= vals[0];
  const color = up ? "#16a34a" : "#dc2626";
  const multiYear = new Set(points.map((p) => p.month.slice(0, 4))).size > 1;
  const label = (m) => (multiYear ? `${m.slice(2, 4)}.${+m.slice(5, 7)}` : `${+m.slice(5, 7)}월`);
  const labelEvery = points.length > 9 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {points.length > 1 && <path d={path} fill="none" stroke={color} strokeWidth="2" />}
      {points.map((p, i) => {
        const sel = p.month === viewedMonth;
        const clickable = !sel && isSelectable(p.month);
        const showLabel = sel || i === points.length - 1 || i % labelEvery === 0;
        return (
          <g
            key={p.month}
            onClick={clickable ? () => onSelect(p.month) : undefined}
            style={{ cursor: clickable ? "pointer" : "default" }}
          >
            <title>{`${p.month} · ${p.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}</title>
            {clickable && <circle cx={x(i)} cy={y(p.equity)} r="14" fill="transparent" />}
            {sel && (
              <circle cx={x(i)} cy={y(p.equity)} r="9" fill="none" stroke="#00ffcc" strokeOpacity="0.45" strokeWidth="2.5" />
            )}
            <circle cx={x(i)} cy={y(p.equity)} r={sel ? 5 : 3} fill={sel ? "#00ffcc" : "#777"} />
            {showLabel && (
              <text
                x={x(i)} y={H - 7} textAnchor="middle"
                fontSize="11" fontWeight={sel ? 900 : 500}
                fill={sel ? "#00ffcc" : "#8a8a8a"}
              >
                {label(p.month)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function EquitySection({ rows, month, currency, currentEquity, onSelectMonth, isSelectable }) {
  if (rows === null) return <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>평가 불러오는 중...</div>;

  // 월별 압축: 각 달 마지막 기록 = 월말 평가 (rows는 day 오름차순 → 뒤 값이 덮어씀).
  // 이번 달은 라이브 현재 평가가 있으면 그 값으로.
  const byMonth = new Map();
  rows.forEach((r) => byMonth.set(r.day.slice(0, 7), r.equity));
  const nowKey = currentMonthKey();
  if (Number.isFinite(currentEquity) && currentEquity > 0) byMonth.set(nowKey, currentEquity);
  const points = [...byMonth.entries()]
    .map(([m, equity]) => ({ month: m, equity }))
    .sort((a, b) => a.month.localeCompare(b.month));
  if (!points.length) {
    return <div style={{ marginTop: 12, fontSize: 12, opacity: 0.55 }}>평가 기록이 없습니다.</div>;
  }

  // 보고 있는 달의 값 + 월 손익(기준선 = 전월 마지막 평가)
  const idx = points.findIndex((p) => p.month === month);
  const cur = idx >= 0 ? points[idx].equity : null;
  const base = idx > 0 ? points[idx - 1].equity : null;
  const chg = cur != null && base != null ? cur - base : null;
  const chgPct = chg != null && base > 0 ? (chg / base) * 100 : null;
  const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "#101010", border: "1px solid #242424" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: "#00ffcc" }}>평가 {currency}</span>
        <b style={{ fontSize: 16 }}>{cur != null ? fmt(cur) : "—"}</b>
        {chg != null && (
          <b style={{ fontSize: 13, color: pnlColor(chg) }}>
            {chg >= 0 ? "+" : ""}{fmt(chg)}{chgPct != null ? ` (${chgPct >= 0 ? "+" : ""}${chgPct.toFixed(2)}%)` : ""}
          </b>
        )}
        <span style={{ fontSize: 11, opacity: 0.55 }}>
          {month === nowKey ? "현재 평가 · 전월말 대비" : "월말 평가 · 전월말 대비"}
        </span>
      </div>
      <div style={{ marginTop: 6 }}>
        <MonthlySparkline
          points={points}
          viewedMonth={month}
          onSelect={onSelectMonth}
          isSelectable={isSelectable}
        />
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

      {/* 월 평가(에쿼티) — 전적과 같은 달을 따라감, 점 클릭으로도 달 이동 */}
      {equitySource && (
        <EquitySection
          rows={equityRows}
          month={month}
          currency={equityCurrency}
          currentEquity={currentEquity}
          onSelectMonth={setMonth}
          isSelectable={(m) => m >= oldestMonthKey() && m <= currentMonthKey()}
        />
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
