import type { ScoredSpace } from '../../lib/types'
import { dDay, won } from '../../lib/score'

interface Props {
  item: ScoredSpace
  onClick: () => void
  fav?: boolean
  onFav?: (id: string) => void
}

export function ListingCard({ item, onClick, fav, onFav }: Props) {
  const d = dDay(item.bidDeadline)
  return (
    <button className="listing" onClick={onClick}>
      <div className="listing-head">
        <span className={`score score-${item.score >= 70 ? 'hi' : item.score >= 40 ? 'mid' : 'lo'}`}>
          적합도 {item.score}
        </span>
        {item.disposalType && <span className={`disp ${item.disposalType === '임대' ? 'lease' : 'sale'}`}>{item.disposalType}</span>}
        {item.distanceKm != null && <span className="dist">{item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)}m` : `${item.distanceKm.toFixed(1)}km`}</span>}
        {d != null && d >= 0 && <span className={`dday ${d <= 3 ? 'urgent' : ''}`}>D-{d}</span>}
        {onFav && (
          <span
            className={`fav ${fav ? 'on' : ''}`}
            role="button"
            aria-label="관심물건"
            onClick={(e) => { e.stopPropagation(); onFav(item.id) }}
          >{fav ? '♥' : '♡'}</span>
        )}
      </div>
      <div className="listing-title">{item.title}</div>
      <div className="muted listing-addr">{item.address || '소재지 정보 없음'}</div>
      <div className="listing-meta">
        <span>{item.propertyType ?? ''}</span>
        <span>{item.usage ?? '용도 미상'}</span>
        <span>{item.areaM2 ? `${item.areaM2}㎡` : '면적 미상'}</span>
        <span>{item.amount != null ? won(item.amount) : (item.amountLabel ?? '—')}</span>
      </div>
    </button>
  )
}
