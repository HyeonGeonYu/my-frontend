// src/components/home/WorldRelationMap.jsx
import React, { useState, useMemo } from "react";
import { isSameWeek, parseISO, format } from "date-fns";
import { ko } from "date-fns/locale";
import { useMarketHolidaysData } from "../../hooks/useCalendarData";
import { useWorldStateData } from "../../hooks/useWorldStateData";

// ── 레이아웃 상수 ──────────────────────────────────────────────────
const VW = 900, VH = 490, R = 36;

// ── 나라 메타 ──────────────────────────────────────────────────────
const FLAGS    = { USA:"🇺🇸", UK:"🇬🇧", Germany:"🇩🇪", China:"🇨🇳", Japan:"🇯🇵", India:"🇮🇳", Korea:"🇰🇷", HongKong:"🇭🇰" };
const NAMES_KR = { USA:"미국",  UK:"영국", Germany:"독일", China:"중국", Japan:"일본", India:"인도", Korea:"한국", HongKong:"홍콩" };
const H_CODE   = { USA:"US",   UK:"GB",  Germany:"DE",   China:"CN",  Japan:"JP",  India:"IN",  Korea:"KR", HongKong:"HK" };

// SVG viewBox 상의 노드 중심 좌표
const NODES = {
  USA:     { cx:  90, cy: 238 },
  UK:      { cx: 302, cy: 128 },
  Germany: { cx: 418, cy: 128 },
  China:   { cx: 592, cy: 222 },
  Japan:   { cx: 750, cy: 142 },
  India:   { cx: 598, cy: 352 },
  Korea:   { cx: 745, cy: 285 },
  HongKong:{ cx: 660, cy: 300 },
};

// ── 목업 데이터 (실데이터 없을 때 폴백) ────────────────────────────
// issues/worry/hope/score_basis 는 백엔드에선 {text,dates} 형태지만,
// 폴백 목업은 문자열로 둬도 렌더 시 asClaim()이 흡수한다.
const MOCK_STATES = {
  USA:     { mood:"주도적", score:7, icon:"🦅", eco:7, pol:5, dip:7,
             issues:["대선 여파로 내부 정치 갈등 지속", "중국 견제 전방위 동맹 확장", "국채 한도·양극화 내부 압박"],
             worry:"중국 견제 비용 누적", hope:"동맹 결속으로 영향력 유지", score_basis:"", special_note:"" },
  UK:      { mood:"안정적", score:6, icon:"🎩", eco:5, pol:5, dip:6,
             issues:["브렉시트 후유증 경제 타격", "스코틀랜드 독립 운동 재점화", "중동 분쟁 중재 외교 역할"],
             worry:"성장 둔화 장기화", hope:"금융 허브 지위 회복", score_basis:"", special_note:"" },
  Germany: { mood:"불안한", score:4, icon:"⚡", eco:4, pol:4, dip:6,
             issues:["경기 침체 공식 진입 위기", "에너지 비용 급등·산업 타격", "우크라이나 지원 정치 부담"],
             worry:"제조업 경쟁력 하락", hope:"에너지 가격 안정화", score_basis:"", special_note:"" },
  China:   { mood:"강경한", score:5, icon:"🐉", eco:6, pol:8, dip:4,
             issues:["대만 해협 군사 긴장 고조", "미·중 무역전쟁 전선 확대", "부동산 위기·내수 침체 심화"],
             worry:"수출 규제·내수 동반 부진", hope:"내수 회복과 기술 자립", score_basis:"", special_note:"" },
  Japan:   { mood:"경계중", score:5, icon:"🛡", eco:5, pol:6, dip:5,
             issues:["방위비 역대 최대 증액", "엔화 약세 장기화", "중국 군사력 팽창 대응 강화"],
             worry:"엔저로 수입물가 부담", hope:"방위·동맹 강화로 안보 확보", score_basis:"", special_note:"" },
  India:   { mood:"도약중", score:8, icon:"🚀", eco:8, pol:6, dip:7,
             issues:["글로벌 외교 위상 급상승", "중국과 국경 분쟁 지속", "제조업 허브 본격 부상"],
             worry:"국경 분쟁 재점화", hope:"제조업 허브로 고성장", score_basis:"", special_note:"" },
  Korea:   { mood:"긴장된", score:3, icon:"⚔️", eco:6, pol:3, dip:5,
             issues:["북핵 위협 수위 최고조", "미·중 사이 외교 딜레마", "반도체 수출 규제 직격타"],
             worry:"북핵·수출규제 동시 압박", hope:"반도체 업황 회복 기대", score_basis:"", special_note:"" },
  HongKong:{ mood:"관망중", score:5, icon:"🌉", eco:5, pol:4, dip:5,
             issues:["금융 허브 지위 유지 경쟁", "본토 경제 연동 심화", "관광·소비 회복 흐름"],
             worry:"본토 경기 둔화 전이", hope:"금융·관광 허브 회복", score_basis:"", special_note:"" },
};

