import { useState } from 'react'
import { fetchAnnouncements, type BizAnnouncement } from '../../lib/kstartup'
import { dDay } from '../../lib/score'

// 자리 + 지원금: 창업지원사업 공고 연계(K-Startup, 모집중)
export function KStartupPanel({ region }: { region: string }) {
  const [items, setItems] = useState<BizAnnouncement[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setLoading(true); setErr(null)
    try { setItems(await fetchAnnouncements(region)) }
    catch (e) { setErr(String((e as Error).message ?? e)) }
    finally { setLoading(false) }
  }

  return (
    <details className="support" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open && items == null && !loading) load() }}>
      <summary>＋ 관련 창업지원사업 (자리 + 지원금) {region && `· ${region}`}</summary>
      {loading && <p className="muted">창업지원사업 불러오는 중…</p>}
      {err && <p className="err-msg">{err}</p>}
      {items && items.length === 0 && <p className="muted">현재 모집 중인 관련 지원사업이 없습니다.</p>}
      <div className="support-list">
        {items?.map((b, i) => {
          const d = dDay(b.endDt ? `${b.endDt.slice(0, 4)}-${b.endDt.slice(4, 6)}-${b.endDt.slice(6, 8)}T18:00:00` : undefined)
          return (
            <div className="support-item" key={i}>
              <div className="support-top">
                <span className="support-field">{b.field || '지원사업'}</span>
                {b.region && <span className="src-tag">{b.region}</span>}
                {d != null && d >= 0 && <span className={`dday ${d <= 5 ? 'urgent' : ''}`}>D-{d}</span>}
              </div>
              <div className="support-name">{b.name}</div>
              <div className="muted tiny">{b.org} · 대상: {b.target || '—'}</div>
              {b.url && <a href={b.url} target="_blank" rel="noreferrer" className="support-link">신청·자세히 →</a>}
            </div>
          )
        })}
      </div>
      <p className="muted tiny">출처: 창업진흥원 K-Startup 사업공고(data.go.kr). 모집중 공고만 표시.</p>
    </details>
  )
}
