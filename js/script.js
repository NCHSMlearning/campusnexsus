// ============================================================
// CAMPUSNEXUS - MAIN JAVASCRIPT
// Version: 7.0 - Hybrid Chat (Bot + Live Agent) + Pre-Chat Form
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
    if (scrollProgress) scrollProgress.style.width = progress + '%';
});

// ============================================================
// THEME TOGGLE
// ============================================================
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeLabel = document.getElementById('themeLabel');
let darkMode = false;

const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    darkMode = true;
    document.body.classList.add('dark-mode');
    if (themeIcon) themeIcon.className = 'fas fa-sun';
    if (themeLabel) themeLabel.textContent = 'Light';
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        darkMode = !darkMode;
        document.body.classList.toggle('dark-mode', darkMode);
        if (themeIcon) themeIcon.className = darkMode ? 'fas fa-sun' : 'fas fa-moon';
        if (themeLabel) themeLabel.textContent = darkMode ? 'Light' : 'Dark';
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    });
}

// ============================================================
// MOBILE MENU TOGGLE
// ============================================================
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');

if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        menuToggle.innerHTML = navLinks.classList.contains('open') 
            ? '<i class="fas fa-times"></i>' 
            : '<i class="fas fa-bars"></i>';
    });

    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open');
            menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        });
    });
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const backdrop = document.getElementById('mobileMenuBackdrop');
    if (mobileMenu) mobileMenu.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
}

const mobileBackdrop = document.getElementById('mobileMenuBackdrop');
if (mobileBackdrop) {
    mobileBackdrop.addEventListener('click', closeMobileMenu);
}

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

document.querySelectorAll('.page-modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.page-modal.active').forEach(modal => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        });
        const chatWindow = document.getElementById('campusChatWindow');
        if (chatWindow && chatWindow.classList.contains('open')) {
            closeCampusChat();
        }
    }
});

// ============================================================
// BACK TO TOP
// ============================================================
const backToTop = document.getElementById('backToTop');

if (backToTop) {
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
}

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

const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
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
// UTILITY FUNCTIONS
// ============================================================
document.addEventListener('submit', function(e) {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        setTimeout(() => {
            submitBtn.disabled = false;
        }, 3000);
    }
});

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

// ============================================================
// SUPABASE CONFIGURATION - CHECK IF ALREADY DEFINED
// ============================================================
const SUPABASE_URL = 'https://irahplkvocaakjxuisto.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYWhwbGt2b2NhYWtqeHVpc3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4ODY5ODQsImV4cCI6MjEwMzQ2Mjk4NH0.BFOwdRVDz4r1oYgUjm8zQbthqblGRq4c3WQWQaOhu7g';

// Only initialize if supabase is not already defined
if (typeof supabase === 'undefined') {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        try {
            var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('✅ Supabase initialized with realtime support');
        } catch (error) {
            console.error('❌ Supabase initialization failed:', error);
            var supabase = {
                from: () => ({ insert: () => Promise.resolve({ error: null }) }),
                channel: () => ({ on: () => ({ subscribe: () => {} }) }),
                removeChannel: () => {}
            };
        }
    } else {
        console.warn('⚠️ Supabase library not loaded');
        var supabase = {
            from: () => ({ insert: () => Promise.resolve({ error: null }) }),
            channel: () => ({ on: () => ({ subscribe: () => {} }) }),
            removeChannel: () => {}
        };
    }
} else {
    console.log('✅ Supabase already initialized');
}

// ============================================================
// HYBRID CHAT SYSTEM - BOT + LIVE AGENT
// ============================================================

// Chat state
let chatMessages = [];
let currentChatId = null;
let isChatOpen = false;
let visitorId = null;
let visitorName = null;
let visitorEmail = null;
let messageSubscription = null;
let isAgentOnline = false;
let chatMode = 'bot'; // 'bot' or 'agent'
let chatStarted = false;

// ============================================================
// PRE-CHAT FORM FUNCTIONS
// ============================================================