const MOCK_RELS = [
  { a:"USA",     b:"UK",      s: 5 },
  { a:"USA",     b:"Germany", s: 4 },
  { a:"USA",     b:"Japan",   s: 4 },
  { a:"USA",     b:"Korea",   s: 4 },
  { a:"USA",     b:"India",   s: 3 },
  { a:"USA",     b:"China",   s:-3 },
  { a:"UK",      b:"Germany", s: 3 },
  { a:"China",   b:"Japan",   s:-3 },
  { a:"China",   b:"India",   s:-2 },
  { a:"China",   b:"Korea",   s:-1 },
  { a:"Japan",   b:"Korea",   s: 2 },
  { a:"India",   b:"Korea",   s: 2 },
  { a:"Germany", b:"India",   s: 2 },
  { a:"China",   b:"HongKong", s: 3 },
];

// 백엔드 응답(countries/relations) → 컴포넌트 내부 형태로 정규화
function normalizeStates(countries) {
  if (!countries || typeof countries !== "object") return MOCK_STATES;
  const out = {};
  Object.keys(MOCK_STATES).forEach((name) => {
    const c = countries[name];
    if (!c) { out[name] = MOCK_STATES[name]; return; }
    out[name] = {
      mood: c.mood ?? MOCK_STATES[name].mood,
      score: Number.isFinite(c.mood_score) ? c.mood_score : MOCK_STATES[name].score,
      icon: c.icon ?? MOCK_STATES[name].icon,
      eco: Number.isFinite(c.eco) ? c.eco : MOCK_STATES[name].eco,
      pol: Number.isFinite(c.pol) ? c.pol : MOCK_STATES[name].pol,
      dip: Number.isFinite(c.dip) ? c.dip : MOCK_STATES[name].dip,
      score_basis: c.score_basis ?? MOCK_STATES[name].score_basis,
      issues: Array.isArray(c.issues) && c.issues.length ? c.issues : MOCK_STATES[name].issues,
      worry: c.worry ?? MOCK_STATES[name].worry,
      hope: c.hope ?? MOCK_STATES[name].hope,
      special_note: c.special_note ?? MOCK_STATES[name].special_note,
    };
  });
  return out;
}

function normalizeRels(relations) {
  if (!Array.isArray(relations) || !relations.length) return MOCK_RELS;
  return relations
    .filter((r) => r && NODES[r.a] && NODES[r.b])
    .map((r) => ({ a: r.a, b: r.b, s: Number(r.score) || 0, label: r.label,
                   dates: Array.isArray(r.dates) ? r.dates : [] }));
}

// 근거 단위 정규화: 문자열이든 {text,dates}든 {text, dates[]} 로 통일
const asClaim = (v) =>
  v == null ? { text: "", dates: [] }
  : typeof v === "string" ? { text: v, dates: [] }
  : { text: v.text ?? "", dates: Array.isArray(v.dates) ? v.dates : [] };

