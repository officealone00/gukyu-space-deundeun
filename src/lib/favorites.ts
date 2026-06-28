// 관심물건 — localStorage 영구 저장(앱 재시작에도 유지)
const KEY = 'gukyu_favs'

export function getFavs(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function toggleFav(id: string): string[] {
  const f = getFavs()
  const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id]
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}
