// 국유공간든든 도메인 타입.

export type Persona = 'youth' | 'smallbiz' | 'local'

export interface PersonaDef {
  id: Persona
  label: string
  hint: string
  // 활용적합도 점수 가중치 (합 = 1). 페르소나별 우선순위 재배치(든든 패턴 §E).
  weights: { fit: number; rent: number; access: number; area: number }
}

// 온비드 부동산 물건목록(검증된 실 API) 1건을 정규화한 통합 모델.
export interface SpaceItem {
  id: string
  sourceLabel: string // 화면 노출용 출처명
  title: string
  address: string
  region: string // 시도 단위(필터용)
  lat?: number
  lng?: number
  areaM2?: number // 건물 또는 토지 면적
  usage?: string // 용도(창고시설 등)
  propertyType?: string // 재산유형명(국유재산/공공개발재산/기타일반재산)
  disposalType?: string // 처분방식명(매각/임대)
  amount?: number // 최저입찰가/감정가(원)
  amountLabel?: string // 화면 표시용 금액 라벨
  appraisal?: number // 감정평가금액(대부료 계산 기준)
  rentPeriod?: string // [임대] 임대기간
  bidStatus?: string // 입찰결과(입찰진행중/유찰 등)
  bidDeadline?: string // ISO date — D-day 정렬용
  thumbnailUrl?: string
  detailUrl?: string // 온비드 원본 링크
  lat2?: number // 지오코딩으로 확보한 좌표(내 주변 계산용)
  lng2?: number
  distanceKm?: number // 내 위치 기준 거리
  raw: Record<string, unknown> // 원본 보존(정직성)
  asOf: string // 데이터 기준일/수집일
}

export interface SearchCriteria {
  persona: Persona
  industry: string // 업종 키워드
  region: string // '' = 전체
  budgetMonthly?: number // 월 예산 상한(원) — 임대 물건 비교용(소프트)
  disposal: '전체' | '임대' | '매각'
}

export interface ScoredSpace extends SpaceItem {
  score: number // 0~100 활용적합도
  reasons: string[] // 점수 근거(어느 데이터에서 왔는지) — 블랙박스 금지
}