// Start chat with visitor info
function startChatWithInfo(name, email) {
    visitorName = name || document.getElementById('visitorNameInput')?.value?.trim() || 'Anonymous Visitor';
    visitorEmail = email || document.getElementById('visitorEmailInput')?.value?.trim() || '';
    
    // Save to localStorage
    localStorage.setItem('campusnexus_visitor_name', visitorName);
    localStorage.setItem('campusnexus_visitor_email', visitorEmail);
    
    // Update chat session with visitor info
    updateVisitorInfo(visitorName, visitorEmail);
    
    // Hide pre-chat form, show chat
    const preChatForm = document.getElementById('preChatForm');
    const chatMessagesContainer = document.getElementById('chatMessagesContainer');
    const quickReplies = document.getElementById('quickReplies');
    const chatInputArea = document.getElementById('chatInputArea');
    
    if (preChatForm) preChatForm.style.display = 'none';
    if (chatMessagesContainer) chatMessagesContainer.style.display = 'block';
    if (quickReplies) quickReplies.style.display = 'flex';
    if (chatInputArea) chatInputArea.style.display = 'flex';
    
    chatStarted = true;
    
    // Add welcome message with visitor name
    addChatMessage('bot', `👋 Welcome <strong>${visitorName}</strong>! I'm here to help you. What can I assist you with today?`);
    
    // Initialize chat if not done
    if (!visitorId || !currentChatId) {
        initializeChat();
    }
    
    // Subscribe to messages
    subscribeToMessages();
}

// Update visitor info in Supabase
async function updateVisitorInfo(name, email) {
    if (!visitorId || !currentChatId) return;
    
    try {
        const { error } = await supabase
            .from('chat_sessions')
            .update({
                visitor_name: name,
                visitor_email: email
            })
            .eq('chat_id', currentChatId);
        
        if (error) console.error('Error updating visitor info:', error);
    } catch (error) {
        console.error('Supabase error:', error);
    }
}

// Check if visitor already provided info
function checkVisitorInfo() {
    const savedName = localStorage.getItem('campusnexus_visitor_name');
    const savedEmail = localStorage.getItem('campusnexus_visitor_email');
    
    if (savedName && savedName !== 'Anonymous Visitor') {
        // Visitor already provided info - show chat directly
        setTimeout(() => {
            startChatWithInfo(savedName, savedEmail);
        }, 500);
        return true;
    }
    return false;
}

// ============================================================
// INITIALIZE CHAT
// ============================================================
async function initializeChat() {
    visitorId = getVisitorId();
    currentChatId = localStorage.getItem('campusnexus_chat_id');
    const savedName = localStorage.getItem('campusnexus_visitor_name') || 'Anonymous';
    const savedEmail = localStorage.getItem('campusnexus_visitor_email') || '';
    
    if (!currentChatId) {
        currentChatId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        localStorage.setItem('campusnexus_chat_id', currentChatId);
        
        try {
            const ip = await getVisitorIP();
            const { error } = await supabase
                .from('chat_sessions')
                .insert([{
                    chat_id: currentChatId,
                    visitor_id: visitorId,
                    visitor_ip: ip,
                    visitor_page: window.location.href,
                    visitor_name: savedName,
                    visitor_email: savedEmail,
                    status: 'active',
                    created_at: new Date().toISOString()
                }]);
            
            if (error) console.error('Error creating chat session:', error);
        } catch (error) {
            console.error('Supabase error:', error);
        }
    } else {
        // Update existing session with visitor info if not already set
        try {
            const { error } = await supabase
                .from('chat_sessions')
                .update({
                    visitor_name: savedName,
                    visitor_email: savedEmail
                })
                .eq('chat_id', currentChatId);
            
            if (error) console.error('Error updating visitor info:', error);
        } catch (error) {
            console.error('Supabase error:', error);
        }
    }
    
    // If chat already started, load history
    if (chatStarted) {
        await loadChatHistory();
        subscribeToMessages();
    }
    
    await checkAgentStatus();
    addModeSelector();
}

// ============================================================
// GET VISITOR ID
// ============================================================
function getVisitorId() {
    let id = localStorage.getItem('campusnexus_visitor_id');
    if (!id) {
        id = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('campusnexus_visitor_id', id);
    }
    return id;
}

// ============================================================
// GET VISITOR IP
// ============================================================
async function getVisitorIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch {
        return 'unknown';
    }
}

