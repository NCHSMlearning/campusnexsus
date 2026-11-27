(function() {
    'use strict';
    
    console.log('🎯 MAIN NAVIGATION HANDLER');

    // Hides the .html extension in the URL  
    if (window.location.pathname.endsWith('.html')) {
        // Remove the .html suffix without discarding the active portal tab.
        // The hash is the deep-link state used to restore the same section on refresh.
        const cleanPath = window.location.pathname.replace(/\.html$/, '') +
            window.location.search + window.location.hash;
        window.history.replaceState({}, '', cleanPath);
    } 
    
    function showTab(tabId) {
        // Backward-compatible aliases for older UI controls.
        const tabAliases = {
            announcements: 'newsletter',
            'student-tickets': 'support-tickets'
        };
        tabId = tabAliases[tabId] || tabId;

        console.log('📂 Opening tab:', tabId);
        
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('overlay');
            if (sidebar) sidebar.classList.remove('active', 'open');
            if (overlay) overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
        
        // Keep CSS visibility and the HTML hidden attribute in sync.
        // Legacy tab handlers may set [hidden] on every inactive section;
        // changing only style.display would leave the selected tab invisible.
        document.querySelectorAll('.tab-content').forEach(tab => {
            const isSelected = tab.id === tabId;
            tab.classList.toggle('active', isSelected);
            tab.style.display = isSelected ? 'block' : 'none';
            if (isSelected) {
                tab.removeAttribute('hidden');
                tab.setAttribute('aria-hidden', 'false');
            } else {
                tab.setAttribute('hidden', '');
                tab.setAttribute('aria-hidden', 'true');
            }
        });
        
        const target = document.getElementById(tabId);
        if (target) {
            target.removeAttribute('hidden');
            target.style.display = 'block';
            target.classList.add('active');
            target.setAttribute('aria-hidden', 'false');
        }
        
        document.querySelectorAll('.sidebar-nav-premium a[data-tab], .dropdown-submenu a[data-tab]').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-tab') === tabId) {
                link.classList.add('active');
            }
        });
        
        localStorage.setItem('nchsm_current_tab', tabId);
        try {
            const nextHash = '#' + encodeURIComponent(tabId);
            if (window.location.hash !== nextHash) window.history.replaceState(null, '', nextHash);
        } catch (_) {}
        
        // Hash changes and delegated sidebar handlers can report the same
        // destination more than once. Debounce duplicate activation so one tap
        // cannot trigger multiple Supabase requests or redraws on mobile.
        const now = Date.now();
        window.__cnStudentTabLoadTimes = window.__cnStudentTabLoadTimes || Object.create(null);
        const forceLoad = tabId === 'hub-timetable';
        const lastLoad = window.__cnStudentTabLoadTimes[tabId] || 0;
        if (!forceLoad && now - lastLoad < 1400) return;
        window.__cnStudentTabLoadTimes[tabId] = now;

        setTimeout(() => {
            try {
                if (tabId === 'hub-courses' && window.coursesModule?.loadCourses) window.coursesModule.loadCourses();
                else if (tabId === 'hub-register' && window.unitRegistrationModule?.loadUnits) window.unitRegistrationModule.loadUnits();
                else if (tabId === 'hub-exam-card' && window.examCardModule?.loadExamCard) window.examCardModule.loadExamCard();
                else if (tabId === 'hub-lecture-card' && window.lectureCardModule?.loadLectureCard) window.lectureCardModule.loadLectureCard();
                else if (tabId === 'academic-reports' && window.academicReportsModule?.loadReports) window.academicReportsModule.loadReports();
                else if (tabId === 'profile' && window.profileModule?.loadProfile) window.profileModule.loadProfile();
                else if (tabId === 'dashboard' && window.dashboardModule?.refreshAll) window.dashboardModule.refreshAll();
                else if (tabId === 'cats' && window.examsModule?.loadExams) window.examsModule.loadExams();
                else if (tabId === 'resources' && window.resourcesModule?.loadAllResources) window.resourcesModule.loadAllResources();
                else if (tabId === 'nurseiq' && window.nurseiqModule?.loadQuestionBankCards) window.nurseiqModule.loadQuestionBankCards();
                else if (tabId === 'finance' && typeof loadStudentFinance === 'function') setTimeout(loadStudentFinance, 300);
                else if (tabId === 'enrollment' && typeof initEnrollment === 'function') setTimeout(initEnrollment, 300);
                else if (tabId === 'hub-timetable' && typeof window.initStudentTimetable === 'function') setTimeout(() => window.initStudentTimetable({ force: true }), 150);
                else if (tabId === 'student-blog' && window.studentBlogModule?.loadPosts) setTimeout(() => window.studentBlogModule.loadPosts(), 50);
            } catch (error) {
                console.warn('[Student Navigation] Module load failed for ' + tabId, error);
                delete window.__cnStudentTabLoadTimes[tabId];
            }
        }, 100);
    }
    
    const dropdownParent = document.querySelector('.has-dropdown');
    const dropdownToggle = document.querySelector('.has-dropdown > a');
    const dropdownMenu = document.querySelector('.dropdown-submenu');
    if (dropdownToggle && dropdownMenu) {
        const newToggle = dropdownToggle.cloneNode(true);
        dropdownToggle.parentNode.replaceChild(newToggle, dropdownToggle);
        newToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = dropdownParent.classList.contains('open');
            dropdownParent.classList.toggle('open', !isOpen);
            newToggle.setAttribute('aria-expanded', String(!isOpen));
            dropdownMenu.style.removeProperty('display');
        });
    }
    
    document.querySelectorAll('.dropdown-submenu a[data-tab]').forEach(item => {
        const tabId = item.getAttribute('data-tab');
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);
        newItem.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (dropdownParent) {
                dropdownParent.classList.remove('open');
                if (dropdownMenu) dropdownMenu.style.removeProperty('display');
            }
            showTab(tabId);
        });
    });
    
    const hubLink = document.querySelector('.sidebar-nav-premium a[data-tab="learning-hub"]');
    if (hubLink) {
        const newLink = hubLink.cloneNode(true);
        hubLink.parentNode.replaceChild(newLink, hubLink);
        newLink.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (window.innerWidth <= 768) {
                showTab('hub-courses');
            } else if (dropdownParent) {
                const isOpen = dropdownParent.classList.contains('open');
                if (isOpen) {
                    dropdownParent.classList.remove('open');
                    if (dropdownMenu) dropdownMenu.style.removeProperty('display');
                } else {
                    dropdownParent.classList.add('open');
                    if (dropdownMenu) dropdownMenu.style.display = 'block';
                }
            }
        });
    }
    
    document.querySelectorAll('.sidebar-nav-premium a[data-tab]').forEach(link => {
        if (link.getAttribute('data-tab') === 'learning-hub') return;
        const tabId = link.getAttribute('data-tab');
        const newLink = link.cloneNode(true);
        link.parentNode.replaceChild(newLink, link);
        newLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showTab(tabId);
        });
    });
    
    document.querySelectorAll('.stat-card[data-tab]').forEach(card => {
        const tabId = card.getAttribute('data-tab');
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
        newCard.addEventListener('click', (e) => {
            e.preventDefault();
            showTab(tabId);
        });
    });
    
    document.addEventListener('click', function(e) {
        if (dropdownParent && !dropdownParent.contains(e.target) && dropdownParent.classList.contains('open')) {
            dropdownParent.classList.remove('open');
            const toggle = dropdownParent.querySelector('.dropdown-toggle-premium');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
            if (dropdownMenu) dropdownMenu.style.removeProperty('display');
        }
    });
    
    // NCHSM_DEEP_LINK_ROUTE_MAP: translate clean student URLs into portal tab IDs before restore.
    (function mapStudentDeepLink() {
        const path = (window.location.pathname || '').replace(/\/+$/, '') || '/';
        const routeTabs = {
            '/student/timetable': 'hub-timetable',
            '/student/calendar': 'hub-timetable',
            '/student/results': 'academic-reports',
            '/student/academic-reports': 'academic-reports'
        };
        const tabId = routeTabs[path.toLowerCase()];
        if (tabId && !window.location.hash) {
            try { window.history.replaceState(null, '', window.location.pathname + window.location.search + '#' + encodeURIComponent(tabId)); } catch (_) {}
        }
    })();

    // ===== REFRESH-SAFE INITIAL TAB =====
    // Never force Dashboard on every reload. Restore the hash first, then the
    // saved SPA tab, and use Dashboard only when no valid tab was saved.
    function getInitialTab() {
        const allowed = new Set(Array.from(document.querySelectorAll('.tab-content')).map(el => el.id));
        let candidate = '';
        try { candidate = decodeURIComponent((window.location.hash || '').replace(/^#/, '')); } catch (_) {}
        if (!candidate) { try { candidate = localStorage.getItem('nchsm_current_tab') || ''; } catch (_) {} }
        return allowed.has(candidate) ? candidate : 'dashboard';
    }
    function restoreInitialTab() {
        const tabId = getInitialTab();
        if (!document.getElementById(tabId)) return false;
        showTab(tabId);
        return true;
    }
    // Expose the resolved tab so authentication/module initialization can
    // restore the same page after asynchronous Supabase/module loading.
    window.nchsmGetInitialTab = getInitialTab;
    window.nchsmRestoreInitialTab = restoreInitialTab;
    window.addEventListener('hashchange', function() {
        let tabId = '';
        try { tabId = decodeURIComponent((window.location.hash || '').replace(/^#/, '')); } catch (_) {}
        if (!tabId) tabId = 'dashboard';
        if (document.getElementById(tabId)) {
            try { localStorage.setItem('nchsm_current_tab', tabId); } catch (_) {}
            showTab(tabId);
        }
    });

    window.showTab = showTab;
})();
