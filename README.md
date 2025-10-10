# 코드 테스트
개발용 : npm start (로컬 백엔드씀)
배포용 : npm run build 
        npm install -g serve
        serve -s build
(서버 백엔드씀)

npm i -g vercel
vercel dev

# 게시판 추가
1. Router.jsx 에서 아래 추가
import Archive from "../pages/Archive";

<Route path="/usstock" element={<UsStock />} />

{ path: "/archive", label: "아카이브", emoji: "🗂️" },

2. pages에 페이지 jsx 추가
3. 