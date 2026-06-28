// Cloudflare Worker — data.go.kr 키 숨김 + CORS 프록시(prod용).
// 비밀키는 Worker secret(wrangler secret put DATAGO_KEY)에만. 클라는 키 없이 /datago/* 호출.
// dev에서는 Vite 프록시가 같은 역할(키는 클라 .env.local).

export interface Env {
  DATAGO_KEY?: string // data.go.kr 일반 인증키(Decoding)
  OPENAI_KEY?: string // OpenAI API 키 — 클라 노출 금지, Worker secret으로만
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    const url = new URL(req.url)

    // OpenAI 프록시: 키는 Worker secret(OPENAI_KEY)에만. 클라는 /ai/* 로만 호출.
    if (url.pathname.startsWith('/ai/')) {
      try {
        const upstream = 'https://api.openai.com' + url.pathname.replace(/^\/ai/, '')
        const r = await fetch(upstream, {
          method: req.method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_KEY ?? ''}` },
          body: req.method === 'POST' ? await req.text() : undefined,
        })
        const body = await r.text()
        return new Response(body, { status: r.status, headers: { ...CORS, 'Content-Type': 'application/json' } })
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
    }

    if (!url.pathname.startsWith('/datago/')) {
      return new Response('Not found', { status: 404, headers: CORS })
    }
    try {
      const upstream = new URL('https://apis.data.go.kr' + url.pathname.replace(/^\/datago/, ''))
      url.searchParams.forEach((v, k) => upstream.searchParams.set(k, v))
      if (env.DATAGO_KEY) upstream.searchParams.set('serviceKey', env.DATAGO_KEY)
      // 온비드는 resultType, 일부 data.go.kr은 _type — 둘 다 세팅(대부분 미지정 파라미터는 무시)
      if (!upstream.searchParams.has('resultType')) upstream.searchParams.set('resultType', 'json')
      const r = await fetch(upstream.toString(), { headers: { Accept: 'application/json' } })
      const body = await r.text()
      return new Response(body, {
        status: r.status,
        headers: { ...CORS, 'Content-Type': r.headers.get('Content-Type') ?? 'application/json' },
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e) }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
  },
}
