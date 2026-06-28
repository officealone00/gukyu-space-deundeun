import { useEffect, useState } from 'react'
import type { ScoredSpace } from '../../lib/types'
import { dDay, won, refineScore } from '../../lib/score'
import { computeDaebu, won as wonD } from '../../lib/daebu'
import { loadKakao, geocode } from '../../lib/kakao'
import { fetchStoreBreakdown, coord2lawd, fetchCommercialPricePerM2, type StoreBreakdown } from '../../lib/insight'
import { aiComment } from '../../lib/ai'

interface Insight { stores: number | null; avgPerM2: number | null; byCat: StoreBreakdown['byCat'] }

// 인앱 모달 — 상세 + 그 자리 주변 분석(상권·시세) 실시간.
export function DetailModal({ item, onClose }: { item: ScoredSpace; onClose: () => void }) {
  const d = dDay(item.bidDeadline)
  const daebu = computeDaebu(item.appraisal)
  // 시세 대비는 '매각'만 유효(매매 실거래가 기준). 임대 월임대료/㎡를 매매가/㎡와 비교하면 안 됨.
  const ourPerM2 = item.disposalType !== '임대' && item.amount && item.areaM2 ? Math.round(item.amount / item.areaM2 / 10000) : null
  const [insight, setInsight] = useState<Insight | null>(null)
  const [iLoading, setILoading] = useState(true)
  const [aiText, setAiText] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)

  async function runAi() {
    setAiBusy(true)
    try { setAiText(await aiComment(item, { stores: insight?.stores, avgPerM2: insight?.avgPerM2, ourPerM2, byCat: insight?.byCat })) }
    catch { setAiText('AI 분석을 불러오지 못했어요. (OpenAI 키 설정을 확인하세요)') }
    finally { setAiBusy(false) }
  }

  useEffect(() => {
    let alive = true
    setInsight(null); setILoading(true)
    ;(async () => {
      try {
        const kakao = await loadKakao()
        let lat = item.lat2, lng = item.lng2
        if (lat == null || lng == null) { const g = await geocode(kakao, item.address, item.region, item.id); if (g) { lat = g[0]; lng = g[1] } }
        if (lat == null || lng == null) { if (alive) setILoading(false); return }
        const [bd, lawd] = await Promise.all([fetchStoreBreakdown(lat, lng, 500).catch(() => null), coord2lawd(kakao, lat, lng)])
        const price = lawd ? await fetchCommercialPricePerM2(lawd).catch(() => null) : null
        if (alive) setInsight({ stores: bd?.total ?? null, byCat: bd?.byCat ?? [], avgPerM2: price?.avgPerM2 ?? null })
      } catch { /* 분석 실패 무시 */ } finally { if (alive) setILoading(false) }
    })()
    return () => { alive = false }
  }, [item.id])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className={`score score-${item.score >= 70 ? 'hi' : item.score >= 40 ? 'mid' : 'lo'}`}>적합도 {item.score}</span>
            {item.disposalType && <span className={`disp ${item.disposalType === '임대' ? 'lease' : 'sale'}`}>{item.disposalType}</span>}
            {item.propertyType && <span className="src-tag">{item.propertyType}</span>}
          </div>
          <button className="x" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        {item.thumbnailUrl && <img className="thumb" src={item.thumbnailUrl} alt="" loading="lazy" />}
        <h3>{item.title}</h3>
        <p className="muted">{item.address || '소재지 정보 없음'}</p>

        <dl className="kv">
          <div><dt>용도</dt><dd>{item.usage ?? '미상'}</dd></div>
          <div><dt>면적</dt><dd>{item.areaM2 ? `${item.areaM2}㎡` : '미상'}</dd></div>
          <div><dt>{item.disposalType === '임대' ? '월 임대료' : '최저입찰가'}</dt><dd>{item.amount != null ? won(item.amount) : (item.amountLabel ?? '—')}</dd></div>
          {item.deposit != null && item.deposit > 0 && <div><dt>보증금</dt><dd>{won(item.deposit)}</dd></div>}
          <div><dt>입찰상태</dt><dd>{item.bidStatus ?? '—'}</dd></div>
          <div><dt>입찰마감</dt><dd>{item.bidDeadline ? item.bidDeadline.slice(0, 16).replace('T', ' ') : '미상'}{d != null && d >= 0 ? ` (D-${d})` : ''}</dd></div>
        </dl>

        <div className="insight">
          <strong>이 자리 주변 분석 {iLoading && <span className="muted">· 분석 중…</span>}</strong>
          {insight && (insight.stores != null || insight.avgPerM2 != null) && (() => {
            const r = refineScore(item.score, { stores: insight.stores, ourPerM2, avgPerM2: insight.avgPerM2 })
            return <div className="refined">정밀 적합도 <b>{r.score}</b> <span className="muted">({r.parts.join(' · ')})</span></div>
          })()}
          {insight?.stores != null && <div className="insight-row">· 반경 500m 상가 <b>{insight.stores.toLocaleString()}개</b> <span className="muted">(상권 활성도)</span></div>}
          {insight?.byCat && insight.byCat.length > 0 && (
            <div className="cat-row">
              {insight.byCat.slice(0, 6).map((c) => (
                <span className="cat-chip" key={c.name}>{c.name} <b>{c.count}</b></span>
              ))}
              <span className="muted tiny">표본 100개 기준 업종 분포</span>
            </div>
          )}
          {insight?.avgPerM2 != null && (
            <div className="insight-row">
              · 주변 상업용 실거래 평균 <b>{insight.avgPerM2.toLocaleString()}만원/㎡</b>
              {ourPerM2 != null && <span className="muted"> · 이 자리 {ourPerM2.toLocaleString()}만원/㎡{ourPerM2 < insight.avgPerM2 ? ` (시세 대비 ${Math.round((1 - ourPerM2 / insight.avgPerM2) * 100)}% 저렴)` : ''}</span>}
            </div>
          )}
          {!iLoading && insight?.stores == null && insight?.avgPerM2 == null && <div className="muted tiny">주변 데이터를 찾지 못했습니다.</div>}
          <div className="ai-block">
            <button className="ai-btn" onClick={runAi} disabled={aiBusy}>{aiBusy ? 'AI 분석 중…' : '✨ AI 자리 분석'}</button>
            {aiText && <p className="ai-text">{aiText}</p>}
          </div>
          <p className="muted tiny">출처: 소상공인 상권정보·국토부 실거래가(data.go.kr) · AI는 위 수치만 근거로 해석(사실 생성 안 함)</p>
        </div>

        {daebu && (
          <div className="daebu">
            <strong>예상 대부료 (감정가 {wonD(daebu.base)} 기준)</strong>
            <div className="daebu-row"><span>일반 5%</span><span>월 {wonD(daebu.normalMonth)}</span></div>
            <div className="daebu-row hi"><span>청년·소상공인 1%</span><span>월 {wonD(daebu.reducedMonth)} <b>↓{wonD(daebu.savingMonth)} 절감</b></span></div>
            <p className="muted tiny">※ 국유재산법 시행령 기준. 1% 감면은 2026 상반기 시행 예정(입법예고).</p>
          </div>
        )}

        <div className="reasons">
          <strong>왜 이 점수인가 (근거)</strong>
          <ul>{item.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>

        <p className="honesty muted">
          출처: {item.sourceLabel} · {item.asOf}. 물건·금액·마감은 공공데이터 원본 그대로이며, 적합도·주변분석만 본 서비스가 계산했습니다. 물건관리번호: {(item.raw['cltrMngNo'] as string) ?? '—'}
        </p>

        {item.detailUrl && <a className="primary link" href={item.detailUrl} target="_blank" rel="noreferrer">온비드에서 상세·입찰 확인 →</a>}
      </div>
    </div>
  )
}
