// ============================================================
// CAMPUSNEXUS - MAIN JAVASCRIPT
// Version: 7.0
// ============================================================

// ============================================================
// HIDE .html OR .htm EXTENSION IN URL
// ============================================================
(function() {
    if (window.location.pathname.endsWith('.html') || window.location.pathname.endsWith('.htm')) {
        const cleanPath = window.location.pathname.replace(/\.(html|htm)$/, '');
        window.history.replaceState({}, '', cleanPath);
    }
})();

// ============================================================
// SCROLL PROGRESS BAR
// ============================================================
const scrollProgress = document.getElementById('scrollProgress');

window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (scrollTop / docHeight) * 100;
    scrollProgress.style.width = progress + '%';
});

// ============================================================
// THEME TOGGLE
// ============================================================
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');
let darkMode = false;

// Check saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    darkMode = true;
    document.body.classList.add('dark-mode');
    themeIcon.className = 'fas fa-sun';
    themeLabel.textContent = 'Light';
}

themeToggle.addEventListener('click', () => {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
    themeIcon.className = darkMode ? 'fas fa-sun' : 'fas fa-moon';
    themeLabel.textContent = darkMode ? 'Light' : 'Dark';
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
});

// ============================================================
// MOBILE MENU TOGGLE
// ============================================================
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    menuToggle.innerHTML = navLinks.classList.contains('open') 
        ? '<i class="fas fa-times"></i>' 
        : '<i class="fas fa-bars"></i>';
});

// Close menu when a link is clicked
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
    });
});

// ============================================================
// MODAL FUNCTIONS
// ============================================================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Close modal when clicking outside
document.querySelectorAll('.page-modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.page-modal.active').forEach(modal => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
});

// ============================================================
// BACK TO TOP
// ============================================================
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
    if (window.scrollY > 500) {
        backToTop.classList.add('visible');
    } else {
        backToTop.classList.remove('visible');
    }
});

backToTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ============================================================
// SMOOTH SCROLL FOR ANCHOR LINKS
// ============================================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ============================================================
// ANIMATED COUNTERS
// ============================================================
const counters = document.querySelectorAll('.stats-section .stat-item .number');

const animateCounter = (el) => {
    const target = parseFloat(el.dataset.count);
    const isDecimal = target % 1 !== 0;
    let current = 0;
    const increment = target / 60;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        if (isDecimal) {
            el.textContent = current.toFixed(1) + '%';
        } else {
            el.textContent = Math.floor(current).toLocaleString() + '+';
        }
    }, 30);
};

// Use Intersection Observer for counters
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            animateCounter(el);
            counterObserver.unobserve(el);
        }
    });
}, { threshold: 0.5 });

counters.forEach(counter => {
    counterObserver.observe(counter);
});

// ============================================================
// CONSOLE BRANDING
// ============================================================
console.log('%c🚀 CampusNexus - Digital Learning Platform', 'font-size: 24px; font-weight: bold; color: #0A3D62;');
console.log('%c🏥 Built for Nursing, TVET, and Higher Learning Institutions', 'font-size: 14px; color: #10b981;');
console.log('%c© 2026 Nakuru College of Health Sciences and Management', 'font-size: 12px; color: #64748b;');
console.log('%c✨ The Future of Education is Here!', 'font-size: 16px; color: #d4af37; font-weight: bold;');

// ============================================================
// ADDITIONAL UTILITY FUNCTIONS
// ============================================================

// Prevent double submissions on forms (if any)
document.addEventListener('submit', function(e) {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        setTimeout(() => {
            submitBtn.disabled = false;
        }, 3000);
    }
});

// Lazy load images (if needed)
if ('IntersectionObserver' in window) {
    const lazyImages = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });
    lazyImages.forEach(img => imageObserver.observe(img));
}
