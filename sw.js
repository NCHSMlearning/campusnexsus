// CampusNexus service worker — network-first navigation and versioned assets.
const CACHE_NAME = 'campusnexus-v14';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/privacy.html',
  '/terms.html',
  '/images/logo-icon.png',
  '/images/showcase/campusnexus-hero.jpg',
  '/images/showcase/portfolio-education.jpg',
  '/images/showcase/portfolio-business.jpg',
  '/images/showcase/portfolio-websites.jpg',
  '/images/showcase/portfolio-custom.jpg',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(error => console.warn('CampusNexus precache skipped:', error))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || request.method !== 'GET') return;

  // Admin Exams must always receive the current HTML and scripts from the
  // origin. Never serve a stale cached dashboard bundle or cached login route.
  // This route is an authenticated, data-sensitive workspace rather than an
  // offline app surface.
  const isLecturerExamsRequest =
    url.pathname === '/platform/lecturerexams.html' ||
    url.pathname === '/platform/lecturerexams' ||
    url.pathname.startsWith('/platform/lecturerexams/');
  if (isLecturerExamsRequest) return;

  // Lecturer exam builder and its shared protection scripts are tightly
  // coupled to lecturerexams.html. Never serve an older cached copy: stale
  // bundles can still request removed exam_grades columns and break marking.
  const isLecturerExamAsset =
    url.pathname === '/platform/js/lecturer-exam-builder-v11.js' ||
    url.pathname === '/js/campus-nexus-code-guard.js' ||
    url.pathname === '/code-protection.js' ||
    url.pathname === '/js/exam-coordinator.js' ||
    url.pathname === '/platform/js/cnseb-live-viewer.js';
  if (isLecturerExamAsset) return;

  const isAdminExamsRequest =
    url.pathname === '/exams' ||
    url.pathname === '/exams.html' ||
    url.pathname === '/admin-exams' ||
    url.pathname === '/adminexams' ||
    url.pathname === '/adminexams/' ||
    url.pathname.startsWith('/adminexams/') ||
    url.pathname.startsWith('/platform/examinations/');
  if (isAdminExamsRequest) return;

  // Student portal, login and database scripts must never be served from a
  // stale cache. These pages authenticate users and depend on tightly-coupled
  // HTML/JS versions, so always let the browser fetch the current deployment.
  const isStudentOrLoginRequest =
    url.pathname === '/platform/student.html' ||
    url.pathname === '/platform/student' ||
    url.pathname.startsWith('/platform/js/student-') ||
    url.pathname === '/js/database.js' ||
    url.pathname === '/config.js' ||
    url.pathname === '/platform/login.html' ||
    url.pathname.startsWith('/platform/login/') ||
    url.pathname === '/login' ||
    url.pathname === '/login/' ||
    url.pathname.startsWith('/login/');
  if (isStudentOrLoginRequest) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/index.html')) || new Response('Offline — please reconnect to the internet.', {status: 503}))
    );
    return;
  }

  if (['style', 'script', 'image', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});
