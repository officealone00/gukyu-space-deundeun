import { useEffect, useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SearchBar } from './features/search/SearchBar'
import { MapView } from './features/map/MapView'
import { ListingCard } from './features/listings/ListingCard'
import { DetailModal } from './features/listings/DetailModal'
import { KStartupPanel } from './features/support/KStartupPanel'
import { loadAllSpaces, type SourceError } from './lib/spaces'
import { rankSpaces, byDeadline } from './lib/score'
import { loadKakao, geocode, coord2region, haversine } from './lib/kakao'
import { ACTIVE, PLANNED } from './lib/endpoints'
import { getFavs, toggleFav } from './lib/favorites'
import { aiParseQuery } from './lib/ai'
import { dDay } from './lib/score'
import type { ScoredSpace, SearchCriteria, SpaceItem } from './lib/types'

type Sort = 'score' | 'deadline'
const SIDO = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주']

export default function App() {
  const [criteria, setCriteria] = useState<SearchCriteria>({ persona: 'youth', industry: '', region: '', disposal: '전체' })
  const [raw, setRaw] = useState<SpaceItem[] | null>(null)
  const [errors, setErrors] = useState<SourceError[]>([])
  const [loading, setLoading] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<ScoredSpace | null>(null)
  const [sort, setSort] = useState<Sort>('score')
  const [nearMode, setNearMode] = useState(false)
  const [favs, setFavs] = useState<string[]>(getFavs())
  const [favOnly, setFavOnly] = useState(false)
  const [userSigungu, setUserSigungu] = useState('')

  const onFav = (id: string) => setFavs(toggleFav(id))

  // B. 공유 딥링크: ?id=&r= 이면 해당 지역 검색 후 그 물건 모달 자동 오픈
  const pendingId = useRef<string | null>(null)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const id = sp.get('id'); const r = sp.get('r')
    if (id) {
      pendingId.current = id
      if (r) setCriteria((c) => ({ ...c, region: r }))
      handleSearch(r ?? undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSearch(regionOverride?: string) {
    const region = regionOverride ?? criteria.region
    setLoading(true); setLoadErr(null); setNearMode(false); setUserSigungu('')
    try {
      const { items, errors } = await loadAllSpaces(region)
      setRaw(items); setErrors(errors)
      if (items.length === 0 && errors.length > 0) setLoadErr('데이터를 불러오지 못했습니다. 아래 데이터 연동 상태를 확인해 주세요.')
    } catch (e) {
      setLoadErr(String((e as Error).message ?? e))
    } finally { setLoading(false) }
  }

  // 내 위치 → 가까운 10곳: 위치 권한 → 시도 역지오코딩 → 해당 시도 물건 지오코딩 → 거리순 10개
  function handleNear() {
    if (!navigator.geolocation) { setLoadErr('이 브라우저는 위치를 지원하지 않습니다.'); return }
    setLoading(true); setLoadErr(null)
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const me: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        const kakao = await loadKakao()
        const reg = await coord2region(kakao, me[0], me[1])
        const sidoFull = reg?.sido ?? '' // 예: '광주광역시' / '경기도'
        const sido = SIDO.find((s) => sidoFull.startsWith(s)) ?? '' // 짧은형 '광주' / '경기'
        const sigungu = reg?.sigungu ?? '' // 예: '광산구' / '광주시'(경기)
        const { items, errors } = await loadAllSpaces(sido) // 시도 서버필터(광주광역시 ≠ 경기 광주시)
        setErrors(errors)
        // 먼저 내 시도로 좁히고(광주광역시 ≠ 대전 서구 혼입 방지), 그 안에서 시군구(서구)로 좁힘. 없으면 시도 전체.
        const inSido = sido ? items.filter((x) => x.region === sido) : items
        let target = inSido
        if (sigungu) { const sg = inSido.filter((x) => x.address.includes(sigungu)); if (sg.length >= 1) target = sg }
        const subset = target.slice(0, 60)
        const coords = await Promise.all(
          subset.map((it) => (it.lat != null && it.lng != null ? Promise.resolve<[number, number] | null>([it.lat, it.lng]) : geocode(kakao, it.address, it.region, it.id))),
        )
        const withDist: SpaceItem[] = subset.map((it, i) => {
          const g = coords[i]
          return g ? { ...it, lat2: g[0], lng2: g[1], distanceKm: haversine(me, g) } : it
        })
        const rest = items.filter((x) => !subset.includes(x))
        setRaw([...withDist, ...rest])
        setCriteria((c) => ({ ...c, region: sido }))
        setUserSigungu(sigungu)
        setNearMode(true)
      } catch (e) {
        setLoadErr('내 주변 계산 실패: ' + String((e as Error).message ?? e))
      } finally { setLoading(false) }
    }, (err) => { setLoading(false); setLoadErr('위치 권한이 필요해요: ' + err.message) }, { enableHighAccuracy: false, timeout: 10000 })
  }

  // 자연어 검색: AI 파싱(우선) → 실패 시 정규식 폴백
  async function handleNl(text: string) {
    let parsed: { region: string; industry: string; disposal: SearchCriteria['disposal'] }
    try {
      parsed = await aiParseQuery(text)
    } catch {
      const region = SIDO.find((s) => text.includes(s)) ?? ''
      const disposal: SearchCriteria['disposal'] = text.includes('임대') ? '임대' : text.includes('매각') ? '매각' : '전체'
      let industry = text
      SIDO.forEach((s) => { industry = industry.replace(s, '') })
      industry = industry.replace(/근처|주변|자리|찾아줘|찾아|에서|임대|매각|구해|싼|저렴/g, '').replace(/\s+/g, ' ').trim()
      parsed = { region, industry, disposal }
    }
    setCriteria((c) => ({ ...c, ...parsed }))
    handleSearch(parsed.region)
  }

  const ranked: ScoredSpace[] = useMemo(() => {
    if (!raw) return []
    let r = rankSpaces(raw, criteria)
    if (criteria.region) r = r.filter((x) => x.region === criteria.region)
    if (favOnly) r = r.filter((x) => favs.includes(x.id))
    if (nearMode) {
      return r.filter((x) => x.distanceKm != null).sort((a, b) => (a.distanceKm! - b.distanceKm!)).slice(0, 10)
    }
    return sort === 'deadline' ? byDeadline(r) : r
  }, [raw, criteria, sort, nearMode, favOnly, favs])

  // C. 지역 요약 대시보드: 현재 결과의 임대/매각 비율·평균 임대료
  const summary = useMemo(() => {
    if (!ranked.length) return null
    const lease = ranked.filter((x) => x.disposalType === '임대').length
    const sale = ranked.filter((x) => x.disposalType === '매각').length
    const rents = ranked.filter((x) => x.disposalType === '임대' && x.amount).map((x) => x.amount!)
    const avgRent = rents.length ? Math.round(rents.reduce((a, b) => a + b, 0) / rents.length) : null
    return { total: ranked.length, lease, sale, avgRent }
  }, [ranked])

  // B. 데이터 로드 후 대기중인 공유 링크 물건 열기
  useEffect(() => {
    if (pendingId.current && raw) {
      const found = ranked.find((x) => x.id === pendingId.current)
      if (found) { setSelected(found); pendingId.current = null }
    }
  }, [raw, ranked])

  // 관심물건 중 마감 임박(D-7 이내) 알림
  const favDueSoon = useMemo(() => {
    if (!raw) return [] as ScoredSpace[]
    return rankSpaces(raw, criteria).filter((x) => favs.includes(x.id)).filter((x) => { const d = dDay(x.bidDeadline); return d != null && d >= 0 && d <= 7 })
  }, [raw, favs, criteria])

  return (
    <ErrorBoundary>
      <div className="app">
        <header className="app-header">
          <div className="brand">
            <img src={`${import.meta.env.BASE_URL}symbol.svg`} alt="" className="brand-symbol" width={28} height={28} />
            <div>
              <h1>국유공간든든</h1>
              <span className="muted">청년·소상공인을 위한 국유 유휴공간 통합 매칭 · 캠코 공공데이터 기반</span>
            </div>
          </div>
        </header>

        <SearchBar value={criteria} onChange={setCriteria} onSearch={handleSearch} onNear={handleNear} onNl={handleNl} />

        {favDueSoon.length > 0 && (
          <div className="card alert">⏰ 관심물건 {favDueSoon.length}건 마감 임박 — {favDueSoon.slice(0, 2).map((x) => x.title).join(', ')} 등</div>
        )}
        {loading && (
          <div className="skeleton-wrap">
            <div className="sk sk-bar" />
            <div className="sk sk-map" />
            <div className="sk-cards">{[0, 1, 2, 3].map((i) => <div className="sk sk-card" key={i} />)}</div>
          </div>
        )}
        {loadErr && <div className="card warn">{loadErr}</div>}
        {!raw && !loading && !loadErr && (
          <div className="card intro">
            <strong>전국 국유·공공 <b>건물</b>을 캠코 공공데이터로 한 번에.</strong>
            <p className="muted">업종·지역을 넣고 <b>국유·공공 부동산 찾기</b>를 누르거나, <b>📍 내 주변 10곳</b>으로 가까운 자리부터 보세요. 물건마다 상권·시세·대부료·AI 자리분석이 따라옵니다.</p>
          </div>
        )}

        {raw && !loading && (
          <>
            <div className="result-bar">
              <span className="muted">
                {nearMode ? `내 주변 ${ranked.length}곳` : `${ranked.length}건`} · {[criteria.region || '전국', nearMode ? userSigungu : ''].filter(Boolean).join(' ')} · {criteria.industry || '전체 업종'}
              </span>
              <div className="sort">
                <button className={favOnly ? 'on' : ''} onClick={() => setFavOnly((v) => !v)}>♥ 관심 {favs.length || ''}</button>
                {!nearMode && <button className={sort === 'score' ? 'on' : ''} onClick={() => setSort('score')}>적합도순</button>}
                {!nearMode && <button className={sort === 'deadline' ? 'on' : ''} onClick={() => setSort('deadline')}>마감임박순</button>}
              </div>
            </div>

            {summary && (
              <div className="summary-row">
                <div className="sum-card"><span className="sum-num">{summary.total}</span><span className="sum-lbl">검색 건물</span></div>
                <div className="sum-card"><span className="sum-num">{summary.lease}</span><span className="sum-lbl">임대</span></div>
                <div className="sum-card"><span className="sum-num">{summary.sale}</span><span className="sum-lbl">매각</span></div>
                <div className="sum-card"><span className="sum-num">{summary.avgRent != null ? `${Math.round(summary.avgRent / 10000).toLocaleString()}만` : '–'}</span><span className="sum-lbl">평균 월임대료</span></div>
              </div>
            )}

            {ranked.length > 0 && <MapView items={ranked} onSelect={setSelected} />}

            <div className="listings">
              {ranked.map((it) => (
                <ListingCard key={it.id} item={it} onClick={() => setSelected(it)} fav={favs.includes(it.id)} onFav={onFav} />
              ))}
              {ranked.length === 0 && (
                <div className="card muted">조건에 맞는 물건이 없습니다. 업종·지역·처분방식을 넓혀보세요.</div>
              )}
            </div>
          </>
        )}

        {raw && !loading && <KStartupPanel region={criteria.region} />}

        <SourceStatus errors={errors} loaded={raw != null} />

        <footer className="app-footer muted">
          데이터: 한국자산관리공사 온비드·국토교통부 공공데이터(data.go.kr). AI는 매칭·분류만 하며,
          물건·금액·마감 등 사실은 공공데이터 원본에서만 제공됩니다. · 인사이트랩
        </footer>

        {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
      </div>
    </ErrorBoundary>
  )
}

