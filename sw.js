// 아루 서비스 워커 v3.9
// index.html은 항상 네트워크 우선 → 앱 열 때 자동으로 최신 버전 적용

const VERSION = 'aru-3.9';
const CACHE   = `aru-${VERSION}`;

// 캐시할 정적 자산 (아이콘 등 잘 안 바뀌는 것들)
const STATIC = [
  './icon.svg',
  './icon.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.json',
];

// 설치
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC))
      .then(() => self.skipWaiting()) // 즉시 활성화
  );
});

// 활성화 — 구버전 캐시 전부 삭제
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('aru-') && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // 열려있는 탭 즉시 제어
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // API 요청은 캐시 안 함
  if (url.includes('api.anthropic.com')) return;

  // ★ 핵심: index.html / version.json은 항상 네트워크 먼저
  // → 앱 열 때마다 서버에서 최신 파일을 받아옴
  if (url.includes('index.html') || url.includes('version.json') || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // 받아온 김에 캐시도 갱신
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request)) // 오프라인이면 캐시에서
    );
    return;
  }

  // 나머지 정적 파일(아이콘 등)은 캐시 우선
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
