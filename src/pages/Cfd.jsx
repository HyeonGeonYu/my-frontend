// src/pages/Cfd.jsx
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createChart } from "lightweight-charts";

const API_BASE = "https://api.hyeongeonnoil.com";

// 3개 CFD 심볼
const SYMBOLS = ["US100", "KS200", "XAUUSD"];

// 페이징 / 개수
const PAGE_LIMIT = 1000;
const TARGET_CANDLE_COUNT = 10000;

// 시간 오프셋
const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC → KST
const SESSION_START_MIN = 6 * 60 + 50; // KST 06:50

// ─────────────────────────────────────
// 유틸 함수들
// ─────────────────────────────────────

// 숫자 콤마 + 소수 N자리
function fmtComma(v, digits = 0) {
  if (v == null || !isFinite(v)) return "—";
  const f = Number(v).toFixed(digits);
  const [i, d] = f.split(".");
  const withComma = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return d != null ? `${withComma}.${d}` : withComma;
}

// UTC ms → 세션 날짜(KST 기준) "YYYY-MM-DD"
function getSessionKeyFromUtcMs(msUtc) {
  const msKst = msUtc + KST_OFFSET_MS;
  const d = new Date(msKst);

  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const minutes = h * 60 + m;

  let sessionDate;
  if (minutes >= SESSION_START_MIN) {
    sessionDate = d;
  } else {
    sessionDate = new Date(msKst - 24 * 60 * 60 * 1000);
  }

  const year = sessionDate.getUTCFullYear();
  const month = sessionDate.getUTCMonth() + 1;
  const day = sessionDate.getUTCDate();

  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  return `${year}-${pad(month)}-${pad(day)}`;
}

// 줄 단위로 세션 그룹 + 통계
function groupBySessionKstWithGaps(rows) {
  const groups = {};
  const stats = {};

  for (const row of rows) {
    const [msUtc, o, h, l, c] = row;

    const sessionKey = getSessionKeyFromUtcMs(msUtc);
    const msKst = msUtc + KST_OFFSET_MS;
    const timeSec = Math.floor(msKst / 1000);

    if (!groups[sessionKey]) groups[sessionKey] = [];
    if (!stats[sessionKey]) stats[sessionKey] = { total: 0, real: 0 };

    stats[sessionKey].total++;

    if (o == null || h == null || l == null || c == null) {
      // 갭 → whitespace
      groups[sessionKey].push({ time: timeSec });
    } else {
      groups[sessionKey].push({
        time: timeSec,
        open: o,
        high: h,
        low: l,
        close: c,
      });
      stats[sessionKey].real++;
    }
  }

  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => a.time - b.time);
  }

  return { groups, stats };
}

