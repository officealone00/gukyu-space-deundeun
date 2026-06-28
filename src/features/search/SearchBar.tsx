import type { SearchCriteria } from '../../lib/types'
import { PERSONAS } from '../../lib/personas'

const REGIONS = ['', '서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주']
const DISPOSALS: SearchCriteria['disposal'][] = ['전체', '임대', '매각']

interface Props {
  value: SearchCriteria
  onChange: (c: SearchCriteria) => void
  onSearch: () => void
  onNear: () => void
  onNl: (text: string) => void
}

export function SearchBar({ value, onChange, onSearch, onNear, onNl }: Props) {
  const set = (patch: Partial<SearchCriteria>) => onChange({ ...value, ...patch })
  return (
    <div className="search">
      <div className="nl-row">
        <input
          className="nl-input"
          type="text"
          placeholder="말로 찾기: 예) 경기 카페 임대 / 서울 사무실 매각"
          onKeyDown={(e) => { if (e.key === 'Enter') onNl((e.target as HTMLInputElement).value) }}
        />
        <span className="muted tiny">Enter로 검색</span>
      </div>
      <div className="persona-row" role="tablist" aria-label="페르소나 선택">
        {PERSONAS.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={value.persona === p.id}
            className={`persona ${value.persona === p.id ? 'on' : ''}`}
            onClick={() => set({ persona: p.id })}
            title={p.hint}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="muted persona-hint">{PERSONAS.find((p) => p.id === value.persona)?.hint}</p>

      <div className="fields">
        <label>
          <span>업종</span>
          <input
            type="text"
            placeholder="예: 창고, 점포, 사무"
            value={value.industry}
            onChange={(e) => set({ industry: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
        </label>
        <label>
          <span>지역</span>
          <select value={value.region} onChange={(e) => set({ region: e.target.value })}>
            {REGIONS.map((r) => <option key={r} value={r}>{r || '전체'}</option>)}
          </select>
        </label>
        <label>
          <span>처분방식</span>
          <select value={value.disposal} onChange={(e) => set({ disposal: e.target.value as SearchCriteria['disposal'] })}>
            {DISPOSALS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>
      <div className="search-actions">
        <button className="primary" onClick={onSearch}>국유·공공 부동산 찾기</button>
        <button className="near" onClick={onNear} title="위치 권한 허용 시 가까운 10곳">📍 내 주변 10곳</button>
      </div>
    </div>
  )
}
