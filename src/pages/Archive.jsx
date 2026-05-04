// src/pages/Archive.jsx
import React, {useEffect, useState} from "react";
import {useSupabaseArchiveData} from "../hooks/useSupabaseArchiveData";
import {newsParams} from "../constants/newsMeta";
import {ClipboardCopy, Check} from "lucide-react";
import ArchiveChartView from "../components/archive/ArchiveChartView";

/* -------------------------------------------------------------------------- */
/* Trading Archive Panel                                                       */
/* -------------------------------------------------------------------------- */

function TradingArchivePanel({
    day,
    date,
    trades = [],
    symbols = [],
    asset,
    selectedTradeView,
    setSelectedTradeView,
    expanded,
    onToggle,
}) {
    return (
        <div
            style={{
                marginBottom: 18,
                borderRadius: 12,
                background: "#181818",
                border: "1px solid #333",
                overflow: "hidden",
            }}
        >
            <div
                onClick={onToggle}
                style={{
                    padding: 14,
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    userSelect: "none",
                }}
            >
                <h4 style={{margin: 0, color: "#00ffcc"}}>
                    {expanded ? "▼" : "▶"} 📈 Trading Snapshot
                </h4>

                <div style={{fontSize: 13, color: "#aaa"}}>
                    Signals {trades.length}개 · Symbols {symbols.length}개
                </div>
            </div>

            {expanded && (
                <div style={{padding: "0 14px 14px"}}>
                    <TradingSnapshotBody
                        day={day}
                        date={date}
                        trades={trades}
                        symbols={symbols}
                        asset={asset}
                        selectedTradeView={selectedTradeView}
                        setSelectedTradeView={setSelectedTradeView}
                    />
                </div>
            )}
        </div>
    );
}

