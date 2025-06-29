# 코드 테스트
개발용 : npm start
배포용 : npm run build

# 게시판 추가
1. Router.jsx 에서 아래 추가
import Archive from "../pages/Archive";
<Route path="/usstock" element={<UsStock />} />
{ path: "/archive", label: "아카이브", emoji: "🗂️" },

2. pages에 페이지 jsx 추가
3. 