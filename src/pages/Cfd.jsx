// src/pages/Cfd.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import CfdChartPanel from "../components/cfd/CfdChartPanel";
import TickerCard from "../components/cfd/TickerCard";

/* ------------------------- symbols 추출 유틸 (coin.jsx 동일) ------------------------- */
function extractSymbolsFromConfig(cfgRaw) {
  const root = cfgRaw?.config ?? cfgRaw;
  if (!root) return [];

  const normalize = (raw) => {
    if (typeof raw === "string") {
      raw = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(raw)) return [];

    const out = [];
    for (const it of raw) {
      if (it == null) continue;
      if (typeof it === "string" || typeof it === "number") {
        out.push(String(it));
        continue;
      }
      if (typeof it === "object") {
        const s =
          it.symbol ??
          it.sym ??
          it.name ??
          it.ticker ??
          it.pair ??
          it.market ??
          it.code ??
          null;
        if (s) out.push(String(s));
      }
    }

    return out
      .map((s) => String(s).trim())
      .filter(Boolean)
      .map((s) => s.toUpperCase());
  };

  const pickFrom = (obj) => {
    if (!obj || typeof obj !== "object") return [];
    const raw =
      obj.symbols ??
      obj.trade_symbols ??
      obj.target_symbols ??
      obj.targets ??
      obj.pairs ??
      obj.markets ??
      obj.instruments ??
      obj.watchlist ??
      null;
    return normalize(raw);
  };

  let symbols = pickFrom(root);
  if (symbols.length) return symbols;

  const candidates = [
    root.bybit,
    root.mt5,
    root.bot,
    root.bots,
    root.strategy,
    root.strategies,
    root.config,
    root.settings,
    root.params,
  ];
  for (const c of candidates) {
    symbols = pickFrom(c);
    if (symbols.length) return symbols;
  }

  const seen = new Set();
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);

    symbols = pickFrom(cur);
    if (symbols.length) return symbols;

    for (const v of Object.values(cur)) {
      if (v && typeof v === "object") stack.push(v);
    }
  }

  return [];
}

/* ------------------------- threshold meta ------------------------- */
async function fetchThresholdMeta(symbol, name) {
  const qs = new URLSearchParams({ symbol: String(symbol || "") });
  if (name) qs.set("name", String(name));
  // qs.set("cross_limit", "10"); // 원하면
  const url = `/api/thresholds?${qs.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) || null;
}



function sessionKeyLabel(sessionKey) {
  if (!sessionKey) return "—";
  const d = new Date(`${sessionKey}T00:00:00.000Z`);
  const month = d.getUTCMonth() + 1;
  const date = d.getUTCDate();
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${month}월 ${date}일(${dow})`;
}

