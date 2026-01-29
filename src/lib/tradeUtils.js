// src/lib/tradeUtils.js

/* ──────────────────────────────
 * KST/포맷/시간 유틸
 * ────────────────────────────── */
const KST_OFFSET_MS = 9 * 3600 * 1000;
const KST_OFFSET_SEC = 9 * 3600;
const DAY_SEC = 24 * 3600;

const pad2 = (n) => String(n).padStart(2, "0");

const BYBIT_API_BASE = "https://api.bybit.com";

export async function fetchPriceScaleBybit(symbol, category = "linear") {
  const url = new URL("/v5/market/instruments-info", BYBIT_API_BASE);
  url.searchParams.set("category", category);
  url.searchParams.set("symbol", String(symbol || "").toUpperCase());

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.retCode !== 0) throw new Error(`API error (${data?.retCode}): ${data?.retMsg}`);

  const item = data?.result?.list?.[0];
  const ps = item?.priceFilter?.priceScale ?? item?.priceScale;
  const n = Number(ps);
  return Number.isFinite(n) ? n : null;
}

const _priceScaleCache = new Map();

export async function fetchPriceScaleBybitCached(symbol, category = "linear") {
  const key = `${category}:${String(symbol || "").toUpperCase()}`;
  if (_priceScaleCache.has(key)) return _priceScaleCache.get(key);
  const p = fetchPriceScaleBybit(symbol, category).catch(() => null);
  _priceScaleCache.set(key, p);
  return p;
}


// ✅ 기존 fmtComma 교체
export const fmtComma = (v, d = null) => {
    if (!(typeof v === "number" && isFinite(v))) return "—";

    // d를 주면: 그 자릿수로 고정
    if (typeof d === "number" && d >= 0) {
        return v.toLocaleString(undefined, {
            maximumFractionDigits: d,
            minimumFractionDigits: d,
        });
    }

    // d를 안 주면: 자동(불필요한 0 안 붙이고, 있는 소수는 유지)
    return v.toLocaleString(undefined, {
        maximumFractionDigits: 12, // 너무 길어지는 것만 방지
    });
};


const _toDateKST = (sec) => new Date(sec * 1000 + KST_OFFSET_MS);

