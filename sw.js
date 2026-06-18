// ════════════════════════════════════════════════════════════════════
// sw.js — Service Worker สำหรับ ScanPay PWA
// กลยุทธ์: Cache First — โหลดเร็ว ใช้ออฟไลน์ได้
// ════════════════════════════════════════════════════════════════════

const CACHE_NAME = "scanpay-v1";

// ไฟล์ที่ต้อง cache ไว้ใช้ออฟไลน์
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-180.png"
];

// ── Install: cache ไฟล์หลักทันที ──────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: ลบ cache เก่าออก ────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Cache First + Network Fallback ─────────────────────────────
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // ไม่ cache request ที่ไปหา Google Apps Script (Sales Log API)
  // เพราะต้องการข้อมูลสดจาก server เสมอ
  if (
    url.hostname === "script.google.com" ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("googleusercontent.com") ||
    event.request.method === "POST"
  ) {
    return; // ให้ browser จัดการเอง (ไม่ intercept)
  }

  // CDN libraries (fonts, qrcode, html2canvas) — Network First with cache fallback
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com" ||
    url.hostname === "cdnjs.cloudflare.com"
  ) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ไฟล์แอปหลัก — Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
