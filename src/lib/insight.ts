// 주변 분석: 상권 활성도(소진공 상권정보) + 시세(국토부 상업용 실거래가). 실호출 검증(2026-06-26).
import { DATAGO_BASE, DATAGO_KEY, USE_PROXY } from './endpoints'

function withKey(path: string, params: Record<string, string | number>): string {
  const absolute = DATAGO_BASE.startsWith('http')
  const u = new URL(DATAGO_BASE + path, absolute ? undefined : window.location.origin)
  if (!USE_PROXY && import.meta.env.DEV && DATAGO_KEY) u.searchParams.set('serviceKey', DATAGO_KEY)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v))
  return absolute ? u.toString() : u.pathname + u.search
}

const numOf = (v: unknown) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0 }

// ① 상권: 반경 내 상가 총수(상권 활성도)
export async function fetchStoreCount(lat: number, lng: number, radius = 500): Promise<number> {
  const url = withKey('/B553077/api/open/sdsc2/storeListInRadius', { radius, cx: lng, cy: lat, type: 'json', numOfRows: 1, pageNo: 1 })
  const j = await (await fetch(url)).json()
  return numOf(j?.body?.totalCount)
}

// ①+ 업종별 분포: 반경 내 상가를 업종 대분류로 집계(경쟁/공백 분석용)
export interface StoreBreakdown { total: number; sampled: number; byCat: { name: string; count: number }[] }
export async function fetchStoreBreakdown(lat: number, lng: number, radius = 500): Promise<StoreBreakdown> {
  const url = withKey('/B553077/api/open/sdsc2/storeListInRadius', { radius, cx: lng, cy: lat, type: 'json', numOfRows: 100, pageNo: 1 })
  const j = await (await fetch(url)).json()
  const items: any[] = j?.body?.items ?? []
  const map = new Map<string, number>()
  for (const s of items) { const c = s.indsLclsNm || '기타'; map.set(c, (map.get(c) ?? 0) + 1) }
  const byCat = [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  return { total: numOf(j?.body?.totalCount), sampled: items.length, byCat }
}

// 좌표 → LAWD_CD(법정동 시군구 5자리) via Kakao 행정코드 변환
export async function coord2lawd(kakao: any, lat: number, lng: number): Promise<string | null> {
  return new Promise((resolve) => {
    const g = new kakao.maps.services.Geocoder()
    g.coord2RegionCode(lng, lat, (res: any[], status: string) => {
      const b = res?.find((r) => r.region_type === 'B') ?? res?.[0]
      if (status === kakao.maps.services.Status.OK && b?.code) resolve(String(b.code).slice(0, 5))
      else resolve(null)
    })
  })
}

// ② 국토부 상업용 실거래가 → 평균 만원/㎡ (최근 2개월)
export async function fetchCommercialPricePerM2(lawd: string): Promise<{ count: number; avgPerM2: number } | null> {
  const ym = (back: number) => { const d = new Date(); d.setMonth(d.getMonth() - back); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}` }
  let count = 0, sum = 0
  for (const m of [1, 2]) {
    try {
      const url = withKey('/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade', { LAWD_CD: lawd, DEAL_YMD: ym(m), numOfRows: 200, pageNo: 1 })
      const j = await (await fetch(url)).json()
      let it = j?.response?.body?.items?.item
      it = Array.isArray(it) ? it : (it ? [it] : [])
      for (const r of it) {
        const amt = numOf(r.dealAmount) * 10000 // 만원→원
        const ar = numOf(r.buildingAr) || numOf(r.excluUseAr)
        if (amt > 0 && ar > 0) { sum += amt / ar; count++ }
      }
    } catch { /* 월별 실패 무시 */ }
  }
  if (count === 0) return null
  return { count, avgPerM2: Math.round(sum / count / 10000) } // 만원/㎡
}
