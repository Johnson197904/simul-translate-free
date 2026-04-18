// 同声传译工具 - Service Worker
// 版本号：每次代码更新后手动+1，或者用构建hash自动替换
const CACHE_VERSION = 'v12';  // 改数字 = 强制清除旧缓存
const CACHE_NAME = 'simul-translate-' + CACHE_VERSION;
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 安装事件 - 预缓存资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names
        .filter((n) => n.startsWith('simul-translate-') && n !== CACHE_NAME)
        .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// 请求拦截 - Stale-While-Revalidate（先用缓存，同时后台更新，下次用新）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // API 请求走网络优先
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({ ok: false, error: '网络连接失败' }),
        { headers: { 'Content-Type': 'application/json' } })
    ));
    return;
  }

  // 静态资源：Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => {});
        // 有缓存就立刻返回，同时后台更新；没缓存就等网络
        return cached || networkFetch;
      })
    ).catch(() => {
      if (event.request.mode === 'navigate') return caches.match('/');
    })
  );
});

// 后台同步功能 - 可用于同步离线翻译记录
self.addEventListener('sync', (event) => {
  console.log('Service Worker: 后台同步事件', event.tag);
  
  if (event.tag === 'sync-translations') {
    event.waitUntil(syncTranslations());
  }
});

// 定时更新检查
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-check') {
    console.log('Service Worker: 定时检查更新');
    event.waitUntil(checkForUpdates());
  }
});

// 消息处理 - 可用于页面与Service Worker通信
self.addEventListener('message', (event) => {
  console.log('Service Worker: 收到消息', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});

// 辅助函数：同步翻译记录
async function syncTranslations() {
  try {
    const translations = await getOfflineTranslations();
    if (translations.length > 0) {
      console.log('正在同步离线翻译记录...');
      // 这里可以添加同步到服务器的逻辑
      await clearOfflineTranslations();
    }
  } catch (error) {
    console.error('同步失败:', error);
  }
}

// 辅助函数：检查更新
async function checkForUpdates() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = ASSETS_TO_CACHE.map(url => new Request(url));
    const responses = await Promise.all(
      requests.map(req => fetch(req).catch(() => null))
    );
    
    let hasUpdate = false;
    
    // 比较新版本
    for (let i = 0; i < ASSETS_TO_CACHE.length; i++) {
      const newResponse = responses[i];
      if (!newResponse || !newResponse.ok) continue;
      
      const cachedResponse = await cache.match(ASSETS_TO_CACHE[i]);
      if (!cachedResponse) continue;
      
      const newETag = newResponse.headers.get('etag');
      const cachedETag = cachedResponse.headers.get('etag');
      
      if (newETag && cachedETag && newETag !== cachedETag) {
        hasUpdate = true;
        await cache.put(ASSETS_TO_CACHE[i], newResponse);
      }
    }
    
    if (hasUpdate) {
      // 发送更新通知
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          message: '应用已更新，请刷新页面获得最新功能'
        });
      });
    }
    
    return hasUpdate;
  } catch (error) {
    console.error('更新检查失败:', error);
    return false;
  }
}

// 模拟离线功能存储
async function getOfflineTranslations() {
  // 这里可以从IndexedDB获取离线数据
  return [];
}

async function clearOfflineTranslations() {
  // 这里可以清除IndexedDB中的离线数据
  return Promise.resolve();
}