// 최근 100개 종가로 MA 계산 (마지막 값만)
function calcLatestMA(rows, period = 100) {
  const closes = rows
    .filter((r) => r[4] != null)
    .map((r) => Number(r[4]));
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

// rows 기반 카드용 통계
function buildSymbolStats(rows) {
  const valid = rows.filter((r) => r[4] != null);
  if (!valid.length) return { price: null, ma100: null, chg3mPct: null };

  const lastClose = Number(valid[valid.length - 1][4]);
  const ma100 = calcLatestMA(valid, 100);

  let chg3mPct = null;
  if (valid.length >= 3) {
    const prev3 = Number(valid[valid.length - 3][4]);
    if (prev3) {
      chg3mPct = ((lastClose - prev3) / prev3) * 100;
    }
  }

  return { price: lastClose, ma100, chg3mPct };
}

// 가장 긴 연속 whitespace 구간
function detectLongestGapRange(data) {
  let best = null;
  let start = null;
  let prev = null;

  for (const pt of data) {
    const isGap = !("open" in pt);

    if (isGap) {
      if (start === null) {
        start = pt.time;
        prev = pt.time;
      } else if (pt.time === prev + 60) {
        prev = pt.time;
      } else {
        const durationSec = prev - start + 60;
        if (!best || durationSec > best.durationSec) {
          best = { from: start, to: prev + 60, durationSec };
        }
        start = pt.time;
        prev = pt.time;
      }
    } else {
      if (start !== null) {
        const durationSec = prev - start + 60;
        if (!best || durationSec > best.durationSec) {
          best = { from: start, to: prev + 60, durationSec };
        }
        start = null;
        prev = null;
      }
    }
  }

  if (start !== null) {
    const durationSec = prev - start + 60;
    if (!best || durationSec > best.durationSec) {
      best = { from: start, to: prev + 60, durationSec };
    }
  }

  return best;
}

// time(sec, KST epoch) → "HH:MM"
function formatKstTime(sec) {
  const msKst = sec * 1000;
  const d = new Date(msKst);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// 페이지 전체용 candle fetch
async function fetchPagedCandles(symbol, interval, targetCount, logCb) {
  let allRows = [];
  let nextCursor = null;
  let page = 0;

  while (allRows.length < targetCount) {
    page += 1;

    const url = new URL("/v5/market/candles/with-gaps", API_BASE);
    url.searchParams.set("symbol", symbol.toUpperCase());
    url.searchParams.set("interval", interval);
    url.searchParams.set("limit", String(PAGE_LIMIT));
    if (nextCursor != null) url.searchParams.set("end", String(nextCursor));

    logCb?.(`[${symbol}] 페이지 ${page} 요청: ${url.toString()}`);
    const res = await fetch(url);
    logCb?.(`[${symbol}] 페이지 ${page} status: ${res.status}`);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    logCb?.(
      `[${symbol}] 페이지 ${page} retCode=${data.retCode}, retMsg=${data.retMsg}`
    );
    if (data.retCode !== 0) {
      throw new Error(`API error (${data.retCode}): ${data.retMsg}`);
    }

    const result = data.result || {};
    const rows = result.list || [];
    logCb?.(`[${symbol}] 페이지 ${page} rows: ${rows.length}`);

    if (!rows.length) break;

    allRows = allRows.concat(rows);
    nextCursor = result.nextCursor;

    if (nextCursor == null) break;
  }

  allRows.sort((a, b) => a[0] - b[0]);

  if (allRows.length > targetCount) {
    allRows = allRows.slice(allRows.length - targetCount);
  }

  logCb?.(`[${symbol}] 총 row 수: ${allRows.length}`);
  return allRows;
}

// ─────────────────────────────────────
// TickerCard (좌측 카드, 코인 스타일)
// ─────────────────────────────────────

function TickerCard({ symbol, stats }) {
  const price = stats?.price ?? null;
  const ma100 = stats?.ma100 ?? null;
  const chg3mPct = stats?.chg3mPct ?? null;

  const has = typeof price === "number" && typeof ma100 === "number" && ma100 !== 0;
  const deltaPct = has ? price / ma100 - 1 : null;
  const up = deltaPct != null ? deltaPct >= 0 : null;

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 14,
        background: "#1a1a1a",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      {/* 헤더: 심볼 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div style={{ fontSize: 14, opacity: 0.9 }}>{symbol}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>CFD 1분봉</div>
      </div>

      {/* 현재가 */}
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>
        {price != null ? fmtComma(price, 1) : "—"}
      </div>

      {/* MA100 대비 / 3분 전 대비 */}
      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          fontWeight: 700,
          display: "flex",
          alignItems: "baseline",
          gap: 10,
        }}
      >
        <span
          style={{
            color:
              up == null ? "#aaa" : up ? "#2fe08d" : "#ff6b6b",
          }}
        >
          MA100 대비{" "}
          {deltaPct != null
            ? `${deltaPct >= 0 ? "▲" : "▼"} ${Math.abs(
                deltaPct * 100
              ).toFixed(2)}%`
            : "--"}
        </span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span
          style={{
            color:
              chg3mPct == null
                ? "#aaa"
                : chg3mPct >= 0
                ? "#2fe08d"
                : "#ff6b6b",
          }}
        >
          3분전{" "}
          {chg3mPct != null
            ? `${chg3mPct >= 0 ? "+" : ""}${chg3mPct.toFixed(3)}%`
            : "—"}
        </span>
      </div>

      {/* 간단 설명 */}
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          lineHeight: 1.6,
          opacity: 0.9,
        }}
      >
        <div>• MA100: {ma100 != null ? fmtComma(ma100, 1) : "—"}</div>
        <div>• 데이터: 최근 {TARGET_CANDLE_COUNT}분 내</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// ChartPanel: 심볼 하나의 차트
// ─────────────────────────────────────

