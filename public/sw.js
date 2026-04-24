const CACHE_NAME = 'finance-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
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

  // /api/ 경로는 pwa-icon 제외하고 캐시 없이 통과 (Supabase 인증 포함)
  if (url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/pwa-icon')) return

  // 네비게이션 요청: 네트워크 실패 시 offline.html 반환
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    )
  }
})
