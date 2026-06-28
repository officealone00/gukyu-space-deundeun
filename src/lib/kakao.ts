// Kakao Maps JS SDK 동적 로더 + 주소 지오코딩.
// JS 키는 도메인 제한이 걸리므로 클라 노출 허용(VITE_KAKAO_JS_KEY).
// 좌표 없는 물건은 주소 → 좌표 변환(addressSearch). 실패 시 시도 중심 + 결정적 jitter(든든 §4).

let loading: Promise<any> | null = null

export function loadKakao(): Promise<any> {
  const w = window as any
  if (w.kakao?.maps) return Promise.resolve(w.kakao)
  if (loading) return loading
  const key = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined
  if (!key) return Promise.reject(new Error('VITE_KAKAO_JS_KEY 미설정 — .env.local에 Kakao JS 키를 넣어주세요.'))
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false&libraries=services`
    s.onload = () => w.kakao.maps.load(() => resolve(w.kakao))
    s.onerror = () => reject(new Error('Kakao SDK 로드 실패(도메인 등록·키 확인)'))
    document.head.appendChild(s)
  })
  return loading
}

// 시도 중심 좌표(지오코딩 실패 시 폴백)
const SIDO_CENTER: Record<string, [number, number]> = {
  서울: [37.5665, 126.978], 부산: [35.1796, 129.0756], 대구: [35.8714, 128.6014],
  인천: [37.4563, 126.7052], 광주: [35.1595, 126.8526], 대전: [36.3504, 127.3845],
  울산: [35.5384, 129.3114], 세종: [36.48, 127.289], 경기: [37.4138, 127.5183],
  강원: [37.8228, 128.1555], 충북: [36.6357, 127.4912], 충남: [36.6588, 126.6728],
  전북: [35.7175, 127.153], 전남: [34.8161, 126.4629], 경북: [36.4919, 128.8889],
  경남: [35.4606, 128.2132], 제주: [33.4996, 126.5312],
}

// 같은 id는 항상 같은 위치(결정적 jitter)
function jitter(id: string): [number, number] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const dx = ((h % 1000) / 1000 - 0.5) * 0.08
  const dy = (((h >> 10) % 1000) / 1000 - 0.5) * 0.08
  return [dx, dy]
}

// 두 좌표 간 거리(km) — 내 주변 정렬용
export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// 좌표 → 시도명(예: '경기도') 역지오코딩
export async function coord2sido(kakao: any, lat: number, lng: number): Promise<string | null> {
  const r = await coord2region(kakao, lat, lng)
  return r?.sido ?? null
}

// 좌표 → {시도, 시군구}(예: 광주광역시 / 광산구) 역지오코딩
export async function coord2region(kakao: any, lat: number, lng: number): Promise<{ sido: string; sigungu: string } | null> {
  return new Promise((resolve) => {
    const geocoder = new kakao.maps.services.Geocoder()
    geocoder.coord2RegionCode(lng, lat, (res: any[], status: string) => {
      const b = res?.find((r) => r.region_type === 'B') ?? res?.[0]
      if (status === kakao.maps.services.Status.OK && b) resolve({ sido: b.region_1depth_name ?? '', sigungu: b.region_2depth_name ?? '' })
      else resolve(null)
    })
  })
}

export async function geocode(kakao: any, address: string, region: string, id: string): Promise<[number, number] | null> {
  if (address) {
    const r = await new Promise<[number, number] | null>((resolve) => {
      const geocoder = new kakao.maps.services.Geocoder()
      geocoder.addressSearch(address, (res: any[], status: string) => {
        if (status === kakao.maps.services.Status.OK && res[0]) resolve([Number(res[0].y), Number(res[0].x)])
        else resolve(null)
      })
    })
    if (r) return r
    // 주소검색 실패 → 장소 키워드 검색(건물명 등, 예: 임대현황의 "사근동 공공복합청사")
    const kw = await new Promise<[number, number] | null>((resolve) => {
      const ps = new kakao.maps.services.Places()
      ps.keywordSearch(address, (data: any[], status: string) => {
        if (status === kakao.maps.services.Status.OK && data[0]) resolve([Number(data[0].y), Number(data[0].x)])
        else resolve(null)
      })
    })
    if (kw) return kw
  }
  const center = SIDO_CENTER[region]
  if (center) {
    const [dx, dy] = jitter(id)
    return [center[0] + dy, center[1] + dx]
  }
  return null
}
