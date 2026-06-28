// 얇은 fetch 래퍼: 타임아웃 + 에러 정규화. 데모 안정성(완성도 rubric)용.
export async function getJson<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 12000, ...rest } = init ?? {}
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      ...rest,
      signal: ctrl.signal,
      headers: { Accept: 'application/json', ...(rest.headers ?? {}) },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(t)
  }
}
