import React, { useState } from "react";
import { useDailySavedData } from "../hooks/useDailySavedData";
import { newsParams } from "../constants/newsMeta";
import { ClipboardCopy, Check } from "lucide-react";

// CopyButton 컴포넌트
function CopyButton({ text, size = 18, absolute = true, titleLabel = "복사하기" }) {
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
      {copied ? <Check size={size} /> : <ClipboardCopy size={size} />}
    </button>
  );
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
    "각 뉴스는 명확히 구분해서 작성해\n" +
    "정리 순서는 뉴스 등장 순서와 같게 해줘.\n" +
    "반드시 한글,한국어로만 작성해.";
  return base + promptTail;
};


// 날짜 포맷 함수: 20250619 → 2025년 6월 19일 (목요일)
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

function Archive() {
  const [page, setPage] = useState(1);
  const [expandedDate, setExpandedDate] = useState(null);
  const [expandedSummary, setExpandedSummary] = useState({});

  const { data, total, loading, error } = useDailySavedData(page);

  const perPage = 5;
  const totalPages = Math.ceil(total / perPage);

  const toggleDate = (date) => {
    setExpandedDate(expandedDate === date ? null : date);
  };

  const toggleSummary = (key) => {
    setExpandedSummary((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div style={{ padding: "40px", color: "#fff", backgroundColor: "#111", minHeight: "100vh" }}>
      <h1 style={{ color: "#00ffcc" }}>📅 아카이브</h1>

      {loading && <p>⏳ 로딩 중...</p>}
      {error && <p style={{ color: "red" }}>❌ 오류 발생: {error.message}</p>}
      {!loading && data.length === 0 && <p>데이터가 없습니다.</p>}

      {!loading &&
        data.map(({ date, data }) => (
          <div key={date} style={{ marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
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
              <div style={{ paddingLeft: "16px" }}>
                {(() => {
                  const youtubeData = data.youtube_data || {};
                  const orderedCountries = Object.entries(youtubeData).sort(([a], [b]) => {
                    const order = newsParams.order;
                    const indexA = order.indexOf(a);
                    const indexB = order.indexOf(b);
                    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                  });

                  return orderedCountries.map(([country, info]) => {
                    const summaryKey = `${date}_${country}_content`;
                    const resultKey = `${date}_${country}_result`;

                    return (
                        <div key={country} style={{marginBottom: "16px"}}>
                          <h4 style={{marginBottom: "4px", color: "#ffcc00"}}>{country}</h4>

                          <div>📌 <strong>제목:</strong>{" "}
                            <a href={info.url} target="_blank" rel="noreferrer" style={{color: "#00ccff"}}>
                              {info.title || info.url}
                            </a>
                          </div>
                          <div>🕒 <strong>업로드:</strong> {info.publishedAt ? new Date(info.publishedAt).toLocaleString() : "없음"}
                          </div>

                          {/* summary_result toggle */}
                          {info.summary_result && (
                              <div style={{marginTop: "8px"}}>
                                <button
                                    onClick={() => toggleSummary(resultKey)}
                                    style={{
                                      backgroundColor: "#222",
                                      color: "#00ffcc",
                                      border: "1px solid #00ffcc",
                                      borderRadius: "4px",
                                      padding: "4px 8px",
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
                                          padding: "8px",
                                          borderRadius: "6px",
                                        }}
                                    >
                                      <CopyButton text={info.summary_result} />
                                      <strong>🧾 summary_result:</strong>
                                      <pre style={{whiteSpace: "pre-wrap", marginTop: "4px", color: "#ccc"}}>
                                  {info.summary_result}
                                </pre>
                                    </div>
                                )}
                              </div>
                          )}

                          {/* summary_content toggle */}
                          <div style={{marginTop: "8px"}}>
                            <button
                                onClick={() => toggleSummary(summaryKey)}
                                style={{
                                  backgroundColor: "#222",
                                  color: "#00ffcc",
                                  border: "1px solid #00ffcc",
                                  borderRadius: "4px",
                                  padding: "4px 8px",
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
                                  borderRadius: "6px",
                                  position: "relative", // ✅ 버튼 위치 기준
                                }}
                              >
                                {/* 왼쪽 라벨 */}
                                <strong style={{ color: "#fff", display: "inline-block" }}>
                                  📄 summary_content:
                                </strong>

                                {/* 👉 오른쪽 끝에 고정되는 버튼 그룹 */}
                                <div
                                  style={{
                                    position: "absolute",
                                    top: 8,
                                    right: 12,                // ✅ 박스 오른쪽 끝에 밀착
                                    display: "flex",
                                    gap: 8,
                                    alignItems: "center",
                                  }}
                                >
                                  <CopyButton
                                    text={info.summary_content || ""}
                                    absolute={false}          // ✅ 내부 버튼은 absolute 아님
                                    titleLabel="원문 복사"
                                  />
                                  <CopyButton
                                    text={buildNewsPrompt(info.summary_content || "")}
                                    absolute={false}
                                    titleLabel="원문+프롬프트 복사"
                                  />
                                </div>
                              <br/>
                                {/* 본문 */}
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

      {totalPages > 1 && (
        <div style={{ marginTop: "24px" }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              style={{
                marginRight: "8px",
                backgroundColor: page === i + 1 ? "#00ffcc" : "#444",
                color: page === i + 1 ? "#000" : "#fff",
                padding: "6px 12px",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Archive;