function ChartPanel({ symbol, sessionData, sessionStats, sessionKey }) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const overlayText = useRef("");
  const [overlay, setOverlay] = useState("");

  const CHART_HEIGHT = 320;
  const CHART_WIDTH = 800;

  // 차트 생성
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      layout: { background: { color: "#111" }, textColor: "#ddd" },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderVisible: false,
      },
      rightPriceScale: { borderVisible: false },
      crosshair: { mode: 1 },
      handleScroll: {
        mouseWheel: false,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisDoubleClickReset: false,
        axisPressedMouseMove: false,
        mouseWheel: false,
        pinch: false,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#2fe08d",
      downColor: "#ff6b6b",
      borderUpColor: "#2fe08d",
      borderDownColor: "#ff6b6b",
      wickUpColor: "#2fe08d",
      wickDownColor: "#ff6b6b",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // 세션 변경 시 데이터 반영
  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    if (!sessionKey || !sessionData) return;

    const data = sessionData[sessionKey] || [];
    const stat = sessionStats?.[sessionKey] || { total: 0, real: 0 };

    seriesRef.current.setData(data);

    // x축 06:50~다음날 06:50 고정
    const [y, m, d] = sessionKey.split("-").map(Number);
    const sessionStartUtcMs = Date.UTC(y, m - 1, d, 6, 50, 0);
    const from = Math.floor(sessionStartUtcMs / 1000);
    const to = from + 24 * 60 * 60;
    chartRef.current.timeScale().setVisibleRange({ from, to });

    // 오버레이 계산
    let text = "";
    if (stat.total > 0 && stat.real === 0) {
      text = "휴장";
    } else {
      const gap = detectLongestGapRange(data);
      if (gap && gap.durationSec >= 60 * 60) {
        const fromStr = formatKstTime(gap.from);
        const toStr = formatKstTime(gap.to);
        text = `휴장 ${fromStr} ~ ${toStr}`;
      }
    }
    overlayText.current = text;
    setOverlay(text);
  }, [sessionKey, sessionData, sessionStats]);

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 20, opacity: 0.8, marginBottom: 6 }}>
        {symbol}
      </div>
      <div
        style={{
          position: "relative",
          width: CHART_WIDTH,
          height: CHART_HEIGHT,
          borderRadius: 12,
          overflow: "hidden",
          background: "#111",
        }}
      >
        <div
          ref={wrapRef}
          style={{ width: "100%", height: "100%" }}
        />
        {overlay && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              fontSize: 28,
              fontWeight: 600,
              color: "#9ca3af",
              textShadow: "0 0 8px rgba(0,0,0,0.7)",
              background:
                "radial-gradient(circle at center, rgba(0,0,0,0.4), transparent)",
            }}
          >
            {overlay}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────