// 근거 날짜 표시
const fmtClaimDate = (d) => { try { return format(parseISO(d), "M/d"); } catch { return String(d); } };

// ── 색상 헬퍼 ──────────────────────────────────────────────────────
const relColor = (s) =>
  s >= 4 ? "#00e676" : s >= 2 ? "#69f0ae" : s >= 0 ? "#ffca28" : s >= -2 ? "#ff7043" : "#ef5350";

const relLabel = (s) =>
  s >= 4 ? "❤️ 동맹" : s >= 2 ? "😊 우호" : s >= 0 ? "🤝 중립" : s >= -2 ? "😤 긴장" : "⚔️ 적대";

const moodColor = (score) =>
  score >= 7 ? "#00e676" : score >= 5 ? "#ffca28" : "#ef5350";

// 두 노드 사이 선의 시작점 (원 테두리에서 출발)
function edgePt(from, to) {
  const dx = to.cx - from.cx, dy = to.cy - from.cy;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  return [from.cx + (dx / d) * (R + 3), from.cy + (dy / d) * (R + 3)];
}

// ── SVG: 관계선 ────────────────────────────────────────────────────
function RelLine({ rel, mode }) {
  const na = NODES[rel.a], nb = NODES[rel.b];
  const [ax, ay] = edgePt(na, nb);
  const [bx, by] = edgePt(nb, na);
  const color = relColor(rel.s);
  const abs   = Math.abs(rel.s);
  const dash  = rel.s < 0 ? "5 3" : undefined;
  const mx    = (ax + bx) / 2, my = (ay + by) / 2;

  if (mode === "dimmed") {
    return <line x1={ax} y1={ay} x2={bx} y2={by}
      stroke={color} strokeWidth={abs * 0.5} strokeOpacity={0.06} strokeDasharray={dash} />;
  }
  if (mode === "normal") {
    return (
      <g>
        <line x1={ax} y1={ay} x2={bx} y2={by}
          stroke={color} strokeWidth={abs * 1.5} strokeOpacity={0.09} />
        <line x1={ax} y1={ay} x2={bx} y2={by}
          stroke={color} strokeWidth={abs * 0.7} strokeOpacity={0.28} strokeDasharray={dash} />
      </g>
    );
  }
  // highlighted — 노드 위 레이어에 그림
  return (
    <g>
      <line x1={ax} y1={ay} x2={bx} y2={by}
        stroke={color} strokeWidth={abs * 3.5} strokeOpacity={0.22} />
      <line x1={ax} y1={ay} x2={bx} y2={by}
        stroke={color} strokeWidth={abs * 1.4} strokeOpacity={0.95} strokeDasharray={dash} />
      <rect x={mx - 30} y={my - 11} width={60} height={20} rx={5}
        fill="#070e1c" stroke={color} strokeWidth={0.8} strokeOpacity={0.8} />
      <text x={mx} y={my + 1}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={9} fill={color} style={{ pointerEvents:"none", userSelect:"none" }}>
        {rel.label || relLabel(rel.s)}
      </text>
    </g>
  );
}