// ============================================================
// CHECK AGENT STATUS
// ============================================================
async function checkAgentStatus() {
    try {
        const { data, error } = await supabase
            .from('chat_agents')
            .select('is_online')
            .eq('is_online', true)
            .limit(1);
        
        if (error) throw error;
        isAgentOnline = data && data.length > 0;
        
        updateStatusIndicator();
    } catch (error) {
        console.error('Error checking agent status:', error);
    }
}

function updateStatusIndicator() {
    const statusIndicator = document.getElementById('chatStatusIndicator');
    const agentStatus = document.getElementById('agentStatus');
    
    if (statusIndicator) {
        if (isAgentOnline) {
            statusIndicator.innerHTML = '<span>🟢 Online</span><span id="agentStatus">| Agent available</span>';
        } else {
            statusIndicator.innerHTML = '<span>🟡 Away</span><span id="agentStatus">| No agents online</span>';
        }
    }
}

// ============================================================
// ADD MODE SELECTOR TO CHAT
// ============================================================
function addModeSelector() {
    const quickReplies = document.getElementById('quickReplies');
    if (!quickReplies) return;
    
    if (document.getElementById('chatModeSelector')) return;
    
    const modeSelector = document.createElement('div');
    modeSelector.id = 'chatModeSelector';
    modeSelector.style.cssText = `
        display: flex;
        gap: 8px;
        padding: 8px 16px;
        background: #0A1628;
        border-top: 1px solid rgba(255,255,255,0.05);
    `;
    
    modeSelector.innerHTML = `
        <button onclick="setChatMode('bot')" id="modeBotBtn" style="
            flex: 1;
            padding: 6px 12px;
            border-radius: 20px;
            border: 1px solid #D4A843;
            background: #D4A843;
            color: #0A1628;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        ">
            🤖 Bot
        </button>
        <button onclick="setChatMode('agent')" id="modeAgentBtn" style="
            flex: 1;
            padding: 6px 12px;
            border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.1);
            background: transparent;
            color: #94a3b8;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        ">
            👤 Live Agent
            <span id="agentStatusBadge" style="
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${isAgentOnline ? '#2ecc71' : '#f39c12'};
                margin-left: 4px;
            "></span>
        </button>
    `;
    
    quickReplies.parentNode.insertBefore(modeSelector, quickReplies.nextSibling);
}

// ============================================================
// SET CHAT MODE
// ============================================================
function setChatMode(mode) {
    chatMode = mode;
    
    const botBtn = document.getElementById('modeBotBtn');
    const agentBtn = document.getElementById('modeAgentBtn');
    
    if (mode === 'bot') {
        botBtn.style.background = '#D4A843';
        botBtn.style.color = '#0A1628';
        botBtn.style.borderColor = '#D4A843';
        agentBtn.style.background = 'transparent';
        agentBtn.style.color = '#94a3b8';
        agentBtn.style.borderColor = 'rgba(255,255,255,0.1)';
        
        const statusIndicator = document.getElementById('chatStatusIndicator');
        if (statusIndicator) {
            statusIndicator.innerHTML = '<span>🤖 Bot Mode</span><span id="agentStatus">| Auto-reply enabled</span>';
        }
        
        const header = document.querySelector('.campus-chat-header div');
        if (header) {
            header.innerHTML = `
                <i class="fas fa-robot" style="margin-right: 8px;"></i> 
                CampusNexus Bot
                <span class="chat-status">
                    <span class="online-dot"></span> Online
                </span>
            `;
        }
        
        addChatMessage('bot', '🤖 Switched to <strong>Bot Mode</strong>. I\'ll answer your questions automatically!');
        
    } else {
        agentBtn.style.background = '#D4A843';
        agentBtn.style.color = '#0A1628';
        agentBtn.style.borderColor = '#D4A843';
        botBtn.style.background = 'transparent';
        botBtn.style.color = '#94a3b8';
        botBtn.style.borderColor = 'rgba(255,255,255,0.1)';
        
        const statusIndicator = document.getElementById('chatStatusIndicator');
        if (statusIndicator) {
            if (isAgentOnline) {
                statusIndicator.innerHTML = '<span>🟢 Live Agent</span><span id="agentStatus">| Agent online</span>';
            } else {
                statusIndicator.innerHTML = '<span>🟡 Live Agent</span><span id="agentStatus">| No agents online</span>';
            }
        }
        
        const header = document.querySelector('.campus-chat-header div');
        if (header) {
            header.innerHTML = `
                <i class="fas fa-user-tie" style="margin-right: 8px;"></i> 
                Live Support
                <span class="chat-status">
                    <span class="online-dot" style="background: ${isAgentOnline ? '#2ecc71' : '#f39c12'};"></span>
                    ${isAgentOnline ? 'Online' : 'Away'}
                </span>
            `;
        }
        
        if (isAgentOnline) {
            addChatMessage('bot', '👤 <strong>Live Agent Mode</strong> activated! A support agent will respond to your messages.');
        } else {
            addChatMessage('bot', '👤 <strong>Live Agent Mode</strong> activated. ⚠️ No agents are currently online. Your messages will be saved and responded to when an agent becomes available.');
        }
    }
    
    localStorage.setItem('campusnexus_chat_mode', mode);
}

