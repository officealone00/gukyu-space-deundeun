// K-Startup 창업지원사업 공고 (창업진흥원, 15125364) — 실호출 검증(2026-06-26).
// Base: apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01 (page/perPage/returnType)
import { DATAGO_BASE, DATAGO_KEY, USE_PROXY } from './endpoints'

export interface BizAnnouncement {
  name: string
  org: string
  field: string
  target: string
  region: string
  endDt?: string // yyyyMMdd
  url?: string
  ongoing: boolean
}

export async function fetchAnnouncements(region: string, perPage = 80): Promise<BizAnnouncement[]> {
  const absolute = DATAGO_BASE.startsWith('http')
  const u = new URL(DATAGO_BASE + '/B552735/kisedKstartupService01/getAnnouncementInformation01', absolute ? undefined : window.location.origin)
  if (!USE_PROXY && import.meta.env.DEV && DATAGO_KEY) u.searchParams.set('serviceKey', DATAGO_KEY)
  u.searchParams.set('returnType', 'json')
  u.searchParams.set('page', '1')
  u.searchParams.set('perPage', String(perPage))
  const url = absolute ? u.toString() : u.pathname + u.search
  const r = await fetch(url)
  const j = await r.json()
  const list: any[] = j?.data ?? j?.response?.body?.items ?? []
  return list
    .map((x) => ({
      name: x.biz_pbanc_nm || x.intg_pbanc_biz_nm || '창업지원사업',
      org: x.pbanc_ntrp_nm || '',
      field: x.supt_biz_clsfc || '',
      target: x.aply_trgt || '',
      region: x.supt_regin || '',
      endDt: x.pbanc_rcpt_end_dt,
      url: x.biz_aply_url || x.biz_gdnc_url,
      ongoing: x.rcrt_prgs_yn === 'Y',
    }))
    .filter((b) => b.ongoing)
    .filter((b) => !region || !b.region || b.region.includes(region) || b.region.includes('전국'))
    .slice(0, 12)
}