function SourceStatus({ errors, loaded }: { errors: SourceError[]; loaded: boolean }) {
  return (
    <details className="source-status" open={loaded && errors.length > 0}>
      <summary>데이터 연동 상태 ({ACTIVE.length}종 통합)</summary>
      <ul>
        {ACTIVE.map((s) => {
          const err = errors.find((e) => e.datasetUrl === s.datasetUrl)
          return (
            <li key={s.id}>
              <span className={`dot ${loaded ? (err ? 'off' : 'on') : 'idle'}`} />
              <a href={s.datasetUrl} target="_blank" rel="noreferrer">{s.label}</a>
              <span className="muted"> · {s.asOf} · ✅검증</span>
              {err && <span className="err-msg"> — {err.message}</span>}
            </li>
          )
        })}
        {PLANNED.map((s) => (
          <li key={s.id}>
            <span className="dot idle" />
            <a href={s.datasetUrl} target="_blank" rel="noreferrer">{s.label}</a>
            <span className="muted"> · {s.asOf}</span>
          </li>
        ))}
      </ul>
      <p className="muted tiny">
        ※ 온비드 물건목록·공공개발 공실 = 실호출 검증·통합 완료. 국유재산 입찰·임대현황은 호출 검증 완료, 필드매핑 통합 예정(가상데이터 없음).
      </p>
    </details>
  )
}