// ============================================================
// LOAD CHAT HISTORY
// ============================================================
async function loadChatHistory() {
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('visitor_id', visitorId)
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            const messagesContainer = document.getElementById('campusChatMessages');
            // Don't clear if using pre-chat form
            if (!document.getElementById('preChatForm') || document.getElementById('preChatForm').style.display === 'none') {
                messagesContainer.innerHTML = '';
            }
            
            data.forEach(msg => {
                const type = msg.sender === 'visitor' ? 'user' : 'bot';
                addChatMessage(type, msg.message, msg.created_at);
            });
        }
    } catch (error) {
        console.error('Error loading history:', error);
        loadLocalHistory();
    }
}

function loadLocalHistory() {
    const localMessages = JSON.parse(localStorage.getItem('campusChatMessages') || '[]');
    if (localMessages.length > 0) {
        const messagesContainer = document.getElementById('campusChatMessages');
        if (!document.getElementById('preChatForm') || document.getElementById('preChatForm').style.display === 'none') {
            messagesContainer.innerHTML = '';
        }
        localMessages.forEach(msg => {
            addChatMessage(msg.sender === 'visitor' ? 'user' : 'bot', msg.message);
        });
    }
}

// ============================================================
// SUBSCRIBE TO REALTIME MESSAGES
// ============================================================
function subscribeToMessages() {
    if (messageSubscription) {
        try {
            supabase.removeChannel(messageSubscription);
        } catch(e) {}
    }
    
    if (!visitorId) return;
    
    try {
        messageSubscription = supabase
            .channel('chat_messages_' + visitorId)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `visitor_id=eq.${visitorId}`
                },
                (payload) => {
                    const msg = payload.new;
                    if (msg.sender === 'agent') {
                        addChatMessage('bot', '👤 <strong>Agent:</strong> ' + msg.message, msg.created_at);
                        const chatWindow = document.getElementById('campusChatWindow');
                        const notification = document.getElementById('chatNotification');
                        if (chatWindow && !chatWindow.classList.contains('open') && notification) {
                            notification.style.display = 'block';
                            notification.textContent = '1';
                        }
                        playNotificationSound();
                    } else if (msg.sender === 'bot' && chatMode === 'bot') {
                        addChatMessage('bot', msg.message, msg.created_at);
                    }
                }
            )
            .subscribe();
    } catch (error) {
        console.error('Error subscribing to messages:', error);
    }
}

// ============================================================
// PLAY NOTIFICATION SOUND
// ============================================================
function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFh4qJhY6Kh4mMh4+Jh4mNh5KLh4mJh5OJg4eNhpGJg4uLhpOKhoeJiJONgoiHhI+KhI2KiZSMhIeKiZWNgoeIiZSNg4eKiZSNg4aKiJWOg4eKiJSNg4aKiZaNhIiKiZaOhoiKiZePh4mKipePiIqKi5mQh4qJi5qRiImKi5uRioaKipyTioaKipyTh4eLi52UhoaKjJ6VhoaKjJ2VhoaLjZ6VhoaLjZ2VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6VhoaLjZ6V');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    } catch(e) {}
}

