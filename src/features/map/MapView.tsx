import { useEffect, useRef } from 'react'
import { loadKakao, geocode } from '../../lib/kakao'
import type { ScoredSpace } from '../../lib/types'

interface Props {
  items: ScoredSpace[]
  onSelect: (item: ScoredSpace) => void
}

// 통합 지도: 좌표 있으면 즉시, 없으면 주소 지오코딩 후 마커. 든든 §E(완성도) — 마커 중앙정렬.
export function MapView({ items, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const errRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    loadKakao()
      .then((kakao) => {
        if (!alive || !ref.current) return
        const map = new kakao.maps.Map(ref.current, {
          center: new kakao.maps.LatLng(36.5, 127.8),
          level: 13,
        })
        mapRef.current = { kakao, map }
        renderMarkers()
      })
      .catch((e) => {
        if (errRef.current) errRef.current.textContent = String(e.message ?? e)
      })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { renderMarkers() /* eslint-disable-next-line */ }, [items])

  async function renderMarkers() {
    const ctx = mapRef.current
    if (!ctx) return
    const { kakao, map } = ctx
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    const bounds = new kakao.maps.LatLngBounds()
    // 상위 15건만 병렬 지오코딩(순차 await로 렌더 블로킹 방지 → 데모 안정성)
    const top = items.slice(0, 15)
    const coords = await Promise.all(
      top.map(async (it) => {
        if (it.lat != null && it.lng != null) return [it.lat, it.lng] as [number, number]
        return geocode(kakao, it.address, it.region, it.id)
      }),
    )
    let any = false
    top.forEach((it, i) => {
      const g = coords[i]
      if (!g) return
      const pos = new kakao.maps.LatLng(g[0], g[1])
      const tier = it.score >= 70 ? 'hi' : it.score >= 40 ? 'mid' : 'lo'
      const el = document.createElement('div')
      el.className = `map-marker mm-${tier}`
      el.textContent = String(it.score)
      el.title = `${it.title} · 적합도 ${it.score}`
      el.onclick = () => onSelect(it)
      const ov = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1, zIndex: 3 })
      ov.setMap(map)
      markersRef.current.push(ov)
      bounds.extend(pos)
      any = true
    })
    if (any) map.setBounds(bounds)
  }

  return (
    <div className="map-wrap">
      <div ref={ref} className="map" />
      <div ref={errRef} className="map-err muted" />
    </div>
  )
}
