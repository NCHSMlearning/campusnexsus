// CampusNexus service worker — network-first navigation and versioned assets.
const CACHE_NAME = 'campusnexus-v12';
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
  const isAdminExamsRequest =
    url.pathname === '/adminexams' ||
    url.pathname === '/adminexams/' ||
    url.pathname.startsWith('/adminexams/') ||
    url.pathname.startsWith('/platform/examinations/source/');
  if (isAdminExamsRequest) return;

  // Student portal, login and database scripts must never be served from a
  // stale cache. These pages authenticate users and depend on tightly-coupled
  // HTML/JS versions, so always let the browser fetch the current deployment.
  const studentCoreScripts = new Set([
    '/js/utils.js',
    '/js/ui.js',
    '/js/database.js',
    '/js/dashboard.js',
    '/js/profile.js',
    '/js/attendance.js',
    '/js/courses.js',
    '/js/exams.js',
    '/js/unit-registration.js',
    '/js/resources.js',
    '/js/calendar.js',
    '/js/messages.js',
    '/js/student-tickets.js',
    '/js/nurseiq.js',
    '/js/exam-card.js',
    '/js/lecture-card.js',
    '/js/academic-reports.js',
    '/js/timetable-manager.js',
    '/js/reviews-newsletter.js',
    '/js/student-finance.js',
    '/js/enrollment.js',
    '/js/cleanup.js',
    '/js/chatbot.js',
    '/js/student-blog.js',
    '/js/student-clinical-placements.js',
    '/js/online-learning.js',
    '/js/nchsm-mobile-enhancements.js',
    '/platform/js/academic-structure.js',
    '/platform/js/student-navigation.js',
    '/platform/js/student-sidebar-search.js',
    '/platform/js/student-dashboard-enhancements.js',
    '/platform/js/student-navigation-guard.js',
    '/platform/js/institution-portal-branding.js',
    '/platform/js/campus-nexus-module-access.js'
  ]);
  const isStudentPortalRoute =
    url.pathname === '/student' ||
    url.pathname === '/student/' ||
    url.pathname.startsWith('/student/') ||
    url.pathname === '/platform/student.html' ||
    url.pathname === '/platform/student' ||
    url.pathname.startsWith('/platform/student/');
  const isStudentOrLoginRequest =
    isStudentPortalRoute ||
    url.pathname.startsWith('/platform/js/student-') ||
    studentCoreScripts.has(url.pathname) ||
    url.pathname === '/config.js' ||
    url.pathname === '/platform/login.html' ||
    url.pathname.startsWith('/platform/login/') ||
    url.pathname === '/login' ||
    url.pathname === '/login/' ||
    url.pathname.startsWith('/login/');
  // Do not serve a mixed-version student workspace from the service-worker
  // cache. Authentication, the database wrapper and dependent feature modules
  // must all come from the same current deployment. This is intentionally
  // network-only; the portal is authenticated and must not replay stale code.
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
