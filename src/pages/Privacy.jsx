// 개인정보처리방침 — 플레이스토어 등록 필수 요건(개인정보처리방침 URL)용 페이지
// 앱(NewsInsight 안드로이드)과 웹(hyeongeonnoil.com) 공통 적용
import React from "react";

const wrap = {
  maxWidth: "720px",
  margin: "0 auto",
  padding: "24px 16px 60px",
  color: "#ddd",
  lineHeight: 1.8,
  fontSize: "15px",
};
const h1 = { color: "#00ffcc", fontSize: "22px", marginBottom: "4px" };
const h2 = { color: "#fff", fontSize: "17px", marginTop: "28px", marginBottom: "8px" };
const muted = { color: "#888", fontSize: "13px" };

export default function Privacy() {
  return (
    <div style={wrap}>
      <h1 style={h1}>개인정보처리방침</h1>
      <p style={muted}>시행일: 2026-08-29 · 적용 대상: NewsInsight 안드로이드 앱 및 hyeongeonnoil.com</p>

      <h2 style={h2}>1. 수집하는 개인정보</h2>
      <p>
        NewsInsight는 회원가입·로그인 기능이 없으며, 이름·이메일·전화번호 등{" "}
        <strong>개인을 식별할 수 있는 정보를 수집하거나 저장하지 않습니다.</strong>
      </p>

      <h2 style={h2}>2. 푸시 알림 (앱)</h2>
      <p>
        앱에서 푸시 알림을 사용하는 경우, 알림 전송을 위한 기기 등록 토큰이 Google
        Firebase Cloud Messaging에 저장됩니다. 이 토큰은 알림 전송 외의 용도로 사용되지
        않으며, 다른 개인정보와 연결되지 않습니다. 알림은 기기 설정에서 언제든 끌 수
        있습니다.
      </p>

      <h2 style={h2}>3. 웹 방문 통계</h2>
      <p>
        웹사이트는 서비스 개선을 위해 Google Analytics 및 Vercel Analytics를 사용해
        익명화된 방문 통계(페이지뷰, 브라우저 종류 등)를 수집합니다. 이 통계는 개인을
        식별하는 데 사용되지 않습니다.
      </p>

      <h2 style={h2}>4. 제3자 제공</h2>
      <p>수집한 정보를 제3자에게 판매하거나 제공하지 않습니다.</p>

      <h2 style={h2}>5. 문의</h2>
      <p>
        개인정보 관련 문의: <a href="mailto:kofgb0987@gmail.com" style={{ color: "#00ffcc" }}>kofgb0987@gmail.com</a>
      </p>

      <p style={{ ...muted, marginTop: "32px" }}>
        This service does not collect or store personally identifiable information. Push
        notification tokens (Firebase Cloud Messaging) and anonymized web analytics are
        the only data processed. Contact: kofgb0987@gmail.com
      </p>
    </div>
  );
}
