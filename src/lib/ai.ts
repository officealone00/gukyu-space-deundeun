// AI(OpenAI) — 해석·추천만. 사실(물건·금액·마감)은 공공데이터 원본에서만. 환각 차단 프롬프트.
// 키는 Worker secret(OPENAI_KEY) 또는 dev .env.local(VITE_OPENAI_KEY). 클라는 /ai 경로만.
import { AI_BASE } from './endpoints'
import type { SpaceItem } from './types'

const MODEL = 'gpt-4o-mini'

async function chat(messages: { role: string; content: string }[], json = false): Promise<string> {
  const r = await fetch(`${AI_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.3, ...(json ? { response_format: { type: 'json_object' } } : {}) }),
  })
  if (!r.ok) throw new Error(`AI ${r.status}`)
  const j = await r.json()
  return j?.choices?.[0]?.message?.content ?? ''
}

const SIDO = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주']

export interface ParsedQuery { region: string; industry: string; disposal: '전체' | '임대' | '매각' }

// ① 자연어 질의 → 구조화(지역·업종·처분방식). 실패 시 호출측에서 정규식 폴백.
export async function aiParseQuery(text: string): Promise<ParsedQuery> {
  const sys = `너는 부동산 검색 질의 파서다. 사용자 질의에서 아래 JSON만 출력:
{"region": 한국 시도 짧은형(${SIDO.join('/')}) 중 해당, 없으면 "", "industry": 업종/용도 키워드(예 카페,창고,사무,점포) 없으면 "", "disposal": "임대"|"매각"|"전체"}
설명·코드블록 없이 JSON만.`
  const out = await chat([{ role: 'system', content: sys }, { role: 'user', content: text }], true)
  const p = JSON.parse(out)
  const region = SIDO.find((s) => String(p.region ?? '').includes(s)) ?? ''
  const disposal = (['임대', '매각'].includes(p.disposal) ? p.disposal : '전체') as ParsedQuery['disposal']
  return { region, industry: String(p.industry ?? '').trim(), disposal }
}

// ② AI 자리 추천 코멘트 — 제공된 데이터(수치)만 근거로, 추천 업종 + 경쟁/공백 조언.
export async function aiComment(
  item: SpaceItem,
  ctx: { stores?: number | null; avgPerM2?: number | null; ourPerM2?: number | null; byCat?: { name: string; count: number }[] },
): Promise<string> {
  const facts = [
    `물건: ${item.title}`,
    `소재지: ${item.address || '미상'}`,
    `용도: ${item.usage || '미상'}`,
    `면적: ${item.areaM2 ? item.areaM2 + '㎡' : '미상'}`,
    `처분방식: ${item.disposalType || '미상'}`,
    ctx.stores != null ? `반경 500m 상가수: ${ctx.stores}개` : '',
    ctx.byCat && ctx.byCat.length ? `반경 500m 업종 분포(표본): ${ctx.byCat.slice(0, 8).map((c) => `${c.name} ${c.count}`).join(', ')}` : '',
    ctx.avgPerM2 != null ? `주변 상업용 실거래 평균: ${ctx.avgPerM2}만원/㎡` : '',
    ctx.ourPerM2 != null ? `이 자리 단가: ${ctx.ourPerM2}만원/㎡` : '',
  ].filter(Boolean).join('\n')
  const sys = `너는 창업 자리 컨설턴트다. 아래 '사실 데이터'만 근거로 청년·소상공인에게 조언하라. 한국어 3~4문장:
1) 업종 분포를 보고 경쟁이 센 업종과 비어있는(공백) 업종을 짚어라.
2) 이 면적·단가·입지에 맞는 **추천 업종 1~2개**와 이유.
규칙: 제공된 수치 외 새로운 사실(가격·면적·통계·상호)을 절대 만들지 마라. 과장 금지.`
  return chat([{ role: 'system', content: sys }, { role: 'user', content: facts }])
}
