// src/lib/tradeUtils.js

/* ──────────────────────────────
 * KST/포맷/시간 유틸
 * ────────────────────────────── */
const KST_OFFSET_MS = 9 * 3600 * 1000;
const KST_OFFSET_SEC = 9 * 3600;
const DAY_SEC = 24 * 3600;

const pad2 = (n) => String(n).padStart(2, "0");

export const fmtComma = (v, d = 0) =>
  (typeof v === "number" && isFinite(v))
    ? v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d })
    : "—";

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

// (기존) 06:50~다음날 06:50 (UTC초 범위)
export function getWindowRangeUtcFromBars(bars, offsetDays) {
  const anchor0650Utc = getAnchorKst0650UtcSec(bars);
  if (anchor0650Utc == null) return [0, 0];
  const startUtc = anchor0650Utc + offsetDays * DAY_SEC;
  return [startUtc, startUtc + DAY_SEC];
}

// 끝 경계: 지금 기준 "다음 06:50 KST" (UTC초)
export function next0650EndBoundaryUtcSec(nowSec = Math.floor(Date.now()/1000)) {
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
  for (let t = start; t < end; t += 60) out.push({ time: t }); // lightweight-charts whitespace point
  return out;
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
    if (q.length === win) out.push({ time: b.time, value: sum / win });
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

/* ──────────────────────────────
 * REST 누적 로딩 (/api/klines 프록시 사용)
 * ────────────────────────────── */
export async function fetchAllKlines(symbol, interval, keep) {
  const perPages = 3; // 호출당 페이지 수 (작게 유지)
  let cursor;
  const acc = [];
  const softDeadline = Date.now() + 12_000; // 12초 제한

  while (acc.length < keep) {
    const sp = new URLSearchParams({
      symbol,
      interval,
      limit: String(keep),
      pages: String(perPages),
    });
    if (cursor) sp.set("cursor", String(cursor));

    const resp = await fetch(`/api/klines?${sp.toString()}`, { cache: "no-store" });
    const json = await resp.json();
    if (!resp.ok || json?.retCode !== 0) {
      throw new Error(`klines bad response: ${resp.status} ${json?.retMsg || ""}`);
    }

    const rows = Array.isArray(json?.list) ? json.list : [];
    for (const r of rows) {
      let t = Number(r.time);
      if (t > 1e12) t = Math.floor(t / 1000); // ms->sec 안전화
      acc.push({ time: t, open: +r.open, high: +r.high, low: +r.low, close: +r.close });
    }

    cursor = json?.nextCursor ?? null;
    if (!cursor || acc.length >= keep || Date.now() >= softDeadline) break;
  }
  acc.sort((a, b) => a.time - b.time);
  return acc.slice(-keep);
}

/* ──────────────────────────────
 * 시그널 어노테이션 (옵션)
 * ────────────────────────────── */
export async function fetchSignals(symbol) {
  const res = await fetch(`/api/signals?symbol=${symbol}&days=7`, { cache: "no-store" });
  const j = await res.json().catch(() => ({}));
  return Array.isArray(j?.signals) ? j.signals : [];
}

export function buildSignalAnnotations(sigs) {
  const items = (Array.isArray(sigs) ? sigs : [])
    .map((s) => {
      const ts = s.ts || s.time || s.timeSec;
      const timeSec = s.timeSec ? Number(s.timeSec) : Math.floor(new Date(ts).getTime() / 1000);
      const sessionKey = sessionKeyKST_0650(timeSec);
      return { ...s, timeSec, sessionKey };
    })
    .sort((a, b) => a.timeSec - b.timeSec);

  const bySession = new Map();
  for (const s of items) {
    if (!bySession.has(s.sessionKey)) bySession.set(s.sessionKey, []);
    bySession.get(s.sessionKey).push(s);
  }

  const annotated = [];
  for (const list of bySession.values()) {
    list.sort((a, b) => a.timeSec - b.timeSec).forEach((s, idx) => {
      annotated.push({ ...s, seq: idx + 1 });
    });
  }
  annotated.sort((a, b) => a.timeSec - b.timeSec);

  const markers = [];
  const notes = [];
  for (const s of annotated) {
    const isEntry = s.kind === "ENTRY";
    const isExit = s.kind === "EXIT";
    const isLong = s.side === "LONG";
    const isShort = s.side === "SHORT";

    let position = "aboveBar";
    let color = "#ffd166";
    let shape = "arrowDown";
    if (isEntry && isLong) { position = "belowBar"; color = "#2fe08d"; shape = "arrowUp"; }
    if (isEntry && isShort) { position = "aboveBar"; color = "#ff6b6b"; shape = "arrowDown"; }
    if (isExit && isLong) { position = "aboveBar"; color = "#2fe08d"; shape = "arrowDown"; }
    if (isExit && isShort) { position = "belowBar"; color = "#ff6b6b"; shape = "arrowUp"; }

    markers.push({ time: s.timeSec, position, color, shape, text: `#${s.seq}` });
    notes.push({
      key: `${s.sessionKey}#${s.seq}`,
      timeSec: s.timeSec,
      sessionKey: s.sessionKey,
      seq: s.seq,
      kind: s.kind,
      side: s.side,
      price: s.price,
      reasons: Array.isArray(s.reasons) ? s.reasons : [],
    });
  }
  return { markers, notes };
}

// 세션 키 (YYYY-MM-DD @ 06:50 KST)
export function sessionKeyKST_0650(tsSec) {
  const kst = tsSec + KST_OFFSET_SEC;
  const SIX50 = 6 * 3600 + 50 * 60;
  const sessionStartKst = Math.floor((kst - SIX50) / DAY_SEC) * DAY_SEC + SIX50;
  const d = new Date((sessionStartKst - KST_OFFSET_SEC) * 1000);
  const yyyy = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric" });
  const mm = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit" });
  const dd = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", day: "2-digit" });
  return `${yyyy}-${mm}-${dd}`;
}

/* ──────────────────────────────
 * 최소 WS 허브 (Bybit public linear)
 * ────────────────────────────── */
const WS_URL = "wss://stream.bybit.com/v5/public/linear";

class WsHub {
  constructor() {
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
    this.statusHandlers.forEach((fn) => { try { fn(this.connected); } catch {} });
  }

  onStatus(fn) {
    this.statusHandlers.add(fn);
    try { fn(this.connected); } catch {}
    return () => this.statusHandlers.delete(fn);
  }

  _connect() {
    if (this.ws) return;
    const ws = new WebSocket(WS_URL);
    this.ws = ws;

    ws.onopen = () => {
      this.connected = true;
      this._emitStatus();
      if (this.queue.length) {
        const args = [...new Set(this.queue)];
        ws.send(JSON.stringify({ op: "subscribe", args }));
        args.forEach((t) => this.pendingTopics.add(t));
        this.queue = [];
      }
      // keep-alive ping
      try { clearInterval(this._pingTimer); } catch {}
      this._pingTimer = setInterval(() => {
        try { this.ws?.send(JSON.stringify({ op: "ping" })); } catch {}
      }, 20000);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data || "{}");
        if (msg.op === "pong") return;
        const topic = msg?.topic;
        if (!topic) return;
        const set = this.handlers.get(topic);
        if (!set || set.size === 0) return;
        const payload = Array.isArray(msg.data) ? msg.data[msg.data.length - 1] : msg.data;
        set.forEach((fn) => { try { fn(payload); } catch {} });
      } catch {}
    };

    ws.onclose = () => {
      this.ws = null;
      this.connected = false;
      this._emitStatus();
      try { clearInterval(this._pingTimer); } catch {}
      setTimeout(() => this._connect(), 1200);
    };

    ws.onerror = () => {
      try { clearInterval(this._pingTimer); } catch {}
      try { this.ws?.close(); } catch {}
    };
  }

  ensureSubscribe(topic) {
    if (this.pendingTopics.has(topic)) return;
    if (this.connected) {
      try { this.ws?.send(JSON.stringify({ op: "subscribe", args: [topic] })); } catch {}
      this.pendingTopics.add(topic);
    } else {
      this.queue.push(topic);
    }
  }

  addListener(topic, fn) {
    this.ensureSubscribe(topic);
    if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
    this.handlers.get(topic).add(fn);
    // off 함수
    return () => {
      const set = this.handlers.get(topic);
      if (set) set.delete(fn);
      if (set && set.size === 0) {
        this.handlers.delete(topic);
        this.pendingTopics.delete(topic);
        try { this.ws?.send(JSON.stringify({ op: "unsubscribe", args: [topic] })); } catch {}
      }
    };
  }
}

export const wsHub = new WsHub();