export const fmtKSTFull = (sec) => {
    if (!sec) return "";
    const d = _toDateKST(sec);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} KST`;
};

export const fmtKSTHour = (sec) => {
    const d = _toDateKST(sec);
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
};

export const fmtKSTHMS = (sec) => {
    const d = _toDateKST(sec);
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
};

export const fmtKSTMonth = (sec) => {
    const d = _toDateKST(sec);
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

export const getTs = (t) => (typeof t === "number" ? t : (t?.timestamp || 0));

/* ──────────────────────────────
 * 06:50 KST 세션 윈도우
 * ────────────────────────────── */

// 마지막 바 기준 KST 06:50 anchor(UTC초)
export function getAnchorKst0650UtcSec(bars) {
    if (!bars?.length) return null;
    const lastUtc = bars[bars.length - 1].time; // sec
    const kst = lastUtc + KST_OFFSET_SEC;
    const SIX50 = 6 * 3600 + 50 * 60;
    const sessionStartKst = Math.floor((kst - SIX50) / DAY_SEC) * DAY_SEC + SIX50;
    return sessionStartKst - KST_OFFSET_SEC; // back to UTC
}

// 끝 경계: 지금 기준 "다음 06:50 KST" (UTC초)
export function next0650EndBoundaryUtcSec(nowSec = Math.floor(Date.now() / 1000)) {
    const SIX50 = 6 * 3600 + 50 * 60;
    const kst = nowSec + KST_OFFSET_SEC;
    const today0650 = Math.floor((kst - SIX50) / DAY_SEC) * DAY_SEC + SIX50; // 오늘 06:50(KST)
    const endKst = kst < today0650 ? today0650 : (today0650 + DAY_SEC);      // 다음 06:50(KST)
    return endKst - KST_OFFSET_SEC; // back to UTC
}

// 분 단위 "빈 캔들(whitespace)" 생성: [from, to) 범위에서 60초 간격
export function genMinutePlaceholders(fromSec, toSec) {
    const out = [];
    const start = Math.max(0, Math.floor(fromSec / 60) * 60);
    const end = Math.max(0, Math.floor(toSec / 60) * 60);
    for (let t = start; t < end; t += 60) out.push({time: t}); // lightweight-charts whitespace point
    return out;
}

// buildSignalAnnotations 안(혹은 파일 상단)에 추가
function normalizeReasons(s) {
    // 1) 기존 호환: reasons가 이미 배열이면 그대로
    if (Array.isArray(s?.reasons)) return s.reasons;

    // 2) 새 필드: reasons_json이 배열로 오는 경우(혹시나) 그대로
    if (Array.isArray(s?.reasons_json)) return s.reasons_json;

    // 3) 새 필드: reasons_json이 JSON 문자열이면 파싱
    const rj = s?.reasons_json;
    if (typeof rj === "string" && rj.trim()) {
        try {
            const parsed = JSON.parse(rj);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            // JSON 파싱 실패 시 fallthrough
        }
        // JSON이 아니고 그냥 문자열이면 한 줄 reason으로라도 처리
        return [rj];
    }

    return [];
}

/* ──────────────────────────────
 * 가격 시계열 계산
 * ────────────────────────────── */
export function calcSMA(bars, win = 100) {
    const out = [];
    let sum = 0;
    const q = [];
    for (const b of bars) {
        const v = Number(b.close ?? b.c ?? b.value ?? 0);
        q.push(v);
        sum += v;
        if (q.length > win) sum -= q.shift();
        if (q.length === win) out.push({time: b.time, value: sum / win});
    }
    return out;
}

export function calcLatestMAValue(bars, win = 100) {
    if (!Array.isArray(bars) || bars.length < win) return null;
    let sum = 0;
    for (let i = bars.length - win; i < bars.length; i++) {
        sum += Number(bars[i].close ?? bars[i].c ?? bars[i].value ?? 0);
    }
    return sum / win;
}

export function sliceWithBuffer(bars, start, end, buf = 99) {
    if (!bars.length) return [];
    let i = bars.findIndex((b) => b.time >= start);
    if (i === -1) i = bars.length;
    const from = Math.max(0, i - buf);
    const toIdx = bars.findIndex((b) => b.time >= end);
    const j = toIdx === -1 ? bars.length : toIdx;
    return bars.slice(from, j);
}

export function mergeBars(arr, bar) {
    if (!arr || !arr.length) return [bar];
    const last = arr[arr.length - 1];
    if (bar.time === last.time) return arr.slice(0, -1).concat(bar);
    if (bar.time > last.time) return arr.concat(bar);
    const idx = arr.findIndex((x) => x.time === bar.time);
    if (idx >= 0) {
        const next = arr.slice();
        next[idx] = bar;
        return next;
    }
    return arr;
}

export async function fetchSignals(symbol, name = "bybit", days = 7) {
    const now = Date.now();
    const from = now - days * 86400 * 1000;

    const sp = new URLSearchParams({
        symbol: String(symbol || "").toUpperCase(),
        name: String(name || "bybit"),
        from: new Date(from).toISOString(),
        to: new Date(now).toISOString(),
    });

    const res = await fetch(`/api/signals?${sp.toString()}`, {cache: "no-store"});
    const j = await res.json().catch(() => ({}));
    return Array.isArray(j?.signals) ? j.signals : [];
}


export function buildSignalAnnotations(sigs) {
    const items = (Array.isArray(sigs) ? sigs : [])
        .map((s) => {
            // ✅ API가 timeSec를 내려주므로 최우선 사용
            let timeSec = Number(s?.timeSec);
            if (!Number.isFinite(timeSec) || timeSec <= 0) {
                const tsMs = Number(s?.ts_ms);
                if (Number.isFinite(tsMs) && tsMs > 0) timeSec = Math.floor(tsMs / 1000);
            }
            if (!Number.isFinite(timeSec) || timeSec <= 0) return null;

            const sessionKey = sessionKeyKST_0650(timeSec);

            // ✅ kind/side 표준화 (OPEN/CLOSE 기준)
            const kindU = String(s?.kind || "").toUpperCase().trim();
            const sideU = String(s?.side || "").toUpperCase().trim();

            return {...s, kind: kindU, side: sideU, timeSec, sessionKey};
        })
        .filter(Boolean)
        .sort((a, b) => a.timeSec - b.timeSec);

    const bySession = new Map();
    for (const s of items) {
        if (!bySession.has(s.sessionKey)) bySession.set(s.sessionKey, []);
        bySession.get(s.sessionKey).push(s);
    }

    const annotated = [];
    for (const list of bySession.values()) {
        list
            .sort((a, b) => a.timeSec - b.timeSec)
            .forEach((s, idx) => annotated.push({...s, seq: idx + 1}));
    }
    annotated.sort((a, b) => a.timeSec - b.timeSec);

    const markers = [];
    const notes = [];

    for (const s of annotated) {
        const kindU = String(s.kind || "").toUpperCase();

        // ✅ 표준 kind: ENTRY/EXIT로 통일 (OPEN/CLOSE 방어)
        const kindStd = kindU === "OPEN" ? "ENTRY" : kindU === "CLOSE" ? "EXIT" : kindU;

        const isEntry = kindStd === "ENTRY";
        const isExit = kindStd === "EXIT";

        const isLong = s.side === "LONG";
        const isShort = s.side === "SHORT";

        let position = "aboveBar";
        // ✅ 투명도를 적용한 RGBA 색상 정의 (0.5 = 50% 투명도)
        const COLOR_LONG = "rgba(47, 224, 141, 0.7)";  // 기존 #2fe08d
        const COLOR_SHORT = "rgba(255, 107, 107, 0.7)"; // 기존 #ff6b6b
        const COLOR_IDLE = "rgba(255, 209, 102, 0.7)";  // 기존 #ffd166

        let color = COLOR_IDLE;
        let shape = "arrowDown";

        // ✅ 조건별 색상 및 위치 설정
        if (isEntry && isLong) {
            position = "belowBar";
            color = COLOR_LONG;
            shape = "arrowUp";
        }
        if (isEntry && isShort) {
            position = "aboveBar";
            color = COLOR_SHORT;
            shape = "arrowDown";
        }
        if (isExit && isLong) {
            position = "aboveBar";
            color = COLOR_LONG;
            shape = "arrowDown";
        }
        if (isExit && isShort) {
            position = "belowBar";
            color = COLOR_SHORT;
            shape = "arrowUp";
        }

        const shortLabel = isLong ? (isEntry ? "진입 L" : "청산 L") : (isEntry ? "진입 S" : "청산 S");

        markers.push({
            time: s.timeSec, position, color, shape, text: `#${s.seq} ${shortLabel}`, size: 2,
        });

        notes.push({
            key: `${s.sessionKey}#${s.seq}`,
            timeSec: s.timeSec,
            sessionKey: s.sessionKey,
            seq: s.seq,
            kind: kindStd,
            side: s.side,
            price: s.price,
            reasons: normalizeReasons(s),
        });
    }

    return {markers, notes};
}


