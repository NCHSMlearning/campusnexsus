window.app = { config: null, supabase: null, db: null, user: null, isInitialized: false };

// Refresh-safe authentication: wait for Supabase's persisted session to restore.
// On mobile/slow networks, token storage and refresh can take longer than a normal page load.
// Reuse the existing client; never sign the student out just because the first read is empty.
async function getSessionWithRestoreRetry(client, maxAttempts = 20, delayMs = 500) {
    if (!client?.auth?.getSession) return null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const { data, error } = await client.auth.getSession();
            if (error) {
                console.warn('Session restore check failed:', error.message || error);
            } else if (data?.session) {
                return data.session;
            }
        } catch (error) {
            console.warn(`Waiting for Supabase session restore (${attempt + 1}/${maxAttempts}):`, error?.message || error);
        }

        // Listen briefly for Supabase auth initialization before the next poll.
        if (attempt === 0 && client.auth.onAuthStateChange) {
            try {
                const { data: listener } = client.auth.onAuthStateChange((event, session) => {
                    if (session?.user) window.__nchsmRestoredSession = session;
                });
                if (listener?.subscription) {
                    setTimeout(() => listener.subscription.unsubscribe(), 30000);
                }
            } catch (_) {}
        }
        if (window.__nchsmRestoredSession?.user) return window.__nchsmRestoredSession;
        await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return window.__nchsmRestoredSession || null;
}

function showStudentPortalBootError(title, message) {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';

    const appContent = document.getElementById('app-content');
    if (appContent) appContent.style.display = 'none';

    let panel = document.getElementById('student-portal-boot-error');
    if (!panel) {
        panel = document.createElement('main');
        panel.id = 'student-portal-boot-error';
        panel.style.cssText = 'min-height:100vh;box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:24px;background:#f3f6fb;font-family:Inter,Arial,sans-serif;color:#14263d;';
        panel.innerHTML = '<section style="width:min(100%,560px);background:#fff;border:1px solid #dbe4ef;border-radius:18px;padding:28px;box-shadow:0 14px 45px rgba(15,35,60,.10)"><div style="width:46px;height:46px;border-radius:13px;background:#fff4e5;color:#b45309;display:grid;place-items:center;font-size:23px;font-weight:800">!</div><h1 id="student-portal-boot-title" style="font-size:22px;margin:18px 0 8px">Student Portal could not start</h1><p id="student-portal-boot-message" style="margin:0;color:#52657d;line-height:1.6;overflow-wrap:anywhere"></p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:22px"><button id="student-portal-boot-retry" type="button" style="border:0;border-radius:10px;padding:12px 18px;background:#073b63;color:#fff;font-weight:700">Try again</button><a id="student-portal-boot-login" style="display:inline-flex;align-items:center;border-radius:10px;padding:12px 18px;background:#edf3f9;color:#173b5e;text-decoration:none;font-weight:700">Go to sign in</a></div><p style="font-size:12px;color:#8493a5;margin:18px 0 0">If this continues, share a screenshot of this message with the Campus Nexus support team.</p></section>';
        document.body.appendChild(panel);
        panel.querySelector('#student-portal-boot-retry').addEventListener('click', () => window.location.reload());
    }

    panel.querySelector('#student-portal-boot-title').textContent = title || 'Student Portal could not start';
    panel.querySelector('#student-portal-boot-message').textContent = message || 'An unexpected startup error occurred.';
    const returnTo = window.location.pathname + window.location.search + window.location.hash;
    const safeReturnTo = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/platform/student.html#dashboard';
    panel.querySelector('#student-portal-boot-login').href = '/login.html?redirect=' + encodeURIComponent(safeReturnTo);
    panel.style.display = 'flex';
}

