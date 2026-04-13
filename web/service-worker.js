// 同声传译工具 - Service Worker
const CACHE_NAME = 'simul-translate-v1.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  // 图标文件（如果存在）
  '/icon-192.png',
  '/icon-512.png'
];

// 安装事件 - 预缓存资源
self.addEventListener('install', (event) => {
  console.log('Service Worker: 正在安装...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: 缓存应用资源');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('Service Worker: 安装完成，跳过等待阶段');
        return self.skipWaiting();
      })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('Service Worker: 正在激活...');
  
  // 删除旧缓存
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Service Worker: 删除旧缓存', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker: 激活完成，已清理旧缓存');
      return self.clients.claim();
    })
  );
});

// 请求拦截 - 缓存优先策略
self.addEventListener('fetch', (event) => {
  // 只处理同源请求
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    return;
  }
  
  // 对于API请求，使用网络优先策略
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // 网络失败时返回错误响应
          return new Response(JSON.stringify({
            ok: false,
            error: '网络连接失败，请检查网络'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
  
  // 对静态资源使用缓存优先策略
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // 返回缓存内容或进行网络请求
        return cachedResponse || fetch(event.request)
          .then((response) => {
            // 如果不是同源请求或不成功，直接返回
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 缓存新的资源
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          });
      })
      .catch(() => {
        // 网络和缓存都失败的特殊处理
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
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