// ── SVG: 나라 노드 ─────────────────────────────────────────────────
function CountryNode({ name, state, selected, dimmed, connected, onClick, hasHoliday }) {
  const n  = NODES[name];
  const s  = state;
  const mc = moodColor(s.score);

  return (
    <g
      transform={`translate(${n.cx},${n.cy})`}
      onClick={() => onClick(name)}
      style={{ cursor:"pointer", opacity: dimmed ? 0.3 : 1, transition:"opacity 0.25s" }}
    >
      {/* 외부 글로우 링 (선택 시) */}
      {selected && (
        <circle r={R + 11} fill="none" stroke={mc} strokeWidth="1.5" strokeOpacity="0.3" />
      )}
      {/* 연결된 나라 표시 (연한 링) */}
      {connected && !selected && (
        <circle r={R + 6} fill="none" stroke={mc} strokeWidth="1" strokeOpacity="0.18" />
      )}
      {/* 메인 원 */}
      <circle r={R}
        fill={selected ? "rgba(20,32,58,0.98)" : "rgba(9,14,26,0.96)"}
        stroke={mc}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      {/* 국기 이모지 */}
      <text fontSize="24" textAnchor="middle" dominantBaseline="middle"
        style={{ userSelect:"none" }}>
        {FLAGS[name]}
      </text>
      {/* 나라 이름 */}
      <text y={R + 15} fontSize="11" fontWeight="bold"
        fill={selected ? "#ffffff" : "#c6d6ee"}
        textAnchor="middle" style={{ userSelect:"none" }}>
        {NAMES_KR[name]}
      </text>
      {/* 상태 문구 */}
      <text y={R + 27} fontSize="9" fill={mc}
        textAnchor="middle" style={{ userSelect:"none" }}>
        {s.icon} {s.mood}
      </text>
      {/* 공휴일 배지 */}
      {hasHoliday && (
        <g transform={`translate(${R - 3},${-(R - 3)})`}>
          <circle r={9} fill="#f59e0b" stroke="#07101e" strokeWidth="1.5" />
          <text fontSize="11" textAnchor="middle" dominantBaseline="middle"
            style={{ userSelect:"none" }}>🗓</text>
        </g>
      )}
    </g>
  );
}

// ── HTML: 스탯바 ───────────────────────────────────────────────────
function StatBar({ label, val }) {
  const color = val >= 7 ? "#00e676" : val >= 5 ? "#ffca28" : "#ef5350";
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
        <span style={{ fontSize:10, color:"#607080" }}>{label}</span>
        <span style={{ fontSize:10, color:"#3a4a58" }}>{val}/10</span>
      </div>
      <div style={{ height:5, background:"#101828", borderRadius:3, overflow:"hidden" }}>
        <div style={{
          width:`${val * 10}%`, height:"100%",
          background:color, borderRadius:3,
          boxShadow:`0 0 6px ${color}88`,
          transition:"width 0.5s",
        }} />
      </div>
    </div>
  );
}

// ── HTML: 근거 출처 칩 (날짜 → 원문 링크) ──────────────────────────
function SourceChips({ dates, srcMap }) {
  if (!dates || !dates.length) return null;
  return (
    <span style={{ display:"inline-flex", flexWrap:"wrap", gap:4, marginLeft:6, verticalAlign:"middle" }}>
      {dates.map((d, i) => {
        const src = srcMap && srcMap[d];
        const base = { fontSize:8.5, borderRadius:4, padding:"1px 5px", whiteSpace:"nowrap", textDecoration:"none" };
        return src && src.url ? (
          <a key={i} href={src.url} target="_blank" rel="noreferrer" title={src.title || d}
             style={{ ...base, color:"#4a9eda", background:"#0a1622", border:"1px solid #15324a" }}>🔗 {fmtClaimDate(d)}</a>
        ) : (
          <span key={i} title={d}
             style={{ ...base, color:"#52708a", background:"#0a1420", border:"1px solid #18293a" }}>{fmtClaimDate(d)}</span>
        );
      })}
    </span>
  );
}

