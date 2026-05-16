const CACHE_NAME = 'finance-v7'
const OFFLINE_URL = '/offline.html'
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/icon-192x192.png',
  '/icon-512x512.png',
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

  // 외부 도메인(Supabase 등) — 통과
  if (url.origin !== self.location.origin) return

  // API 경로 — 통과
  if (url.pathname.startsWith('/api/')) return

  // 네비게이션 요청 — SW 개입 없이 브라우저가 직접 처리
  // (Next.js RSC 요청 및 인증 흐름 방해 방지)
  if (event.request.mode === 'navigate') return

  // manifest, _next 내부 파일 — 통과 (항상 최신 버전 유지)
  if (url.pathname === '/manifest.json') return
  if (url.pathname.startsWith('/_next/')) return

  // 정적 자산(아이콘 등): 캐시 우선, 없으면 네트워크
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
    })
  )
})