function Cfd() {
  const [logText, setLogText] = useState("");
  const [loading, setLoading] = useState(false);

  // 심볼별 rows / 세션 / 카드 통계
  const [rowsMap, setRowsMap] = useState({});
  const [sessionDataMap, setSessionDataMap] = useState({});
  const [sessionStatsMap, setSessionStatsMap] = useState({});
  const [symbolStatsMap, setSymbolStatsMap] = useState({});

  // 전체 세션 날짜 리스트 + 인덱스
  const [allSessionKeys, setAllSessionKeys] = useState([]);
  const [sessionIndex, setSessionIndex] = useState(0);

  const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    setLogText((prev) => prev + line);
    console.log(msg);
  };

  // 세션 날짜 라벨
  const selectedDate = allSessionKeys[sessionIndex] || null;
  const selectedDateLabel = selectedDate ?? "—";

  // 전체 세션키 업데이트
  const recomputeAllSessionKeys = useCallback((sessionDataMapNext) => {
    const set = new Set();
    Object.values(sessionDataMapNext).forEach((g) => {
      Object.keys(g || {}).forEach((k) => set.add(k));
    });
    const arr = Array.from(set).sort();
    setAllSessionKeys(arr);
    if (arr.length) {
      setSessionIndex(arr.length - 1); // 최신 세션으로
    } else {
      setSessionIndex(0);
    }
  }, []);

  // 모든 심볼 한번에 로드
  const loadAll = useCallback(async () => {
    setLoading(true);
    setLogText("");
    try {
      const nextRows = {};
      const nextSessionData = {};
      const nextSessionStats = {};
      const nextSymbolStats = {};

      for (const symbol of SYMBOLS) {
        log(`=== ${symbol} 로딩 시작 ===`);
        const rows = await fetchPagedCandles(
          symbol,
          "1",
          TARGET_CANDLE_COUNT,
          log
        );
        nextRows[symbol] = rows;

        const { groups, stats } = groupBySessionKstWithGaps(rows);
        nextSessionData[symbol] = groups;
        nextSessionStats[symbol] = stats;

        nextSymbolStats[symbol] = buildSymbolStats(rows);
      }

      setRowsMap(nextRows);
      setSessionDataMap(nextSessionData);
      setSessionStatsMap(nextSessionStats);
      setSymbolStatsMap(nextSymbolStats);

      recomputeAllSessionKeys(nextSessionData);
    } catch (e) {
      console.error(e);
      log(`❌ 에러: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [recomputeAllSessionKeys]);

  useEffect(() => {
    // 처음 들어오면 자동 로드
    loadAll();
  }, [loadAll]);

  const atMin = sessionIndex <= 0;
  const atMax = sessionIndex >= allSessionKeys.length - 1;

  const disBtnStyle = (disabled) => ({
    padding: "8px 12px",
    borderRadius: 10,
    border: 0,
    background: disabled ? "#222" : "#2a2a2a",
    color: "#fff",
    fontWeight: 700,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  return (
    <div
      style={{
        padding: 24,
        color: "#fff",
        background: "#111",
        minHeight: "100vh",
      }}
    >
      <h2 style={{ marginBottom: 16 }}>CFD 세션 차트 (US100 / KS200 / XAUUSD)</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 24,
        }}
      >
        {/* 왼쪽: 보기 설정 + 티커 카드들 */}
        <div>
          <div
            style={{
              position: "sticky",
              top: 12,
              zIndex: 5,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {/* 보기 설정 카드 */}
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background: "#1a1a1a",
                marginBottom: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 10 }}>
                  보기 설정
                </div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  세션 날짜: {selectedDateLabel}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={loadAll}
                  disabled={loading}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: 0,
                    background: "#00ffcc",
                    color: "#000",
                    fontWeight: 700,
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  {loading ? "로딩 중..." : "전체 새로고침"}
                </button>
              </div>

              <div style={{ height: 10 }} />

              {/* 전날/오늘/다음날 */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() =>
                    setSessionIndex((i) => Math.max(0, i - 1))
                  }
                  disabled={atMin || !allSessionKeys.length}
                  style={disBtnStyle(atMin || !allSessionKeys.length)}
                >
                  ◀ 이전 세션
                </button>
                <button
                  onClick={() =>
                    setSessionIndex(
                      allSessionKeys.length
                        ? allSessionKeys.length - 1
                        : 0
                    )
                  }
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: 0,
                    background: "#00ffcc",
                    color: "#000",
                    fontWeight: 700,
                  }}
                >
                  최신 세션
                </button>
                <button
                  onClick={() =>
                    setSessionIndex((i) =>
                      Math.min(
                        allSessionKeys.length - 1,
                        i + 1
                      )
                    )
                  }
                  disabled={atMax || !allSessionKeys.length}
                  style={disBtnStyle(atMax || !allSessionKeys.length)}
                >
                  다음 세션 ▶
                </button>
              </div>
            </div>

            {/* 티커 카드들 */}
            <div style={{ display: "grid", gap: 12 }}>
              {SYMBOLS.map((s) => (
                <TickerCard
                  key={s}
                  symbol={s}
                  stats={symbolStatsMap[s]}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 오른쪽: 차트 3개 */}
        <div>
          {SYMBOLS.map((s) => (
            <ChartPanel
              key={s}
              symbol={s}
              sessionData={sessionDataMap[s]}
              sessionStats={sessionStatsMap[s]}
              sessionKey={selectedDate}
            />
          ))}
        </div>
      </div>

      {/* 로그 패널 (디버깅용) */}
      <div
        style={{
          marginTop: 16,
          fontSize: 11,
          whiteSpace: "pre-wrap",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          background: "#020617",
          borderRadius: 8,
          padding: 8,
          maxHeight: 180,
          overflowY: "auto",
          border: "1px solid #374151",
        }}
      >
        {logText}
      </div>
    </div>
  );
}

export default Cfd;