// ── HTML: 상세 패널 ────────────────────────────────────────────────
function DetailPanel({ name, weekHols, states, rels, sources }) {
  const s  = states[name];
  const mc = moodColor(s.score);
  const myRels = rels.filter(r => r.a === name || r.b === name);
  const hols = weekHols[name] || [];
  const countrySrc = (sources && sources[name]) || {};
  const scoreBasis = asClaim(s.score_basis);
  const worry = asClaim(s.worry);
  const hope  = asClaim(s.hope);

  return (
    <div style={{
      borderTop:"1px solid #101828",
      background:"rgba(6,10,20,0.98)",
      padding:"14px 18px",
      display:"flex", gap:20, flexWrap:"wrap", alignItems:"flex-start",
    }}>

      {/* ── 왼쪽: 기본 정보 + 스탯 + 공휴일 ── */}
      <div style={{ flex:"0 0 165px", minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <span style={{ fontSize:38 }}>{FLAGS[name]}</span>
          <div>
            <div style={{ fontSize:15, fontWeight:"bold", color:"#dce8ff" }}>{NAMES_KR[name]}</div>
            <div style={{ fontSize:11, color:mc, marginTop:3 }}>{s.icon} {s.mood}</div>
          </div>
        </div>
        <StatBar label="💰 경제" val={s.eco} />
        <StatBar label="🏛 정치" val={s.pol} />
        <StatBar label="🌐 외교" val={s.dip} />

        {/* 점수 근거 */}
        {scoreBasis.text && (
          <div style={{ marginTop:8, padding:"7px 9px", background:"#0b1522", borderRadius:7, border:"1px solid #14202e" }}>
            <div style={{ fontSize:9, color:"#445566", marginBottom:4 }}>📊 점수 근거</div>
            <div style={{ fontSize:10, color:"#90a4bc", lineHeight:1.5 }}>{scoreBasis.text}</div>
            {scoreBasis.dates.length > 0 && (
              <div style={{ marginTop:4 }}><SourceChips dates={scoreBasis.dates} srcMap={countrySrc} /></div>
            )}
          </div>
        )}

        {/* 이번 주 공휴일 (실데이터만) */}
        <div style={{ marginTop:8, padding:"8px 10px", background:"#0b1522", borderRadius:7, border:"1px solid #18263a" }}>
          <div style={{ fontSize:10, color:"#445566", marginBottom:6, letterSpacing:".5px" }}>🗓 이번 주 공휴일</div>
          {hols.length === 0 ? (
            <div style={{ fontSize:10, color:"#2e3e4e" }}>— 공휴일 없음</div>
          ) : hols.map((h, i) => (
            <div key={i} style={{ fontSize:10, color:"#f59e0b", marginBottom:3 }}>
              ✦ {h.name}
              <span style={{ color:"#7a6020", marginLeft:4 }}>
                ({format(parseISO(h.date), "M/d(E)", { locale:ko })})
              </span>
            </div>
          ))}
        </div>

        {/* 특이사항 (공휴일과 분리) */}
        {s.special_note && String(s.special_note).trim() && (
          <div style={{ marginTop:8, padding:"8px 10px", background:"#141019", borderRadius:7, border:"1px solid #2a1e3a" }}>
            <div style={{ fontSize:10, color:"#7a5a8a", marginBottom:5, letterSpacing:".5px" }}>💬 특이사항</div>
            <div style={{ fontSize:10, color:"#b09ac0", lineHeight:1.5 }}>{s.special_note}</div>
          </div>
        )}
      </div>

      {/* ── 가운데: 걱정/기대 + 주요 현안 ── */}
      <div style={{ flex:"1 1 190px", minWidth:0 }}>
        <div style={{ display:"flex", gap:6, marginBottom:8 }}>
          <div style={{ flex:1, padding:"7px 9px", background:"#15110b", borderRadius:7, border:"1px solid #3a2a12" }}>
            <div style={{ fontSize:9, color:"#a06a3a", marginBottom:3 }}>😟 걱정</div>
            <div style={{ fontSize:10, color:"#d8b888", lineHeight:1.4 }}>{worry.text}</div>
            {worry.dates.length > 0 && <div style={{ marginTop:4 }}><SourceChips dates={worry.dates} srcMap={countrySrc} /></div>}
          </div>
          <div style={{ flex:1, padding:"7px 9px", background:"#0b1510", borderRadius:7, border:"1px solid #143a28" }}>
            <div style={{ fontSize:9, color:"#3a9a6a", marginBottom:3 }}>✨ 기대</div>
            <div style={{ fontSize:10, color:"#88d8b0", lineHeight:1.4 }}>{hope.text}</div>
            {hope.dates.length > 0 && <div style={{ marginTop:4 }}><SourceChips dates={hope.dates} srcMap={countrySrc} /></div>}
          </div>
        </div>
        <div style={{ fontSize:10, color:"#3a5060", marginBottom:8, letterSpacing:".5px" }}>📋 주요 현안</div>
        {s.issues.map((issue, i) => {
          const it = asClaim(issue);
          return (
            <div key={i} style={{
              fontSize:11, color:"#b0c4dc",
              padding:"7px 10px", marginBottom:6,
              background:"#0b1522", borderRadius:7,
              borderLeft:`3px solid ${mc}`,
            }}>
              <span style={{ fontSize:9, color:"#2a3a48", marginRight:6 }}>0{i + 1}</span>{it.text}
              <SourceChips dates={it.dates} srcMap={countrySrc} />
            </div>
          );
        })}
      </div>

      {/* ── 오른쪽: 대외 관계 ── */}
      <div style={{ flex:"1 1 190px", minWidth:0 }}>
        <div style={{ fontSize:10, color:"#3a5060", marginBottom:8, letterSpacing:".5px" }}>🌐 대외 관계</div>
        {myRels.map((r, i) => {
          const other = r.a === name ? r.b : r.a;
          const relSrc = { ...((sources && sources[other]) || {}), ...countrySrc };
          return (
            <div key={i} style={{
              padding:"6px 10px", marginBottom:5,
              background:"#0b1522", borderRadius:7,
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:18 }}>{FLAGS[other]}</span>
                <span style={{ fontSize:11, color:"#7a8fa8" }}>{NAMES_KR[other]}</span>
                <span style={{ marginLeft:"auto", fontSize:10, color:relColor(r.s), whiteSpace:"nowrap" }}>
                  {r.label || relLabel(r.s)}
                </span>
              </div>
              {r.dates && r.dates.length > 0 && (
                <div style={{ marginTop:4 }}><SourceChips dates={r.dates} srcMap={relSrc} /></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────
export default function WorldRelationMap() {
  const [selected, setSelected] = useState(null);
  const { holidaysData } = useMarketHolidaysData();
  const { data: worldData, updatedAt } = useWorldStateData();

  const isLive = !!(worldData && worldData.countries);

  // 실데이터 우선, 없으면 목업 폴백
  const states = useMemo(() => normalizeStates(worldData?.countries), [worldData]);
  const rels   = useMemo(() => normalizeRels(worldData?.relations), [worldData]);
  const sources = worldData?.sources || {};   // {country: {date: {url,title}}}

  // 이번 주 공휴일 나라별로 분류
  const weekHols = useMemo(() => {
    const now = new Date();
    const result = {};
    Object.keys(NODES).forEach((country) => {
      const code = H_CODE[country];
      const hols = holidaysData?.holidays?.[code] || [];
      result[country] = hols.filter((h) => {
        try { return isSameWeek(parseISO(h.date), now, { weekStartsOn: 1 }); }
        catch { return false; }
      });
    });
    return result;
  }, [holidaysData]);

  // 선택된 나라와 연결된 나라들
  const connectedSet = useMemo(() => {
    if (!selected) return new Set();
    return new Set(
      rels.filter((r) => r.a === selected || r.b === selected)
          .map((r) => (r.a === selected ? r.b : r.a))
    );
  }, [selected, rels]);

  const handleSelect = (name) => setSelected((p) => (p === name ? null : name));

  return (
    <div style={{
      background:"#060a17",
      borderRadius:12,
      border:"1px solid #121c2e",
      overflow:"hidden",
      marginBottom:28,
    }}>
      {/* 제목 바 */}
      <div style={{
        padding:"10px 16px",
        background:"linear-gradient(90deg,#0b1528 0%,#060a17 100%)",
        borderBottom:"1px solid #121c2e",
        display:"flex", justifyContent:"space-between", alignItems:"center",
      }}>
        <div>
          <span style={{ fontSize:15, fontWeight:"bold", color:"#d4e4ff" }}>🌍 세계 정세 현황판</span>
          <span style={{ marginLeft:8, fontSize:10, color:"#283848" }}>뉴스 AI 분석 기반</span>
          {isLive && updatedAt && (
            <span style={{ marginLeft:8, fontSize:9, color:"#2e4250" }}>
              · {(() => { try { return format(parseISO(updatedAt), "M/d HH:mm"); } catch { return ""; } })()} 기준
            </span>
          )}
        </div>
        <span style={{
          fontSize:9,
          color: isLive ? "#1a6f4a" : "#253545",
          background: isLive ? "#08160f" : "#0c1828",
          padding:"2px 8px", borderRadius:4,
          border: `1px solid ${isLive ? "#13402a" : "#182535"}`,
        }}>{isLive ? "● LIVE" : "MOCK DATA"}</span>
      </div>

      {/* SVG 맵 — viewBox로 반응형, 가로 스크롤 없음 */}
      <div style={{ lineHeight:0 }}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          width="100%"
          style={{ display:"block", background:"#070b18" }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <pattern id="wg" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#0e1828" strokeWidth="0.7" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#wg)" />

          {/* ── 레이어 1: 배경 관계선 (노드 아래) ── */}
          {rels.map((r, i) => {
            // 선택된 나라의 선은 레이어3에서 그림 → 여기선 스킵
            if (selected && (r.a === selected || r.b === selected)) return null;
            return (
              <RelLine key={i} rel={r} mode={selected ? "dimmed" : "normal"} />
            );
          })}

          {/* ── 레이어 2: 나라 노드 ── */}
          {Object.keys(NODES).map((name) => (
            <CountryNode
              key={name}
              name={name}
              state={states[name]}
              selected={selected === name}
              dimmed={!!selected && selected !== name && !connectedSet.has(name)}
              connected={connectedSet.has(name)}
              onClick={handleSelect}
              hasHoliday={(weekHols[name] || []).length > 0}
            />
          ))}

          {/* ── 레이어 3: 선택된 나라의 하이라이트 선 (노드 위) ── */}
          {selected && rels
            .filter((r) => r.a === selected || r.b === selected)
            .map((r, i) => <RelLine key={`hl${i}`} rel={r} mode="highlighted" />)
          }
        </svg>
      </div>

      {/* 상세 패널 */}
      {selected && <DetailPanel name={selected} weekHols={weekHols} states={states} rels={rels} sources={sources} />}

      {/* 범례 */}
      <div style={{
        padding:"8px 16px",
        borderTop:"1px solid #0d1828",
        background:"#050811",
        display:"flex", gap:14, flexWrap:"wrap", alignItems:"center",
      }}>
        {[
          { c:"#00e676", label:"동맹", dash:false },
          { c:"#69f0ae", label:"우호", dash:false },
          { c:"#ffca28", label:"중립", dash:false },
          { c:"#ff7043", label:"긴장", dash:true  },
          { c:"#ef5350", label:"적대", dash:true  },
        ].map(({ c, label, dash }) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <svg width={24} height={8}>
              <line x1={0} y1={4} x2={24} y2={4}
                stroke={c} strokeWidth={2} strokeDasharray={dash ? "4 2" : undefined} />
            </svg>
            <span style={{ fontSize:9, color:"#384858" }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft:"auto", fontSize:9, color:"#283848", display:"flex", gap:10 }}>
          <span>🗓 이번 주 공휴일</span>
          <span>·</span>
          <span>클릭 → 상세 보기</span>
        </div>
      </div>
    </div>
  );
}