// ============================================================
// CHAT FUNCTIONS
// ============================================================
function toggleCampusChat() {
    const window = document.getElementById('campusChatWindow');
    const toggle = document.getElementById('campusChatToggle');
    
    if (window) {
        window.classList.toggle('open');
        const isOpen = window.classList.contains('open');
        
        if (toggle) {
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.className = isOpen ? 'fas fa-times' : 'fas fa-comment-dots';
            }
        }
        
        if (isOpen) {
            const notification = document.getElementById('chatNotification');
            if (notification) notification.style.display = 'none';
            
            // If chat hasn't started and visitor info exists, start chat
            if (!chatStarted) {
                const hasInfo = checkVisitorInfo();
                if (!hasInfo) {
                    // Focus on name input if pre-chat form is visible
                    const nameInput = document.getElementById('visitorNameInput');
                    if (nameInput) setTimeout(() => nameInput.focus(), 300);
                }
            } else {
                const input = document.getElementById('campusChatInput');
                if (input) input.focus();
            }
            
            localStorage.setItem('campusChatOpen', 'true');
            
            if (!currentChatId) {
                initializeChat();
            }
        } else {
            localStorage.setItem('campusChatOpen', 'false');
        }
    } else {
        createChatWidget();
    }
}

function closeCampusChat() {
    const window = document.getElementById('campusChatWindow');
    if (window) {
        window.classList.remove('open');
        const toggle = document.getElementById('campusChatToggle');
        if (toggle) {
            const icon = toggle.querySelector('i');
            if (icon) icon.className = 'fas fa-comment-dots';
        }
        localStorage.setItem('campusChatOpen', 'false');
    }
}

function handleCampusChatKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendCampusChatMessage();
    }
}

// ============================================================
// SEND CHAT MESSAGE
// ============================================================
async function sendCampusChatMessage() {
    const input = document.getElementById('campusChatInput');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    // If chat hasn't started, start it
    if (!chatStarted) {
        const hasInfo = checkVisitorInfo();
        if (!hasInfo) {
            // Show pre-chat form
            const preChatForm = document.getElementById('preChatForm');
            if (preChatForm) preChatForm.style.display = 'block';
            return;
        }
    }
    
    addChatMessage('user', message);
    input.value = '';
    
    if (!visitorId || !currentChatId) {
        await initializeChat();
    }
    
    try {
        const { error } = await supabase
            .from('chat_messages')
            .insert([{
                chat_id: currentChatId,
                visitor_id: visitorId,
                sender: 'visitor',
                message: message,
                created_at: new Date().toISOString()
            }]);
        
        if (error) console.error('Error saving message:', error);
    } catch (error) {
        console.error('Supabase error:', error);
    }
    
    if (chatMode === 'bot') {
        processBotResponse(message);
    } else {
        if (isAgentOnline) {
            addChatMessage('bot', '👤 Your message has been sent to a live agent. They will respond shortly...');
        } else {
            addChatMessage('bot', '⏳ No agents are currently online. Your message has been saved and will be responded to when an agent becomes available.');
        }
    }
}