// 세션 키 (YYYY-MM-DD @ 06:50 KST)
export function sessionKeyKST_0650(tsSec) {
    const kst = tsSec + KST_OFFSET_SEC;
    const SIX50 = 6 * 3600 + 50 * 60;
    const sessionStartKst = Math.floor((kst - SIX50) / DAY_SEC) * DAY_SEC + SIX50;
    const d = new Date((sessionStartKst - KST_OFFSET_SEC) * 1000);
    const yyyy = d.toLocaleString("ko-KR", {timeZone: "Asia/Seoul", year: "numeric"});
    const mm = d.toLocaleString("ko-KR", {timeZone: "Asia/Seoul", month: "2-digit"});
    const dd = d.toLocaleString("ko-KR", {timeZone: "Asia/Seoul", day: "2-digit"});
    return `${yyyy}-${mm}-${dd}`;
}

/* ──────────────────────────────
 * 최소 WS 허브 (Bybit public linear)
 * ────────────────────────────── */

/* ──────────────────────────────
 * 최소 WS 허브 (URL 주입형, Bybit/내서버 공용)
 * ────────────────────────────── */
class WsHub {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.connected = false;
        this.pendingTopics = new Set();
        this.handlers = new Map();     // topic -> Set<fn>
        this.queue = [];               // 연결 전 요청 토픽
        this.statusHandlers = new Set();
        this._pingTimer = null;
        this._connect();
    }

    _emitStatus() {
        this.statusHandlers.forEach((fn) => {
            try {
                fn(this.connected);
            } catch {
            }
        });
    }

    onStatus(fn) {
        this.statusHandlers.add(fn);
        try {
            fn(this.connected);
        } catch {
        }
        return () => this.statusHandlers.delete(fn);
    }

    _connect() {
        if (this.ws) return;

        const ws = new WebSocket(this.url);
        this.ws = ws;

        ws.onopen = () => {
            this.connected = true;
            this._emitStatus();

            // flush queued topics
            if (this.queue.length) {
                const args = [...new Set(this.queue)];
                try {
                    ws.send(JSON.stringify({op: "subscribe", args}));
                } catch {
                }
                args.forEach((t) => this.pendingTopics.add(t));
                this.queue = [];
            }

            // keep-alive ping (Bybit는 ping/pong 지원, 내 서버는 무시해도 OK)
            try {
                clearInterval(this._pingTimer);
            } catch {
            }
            this._pingTimer = setInterval(() => {
                try {
                    this.ws?.send(JSON.stringify({op: "ping"}));
                } catch {
                }
            }, 20000);
        };

        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data || "{}");

                // bybit pong or server ack
                if (msg.op === "pong") return;
                if (msg.op && msg.op !== "pong") return;

                const topic = msg?.topic;
                if (!topic) return;

                const set = this.handlers.get(topic);
                if (!set || set.size === 0) return;

                // bybit는 data 배열일 수 있음 / 내 서버도 배열일 수 있음
                const payload = Array.isArray(msg.data) ? (msg.data[msg.data.length - 1] ?? msg.data[0]) : msg.data;

                set.forEach((fn) => {
                    try {
                        fn(payload);
                    } catch {
                    }
                });
            } catch {
            }
        };

        ws.onclose = () => {
            this.ws = null;
            this.connected = false;
            this._emitStatus();
            try {
                clearInterval(this._pingTimer);
            } catch {
            }
            setTimeout(() => this._connect(), 1200);
        };

        ws.onerror = () => {
            try {
                clearInterval(this._pingTimer);
            } catch {
            }
            try {
                this.ws?.close();
            } catch {
            }
        };
    }

    ensureSubscribe(topic) {
        if (this.pendingTopics.has(topic)) return;
        if (this.connected) {
            try {
                this.ws?.send(JSON.stringify({op: "subscribe", args: [topic]}));
            } catch {
            }
            this.pendingTopics.add(topic);
        } else {
            this.queue.push(topic);
        }
    }

    subscribe(topics) {
        const arr = Array.isArray(topics) ? topics : [topics];
        arr.forEach((t) => this.ensureSubscribe(t));
    }

    unsubscribe(topics) {
        const arr = Array.isArray(topics) ? topics : [topics];
        arr.forEach((t) => {
            this.pendingTopics.delete(t);
            try {
                this.ws?.send(JSON.stringify({op: "unsubscribe", args: [t]}));
            } catch {
            }
        });
    }

    addListener(topic, fn) {
        this.ensureSubscribe(topic);
        if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
        this.handlers.get(topic).add(fn);

        return () => {
            const set = this.handlers.get(topic);
            if (set) set.delete(fn);
            if (set && set.size === 0) {
                this.handlers.delete(topic);
                this.pendingTopics.delete(topic);
                try {
                    this.ws?.send(JSON.stringify({op: "unsubscribe", args: [topic]}));
                } catch {
                }
            }
        };
    }
}

