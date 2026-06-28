# 국유공간든든 (gukyu-space-deundeun)

청년·소상공인을 위한 **국유 유휴공간 통합 매칭** 웹앱. 흩어진 캠코 공공데이터(온비드 임대공고·국유부동산 임대현황·공공개발 공실)를 한 화면에 모아, 업종·예산·지역만 넣으면 **활용적합도 점수**로 매칭해준다. AI는 매칭·분류만, 물건·임대료·마감 같은 사실은 공공데이터 원본에서만.

> 2026 KAMCO Startup TechBlaze 부문❶ 출품작 · 인사이트랩(이현진)

## 실행 (rody님 PC에서 직접)
```bash
cd app
npm install
cp .env.example .env.local   # 키 입력(아래)
npm run dev                  # http://localhost:5173
npm run typecheck            # 타입 확인(통과 확인됨)
npm run build                # 제출/배포용 빌드
```

## 키 발급 (둘 다 무료, 대부분 즉시)
1. **Kakao 지도 JS 키** → https://developers.kakao.com → 내 애플리케이션 → 앱 키 → **JavaScript 키**.
   플랫폼에 `http://localhost:5173`(과 배포 도메인) 등록. → `.env.local`의 `VITE_KAKAO_JS_KEY`.
2. **data.go.kr 인증키** → https://www.data.go.kr → 각 API "활용신청" 후 마이페이지 인증키(Decoding).
   연동 API 3종: 공공개발 공실(15126385) · 국유부동산 임대현황(15126834) · 온비드 임대공고(15000849).
   → `.env.local`의 `VITE_DATAGO_KEY` (dev 프록시용).

## 데이터 정직성 원칙 (코드에 강제)
- 가상 데이터 없음 — 실제 공공 API만 호출. 미연동/실패 데이터는 "데이터 연동 상태"에 솔직히 표시.
- 점수(활용적합도)만 본 서비스가 계산하고, 그 **근거를 항상 노출**(블랙박스 금지).
- 출처·기준일 화면 표기.

## 구조
- `src/App.tsx` — 검색 → 매칭 → 지도/리스트 → 인앱 상세.
- `src/lib/endpoints.ts` — 캠코 API 설정. ⚠️ 정확한 경로·필드는 **첫 실호출 응답으로 확정**(api-integration 원칙). path/params만 고치면 됨.
- `src/lib/spaces.ts` — 3종 데이터 → 통합 SpaceItem 정규화(다중 후보 필드 방어).
- `src/lib/score.ts` — 활용적합도 점수 산식(페르소나별 가중치).
- `src/lib/kakao.ts` — 지도 + 주소 지오코딩.
- `worker/` — prod용 Cloudflare Worker 키 숨김 프록시.

## ⚠️ 연동 마무리 (1차 실호출 후 5분)
data.go.kr 키로 각 API를 한 번 호출해 응답 원문을 보면, `endpoints.ts`의 `path`와 `spaces.ts`의 필드 매핑을 실제 필드명으로 확정할 수 있다. (현재는 표준 envelope + 다중 후보 필드로 관대하게 매핑돼 있어 대부분 동작하나, 정확도를 위해 1회 검증 권장.)

## 환경변수
`.env.example` 참고. 클라 노출 가능값만 `VITE_`. prod 비밀키는 Worker secret.

## 라이선스 / IP
ⓒ 인사이트랩 (대표 이현진, 사업자등록번호 121-32-93146). 든든 시리즈.
