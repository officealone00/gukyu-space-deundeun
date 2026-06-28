// 캠코 2종(온비드 물건목록 + 공공개발 공실) → 통합 SpaceItem 정규화. 둘 다 실호출 검증(2026-06-26).
import { dataGoItems, num, pick, toArray } from './api'
import { getJson } from './http'
import { buildUrl, ONBID, VACANCY, RENT, LH, LH_CNP_CD, TARGET_PRPT_DIV, type DataGoService } from './endpoints'
import type { SpaceItem } from './types'

const SIDO = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주']
// 주소는 항상 시도로 시작 → startsWith로만 판정. (includes 쓰면 "경기도 광주시"가 '광주'로 오분류됨)
export function inferRegion(address?: string): string {
  if (!address) return ''
  return SIDO.find((s) => address.startsWith(s)) ?? ''
}

// yyyyMMddHHmm → ISO. 마감미정(2999 등) 가드.
function parseDt(v?: string): string | undefined {
  if (!v) return undefined
  const s = String(v).replace(/[^\d]/g, '')
  if (s.length < 8) return undefined
  const y = +s.slice(0, 4)
  if (y < 2000 || y > 2100) return undefined
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10) || '00'}:${s.slice(10, 12) || '00'}:00`
}

type Raw = Record<string, unknown>

// ① 온비드 부동산 물건목록 정규화
function normalizeOnbid(raw: Raw): SpaceItem {
  const sido = pick(raw, 'lctnSdnm') ?? '', sgg = pick(raw, 'lctnSggnm') ?? '', emd = pick(raw, 'lctnEmdNm') ?? ''
  const address = [sido, sgg, emd].filter(Boolean).join(' ')
  const cltrNo = pick(raw, 'cltrMngNo') ?? '', cdtnNo = pick(raw, 'pbctCdtnNo') ?? ''
  return {
    id: `onbid-${cltrNo}-${cdtnNo}`,
    sourceLabel: '온비드 공매(캠코)',
    title: pick(raw, 'onbidCltrNm') ?? (address || '국유·공공 부동산'),
    address, region: inferRegion(sido || address),
    areaM2: num(pick(raw, 'bldSqms')) ?? num(pick(raw, 'landSqms')),
    usage: pick(raw, 'cltrUsgSclsCtgrNm', 'cltrUsgMclsCtgrNm', 'cltrUsgLclsCtgrNm'),
    propertyType: pick(raw, 'prptDivNm'),
    disposalType: pick(raw, 'dspsMthodNm'),
    amount: num(pick(raw, 'lowstBidPrcIndctCont', 'apslEvlAmt', 'frstBidPrc')),
    amountLabel: pick(raw, 'lowstBidPrcIndctCont'),
    appraisal: num(pick(raw, 'apslEvlAmt')),
    rentPeriod: pick(raw, 'rentPerdCont'),
    bidStatus: pick(raw, 'pbctStatNm'),
    bidDeadline: parseDt(pick(raw, 'cltrBidEndDt')),
    thumbnailUrl: pick(raw, 'thnlImgUrlAdr'),
    detailUrl: cltrNo ? 'https://www.onbid.co.kr/' : undefined,
    raw, asOf: ONBID.asOf,
  }
}

// ② 공공개발 공실(임대) 정규화 — 월임대료/보증금/주소/용도 풍부
function normalizeVacancy(raw: Raw): SpaceItem {
  const address = pick(raw, 'LCTN_ADR') ?? ''
  const bld = pick(raw, 'BLD_NM') ?? '', flr = pick(raw, 'FLR_DIV_NM') ?? ''
  const rent = num(pick(raw, 'EVMN_RENT_AMT'))
  return {
    id: `vac-${pick(raw, 'RENT_CLTR_NO') ?? Math.random().toString(36).slice(2, 8)}`,
    sourceLabel: '공공개발 공실(캠코)',
    title: [bld, flr].filter(Boolean).join(' ') || (address || '공공개발 공실'),
    address, region: inferRegion(address),
    areaM2: num(pick(raw, 'XUAR')) ?? num(pick(raw, 'CTRT_SQMS')),
    usage: pick(raw, 'DTL_USG_NM'),
    propertyType: '공공개발 공실',
    disposalType: '임대',
    amount: rent || undefined, // 월임대료(0/미기재는 협의로 처리)
    amountLabel: rent ? undefined : '협의',
    deposit: num(pick(raw, 'RENT_GRTEE_AMT')),
    bidStatus: '공실(임대가능)',
    raw, asOf: VACANCY.asOf,
  }
}

// ③ 국유부동산 임대현황(나라키움) 정규화 — 주소 없음, 건물명으로 위치 검색
function normalizeRent(raw: Raw): SpaceItem {
  const bld = pick(raw, 'BLD_NM') ?? '', flr = pick(raw, 'FBLD_DIV_CD_NM') ?? '', flno = pick(raw, 'BLD_FLNO') ?? ''
  const title = [bld, flr, flno && `${flno}층`].filter(Boolean).join(' ') || '국유 임대건물'
  return {
    id: `rent-${bld}-${flno}-${Math.random().toString(36).slice(2, 6)}`,
    sourceLabel: '국유 임대건물(캠코)',
    title,
    address: bld, // 주소 미제공 → 건물명으로 키워드 지오코딩
    region: '',
    areaM2: num(pick(raw, 'XUAR')),
    usage: pick(raw, 'BLD_STRC_TYPE_CD_NM'),
    propertyType: '국유 임대건물',
    disposalType: '임대',
    amount: undefined,
    amountLabel: '협의',
    bidStatus: '임대가능',
    raw, asOf: RENT.asOf,
  }
}

// ④ LH 분양·임대 상가공고 정규화 — 공고 단위(주소·금액·면적 없음, 지역명·마감·상세URL만)
function normalizeLh(raw: Raw): SpaceItem {
  const cnpNm = pick(raw, 'CNP_CD_NM') ?? ''
  const region = inferRegion(cnpNm) // "광주광역시"→'광주', "경기도"→'경기', "전국"→''
  return {
    id: `lh-${pick(raw, 'PAN_ID') ?? Math.random().toString(36).slice(2, 8)}`,
    sourceLabel: 'LH 청약플러스 상가공고',
    title: pick(raw, 'PAN_NM') ?? 'LH 상가 공고',
    address: region && cnpNm !== '전국' ? cnpNm : '', // 정확 주소 미제공 → 시도명만(지오코딩 폴백)
    region,
    usage: pick(raw, 'AIS_TP_CD_NM', 'UPP_AIS_TP_NM') ?? '상가',
    propertyType: 'LH 상가',
    disposalType: '상가공고', // 22=상가(분양/임대 혼재). 임대/매각으로 단정하지 않음(정직성).
    amountLabel: '공고 참조',
    bidStatus: pick(raw, 'PAN_SS'),
    bidDeadline: parseDt(pick(raw, 'CLSG_DT')),
    detailUrl: pick(raw, 'DTL_URL', 'DTL_URL_MOB'),
    raw, asOf: LH.asOf,
  }
}

// LH 전용 페처 — 응답이 배열형 [{dsSch},{resHeader,dsList}]이라 dataGoItems로 못 읽음.
function ymd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}
async function fetchLh(region: string): Promise<SpaceItem[]> {
  const today = new Date()
  const start = new Date(today.getTime() - 540 * 86_400_000) // 게시일 최근 18개월
  const params: Record<string, string | number> = {
    PG_SZ: 200, PAGE: 1, UPP_AIS_TP_CD: 22, // 22 = 상가
    PAN_ST_DT: ymd(start), PAN_ED_DT: ymd(today),
  }
  const cnp = region ? LH_CNP_CD[region] : undefined
  if (cnp) params.CNP_CD = cnp // 지역 선택 시 서버 필터
  try {
    const json = await getJson<unknown>(buildUrl(LH, params))
    const arr = Array.isArray(json) ? (json as Record<string, any>[]) : []
    const header = arr.find((x) => x && x.resHeader)?.resHeader?.[0]
    if (header && header.SS_CODE && header.SS_CODE !== 'Y') return [] // NODATA 등 → 빈 결과
    const list: Raw[] = arr.find((x) => x && x.dsList)?.dsList ?? []
    const open = new Set(['공고중', '접수중', '상담요청', '정정공고중']) // 마감 제외(진행중만)
    return list.map(normalizeLh).filter((it) => open.has(String(it.bidStatus)))
  } catch (e) {
    throw new SourceError(LH.label, LH.datasetUrl, String(e))
  }
}

export class SourceError extends Error {
  constructor(public sourceLabel: string, public datasetUrl: string, message: string) {
    super(message); this.name = 'SourceError'
  }
}

export interface LoadResult { items: SpaceItem[]; errors: SourceError[] }

// 건물만(토지·전·답·대지 등 지목성 물건 제외) — 창업 자리는 건물이어야 함.
const LAND_RE = /(^|\s)(전|답|대|대지|임야|잡종지|과수원|목장용지|도로|구거|유지|하천|염전|나대지|광천지|수도용지|제방|묘지|사적지|종교용지|체육용지|유원지|철도용지|학교용지|주차장|공원)(\s|$)/
const BLDG_RE = /건물|주택|아파트|연립|다세대|빌라|오피스텔|상가|점포|사무|업무|근린|창고시설|공장|시설|숙박|판매|교육|의료|위락|문화|숙박/
function isBuildingItem(it: SpaceItem): boolean {
  const r = it.raw
  if (num(r['bldSqms']) && num(r['bldSqms'])! > 0) return true // 건물면적 있으면 건물
  const u = [r['cltrUsgLclsCtgrNm'], r['cltrUsgMclsCtgrNm'], r['cltrUsgSclsCtgrNm'], it.usage].filter(Boolean).join(' ')
  if (BLDG_RE.test(u)) return true
  if (LAND_RE.test(u)) return false
  return false // 건물면적도 건물용도도 없으면 토지로 간주해 제외
}

async function fetchSource(svc: DataGoService, params: Record<string, string | number>, norm: (r: Raw) => SpaceItem, keep?: (it: SpaceItem) => boolean): Promise<SpaceItem[]> {
  try {
    const rows = await dataGoItems<Raw>(buildUrl(svc, params))
    const items = toArray(rows).map(norm)
    return keep ? items.filter(keep) : items
  } catch (e) {
    throw new SourceError(svc.label, svc.datasetUrl, String(e))
  }
}

// 2종 병렬 호출 → 성공분 합치고 실패는 상태로(든든 §K 정직성)
export async function loadAllSpaces(region = ''): Promise<LoadResult> {
  // 지역 선택 시 온비드는 서버 필터(lctnSdnm)로 그 지역만 직접 조회(예: 광주 168건). 전국이면 넓게 샘플.
  const onbidParams: Record<string, string | number> = region
    ? { numOfRows: 500, pageNo: 1, prptDivCd: TARGET_PRPT_DIV, pvctTrgtYn: 'N', lctnSdnm: region }
    : { numOfRows: 200, pageNo: 1, prptDivCd: TARGET_PRPT_DIV, pvctTrgtYn: 'N' }
  const tasks = [
    fetchSource(ONBID, onbidParams, normalizeOnbid, isBuildingItem), // 건물만(토지 제외)
    fetchSource(VACANCY, { numOfRows: 300, pageNo: 1 }, normalizeVacancy), // 공실=건물
    fetchSource(RENT, { numOfRows: 200, pageNo: 1 }, normalizeRent), // 나라키움=건물
    fetchLh(region), // LH 상가 공고(전용 파서)
  ]
  const settled = await Promise.allSettled(tasks)
  const items: SpaceItem[] = []; const errors: SourceError[] = []
  for (const s of settled) {
    if (s.status === 'fulfilled') items.push(...s.value)
    else errors.push(s.reason instanceof SourceError ? s.reason : new SourceError('알 수 없음', '', String(s.reason)))
  }
  return { items, errors }
}
