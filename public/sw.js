const CACHE_NAME = 'finance-v6'
const OFFLINE_URL = '/offline.html'
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)

  // 외부 도메인(Supabase 등) — 캐시 없이 통과
  if (url.origin !== self.location.origin) return

  // /api/ 경로 — 캐시 없이 통과
  if (url.pathname.startsWith('/api/')) return

  // 네비게이션: 네트워크 우선, 실패 시 offline.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL)
        return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
      })
    )
    return
  }

  // 정적 자산: 네트워크 우선 + 캐시 폴백
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        return cached || new Response('', { status: 503 })
      })
  )
})
