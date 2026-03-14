// ╔══════════════════════════════════════════════════════╗
//   아루 서비스 워커 — 자동 업데이트 시스템
//   버전을 올리면 자동으로 캐시 교체 + 앱 업데이트 알림
// ╚══════════════════════════════════════════════════════╝

const VERSION = 'aru-v2.0';  // ← 업데이트할 때 이 숫자만 올리면 됨
const CACHE   = `aru-cache-${VERSION}`;
const ASSETS  = [
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon.png',
  './icon-192.png',
  './icon-512.png',
  './version.json',
];

// ── 설치: 새 캐시에 파일 저장 ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting()) // 즉시 활성화
  );
});

// ── 활성화: 이전 버전 캐시 삭제 ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('aru-cache-') && k !== CACHE)
          .map(k => {
            console.log('[아루] 구버전 캐시 삭제:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim()) // 모든 탭 즉시 제어
  );
});

// ── 네트워크 요청 처리 ──
self.addEventListener('fetch', e => {
  // Anthropic API는 캐시 안 함
  if (e.request.url.includes('api.anthropic.com')) return;

  // version.json은 항상 네트워크 우선 (업데이트 감지용)
  if (e.request.url.includes('version.json')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 나머지는 캐시 우선, 없으면 네트워크
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200) return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});

// ── 메시지: 앱에서 즉시 업데이트 요청 ──
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
