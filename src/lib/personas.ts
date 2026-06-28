import type { PersonaDef } from './types'

// 페르소나 N종: 내용이 아니라 활용적합도 '우선순위(가중치)'를 재배치한다(든든 §E).
export const PERSONAS: PersonaDef[] = [
  {
    id: 'youth',
    label: '청년 예비창업자',
    hint: '초기비용에 가장 민감 — 대부료 저렴도 우선',
    weights: { fit: 0.25, rent: 0.45, access: 0.2, area: 0.1 },
  },
  {
    id: 'smallbiz',
    label: '소상공인 이전·확장',
    hint: '업종-입지 궁합이 매출 직결 — 적합도 우선',
    weights: { fit: 0.45, rent: 0.2, access: 0.25, area: 0.1 },
  },
  {
    id: 'local',
    label: '로컬크리에이터·사회적경제',
    hint: '접근성·공간 규모 균형',
    weights: { fit: 0.3, rent: 0.25, access: 0.25, area: 0.2 },
  },
]

export function getPersona(id: string): PersonaDef {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]
}