async function initializeApp() {
    try {
        console.log('🚀 Starting app initialization...');
        if (!window.APP_CONFIG) throw new Error('Configuration not loaded.');
        
        const config = window.APP_CONFIG;
        window.app.config = config;
        
        if (!config.SUPABASE_URL || config.SUPABASE_URL === '%%SUPABASE_URL%%') throw new Error('SUPABASE_URL not configured');
        if (!config.SUPABASE_ANON_KEY || config.SUPABASE_ANON_KEY === '%%SUPABASE_ANON_KEY%%') throw new Error('SUPABASE_ANON_KEY not configured');
        
        // Recover if the browser skipped or failed the legacy database script
        // during a slow/mobile page load. The auth client remains the single
        // persistent Supabase client; this only restores the Database wrapper.
        async function ensureStudentDatabaseModule() {
            if (window.db && typeof window.db.initialize === 'function') return window.db;

            // The student portal can be served from either /student or /platform/student.html.
            // Resolve the database script from the site root and retry once without stale cache.
            const candidates = [
                new URL('/js/database.js', window.location.origin).href,
                new URL('../js/database.js', window.location.href).href
            ];
            const uniqueCandidates = [...new Set(candidates)];
            let lastError = null;

            for (const source of uniqueCandidates) {
                try {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = source + (source.includes('?') ? '&' : '?') + 'student_boot=' + Date.now();
                        script.async = true;
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error('Could not load ' + source));
                        document.head.appendChild(script);
                    });
                    // A different legacy script may leave a plain object in
                    // window.db. Treat it as usable only when it is the actual
                    // Database instance with initialize(); otherwise rebuild it.
                    if (window.db && typeof window.db.initialize === 'function') return window.db;
                    if (typeof window.Database === 'function') {
                        window.db = new window.Database();
                        if (typeof window.db.initialize === 'function') return window.db;
                    }
                    throw new Error(
                        'The database script loaded, but no usable Database instance was exposed. ' +
                        'window.db=' + typeof window.db +
                        ', window.Database=' + typeof window.Database
                    );
                } catch (error) {
                    lastError = error;
                    console.error('[Student Portal] Database script load failed:', source, error);
                }
            }

            if ((!window.db || typeof window.db.initialize !== 'function') && typeof window.Database === 'function') {
                window.db = new window.Database();
            }
            if (!window.db || typeof window.db.initialize !== 'function') {
                throw new Error('Student database module could not be loaded. Please refresh the page or contact support.');
            }
            return window.db;
        }

        await ensureStudentDatabaseModule();

        // Match the working Student Examinations portal startup:
        // reuse config.js's persistent Supabase client directly. Do not run
        // Database.initialize()/testConnection() before checking the session.
        const studentSupabase = [
            window.examSupabase,
            window.sb,
            window.supabaseClient,
            window.NCHSMLogin?.supabase,
            window.db?.supabase
        ].find(client =>
            client &&
            typeof client.from === 'function' &&
            typeof client.auth?.getSession === 'function'
        ) || null;

        if (!studentSupabase) {
            throw new Error(window.__EXAM_CONFIG_ERROR__ || 'Student database connection is unavailable. Please refresh this page.');
        }

        // Supabase may still be restoring its persisted auth state on a
        // cold mobile load. Wait for the auth client to finish restoring
        // before treating an empty first getSession() result as signed out.
        const userSession = await getSessionWithRestoreRetry(studentSupabase, 20, 500);

        // Publish the persistent client to legacy modules without starting a
        // second Supabase client or a competing authentication lifecycle.
        window.db.supabase = studentSupabase;
        window.db.isInitialized = true;
        window.db.currentUserId = userSession?.user?.id || null;
        window.sb = studentSupabase;
        window.supabaseClient = studentSupabase;
        window.supabase = studentSupabase;
        window.currentUserId = userSession?.user?.id || null;
        window.currentUser = userSession?.user || null;

        if (!userSession) {
            // No valid session after Supabase's restore window: return to sign-in.
            // Preserve the intended deep link so it can be restored after login.
            console.warn('No Supabase session was restored. Redirecting to sign in.');
            const returnTo = window.location.pathname + window.location.search + window.location.hash;
            const safeReturnTo = returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
                ? returnTo
                : '/student';
            const loginUrl = '/platform/login.html?redirect=' + encodeURIComponent(safeReturnTo);
            window.location.replace(loginUrl);
            return;
        }
        

        window.db.currentUserId = userSession.user.id;
        window.currentUserId = userSession.user.id;
        window.currentUser = userSession.user;

        // Follow student-exams.js: query the signed-in student's own profile
        // directly, then enforce the institution approval checks below.
        const { data: profileRow, error: profileError } = await studentSupabase
            .from('consolidated_user_profiles_table')
            .select('user_id,full_name,role,status,login_enabled,institution_id,admission_number,student_id,program,program_type,current_block,block,intake_year,intake_month,admission_year')
            .eq('user_id', userSession.user.id)
            .maybeSingle();
        if (profileError) throw profileError;
        if (!profileRow) throw new Error('Your student profile could not be found. Please contact your institution administrator.');

        const authenticatedStudentProfile = {
            ...profileRow,
            program: String(
                profileRow.program ||
                profileRow.program_type ||
                profileRow.program_name ||
                profileRow.department ||
                ''
            ).trim(),
            block: profileRow.block ?? profileRow.current_block ?? null,
            intake_year: profileRow.intake_year ?? profileRow.year_of_intake ?? null
        };
        window.db.currentUserProfile = authenticatedStudentProfile;
        window.currentUserProfile = authenticatedStudentProfile;
        window.app = window.app || {};
        window.app.user = authenticatedStudentProfile;

        // Resolve and publish the authenticated student's tenant context in the
        // same way the working Lecturer portal does. Never infer a tenant from
        // a browser-wide cached value or from another student's previous session.
        const studentInstitutionId = String(authenticatedStudentProfile.institution_id || '').trim();
        if (!studentInstitutionId) {
            showStudentPortalBootError(
                'Institution not assigned',
                'Your student account is not linked to an institution. Please contact your institution administrator.'
            );
            return;
        }
        window.CURRENT_INSTITUTION_ID = studentInstitutionId;
        window.currentInstitutionId = studentInstitutionId;
        window.CURRENT_INSTITUTION = null;
        window.CURRENT_INSTITUTION_CODE = '';
        window.currentInstitutionCode = '';
        window.CURRENT_SCHOOL_CODE = '';
        window.currentSchoolCode = '';

        try {
            const { data: institution, error: institutionError } = await studentSupabase
                .from('institutions')
                .select('id,name,short_code,school_code,logo_url,primary_color,secondary_color,status')
                .eq('id', studentInstitutionId)
                .maybeSingle();
            if (institutionError) throw institutionError;
            if (!institution) throw new Error('The institution linked to this student account could not be found.');
            if (String(institution.status || '').toLowerCase() === 'suspended') {
                showStudentPortalBootError(
                    'Institution portal unavailable',
                    'This institution is currently suspended. Please contact your institution administrator.'
                );
                return;
            }

            const schoolCode = String(institution.school_code || institution.short_code || '').trim();
            const requestedCode = String(
                new URLSearchParams(window.location.search).get('school_code') ||
                new URLSearchParams(window.location.search).get('institution_code') || ''
            ).trim();
            if (requestedCode && schoolCode && requestedCode.toLowerCase() !== schoolCode.toLowerCase()) {
                showStudentPortalBootError(
                    'Institution code mismatch',
                    'This student account belongs to ' + (institution.name || 'a different institution') +
                    ' (' + schoolCode + '). Open the portal using your own institution code.'
                );
                return;
            }

            authenticatedStudentProfile.institution = institution;
            authenticatedStudentProfile.institution_name = institution.name || '';
            authenticatedStudentProfile.institution_code = schoolCode;
            authenticatedStudentProfile.school_code = schoolCode;
            window.CURRENT_INSTITUTION = institution;
            window.CURRENT_INSTITUTION_CODE = schoolCode;
            window.currentInstitutionCode = schoolCode;
            window.CURRENT_SCHOOL_CODE = schoolCode;
            window.currentSchoolCode = schoolCode;
            document.documentElement.dataset.institutionId = studentInstitutionId;
            if (schoolCode) document.documentElement.dataset.institutionCode = schoolCode;
            console.info('[Student Portal] Authenticated institution resolved:', institution.name, schoolCode);
        } catch (institutionError) {
            console.error('[Student Portal] Could not resolve authenticated institution:', institutionError);
            showStudentPortalBootError(
                'Institution could not be verified',
                institutionError?.message || 'The institution linked to your account could not be verified. Please refresh or contact support.'
            );
            return;
        }

        // Resolve academic period terminology from this student's own institution
        // and programme. This never uses another tenant's programme settings.
        try {
            if (window.CampusAcademicStructure && authenticatedStudentProfile.institution_id && authenticatedStudentProfile.program) {
                window.currentAcademicStructure = await window.CampusAcademicStructure.resolve(
                    studentSupabase,
                    authenticatedStudentProfile.institution_id,
                    authenticatedStudentProfile.program
                );
                const structure = window.currentAcademicStructure;
                const metricLabel = document.getElementById('dashboard-current-block-label');
                if (metricLabel) metricLabel.textContent = structure.singular;
                document.querySelectorAll('[data-academic-period-label]').forEach(el => {
                    el.textContent = el.dataset.academicPeriodLabel === 'plural' ? structure.plural : structure.singular;
                });
                document.querySelectorAll('[data-academic-period-all]').forEach(el => {
                    el.textContent = 'All ' + structure.pluralLower;
                });
            }
        } catch (structureError) {
            console.warn('[Student Portal] Institution academic structure lookup unavailable; retaining legacy labels.', structureError);
        }

        const studentRole = String(authenticatedStudentProfile?.role || '').trim().toLowerCase();
        const studentStatus = String(authenticatedStudentProfile?.status || '').trim().toLowerCase();
        const isApprovedStudent = studentRole === 'student'
            && ['approved', 'active'].includes(studentStatus)
            && authenticatedStudentProfile?.login_enabled !== false
            && !!authenticatedStudentProfile?.institution_id;

        if (!isApprovedStudent) {
            console.warn('Student portal access denied: profile is not an active approved student.', {
                role: studentRole,
                status: studentStatus,
                hasInstitution: !!authenticatedStudentProfile?.institution_id,
                loginEnabled: authenticatedStudentProfile?.login_enabled
            });
            showStudentPortalBootError(
                'Student account access is not active',
                'Your account profile is present, but it is not currently marked as an approved, active student with an assigned institution. Please sign in again or contact your institution administrator to confirm your account approval.'
            );
            return;
        }

        // ===== AUTHENTICATED HEADER IDENTITY =====
        // Always derive the header identity from the real authenticated student.
        // The old header fell back to the literal word "Student", which produced
        // the "ST" avatar on mobile when the profile was not yet exposed globally.
        function syncAuthenticatedHeaderIdentity(profileOverride, authUser) {
            const p = profileOverride || window.db?.currentUserProfile || window.currentUserProfile || {};
            const u = authUser || userSession?.user || {};
            const meta = u?.user_metadata || {};

            const rawName = [
                p.full_name,
                p.name,
                p.student_name,
                meta.full_name,
                meta.name,
                meta.fullName
            ].find(v => typeof v === 'string' && v.trim());

            // Do not use "Student" as the identity when an authenticated name is available.
            const displayName = rawName ? rawName.trim() : '';

            const headerName = document.getElementById('header-user-name');
            if (headerName && displayName) headerName.textContent = displayName;

            const dashboardName = document.getElementById('welcome-student-name');
            if (dashboardName && displayName) dashboardName.textContent = displayName;

            const welcomeHeader = document.getElementById('welcome-header');
            if (welcomeHeader && displayName) {
                welcomeHeader.textContent = 'Welcome back, ' + displayName + '!';
            }

            // Use the student's REAL uploaded profile photo when available.
            // profile_photo_url is preferred; passport_url is the legacy fallback.
            const profilePhotoUrl = [
                p.profile_photo_url,
                p.passport_url
            ].find(v => typeof v === 'string' && v.trim()) || '';

            const fallbackAvatar = displayName
                ? `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=4C1D95&color=fff&size=100&bold=true`
                : 'https://ui-avatars.com/api/?name=Student&background=4C1D95&color=fff&size=100&bold=true';

            const finalPhotoUrl = profilePhotoUrl || fallbackAvatar;

            const photo = document.getElementById('header-profile-photo');
            if (photo) {
                photo.src = finalPhotoUrl;
                photo.alt = displayName ? displayName + ' profile' : 'Student profile';
                // If an uploaded photo is invalid/expired, gracefully fall back
                // to the student's initials instead of leaving a broken image.
                photo.onerror = function () {
                    if (this.src !== fallbackAvatar) {
                        this.src = fallbackAvatar;
                        this.alt = displayName ? displayName + ' profile' : 'Student profile';
                    }
                };
            }

            const sidebarName = document.getElementById('sidebarUserName');
            if (sidebarName && displayName) sidebarName.textContent = displayName;

            const sidebarAvatar = document.getElementById('sidebar-avatar');
            if (sidebarAvatar) {
                sidebarAvatar.src = finalPhotoUrl;
                sidebarAvatar.alt = displayName ? displayName + ' profile' : 'Student profile';
                sidebarAvatar.onerror = function () {
                    if (this.src !== fallbackAvatar) {
                        this.src = fallbackAvatar;
                        this.alt = displayName ? displayName + ' profile' : 'Student profile';
                    }
                };
            }

            return displayName;
        }

        // Final authoritative profile sync: use the same table that profile.js
        // uses, keyed by the authenticated Supabase user UUID. This guarantees
        // the header and sidebar receive the real student's name even if the
        // database module exposes its profile a moment later.
        async function ensureAuthenticatedStudentIdentity() {
            try {
                let profile = window.db?.currentUserProfile || window.currentUserProfile || null;
                const uid = userSession?.user?.id;

                // ALWAYS use the authenticated user's row as the authoritative
                // source for the shell identity.  Do not trust an earlier
                // fallback profile containing only role/Student information.
                if (uid && window.db?.supabase) {
                    const { data, error } = await window.db.supabase
                        .from('consolidated_user_profiles_table')
                        .select('full_name,student_id,admission_number,profile_photo_url,passport_url,program,block,current_block,role,status')
                        .eq('user_id', uid)
                        .maybeSingle();

                    if (error) {
                        console.warn('⚠️ Authoritative student profile lookup failed:', error.message);
                    } else if (data) {
                        profile = { ...(profile || {}), ...data };
                        window.db.currentUserProfile = profile;
                        window.currentUserProfile = profile;
                        window.app = window.app || {};
                        window.app.user = profile;
                    }
                }

                const displayName = syncAuthenticatedHeaderIdentity(profile, userSession.user);
                if (displayName) {
                    console.log('✅ Student identity synced:', displayName);
                } else {
                    console.warn('⚠️ No student full_name available for authenticated user:', uid);
                }
            } catch (identityError) {
                console.warn('⚠️ Student identity sync failed:', identityError);
            }
        }

        // Wait for the authoritative student name BEFORE Dashboard/Profile
        // modules initialize, so they receive Tiongii instead of the fallback.
        await ensureAuthenticatedStudentIdentity();

        // Re-apply after Dashboard/Profile modules finish initialization.
        document.addEventListener('appReady', () => {
            void ensureAuthenticatedStudentIdentity();
        }, { once: true });
        window.addEventListener('appReady', () => {
            void ensureAuthenticatedStudentIdentity();
        }, { once: true });
        
        console.log('✅ User authenticated');
        
        // Reveal the authenticated shell before optional login telemetry so a
        // slow network request cannot keep the portal hidden.
        const appContent = document.getElementById('app-content');
        if (appContent) appContent.style.display = 'block';
        if (typeof window.nchsmFinishLoading === 'function') window.nchsmFinishLoading();
        else { const loadingScreen = document.getElementById('loading-screen'); if (loadingScreen) loadingScreen.style.display = 'none'; }

        if (window.db.currentUserId && window.ui && window.ui.recordNewLogin) {
            Promise.resolve(window.ui.recordNewLogin(window.db.currentUserId))
                .catch(err => console.warn('Login activity recording failed:', err));
        }
        
        window.supabase = window.db.supabase;
        window.currentUserId = window.db.currentUserId;
        window.currentUserProfile = window.db.currentUserProfile;

        // Initialize only the authenticated shell utilities. The main inline
        // controller owns auth, tab routing and academic module initialization.
        if (window.ui && !window.__CAMPUS_NEXUS_STUDENT_SHELL_READY__) {
            window.__CAMPUS_NEXUS_STUDENT_SHELL_READY__ = true;
            window.ui.supabase = window.db.supabase;
            window.ui.currentUser = userSession.user;

            // Bind the portal's navigation, logout, refresh and utility controls
            // only after authentication. safeInitialize() is intentionally skipped
            // on this page, so these shell listeners must be initialized here.
            if (!window.__CAMPUS_NEXUS_STUDENT_UI_EVENTS_READY__) {
                window.__CAMPUS_NEXUS_STUDENT_UI_EVENTS_READY__ = true;
                window.ui.setupEventListeners?.();
                window.ui.setupProfileDropdown?.();
            }

            window.ui.initializeDateTime?.();
            window.ui.setupOfflineIndicator?.();
            window.ui.setupMobileMenuVisibility?.();
            window.ui.startReviewsBadgeUpdater?.();

            const menuButton = document.getElementById('mobile-menu-toggle');
            const menuOverlay = document.getElementById('overlay');
            if (menuButton) menuButton.addEventListener('click', (event) => {
                event.preventDefault();
                window.ui.toggleMenu?.();
            }, { once: false });
            if (menuOverlay) menuOverlay.addEventListener('click', () => window.ui.closeMenu?.(), { once: false });
        }

        // Authenticated shell is ready: restore the tab before module loaders run.
        // Restore the exact page requested by the URL hash BEFORE modules boot.
        // The final restore below also protects it from modules that initialize
        // themselves by opening Dashboard.
        const initialPortalTab = (typeof window.nchsmGetInitialTab === 'function')
            ? window.nchsmGetInitialTab()
            : 'dashboard';
        if (typeof window.nchsmRestoreInitialTab === 'function') window.nchsmRestoreInitialTab();
        document.dispatchEvent(new Event('appReady'));
        window.dispatchEvent(new Event('appReady'));
        
        // Re-sync after the global profile references are exposed. This also
        // handles profile data that becomes available slightly after appReady.
        syncAuthenticatedHeaderIdentity(window.db.currentUserProfile, userSession.user);
        // Dashboard/Profile modules may refresh the shell after initialization.
        // Re-apply the authoritative identity after those modules have mounted.
        setTimeout(() => ensureAuthenticatedStudentIdentity(), 450);
        setTimeout(() => ensureAuthenticatedStudentIdentity(), 1100);
        
        if (typeof initUI === 'function') initUI();
        if (typeof initProfileModule === 'function') setTimeout(() => initProfileModule(), 100);
        if (typeof initDashboardModule === 'function') {
            setTimeout(() => {
                window.dashboardModule = initDashboardModule(window.db.supabase);
                if (window.dashboardModule && window.currentUserId && window.currentUserProfile) {
                    window.dashboardModule.initialize(window.currentUserId, window.currentUserProfile);
                }
                // Do not force Dashboard after a refresh when another valid
                // tab was requested by #hash/localStorage.
                if (initialPortalTab === 'dashboard') {
                    const dash = document.getElementById('dashboard');
                    if (dash) {
                        dash.style.display = 'block';
                        dash.classList.add('active');
                    }
                } else if (typeof window.showTab === 'function') {
                    window.showTab(initialPortalTab);
                }
            }, 200);
        }
        
        window.app.isInitialized = true;
        window.app.supabase = window.db.supabase;
        window.app.user = window.db.currentUserProfile;
        
        console.log('✅ Application initialized successfully');
        document.dispatchEvent(new CustomEvent('appReady', {
            detail: { userId: window.currentUserId, userProfile: window.currentUserProfile, database: window.db }
        }));
        
        // ===== LOAD FINANCE DATA ON INIT =====
        if (typeof loadStudentFinance === 'function') {
            setTimeout(loadStudentFinance, 1000);
        }
        
        // ===== INITIALIZE ENROLLMENT MODULE =====
        if (typeof initEnrollment === 'function') {
            setTimeout(initEnrollment, 1200);
        }

        // FINAL REFRESH-SAFE ROUTE RESTORE
        // Some legacy modules initialize by showing Dashboard. Re-apply the
        // URL/localStorage route after they finish so refresh always lands on
        // the page the student was actually viewing.
        setTimeout(() => {
            const routeTab = (typeof window.nchsmGetInitialTab === 'function')
                ? window.nchsmGetInitialTab()
                : 'dashboard';
            if (typeof window.showTab === 'function' && document.getElementById(routeTab)) {
                window.showTab(routeTab);
            }
        }, 1500);
        
    } catch (error) {
        console.error('❌ Student portal initialization failed:', error);

        // Keep student data protected, but never leave users with a blank
        // screen or silently hide the reason startup failed.
        showStudentPortalBootError(
            'Student Portal could not load',
            error?.message || 'The portal encountered an unexpected startup error. Please try again.'
        );
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM ready, starting app initialization...');
    initializeApp();
});
