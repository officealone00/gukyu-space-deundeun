import type { ScoredSpace, SearchCriteria, SpaceItem } from './types'
import { getPersona } from './personas'

// ── 활용적합도 점수 (자체 신지표, 산식 공개) ──────────────────────────
// 적합도 = w1·업종-입지 적합 + w2·금액 저렴도 + w3·접근성 + w4·면적 적합
// 각 항목 0~1 정규화 → 페르소나 가중치로 가중합 → 0~100. 근거(reasons) 동반(블랙박스 금지).

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const REF_AMOUNT = 500_000_000 // 금액 저렴도 기준(5억)

function won(n?: number): string {
  if (n == null) return '—'
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억원`
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만원`
  return `${n.toLocaleString()}원`
}

// 업종-입지 적합: 용도/물건명에 업종 키워드가 맞는지(규칙기반 v1).
function fitScore(item: SpaceItem, industry: string): { v: number; why?: string } {
  if (!industry.trim()) return { v: 0.5 }
  const hay = `${item.usage ?? ''} ${item.title}`.toLowerCase()
  if (hay.includes(industry.toLowerCase())) return { v: 1, why: `용도/물건명에 '${industry}' 부합` }
  if ((item.usage ?? '').match(/근린|상가|점포|사무|창고/)) return { v: 0.7, why: `${item.usage} (다업종 수용 가능)` }
  return { v: 0.4 }
}

// 금액 저렴도: 최저입찰가/감정가가 낮을수록 높음(기준 5억). 임대+예산이 맞으면 가점.
function amountScore(item: SpaceItem, budget?: number): { v: number; why?: string } {
  if (item.amount == null) return { v: 0.5, why: '금액 비공개/정보없음' }
  if (item.disposalType === '임대' && budget && budget > 0 && item.amount <= budget) {
    return { v: 0.95, why: `임대료 ${won(item.amount)} ≤ 예산 ${won(budget)}` }
  }
  return { v: clamp01(1 - item.amount / REF_AMOUNT), why: `${item.disposalType ?? ''} ${won(item.amount)}` }
}

function accessScore(item: SpaceItem): { v: number; why?: string } {
  if (item.region) return { v: 0.7, why: `${item.region} 소재(지도 확인 가능)` }
  return { v: 0.4, why: '소재지 정보 제한' }
}

function areaScore(item: SpaceItem): { v: number; why?: string } {
  if (item.areaM2 == null) return { v: 0.5 }
  return { v: 1, why: `면적 ${item.areaM2}㎡` }
}

export function scoreItem(item: SpaceItem, c: SearchCriteria): ScoredSpace {
  const w = getPersona(c.persona).weights
  const f = fitScore(item, c.industry)
  const a = amountScore(item, c.budgetMonthly)
  const ac = accessScore(item)
  const ar = areaScore(item)
  const score = Math.round((w.fit * f.v + w.rent * a.v + w.access * ac.v + w.area * ar.v) * 100)
  const reasons = [
    f.why && `업종-입지: ${f.why}`,
    a.why && `금액: ${a.why}`,
    ac.why && `접근성: ${ac.why}`,
    ar.why && `면적: ${ar.why}`,
  ].filter(Boolean) as string[]
  return { ...item, score, reasons }
}

export function rankSpaces(items: SpaceItem[], c: SearchCriteria): ScoredSpace[] {
  return items
    .filter((it) => c.disposal === '전체' || (it.disposalType ?? '').includes(c.disposal))
    .map((it) => scoreItem(it, c))
    .sort((a, b) => b.score - a.score)
}

export function byDeadline(items: ScoredSpace[]): ScoredSpace[] {
  return [...items].sort((a, b) => {
    if (!a.bidDeadline) return 1
    if (!b.bidDeadline) return -1
    return a.bidDeadline.localeCompare(b.bidDeadline)
  })
}

// ② 정밀 적합도: 리스트 단계의 룰 점수(base)에 상세 시 가져온 상권·시세 실데이터를 가산.
export interface Refined { score: number; parts: string[] }
export function refineScore(base: number, ctx: { stores?: number | null; ourPerM2?: number | null; avgPerM2?: number | null }): Refined {
  const parts = [`기본 ${base}`]
  let bonus = 0
  if (ctx.stores != null) { const a = Math.round(Math.min(ctx.stores / 200, 1) * 10); bonus += a; parts.push(`상권활성도 +${a}`) }
  if (ctx.ourPerM2 && ctx.avgPerM2 && ctx.ourPerM2 < ctx.avgPerM2) { const sv = Math.round((1 - ctx.ourPerM2 / ctx.avgPerM2) * 15); bonus += sv; parts.push(`시세대비 저렴 +${sv}`) }
  return { score: Math.max(0, Math.min(100, base + bonus)), parts }
}

export function dDay(iso?: string): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

export { won }