export default function Cfd() {
  /* ------------------------- config ------------------------- */
  const [configState, setConfigState] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
const signalName = useMemo(() => {
  return configState?.name || configState?.exchange || "mt5_signal";
}, [configState]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/config?name=mt5_signal", { cache: "no-store" });
        const j = r.ok ? await r.json() : null;
        if (!alive) return;
        setConfigState(j?.config ?? j);
      } finally {
        if (alive) setConfigLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const symbols = useMemo(() => extractSymbolsFromConfig(configState), [configState]);
  const symbolsReady = symbols.length > 0;

  /* ------------------------- threshold meta ------------------------- */
  const [metaMap, setMetaMap] = useState({});

  useEffect(() => {
    let alive = true;
    if (!symbolsReady) return;

    (async () => {
      try {
        const namespace = "mt5_signal"; // 지금 페이지가 이 config를 쓰니까 고정
const results = await Promise.all(
  symbols.map((s) => fetchThresholdMeta(s, namespace).catch(() => null))
);

        if (!alive) return;

        const merged = {};
        results.forEach((m, i) => {
          if (m) merged[symbols[i]] = m;
        });
        setMetaMap((prev) => ({ ...prev, ...merged }));
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, [symbols, symbolsReady, signalName]);

  /* ------------------------- stats from panels ------------------------- */
  const [symbolStatsMap, setSymbolStatsMap] = useState({});
  const onStats = useCallback((symbol, stats) => {
    setSymbolStatsMap((prev) => ({ ...prev, [symbol]: { ...prev[symbol], ...stats } }));
  }, []);

  /* ------------------------- session keys aggregation ------------------------- */
  const [sessionKeysBySymbol, setSessionKeysBySymbol] = useState({});
  const onSessionKeys = useCallback((symbol, keys) => {
    setSessionKeysBySymbol((prev) => ({ ...prev, [symbol]: keys || [] }));
  }, []);

  const allSessionKeys = useMemo(() => {
    const set = new Set();
    Object.values(sessionKeysBySymbol).forEach((arr) => (arr || []).forEach((k) => set.add(k)));
    return Array.from(set).sort();
  }, [sessionKeysBySymbol]);

  const [sessionIndex, setSessionIndex] = useState(0);

  useEffect(() => {
    if (!allSessionKeys.length) return;
    setSessionIndex(allSessionKeys.length - 1);
  }, [allSessionKeys.join("|")]);

  const selectedDate = allSessionKeys[sessionIndex] || null;

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

  /* ------------------------- UI ------------------------- */
  if (!configLoaded) {
    return (
      <div style={{ padding: 24, color: "#fff", background: "#111", minHeight: "100vh" }}>
        <div style={{ opacity: 0.85 }}>config 로딩중...</div>
      </div>
    );
  }

  if (!symbolsReady) {
    return (
      <div style={{ padding: 24, color: "#fff", background: "#111", minHeight: "100vh" }}>
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            lineHeight: 1.6,
          }}
        >
          config에서 symbols를 못 가져왔어.
          <br />
          <span style={{ opacity: 0.75 }}>
            개발자 콘솔(F12)에서 <b>/api/config?name=mt5_signal</b> 응답을 확인해봐.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, color: "#fff", background: "#111", minHeight: "100vh" }}>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 14, opacity: 0.95 }}>
        CFD 세션 차트 <span style={{ opacity: 0.6, fontWeight: 700 }}>({symbols.join(" / ")})</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 24 }}>
        {/* 왼쪽 */}
        <div>
          <div
            style={{
              position: "sticky",
              top: 12,
              zIndex: 5,
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 14,
                background: "#1a1a1a",
                marginBottom: 14,
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>보기 설정</div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {selectedDate ? sessionKeyLabel(selectedDate) : "—"}
                  {selectedDate ? <span style={{ opacity: 0.65 }}> ({selectedDate})</span> : null}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setSessionIndex((i) => Math.max(0, i - 1))}
                  disabled={!allSessionKeys.length || atMin}
                  style={disBtnStyle(!allSessionKeys.length || atMin)}
                  title="이전 세션"
                >
                  ◀ 이전
                </button>

                <button
                  onClick={() => setSessionIndex(allSessionKeys.length ? allSessionKeys.length - 1 : 0)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: 0,
                    background: "#00ffcc",
                    color: "#000",
                    fontWeight: 700,
                  }}
                  title="최신 세션"
                >
                  최신
                </button>

                <button
                  onClick={() => setSessionIndex((i) => Math.min(allSessionKeys.length - 1, i + 1))}
                  disabled={!allSessionKeys.length || atMax}
                  style={disBtnStyle(!allSessionKeys.length || atMax)}
                  title="다음 세션"
                >
                  다음 ▶
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {symbols.map((s) => (
              <TickerCard key={s} symbol={s} stats={symbolStatsMap[s]} meta={metaMap[s]} />
            ))}
          </div>
        </div>

        {/* 오른쪽 */}
        <div>
          {symbols.map((s) => (
            <CfdChartPanel
              key={s}
              symbol={s}
              sessionKey={selectedDate}
              thr={metaMap[s]?.ma_threshold}
              crossTimes={metaMap[s]?.cross_times}
              onStats={onStats}
              onSessionKeys={onSessionKeys}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
