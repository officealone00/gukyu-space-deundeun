// 국유 일반재산 대부료 계산 (근거: 국유재산법 시행령)
// 연 대부료 = 재산가액 × 요율. 일반 5%(1천분의50) 이상. 청년·소상공인 등 정책대상 1%까지 감면.
// ※ 청년·소상공인 1% 적용은 국유재산법 시행령 개정(2025.11 입법예고)에 따른 2026 상반기 시행 예정 사항.

export interface DaebuEstimate {
  base: number
  normalYear: number
  normalMonth: number
  reducedYear: number
  reducedMonth: number
  savingMonth: number // 월 절감액(일반 대비)
}

export function computeDaebu(appraisal?: number): DaebuEstimate | null {
  if (!appraisal || appraisal <= 0) return null
  const normalYear = appraisal * 0.05
  const reducedYear = appraisal * 0.01
  return {
    base: appraisal,
    normalYear,
    normalMonth: normalYear / 12,
    reducedYear,
    reducedMonth: reducedYear / 12,
    savingMonth: (normalYear - reducedYear) / 12,
  }
}

export function won(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억원`
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만원`
  return `${Math.round(n).toLocaleString()}원`
}