/* ✅ URL별 허브 캐시: "하나의 wsHub"처럼 쓰되, 내부는 URL마다 따로 연결 */
const _hubCache = new Map();

/**
 * getWsHub(url)
 * - 같은 url이면 같은 허브 인스턴스를 반환(연결/구독 공유)
 * - 다른 url이면 다른 허브 인스턴스(coin/bybit vs cfd/내서버)로 분리
 */
export function getWsHub(url) {
    const key = String(url || "");
    if (!key) throw new Error("getWsHub(url) requires url");
    if (_hubCache.has(key)) return _hubCache.get(key);
    const hub = new WsHub(key);
    _hubCache.set(key, hub);
    return hub;
}
// === 평가/자산 계산 유틸 ===
export function lastPriceFromStats(stats) {
    if (!stats) return null;
    if (typeof stats.price1m === "number") return stats.price1m;
    if (typeof stats.priceD === "number") return stats.priceD;
    return null;
}

export function calcSidePnl(side, qty, avg, px) {
    if (!qty || !avg || !px) return {pnl: 0, pnlPct: null};
    const pnl = side === "LONG" ? (px - avg) * qty : (avg - px) * qty;
    const pnlPct = (px / avg - 1) * (side === "LONG" ? 100 : -100);
    return {pnl, pnlPct};
}

