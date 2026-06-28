// ─────────────────────────────────────────────────────────────────────────────
// 캠코 공공 API 엔드포인트 — ✅ 실호출 검증 완료(2026-06-26, Chrome 실응답)
//   전부 org code B010003. 응답유형 파라미터 resultType(=json), 응답 {header, body:{items:{item}}}.
// ─────────────────────────────────────────────────────────────────────────────

const PROXY_BASE = (import.meta.env.VITE_PROXY_BASE as string | undefined)?.replace(/\/$/, '')
export const USE_PROXY = !!PROXY_BASE
export const DATAGO_BASE = PROXY_BASE ? `${PROXY_BASE}/datago` : '/datago'
export const DATAGO_KEY = import.meta.env.VITE_DATAGO_KEY as string | undefined
// OpenAI 프록시 베이스 (키는 서버/Worker에만, 클라는 경로만 호출)
export const AI_BASE = PROXY_BASE ? `${PROXY_BASE}/ai` : '/ai'

// 온비드 부동산 물건목록 대상 재산유형: 국유재산+공공개발재산+기타일반재산+공유재산(지자체)
export const TARGET_PRPT_DIV = '0010,0011,0005,0002'

export interface DataGoService {
  id: string
  label: string
  datasetUrl: string
  path: string
  asOf: string
  verified: boolean
}

// ① 온비드 부동산 물건목록(매각·임대, 국유·공공·기타일반) — 17,074건
export const ONBID: DataGoService = {
  id: '15157207',
  label: '온비드 국유·공공 부동산 물건',
  datasetUrl: 'https://www.data.go.kr/data/15157207/openapi.do',
  path: '/B010003/OnbidRlstListSrvc2/getRlstCltrList2',
  asOf: '매시간(공매: 매각·임대)',
  verified: true,
}

// ② 공공개발부동산 공실(임대) — 주소·월임대료·보증금·면적·용도, 1,010건
export const VACANCY: DataGoService = {
  id: '15126385',
  label: '공공개발 공실(임대)',
  datasetUrl: 'https://www.data.go.kr/data/15126385/openapi.do',
  path: '/B010003/pblcDvlpRlst/ophsInf',
  asOf: '실시간(공실·월임대료)',
  verified: true,
}

// ③ 국유부동산 임대현황(나라키움) — 건물명·층·면적. 주소 없어 건물명 키워드 지오코딩으로 위치.
export const RENT: DataGoService = {
  id: '15126834',
  label: '국유부동산 임대현황(나라키움)',
  datasetUrl: 'https://www.data.go.kr/data/15126834/openapi.do',
  path: '/B010003/GvwsRlstRent/rlstRent',
  asOf: '실시간(국유 임대건물·건물명 위치)',
  verified: true,
}

export const ACTIVE: DataGoService[] = [ONBID, VACANCY, RENT]

// 호출은 검증(resultCode 00)됐으나 소재지·용도가 전혀 없어 지도매칭 불가 → 보류(정직 표기)
export const PLANNED: DataGoService[] = [
  { id: '15126370', label: '국유재산 입찰대상물건(80,835건)', datasetUrl: 'https://www.data.go.kr/data/15126370/openapi.do', path: '/B010003/kamcoRlcBidTrgtCltr/cltrLst', asOf: '✅호출검증 · 소재지 미제공으로 지도매칭 보류', verified: false },
]

export function buildUrl(svc: DataGoService, params: Record<string, string | number>): string {
  const absolute = DATAGO_BASE.startsWith('http')
  const u = new URL(DATAGO_BASE + svc.path, absolute ? undefined : window.location.origin)
  if (!USE_PROXY && import.meta.env.DEV && DATAGO_KEY) u.searchParams.set('serviceKey', DATAGO_KEY)
  u.searchParams.set('resultType', 'json')
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v))
  return absolute ? u.toString() : u.pathname + u.search
}
