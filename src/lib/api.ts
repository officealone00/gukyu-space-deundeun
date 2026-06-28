// 한국 공공데이터(data.go.kr) 응답 3종 파싱 헬퍼.
// ⚠️ 실제 필드 매핑 전 라이브 응답으로 구조 확인(prompts/api-integration.md).
import { getJson } from './http'

export function toArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

// 표준 envelope. 온비드는 response 래퍼 없이 {header, body} 최상위 → 둘 다 대응.
// 에러 포맷 {result:{resultCode,resultMsg}}, {header:{...}} 모두 그대로 노출(정직성).
export async function dataGoItems<T>(url: string): Promise<T[]> {
  const json = await getJson<any>(url)
  const header = json?.response?.header ?? json?.header ?? json?.result
  if (header && header.resultCode && header.resultCode !== '00') {
    throw new Error(`${header.resultCode}: ${header.resultMsg ?? ''}`)
  }
  const body = json?.response?.body ?? json?.body
  const item = body?.items?.item ?? body?.items
  return toArray<T>(item)
}

// 2) bare 객체: { result: [...] } 최상위
export async function getDataGoRaw<T>(url: string, key = 'result'): Promise<T[]> {
  const json = await getJson<any>(url)
  return toArray<T>(json?.[key])
}

// 첫 숫자만 뽑기(임대료 "1,200,000원" 같은 문자열 → 1200000)
export function num(v: unknown): number | undefined {
  if (v == null) return undefined
  const s = String(v).replace(/[^\d.]/g, '')
  if (!s) return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

// 여러 후보 필드명 중 처음 존재하는 값(실응답 필드명이 문서와 다를 때 방어)
export function pick(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return undefined
}
