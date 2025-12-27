// src/pages/coin.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import AssetPanel from "../components/AssetPanel";

import TickerCard from "../components/coin/TickerCard";
import ChartPanel from "../components/coin/ChartPanel";

import { next0650EndBoundaryUtcSec } from "../lib/tradeUtils";

/* ------------------------- 날짜 라벨 ------------------------- */
function selectedDayLabel(offsetDays = 0) {
  const end = next0650EndBoundaryUtcSec() + offsetDays * 86400;
  const start = end - 86400;
  const kstSec = start + 9 * 3600;
  const d = new Date(kstSec * 1000);
  const month = d.getUTCMonth() + 1;
  const date = d.getUTCDate();
  const dow = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${month}월 ${date}일(${dow})`;
}

/* ------------------------- threshold meta ------------------------- */
async function fetchThresholdMeta(symbol, name) {
  const qs = new URLSearchParams({ symbol: String(symbol || "") });
  if (name) qs.set("name", String(name));
  // 필요하면 cross_limit도 같이 걸 수 있음 (예: 10)
  // qs.set("cross_limit", "10");

  const url = `/api/thresholds?${qs.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) || null;
}


/* ------------------------- symbols 추출 유틸 ------------------------- */
// ✅ /api/config 응답 구조가 달라도 symbols를 최대한 찾아서 뽑아냄
function extractSymbolsFromConfig(cfgRaw) {
  // /api/config 이 {config:{...}} 또는 {...} 둘 다 대응
  const root = cfgRaw?.config ?? cfgRaw;
  if (!root) return [];

  const normalize = (raw) => {
    // "BTCUSDT,ETHUSDT" 같은 문자열 지원
    if (typeof raw === "string") {
      raw = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    }
    if (!Array.isArray(raw)) return [];

    // ["BTCUSDT"] or [{symbol:"BTCUSDT"}] or [{name:"BTCUSDT"}] 등 대응
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

  // 1) 루트에서 먼저 찾기
  let symbols = pickFrom(root);
  if (symbols.length) return symbols;

  // 2) 흔한 하위 키들에서 찾기
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

  // 3) 재귀적으로 훑어서 찾기 (마지막 수단)
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

export default function Coin() {
  const [interval, setInterval_] = useState("1");
  const [dayOffset, setDayOffset] = useState(0);

  /* ------------------------- asset ------------------------- */
  const [asset, setAsset] = useState({ wallet: { USDT: 0 }, positions: {} });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/asset", { cache: "no-store" });
        const j = res.ok ? await res.json() : null;
        if (!alive || !j) return;
        setAsset(j.asset);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ------------------------- config ------------------------- */
  const [configState, setConfigState] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/config", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();

        if (alive) setConfigState(j?.config ?? j);
      } catch {
      } finally {
        if (alive) setConfigLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const signalName = useMemo(() => {
    return configState?.name || configState?.exchange || "bybit";
  }, [configState]);

  // ✅ DEFAULT_SYMBOLS 완전 제거: config에서만 symbols 사용
  const symbolsConfig = useMemo(() => {
    const symbols = extractSymbolsFromConfig(configState);
    return symbols.map((sym) => ({ symbol: sym, market: "linear" }));
  }, [configState]);

  const symbolsReady = symbolsConfig.length > 0;

  /* ------------------------- stats / meta ------------------------- */
  const [statsMap, setStatsMap] = useState({});
  const onStats = useCallback((symbol, stats) => {
    setStatsMap((prev) => ({
      ...prev,
      [symbol]: { ...prev[symbol], ...stats },
    }));
  }, []);

  const [metaMap, setMetaMap] = useState({});
  useEffect(() => {
    let alive = true;

    // symbols 없으면 meta 로드도 스킵
    if (!symbolsReady) return;

    (async () => {
      try {
        const results = await Promise.all(
  symbolsConfig.map((s) => fetchThresholdMeta(s.symbol, signalName).catch(() => null))
);

        if (!alive) return;

        const merged = {};
        results.forEach((m, i) => {
          if (m) merged[symbolsConfig[i].symbol] = m;
        });
        setMetaMap((prev) => ({ ...prev, ...merged }));
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, [symbolsConfig, symbolsReady,signalName]);

  /* ------------------------- bounds (dayOffset clamp) ------------------------- */
  const requiredSymbols = useMemo(
    () => symbolsConfig.map((s) => s.symbol),
    [symbolsConfig]
  );

  const [perSymbolBounds, setPerSymbolBounds] = useState({});
  const onBounds = useCallback((symbol, bounds) => {
    setPerSymbolBounds((prev) => ({ ...prev, [symbol]: bounds }));
  }, []);

  const { minOffset, maxOffset, boundsReady } = useMemo(() => {
    if (!symbolsReady) return { minOffset: 0, maxOffset: 0, boundsReady: false };

    const haveAll = requiredSymbols.every((sym) => perSymbolBounds[sym]);
    if (!haveAll) return { minOffset: 0, maxOffset: 0, boundsReady: false };

    const values = requiredSymbols.map((sym) => perSymbolBounds[sym]);
    const minCommon = Math.max(...values.map((b) => b.min ?? 0));
    const maxCommon = Math.min(...values.map((b) => b.max ?? 0));
    return { minOffset: minCommon, maxOffset: maxCommon, boundsReady: true };
  }, [perSymbolBounds, requiredSymbols, symbolsReady]);

  useEffect(() => {
    if (interval !== "1" || !boundsReady) return;
    setDayOffset((d) => Math.min(Math.max(d, minOffset), maxOffset));
  }, [interval, boundsReady, minOffset, maxOffset]);

  const atMin = interval === "1" && boundsReady && dayOffset <= minOffset;
  const atMax = interval === "1" && boundsReady && dayOffset >= maxOffset;

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

  /* ------------------------- UI (config 없으면 안내) ------------------------- */
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
            개발자 콘솔(F12)에서 <b>[/api/config raw]</b> 로그를 확인해서,
            symbols가 어떤 키에 들어오는지 보고 알려줘.
          </span>
        </div>
      </div>
    );
  }

  /* ------------------------- main render ------------------------- */
  return (
    <div style={{ padding: 24, color: "#fff", background: "#111", minHeight: "100vh" }}>
      <AssetPanel asset={asset} statsBySymbol={statsMap} config={configState} />

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
                {interval === "1" && <div style={{ fontSize: 12, opacity: 0.85 }}>{selectedDayLabel(dayOffset)}</div>}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    setInterval_("1");
                    setDayOffset(0);
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: 0,
                    background: interval === "1" ? "#00ffcc" : "#2a2a2a",
                    color: interval === "1" ? "#000" : "#fff",
                    fontWeight: 700,
                  }}
                >
                  1분봉
                </button>
                <button
                  onClick={() => setInterval_("D")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: 0,
                    background: interval === "D" ? "#00ffcc" : "#2a2a2a",
                    color: interval === "D" ? "#000" : "#fff",
                    fontWeight: 700,
                  }}
                >
                  1일봉
                </button>
              </div>

              {interval === "1" && (
                <>
                  <div style={{ height: 10 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setDayOffset((d) => Math.max(minOffset, d - 1))}
                      disabled={!boundsReady || atMin}
                      style={disBtnStyle(!boundsReady || atMin)}
                      title="전날 보기"
                    >
                      ◀ 전날
                    </button>
                    <button
                      onClick={() => setDayOffset(0)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 10,
                        border: 0,
                        background: "#00ffcc",
                        color: "#000",
                        fontWeight: 700,
                      }}
                      title="오늘 보기"
                    >
                      오늘
                    </button>
                    <button
                      onClick={() => setDayOffset((d) => Math.min(maxOffset, d + 1))}
                      disabled={!boundsReady || atMax}
                      style={disBtnStyle(!boundsReady || atMax)}
                      title="다음날 보기"
                    >
                      다음날 ▶
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {symbolsConfig.map((s) => (
              <TickerCard
                key={s.symbol}
                symbol={s.symbol}
                interval={interval}
                stats={statsMap[s.symbol]}
                meta={metaMap[s.symbol]}
              />
            ))}
          </div>
        </div>

        {/* 오른쪽 */}
        <div>
          {symbolsConfig.map((s) => (
            <ChartPanel
              key={s.symbol}
              symbol={s.symbol}
              globalInterval={interval}
              dayOffset={dayOffset}
              onBounds={onBounds}
              onStats={onStats}
              thr={metaMap[s.symbol]?.ma_threshold}
              crossTimes={metaMap[s.symbol]?.cross_times}
              signalName={signalName}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