// ============================================================
// ADD CHAT MESSAGE
// ============================================================
function addChatMessage(type, content, timestamp) {
    // Find the messages container - check if pre-chat form is visible
    let container = document.getElementById('chatMessagesContainer');
    if (!container) {
        container = document.getElementById('campusChatMessages');
    }
    
    if (!container) {
        createChatWidget();
        setTimeout(() => addChatMessage(type, content, timestamp), 100);
        return;
    }
    
    // Make sure chat container is visible
    if (container.style.display === 'none') {
        container.style.display = 'block';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `campus-chat-message ${type}`;
    
    const sender = type === 'user' ? 'You' : '🎓 CampusNexus';
    const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="campus-msg-bubble">
            <div class="campus-msg-sender">${sender}</div>
            ${content}
            <span class="campus-msg-time">${time}</span>
        </div>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// ============================================================
// SEND QUICK REPLY
// ============================================================
function sendQuickReply(message) {
    const input = document.getElementById('campusChatInput');
    if (input) {
        input.value = message;
        sendCampusChatMessage();
    }
}

// ============================================================
// BOT RESPONSE LOGIC
// ============================================================
function processBotResponse(message) {
    const lowerMsg = message.toLowerCase();
    let response = '';
    
    if (lowerMsg.includes('login') || lowerMsg.includes('sign in') || lowerMsg.includes('account')) {
        if (lowerMsg.includes('admin') || lowerMsg.includes('staff')) {
            response = '🔐 <strong>Admin/Staff Login:</strong><br><br>Please visit our <a href="admin-login.html" style="color: #D4A843; text-decoration: underline; font-weight: 600;">Admin Login Page</a>.<br><br>📧 Use your staff email and password to access the dashboard.';
        } else {
            response = '🎓 <strong>Welcome to CampusNexus!</strong><br><br>🔑 This platform is for administrators and staff to manage the institution.<br><br>📅 If you\'re a visitor or prospective student, I\'d be happy to help you:<br>• <strong>Book a demo</strong> to see the platform in action<br>• <strong>Learn about our packages</strong> and pricing<br>• <strong>Get support</strong> for any questions<br><br>Just ask me about <strong>demo</strong>, <strong>pricing</strong>, or <strong>support</strong>! 😊';
        }
    } else if (lowerMsg.includes('demo') || lowerMsg.includes('book') || lowerMsg.includes('schedule')) {
        response = '🎉 <strong>Book a Free Demo of CampusNexus!</strong><br><br>I can help you schedule a personalized demonstration:<br><br>📞 <strong>Call:</strong> +254 790 969 743<br>📧 <strong>Email:</strong> demo@campusnexus.com<br>📱 <strong>WhatsApp:</strong> +254 790 969 743<br><br>Or click the <strong>"Book Demo"</strong> button on our website!<br><br>Our team will get back to you within 24 hours. 🚀';
    } else if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('package') || lowerMsg.includes('plan')) {
        response = '💰 <strong>CampusNexus Pricing Plans</strong> (per month):<br><br>📋 <strong>Basic</strong>: KES 25,000<br>  • Essential portal access<br>  • Student & Staff Management<br><br>⭐ <strong>Standard</strong>: KES 30,000 <span style="color: #D4A843;">Most Popular!</span><br>  • Full portal access<br>  • Staff training included<br><br>🏆 <strong>Premium</strong>: KES 45,000<br>  • Complete solution<br>  • IT support included<br><br>All packages include POS access!<br><br>📅 <strong>Want to see a demo?</strong> Just ask me about demos!';
    } else if (lowerMsg.includes('help') || lowerMsg.includes('support') || lowerMsg.includes('issue') || lowerMsg.includes('problem')) {
        response = '🛠️ <strong>How can I help you today?</strong><br><br>I can assist with:<br>• 📅 <strong>Booking a demo</strong> - See the platform in action<br>• 💰 <strong>Pricing information</strong> - Find the right package<br>• 🏪 <strong>POS System</strong> - Learn about our integrated POS<br>• 📱 <strong>Attendance tracking</strong> - QR code and GPS features<br>• 📝 <strong>Online exams</strong> - Create and grade exams<br><br>Just ask me about any of these topics! 😊';
    } else if (lowerMsg.includes('pos') || lowerMsg.includes('store') || lowerMsg.includes('shop') || lowerMsg.includes('canteen')) {
        response = '🏪 <strong>CampusNexus POS System</strong><br><br>Our integrated POS system includes:<br><br>✅ Student account sync<br>✅ Real-time inventory tracking<br>✅ Sales analytics & reports<br>✅ Multiple payment methods<br>   (Cash, M-Pesa, Student Cards)<br>✅ Receipt printing<br>✅ Mobile POS ready<br><br>Perfect for campus shops, canteens, and bookstores!<br><br>📅 <strong>Want to see it in action?</strong> Ask me about demos!';
    } else if (lowerMsg.includes('attendance') || lowerMsg.includes('check in')) {
        response = '📱 <strong>Attendance Tracking with CampusNexus</strong><br><br>Features include:<br><br>✅ QR code scanning<br>✅ GPS location verification<br>✅ Real-time reporting<br>✅ Automated notifications<br>✅ Export reports to PDF/Excel<br><br>Students can check in using their mobile devices!<br><br>📅 <strong>Interested?</strong> Ask me about booking a demo!';
    } else if (lowerMsg.includes('exam') || lowerMsg.includes('test') || lowerMsg.includes('assessment')) {
        response = '📝 <strong>Online Exams & Assessments</strong><br><br>Our exam management features:<br><br>✅ Create and schedule exams<br>✅ Auto-grading capabilities<br>✅ Real-time analytics<br>✅ Secure proctoring options<br>✅ Results dashboard<br>✅ Export results to PDF/Excel<br><br>Streamline your assessment process! 🚀';
    } else if (lowerMsg.includes('feature') || lowerMsg.includes('what can you do')) {
        response = '🚀 <strong>CampusNexus Complete Features</strong><br><br>📚 <strong>Core Features:</strong><br>• Student Portal<br>• Lecturer Portal<br>• Online Exams & Assessments<br>• Attendance Tracking (QR + GPS)<br>• Learning Resources<br>• Fee Management<br>• Support Tickets<br><br>🏪 <strong>Integrated POS System:</strong><br>• Student account sync<br>• Real-time inventory<br>• Sales analytics<br><br>📊 <strong>Analytics & Reports</strong><br>• Performance tracking<br>• Engagement metrics<br><br>📱 <strong>Mobile PWA Ready</strong><br><br>📅 <strong>Want a demo?</strong> Just ask! 🎉';
    } else {
        response = '🎓 <strong>Hello! Welcome to CampusNexus!</strong><br><br>I\'m here to help you with:<br><br>📅 <strong>Demos</strong> - See our platform in action<br>💰 <strong>Pricing</strong> - Find the right package for you<br>🏪 <strong>POS System</strong> - Learn about integrated POS<br>📱 <strong>Features</strong> - Explore what we offer<br>🛠️ <strong>Support</strong> - Get help with any issues<br><br><strong>Just ask me about any of these topics!</strong> 😊<br><br>💡 <em>Try typing: "demo", "pricing", "features", or "help"</em>';
    }
    
    showTypingIndicator();
    
    setTimeout(() => {
        hideTypingIndicator();
        addChatMessage('bot', response);
        
        if (visitorId && currentChatId) {
            try {
                supabase
                    .from('chat_messages')
                    .insert([{
                        chat_id: currentChatId,
                        visitor_id: visitorId,
                        sender: 'bot',
                        message: response.replace(/<[^>]*>/g, ''),
                        created_at: new Date().toISOString()
                    }]);
            } catch (error) {
                console.error('Error saving bot response:', error);
            }
        }
    }, 800 + Math.random() * 600);
}

// ============================================================
// TYPING INDICATOR
// ============================================================
function showTypingIndicator() {
    const container = document.getElementById('chatMessagesContainer') || document.getElementById('campusChatMessages');
    if (!container) return;
    
    hideTypingIndicator();
    
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'campus-chat-message bot';
    typingDiv.innerHTML = `
        <div class="campus-msg-bubble">
            <div class="campus-msg-sender">🎓 CampusNexus</div>
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

// ============================================================
// CREATE CHAT WIDGET (Fallback with Pre-Chat Form)
// ============================================================
function createChatWidget() {
    if (document.getElementById('campusChatWidget')) return;
    
    const widget = document.createElement('div');
    widget.id = 'campusChatWidget';
    widget.className = 'campus-chat-widget';
    widget.innerHTML = `
        <button class="campus-chat-toggle" id="campusChatToggle" onclick="toggleCampusChat()">
            <i class="fas fa-comment-dots"></i>
            <span class="chat-notification" id="chatNotification">1</span>
        </button>
        <div class="campus-chat-window" id="campusChatWindow">
            <div class="campus-chat-header">
                <div>
                    <i class="fas fa-robot" style="margin-right: 8px;"></i> 
                    CampusNexus Bot
                    <span class="chat-status">
                        <span class="online-dot"></span> Online
                    </span>
                </div>
                <button onclick="closeCampusChat()">✕</button>
            </div>
            <div class="chat-status-indicator" id="chatStatusIndicator">
                <span>🤖 Bot Mode</span>
                <span id="agentStatus">| Auto-reply enabled</span>
            </div>
            <div class="campus-chat-messages" id="campusChatMessages">
                <!-- Pre-Chat Form -->
                <div class="campus-chat-message bot" id="preChatForm">
                    <div class="campus-msg-bubble" style="width: 100%; max-width: 320px;">
                        <div class="campus-msg-sender">🎓 CampusNexus Support</div>
                        <p style="margin-bottom: 12px;">👋 Welcome! Please introduce yourself before we start.</p>
                        <div id="visitorInfoForm">
                            <div style="margin-bottom: 10px;">
                                <input type="text" id="visitorNameInput" placeholder="Your full name" 
                                       style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff; font-size: 14px; outline: none;">
                            </div>
                            <div style="margin-bottom: 10px;">
                                <input type="email" id="visitorEmailInput" placeholder="Your email address" 
                                       style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff; font-size: 14px; outline: none;">
                            </div>
                            <button onclick="startChatWithInfo()" 
                                    style="width: 100%; padding: 10px; border-radius: 8px; border: none; background: linear-gradient(135deg, #D4A843, #F0D080); color: #0A1628; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.3s ease;">
                                <i class="fas fa-comment"></i> Start Chat
                            </button>
                            <p style="font-size: 11px; opacity: 0.6; margin-top: 8px; text-align: center;">
                                <i class="fas fa-lock"></i> Your info is safe with us
                            </p>
                        </div>
                    </div>
                </div>
                <!-- Chat messages container -->
                <div id="chatMessagesContainer" style="display: none;"></div>
            </div>
            <div class="chat-quick-replies" id="quickReplies" style="display: none;">
                <button onclick="sendQuickReply('I need help with login')">🔑 Login Help</button>
                <button onclick="sendQuickReply('I want to book a demo')">📅 Book Demo</button>
                <button onclick="sendQuickReply('I have a question about pricing')">💰 Pricing</button>
                <button onclick="sendQuickReply('I need technical support')">🛠️ Support</button>
            </div>
            <div class="campus-chat-input" id="chatInputArea" style="display: none;">
                <input type="text" id="campusChatInput" placeholder="Type your message..." onkeypress="handleCampusChatKey(event)">
                <button onclick="sendCampusChatMessage()">
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(widget);
}

// ============================================================
// INITIALIZE CHAT ON PAGE LOAD
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('campusChatWidget')) {
        createChatWidget();
    }
    
    const savedMode = localStorage.getItem('campusnexus_chat_mode');
    if (savedMode) {
        chatMode = savedMode;
    }
    
    // Check if visitor already provided info
    const hasInfo = checkVisitorInfo();
    
    setTimeout(() => {
        initializeChat();
        setTimeout(() => {
            setChatMode(chatMode);
        }, 500);
    }, 500);
    
    const wasOpen = localStorage.getItem('campusChatOpen');
    if (wasOpen === 'true') {
        const chatWindow = document.getElementById('campusChatWindow');
        if (chatWindow) {
            chatWindow.classList.add('open');
            const toggle = document.getElementById('campusChatToggle');
            if (toggle) {
                const icon = toggle.querySelector('i');
                if (icon) icon.className = 'fas fa-times';
            }
            const notification = document.getElementById('chatNotification');
            if (notification) notification.style.display = 'none';
            
            // If no info, focus on name input
            if (!hasInfo) {
                const nameInput = document.getElementById('visitorNameInput');
                if (nameInput) setTimeout(() => nameInput.focus(), 500);
            }
        }
    }
    
    if (!localStorage.getItem('campusChatVisited')) {
        setTimeout(() => {
            const chatWindow = document.getElementById('campusChatWindow');
            if (chatWindow && !chatWindow.classList.contains('open')) {
                chatWindow.classList.add('open');
                const toggle = document.getElementById('campusChatToggle');
                if (toggle) {
                    const icon = toggle.querySelector('i');
                    if (icon) icon.className = 'fas fa-times';
                }
                const notification = document.getElementById('chatNotification');
                if (notification) notification.style.display = 'none';
                localStorage.setItem('campusChatVisited', 'true');
                localStorage.setItem('campusChatOpen', 'true');
                
                // If no info, focus on name input
                if (!hasInfo) {
                    const nameInput = document.getElementById('visitorNameInput');
                    if (nameInput) setTimeout(() => nameInput.focus(), 500);
                }
            }
        }, 7000);
    }
});

// ============================================================
// SERVICE WORKER REGISTRATION (PWA)
// ============================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('ServiceWorker registered successfully');
            })
            .catch(function(err) {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

console.log('✅ CampusNexus JavaScript loaded successfully!');