export function buildPositionRows(asset, statsBySymbol) {
    const rows = [];
    let pnlSum = 0;

    const positions = (asset && asset.positions) ? asset.positions : {};
    for (const sym of Object.keys(positions)) {
        const pos = positions[sym] || {};
        const px = lastPriceFromStats(statsBySymbol?.[sym]);

        for (const side of ["LONG", "SHORT"]) {
            const s = pos[side];
            if (!s || !px) continue;
            const qty = +s.qty || 0;
            const avg = +s.avg_price || 0;
            if (qty <= 0 || avg <= 0) continue;

            const {pnl, pnlPct} = calcSidePnl(side, qty, avg, px);
            pnlSum += pnl;
            rows.push({sym, side, qty, avg, px, pnl, pnlPct});
        }
    }
    return {rows, pnlSum};
}

export function calcEquityUSDT(asset, statsBySymbol) {
    const wallet = +(asset?.wallet?.USDT ?? 0);
    const {pnlSum} = buildPositionRows(asset, statsBySymbol);
    return wallet + pnlSum;
}

/**
 * 보라색 점(Cross Markers) 생성 함수
 */
export function buildCrossMarkers(crossTimesArr, fromSec, toSec) {
    if (!Array.isArray(crossTimesArr) || crossTimesArr.length === 0) return [];

    // ✅ 보라색 투명도 적용 (rgba)
    const MARKER_COLOR = "rgba(167, 139, 250)";

    const items = crossTimesArr
        .map((c, idx) => {
            // 날짜 문자열을 Epoch 초로 변환하는 로직 (기존 ChartPanel에 있던 것)
            const s = String(c.time || "");
            const iso = s.includes("T") ? s : s.replace(" ", "T");
            const withTz = /[zZ]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}+09:00`;
            const t = Date.parse(withTz);
            const ts = Number.isFinite(t) ? Math.floor(t / 1000) : NaN;

            return {
                idx: idx + 1,
                dir: String(c.dir || "").toUpperCase(),
                ts: ts,
            };
        })
        .filter((x) => Number.isFinite(x.ts))
        .sort((a, b) => a.ts - b.ts);

    const out = [];
    for (const it of items) {
        if (it.ts < fromSec || it.ts >= toSec) continue;
        out.push({
            time: it.ts,
            position: it.dir === "UP" ? "aboveBar" : "belowBar",
            shape: "circle",
            color: MARKER_COLOR,
            text: String(it.idx),
            size: 1, // 점 크기 조절
        });
    }
    return out;
}