function TradingSnapshotBody({
    day,
    trades = [],
    symbols = [],
    asset,
    selectedTradeView,
    setSelectedTradeView,
}) {
    const equity = Number(asset?.equityUsdt ?? 0);
    const unrealizedPnl = Number(asset?.unrealizedPnlUsdt ?? 0);

    const exitTrades = trades.filter((t) => t.kind === "EXIT");
    const entryTrades = trades.filter((t) => t.kind === "ENTRY");

    const pnlSum = exitTrades.reduce((acc, t) => {
        const n = Number(t.pnl);
        return Number.isFinite(n) ? acc + n : acc;
    }, 0);

    return (
        <>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: 10,
                    marginBottom: 12,
                }}
            >
                <ArchiveMetric label="평가 USDT" value={fmtNum(equity, 2)}/>
                <ArchiveMetric label="미실현 PnL" value={fmtSignedNum(unrealizedPnl, 2)}/>
                <ArchiveMetric label="Signals" value={String(trades.length)}/>
                <ArchiveMetric label="ENTRY / EXIT" value={`${entryTrades.length} / ${exitTrades.length}`}/>
                <ArchiveMetric label="확정 PnL 합산(%)" value={fmtSignedNum(pnlSum, 2)}/>
            </div>

            {asset?.positions?.length > 0 && (
                <div style={{marginBottom: 12, overflowX: "auto"}}>
                    <table style={{width: "100%", borderCollapse: "collapse", fontSize: 12}}>
                        <thead>
                        <tr style={{color: "#aaa", borderBottom: "1px solid #333"}}>
                            <th align="left">Symbol</th>
                            <th align="left">Side</th>
                            <th align="right">Qty</th>
                            <th align="right">Avg Entry</th>
                            <th align="right">Close</th>
                            <th align="right">미실현 PnL</th>
                        </tr>
                        </thead>
                        <tbody>
                        {asset.positions.map((p) => (
                            <tr key={`${p.symbol}-${p.side}`} style={{borderBottom: "1px solid #222"}}>
                                <td>{p.symbol}</td>
                                <td>{p.side}</td>
                                <td align="right">{fmtNum(p.qty, 4)}</td>
                                <td align="right">{fmtNum(p.avgEntry, 4)}</td>
                                <td align="right">{p.closePrice == null ? "-" : fmtNum(p.closePrice, 4)}</td>
                                <td align="right">{fmtSignedNum(p.unrealizedPnlUsdt, 2)}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {symbols.length > 0 ? (
                <div>
                    <div style={{fontSize: 13, color: "#aaa", marginBottom: 8}}>
                        심볼을 누르면 이 Archive 안에서 해당 날짜의 1분봉 차트와 매매기록을 봅니다.
                    </div>

                    <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                        {symbols.map((symbol) => {
                            const count = trades.filter((t) => t.symbol === symbol).length;
                            const active =
                                selectedTradeView?.day === day &&
                                selectedTradeView?.symbol === symbol;

                            return (
                                <button
                                    key={symbol}
                                    onClick={() => {
                                        if (active) setSelectedTradeView(null);
                                        else setSelectedTradeView({day, symbol});
                                    }}
                                    style={{
                                        padding: "7px 10px",
                                        borderRadius: 999,
                                        border: `1px solid ${active ? "#ffcc00" : "#00ffcc"}`,
                                        background: active ? "#ffcc00" : "transparent",
                                        color: active ? "#000" : "#00ffcc",
                                        cursor: "pointer",
                                        fontWeight: 800,
                                    }}
                                >
                                    {symbol} <span style={{opacity: 0.7}}>({count})</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div style={{color: "#aaa", fontSize: 13}}>
                    이 날짜에는 저장된 트레이딩 기록이 없습니다.
                </div>
            )}
        </>
    );
}

function ArchiveTradeDetail({day, symbol, trades = []}) {
    const [candles, setCandles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!day || !symbol) return;

        let alive = true;

        async function run() {
            setLoading(true);
            setError(null);

            try {
                const res = await fetch(
                    `/api/archiveCandles?day=${encodeURIComponent(day)}&symbol=${encodeURIComponent(symbol)}`,
                    {cache: "no-store"}
                );

                const json = await res.json();

                if (!res.ok || !json.ok) {
                    throw new Error(json?.error || "candle fetch failed");
                }

                if (!alive) return;
                setCandles(Array.isArray(json.candles) ? json.candles : []);
            } catch (e) {
                if (!alive) return;
                setError(e);
                setCandles([]);
            } finally {
                if (!alive) return;
                setLoading(false);
            }
        }

        run();

        return () => {
            alive = false;
        };
    }, [day, symbol]);

    return (
        <div
            style={{
                marginBottom: 20,
                padding: 14,
                borderRadius: 12,
                background: "#101820",
                border: "1px solid #244",
            }}
        >
            <h4 style={{margin: "0 0 10px", color: "#00ccff"}}>
                📊 {symbol} · {day} 1분봉 / 매매 기록
            </h4>

            {loading && (
                <div style={{color: "#aaa", marginBottom: 10}}>
                    1분봉 불러오는 중...
                </div>
            )}

            {error && (
                <div style={{color: "#ff7777", marginBottom: 10}}>
                    차트 오류: {error.message}
                </div>
            )}

            <ArchiveChartView candles={candles} trades={trades} height={380}/>

            {trades.length === 0 ? (
                <div style={{color: "#aaa", marginTop: 12}}>해당 심볼의 매매기록이 없습니다.</div>
            ) : (
                <div style={{overflowX: "auto", marginTop: 14}}>
                    <table style={{width: "100%", borderCollapse: "collapse", fontSize: 12}}>
                        <thead>
                        <tr style={{color: "#aaa", borderBottom: "1px solid #333"}}>
                            <th align="left">Time</th>
                            <th align="left">Kind</th>
                            <th align="left">Side</th>
                            <th align="right">Price</th>
                            <th align="right">PnL</th>
                            <th align="left">Reason</th>
                        </tr>
                        </thead>
                        <tbody>
                        {trades.map((t) => {
                            const raw = t.raw_json || {};
                            const tsMs = Number(raw.ts_ms || raw.timestamp_ms);
                            const timeText = Number.isFinite(tsMs)
                                ? new Date(tsMs).toLocaleString()
                                : "-";

                            const reasons = Array.isArray(raw.reasons_json)
                                ? raw.reasons_json.join(" / ")
                                : "";

                            return (
                                <tr key={t.id} style={{borderBottom: "1px solid #222"}}>
                                    <td>{timeText}</td>
                                    <td>{t.kind}</td>
                                    <td>{t.side}</td>
                                    <td align="right">{t.price ?? "-"}</td>
                                    <td align="right">{t.pnl ?? "-"}</td>
                                    <td
                                        style={{
                                            maxWidth: 520,
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                        }}
                                    >
                                        {reasons}
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function ArchiveMetric({label, value}) {
    return (
        <div
            style={{
                padding: 10,
                borderRadius: 10,
                background: "#111",
                border: "1px solid #2a2a2a",
            }}
        >
            <div style={{fontSize: 12, color: "#aaa"}}>{label}</div>
            <div style={{fontSize: 18, fontWeight: 900, marginTop: 4}}>{value}</div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Copy Button                                                                 */
/* -------------------------------------------------------------------------- */

function CopyButton({text, size = 18, absolute = true, titleLabel = "복사하기"}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch (e) {
            alert("복사 실패!");
        }
    };

    return (
        <button
            onClick={handleCopy}
            title={titleLabel}
            style={{
                background: "none",
                border: "none",
                position: absolute ? "absolute" : "static",
                top: absolute ? 8 : undefined,
                right: absolute ? 8 : undefined,
                cursor: "pointer",
                color: "#00ffcc",
                padding: 2,
                zIndex: 10,
            }}
        >
            {copied ? <Check size={size}/> : <ClipboardCopy size={size}/>}
        </button>
    );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function fmtNum(v, digits = 2) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "-";

    return n.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function fmtSignedNum(v, digits = 2) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "-";

    const body = Math.abs(n).toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });

    return `${n >= 0 ? "+" : "-"}${body}`;
}

const buildNewsPrompt = (content = "") => {
    const base = (content || "").trim();
    const promptTail =
        "\n\n---\n\n" +
        "위 뉴스 전체 내용을 기반으로 각 뉴스 항목별로 가로줄로 구분 확실히.\n" +
        "뉴스가 여러 개일 경우 **각 뉴스마다 아래 형식**을 반복해서 작성해줘:\n\n" +
        "(대제목으로 1,2,3...) 1. 🗞️ [뉴스 제목 혹은 주제 요약] \n\n" +
        "✅ 한줄 요약: (핵심 사건을 한 문장으로)\n" +
        "🔥 주요 쟁점:\n" +
        "(들여쓰기 4칸 보기편하게)1) ...\n" +
        "(들여쓰기 4칸 보기편하게)2) ...\n" +
        "(들여쓰기 4칸 보기편하게)3) ...\n\n" +
        "각 뉴스는 명확히 구분해서 작성해.\n" +
        "주요 탑 뉴스 5개만 요약해.\n" +
        "정리 순서는 뉴스 등장 순서와 같게 해줘.\n" +
        "반드시 한글,한국어로만 작성해.";
    return base + promptTail;
};

const formatDateWithDay = (dateStr) => {
    if (!/^\d{8}$/.test(dateStr)) return dateStr;

    const year = parseInt(dateStr.slice(0, 4), 10);
    const month = parseInt(dateStr.slice(4, 6), 10) - 1;
    const day = parseInt(dateStr.slice(6, 8), 10);

    const date = new Date(year, month, day);
    const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
    const dayName = days[date.getDay()];

    return `${year}년 ${month + 1}월 ${day}일 (${dayName})`;
};

/* -------------------------------------------------------------------------- */
/* Main Page                                                                   */
/* -------------------------------------------------------------------------- */

function Archive() {
    const [page, setPage] = useState(1);
    const [expandedDate, setExpandedDate] = useState(null);
    const [expandedSummary, setExpandedSummary] = useState({});
    const [expandedTrading, setExpandedTrading] = useState({});
    const [selectedTradeView, setSelectedTradeView] = useState(null);

    const {data, total, loading, error} = useSupabaseArchiveData(page);

    const [renderData, setRenderData] = useState([]);

    useEffect(() => {
        if (!loading && Array.isArray(data)) {
            setRenderData(data);
        }
    }, [loading, data]);

    const isFetching = loading && renderData.length > 0;

    const perPage = 5;
    const totalPages = Math.ceil(total / perPage);

    const pageWindowSize = 5;

    const getPageWindow = (page, totalPages, windowSize) => {
        const windowIndex = Math.floor((page - 1) / windowSize);
        const start = windowIndex * windowSize + 1;
        const end = Math.min(start + windowSize - 1, totalPages);
        return {start, end, windowIndex};
    };

    const {start: windowStart, end: windowEnd} = getPageWindow(page, totalPages, pageWindowSize);

    const goPrevPage = () => setPage((p) => Math.max(1, p - 1));
    const goNextPage = () => setPage((p) => Math.min(totalPages, p + 1));

    const toggleDate = (date) => {
        setExpandedDate((prev) => {
            const next = prev === date ? null : date;
            if (next === null) {
                setSelectedTradeView(null);
            }
            return next;
        });
    };

    const toggleTrading = (date, day) => {
    setExpandedTrading((prev) => {
        const nextExpanded = !prev[date];

        // Trading Snapshot을 닫을 때, 그 날짜의 차트도 같이 닫기
        if (!nextExpanded && selectedTradeView?.day === day) {
            setSelectedTradeView(null);
        }

        return {
            ...prev,
            [date]: nextExpanded,
        };
    });
};

    const toggleSummary = (key) => {
        setExpandedSummary((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const pagerBtnBase = {
        height: 40,
        minWidth: 40,
        padding: "0 12px",
        borderRadius: 10,
        border: "1px solid #2a2a2a",
        background: "#2a2a2a",
        color: "#fff",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        userSelect: "none",
    };

    const pagerBtnActive = {
        background: "#00ffcc",
        color: "#000",
        border: "1px solid #00ffcc",
    };

    const pagerBtnGhost = {
        background: "transparent",
        border: "1px solid #00ffcc",
        color: "#00ffcc",
    };

    const pagerBtnDisabled = {
        opacity: 0.45,
        cursor: "not-allowed",
    };

    return (
        <div style={{padding: "40px", color: "#fff", backgroundColor: "#111", minHeight: "100vh"}}>
            <h1 style={{color: "#00ffcc"}}>📅 아카이브</h1>

            {error && <p style={{color: "red"}}>❌ 오류 발생: {error.message}</p>}

            <div style={{position: "relative", minHeight: 600}}>
                {isFetching && (
                    <div
                        style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            padding: "6px 10px",
                            borderRadius: 999,
                            background: "rgba(0,0,0,0.6)",
                            border: "1px solid #333",
                            color: "#aaa",
                            fontSize: 12,
                            zIndex: 20,
                        }}
                    >
                        가져오는 중…
                    </div>
                )}

                {loading && renderData.length === 0 && <p>⏳ 로딩 중...</p>}

                {!loading && (data?.length ?? 0) === 0 && <p>데이터가 없습니다.</p>}

                {renderData.map(({date, day, data, trades = [], symbols = [], asset = null}) => (
                    <div
                        key={date}
                        style={{
                            marginBottom: "20px",
                            borderBottom: "1px solid #333",
                            paddingBottom: "10px",
                        }}
                    >
                        <h3
                            onClick={() => toggleDate(date)}
                            style={{
                                cursor: "pointer",
                                color: "#00ccff",
                                marginBottom: "8px",
                                userSelect: "none",
                            }}
                        >
                            {expandedDate === date ? "▼" : "▶"} {formatDateWithDay(date)}
                        </h3>

                        {expandedDate === date && (
                            <div style={{paddingLeft: "16px"}}>
                                <TradingArchivePanel
                                    day={day}
                                    date={date}
                                    trades={trades}
                                    symbols={symbols}
                                    asset={asset}
                                    selectedTradeView={selectedTradeView}
                                    setSelectedTradeView={setSelectedTradeView}
                                    expanded={!!expandedTrading[date]}
                                    onToggle={() => toggleTrading(date, day)}
                                />

                                {!!expandedTrading[date] && selectedTradeView?.day === day && (
    <ArchiveTradeDetail
        day={day}
        symbol={selectedTradeView.symbol}
        trades={trades.filter((t) => t.symbol === selectedTradeView.symbol)}
    />
)}

                                {(() => {
                                    const youtubeData = data?.youtube_data || {};
                                    const orderedCountries = Object.entries(youtubeData).sort(([a], [b]) => {
                                        const order = newsParams.order;
                                        const indexA = order.indexOf(a);
                                        const indexB = order.indexOf(b);
                                        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                                    });

                                    if (orderedCountries.length === 0) {
                                        return (
                                            <div style={{color: "#aaa", fontSize: 13, marginTop: 12}}>
                                                저장된 뉴스/유튜브 데이터가 없습니다.
                                            </div>
                                        );
                                    }

                                    return orderedCountries.map(([country, info]) => {
                                        const summaryKey = `${date}_${country}_content`;
                                        const resultKey = `${date}_${country}_result`;

                                        return (
                                            <div key={country} style={{marginBottom: "16px"}}>
                                                <h4 style={{marginBottom: "4px", color: "#ffcc00"}}>{country}</h4>

                                                <div>
                                                    📌 <strong>제목:</strong>{" "}
                                                    <a
                                                        href={info.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        style={{color: "#00ccff"}}
                                                    >
                                                        {info.title || info.url}
                                                    </a>
                                                </div>

                                                <div>
                                                    🕒 <strong>업로드:</strong>{" "}
                                                    {info.publishedAt
                                                        ? new Date(info.publishedAt).toLocaleString()
                                                        : "없음"}
                                                </div>

                                                {info.summary_result && (
                                                    <div style={{marginTop: "8px"}}>
                                                        <button
                                                            onClick={() => toggleSummary(resultKey)}
                                                            style={{
                                                                backgroundColor: "#222",
                                                                color: "#00ffcc",
                                                                border: "1px solid #00ffcc",
                                                                borderRadius: "6px",
                                                                padding: "6px 10px",
                                                                cursor: "pointer",
                                                                fontSize: "0.9rem",
                                                                marginRight: "8px",
                                                            }}
                                                        >
                                                            {expandedSummary[resultKey] ? "요약 닫기" : "요약 보기"}
                                                        </button>

                                                        {expandedSummary[resultKey] && (
                                                            <div
                                                                style={{
                                                                    marginTop: "6px",
                                                                    backgroundColor: "#222",
                                                                    padding: "10px 12px",
                                                                    borderRadius: "8px",
                                                                    position: "relative",
                                                                }}
                                                            >
                                                                <CopyButton text={info.summary_result}/>
                                                                <strong>🧾 summary_result:</strong>
                                                                <pre
                                                                    style={{
                                                                        whiteSpace: "pre-wrap",
                                                                        marginTop: "6px",
                                                                        color: "#ccc",
                                                                    }}
                                                                >
                                                                    {info.summary_result}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div style={{marginTop: "8px"}}>
                                                    <button
                                                        onClick={() => toggleSummary(summaryKey)}
                                                        style={{
                                                            backgroundColor: "#222",
                                                            color: "#00ffcc",
                                                            border: "1px solid #00ffcc",
                                                            borderRadius: "6px",
                                                            padding: "6px 10px",
                                                            cursor: "pointer",
                                                            fontSize: "0.9rem",
                                                        }}
                                                    >
                                                        {expandedSummary[summaryKey] ? "전문 닫기" : "전문 보기"}
                                                    </button>

                                                    {expandedSummary[summaryKey] && (
                                                        <div
                                                            style={{
                                                                marginTop: "6px",
                                                                backgroundColor: "#222",
                                                                padding: "10px 12px",
                                                                borderRadius: "8px",
                                                                position: "relative",
                                                            }}
                                                        >
                                                            <strong style={{color: "#fff", display: "inline-block"}}>
                                                                📄 summary_content:
                                                            </strong>

                                                            <div
                                                                style={{
                                                                    position: "absolute",
                                                                    top: 8,
                                                                    right: 12,
                                                                    display: "flex",
                                                                    gap: 8,
                                                                    alignItems: "center",
                                                                }}
                                                            >
                                                                <CopyButton
                                                                    text={info.summary_content || ""}
                                                                    absolute={false}
                                                                    titleLabel="원문 복사"
                                                                />
                                                                <CopyButton
                                                                    text={buildNewsPrompt(info.summary_content || "")}
                                                                    absolute={false}
                                                                    titleLabel="원문+프롬프트 복사"
                                                                />
                                                            </div>

                                                            <br/>
                                                            {info.summary_content || "내용 없음"}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div
                    style={{
                        marginTop: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 14,
                        flexWrap: "wrap",
                    }}
                >
                    <div style={{display: "flex", gap: 10, alignItems: "center"}}>
                        <button
                            onClick={() => setPage(1)}
                            disabled={page === 1}
                            style={{...pagerBtnBase, ...pagerBtnGhost, ...(page === 1 ? pagerBtnDisabled : null)}}
                            title="첫 페이지"
                        >
                            First
                        </button>

                        <button
                            onClick={goPrevPage}
                            disabled={page === 1}
                            style={{...pagerBtnBase, ...(page === 1 ? pagerBtnDisabled : null)}}
                            title="이전 페이지"
                        >
                            ◀ Prev
                        </button>
                    </div>

                    <div style={{display: "flex", gap: 10, alignItems: "center"}}>
                        {Array.from({length: windowEnd - windowStart + 1}, (_, i) => {
                            const pageNum = windowStart + i;
                            const isActive = page === pageNum;

                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setPage(pageNum)}
                                    style={{...pagerBtnBase, ...(isActive ? pagerBtnActive : null)}}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}

                        <span style={{marginLeft: 6, color: "#aaa", fontSize: 14}}>
                            {windowStart}-{windowEnd} / {totalPages}
                        </span>
                    </div>

                    <div style={{display: "flex", gap: 10, alignItems: "center"}}>
                        <button
                            onClick={goNextPage}
                            disabled={page === totalPages}
                            style={{...pagerBtnBase, ...(page === totalPages ? pagerBtnDisabled : null)}}
                            title="다음 페이지"
                        >
                            Next ▶
                        </button>

                        <button
                            onClick={() => setPage(totalPages)}
                            disabled={page === totalPages}
                            style={{...pagerBtnBase, ...pagerBtnGhost, ...(page === totalPages ? pagerBtnDisabled : null)}}
                            title="마지막 페이지"
                        >
                            Last
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Archive;