// ============================================================
// CAMPUSNEXUS - MAIN JAVASCRIPT
// Version: 7.0 - Hybrid Chat (Bot + Live Agent) + Pre-Chat Form + Auto-Scroll
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
// SUPABASE CONFIGURATION - FIXED PERMANENTLY
// ============================================================
const SUPABASE_URL = 'https://irahplkvocaakjxuisto.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYWhwbGt2b2NhYWtqeHVpc3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4ODY5ODQsImV4cCI6MjEwMzQ2Mjk4NH0.BFOwdRVDz4r1oYgUjm8zQbthqblGRq4c3WQWQaOhu7g';

// Initialize Supabase - always recreate it
try {
    if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase initialized successfully');
    } else {
        console.warn('⚠️ Supabase library not loaded yet, waiting...');
    }
} catch (error) {
    console.error('❌ Supabase initialization failed:', error);
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
let renderedChatMessageIds = new Set();
const CAMPUS_CHAT_API='https://irahplkvocaakjxuisto.supabase.co/functions/v1/public-chat-api';
async function campusChatApi(action,extra={}){const r=await fetch(CAMPUS_CHAT_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,visitor_id:visitorId,chat_id:currentChatId,...extra})});const d=await r.json().catch(()=>({}));if(!r.ok||!d.ok)throw new Error(d.error||'Chat service unavailable');return d;}
function escapeChatText(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
let isAgentOnline = false;
let chatMode = 'bot';
let chatStarted = false;
let scrollObserver = null;

// ============================================================
// PRE-CHAT FORM FUNCTIONS
// ============================================================

async function startChatWithInfo(name,email){
 visitorName=name||document.getElementById('visitorNameInput')?.value?.trim()||'Anonymous Visitor';
 visitorEmail=email||document.getElementById('visitorEmailInput')?.value?.trim()||'';
 localStorage.setItem('campusnexus_visitor_name',visitorName);localStorage.setItem('campusnexus_visitor_email',visitorEmail);
 await createChatSession(visitorName,visitorEmail);
 ['preChatForm','chatMessagesContainer','quickReplies','chatInputArea'].forEach((id,i)=>{const el=document.getElementById(id);if(el)el.style.display=i===0?'none':i===1||i===2||i===3?'block':el.style.display;});
 chatStarted=true;addChatMessage('bot','👋 Welcome '+escapeChatText(visitorName)+'! I\'m here to help you. What can I assist you with today?');
 setTimeout(setupScrollObserver,300);subscribeToMessages();await checkAgentStatus();
}
async function createChatSession(name,email){
 visitorId=getVisitorId();currentChatId='chat_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
 localStorage.setItem('campusnexus_chat_id',currentChatId);renderedChatMessageIds=new Set();
 try{await campusChatApi('create_session',{visitor_name:name,visitor_email:email,visitor_page:location.pathname||'/'});}catch(e){console.error('Chat session could not be created:',e);}
}
async function updateVisitorInfo(name,email){
 if(!visitorId||!currentChatId)return;
 try{await campusChatApi('update_visitor',{visitor_name:name,visitor_email:email});}catch(e){console.error('Visitor details update failed:',e);}
}

function checkVisitorInfo() {
    const savedName = localStorage.getItem('campusnexus_visitor_name');
    const savedEmail = localStorage.getItem('campusnexus_visitor_email');
    
    if (savedName && savedName !== 'Anonymous Visitor') {
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
        id = crypto.randomUUID ? crypto.randomUUID() : 'visitor_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        localStorage.setItem('campusnexus_visitor_id', id);
    }
    return id;
}

// ============================================================
// CHECK AGENT STATUS
// ============================================================
async function checkAgentStatus(){
 try{const d=await campusChatApi('agent_status');isAgentOnline=!!d.isOnline;}
 catch(e){console.warn('Agent status unavailable:',e);isAgentOnline=false;}
 updateStatusIndicator();updateAgentStatusBadge();if(isAgentOnline&&chatMode==='agent')updateChatHeaderForAgent();
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

function updateAgentStatusBadge() {
    const agentBadge = document.getElementById('agentStatusBadge');
    const liveIndicator = document.getElementById('liveIndicator');
    const agentAvailability = document.getElementById('agentAvailability');
    const modeAgentBtn = document.getElementById('modeAgentBtn');
    
    if (agentBadge) {
        agentBadge.style.background = isAgentOnline ? '#2ecc71' : '#f39c12';
    }
    
    if (liveIndicator) {
        liveIndicator.className = 'mode-indicator ' + (isAgentOnline ? 'live' : 'offline');
    }
    
    if (agentAvailability) {
        agentAvailability.textContent = isAgentOnline ? '🟢' : '🔴';
    }
    
    if (modeAgentBtn) {
        modeAgentBtn.innerHTML = `
            👤 Live Agent
            <span id="agentStatusBadge" style="
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: ${isAgentOnline ? '#2ecc71' : '#f39c12'};
                margin-left: 4px;
            "></span>
            <span style="font-size: 10px; color: ${isAgentOnline ? '#2ecc71' : '#f39c12'}; margin-left: 4px;">
                ${isAgentOnline ? 'Online' : 'Away'}
            </span>
        `;
    }
}

function updateChatHeaderForAgent() {
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
}

// ============================================================
// AUTO-SCROLL OBSERVER - GUARANTEED SCROLLING
// ============================================================
function setupScrollObserver() {
    const container = document.getElementById('chatMessagesContainer') || 
                      document.getElementById('campusChatMessages');
    
    if (!container) return;
    
    // Remove existing observer if any
    if (scrollObserver) {
        scrollObserver.disconnect();
    }
    
    // Create new observer
    scrollObserver = new MutationObserver(function(mutations) {
        let shouldScroll = false;
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldScroll = true;
                break;
            }
        }
        
        if (shouldScroll) {
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 10);
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 100);
            setTimeout(() => {
                container.scrollTop = container.scrollHeight;
            }, 300);
        }
    });
    
    scrollObserver.observe(container, {
        childList: true,
        subtree: true,
        attributes: false
    });
    
    console.log('✅ Scroll observer set up');
}

function forceScrollToBottom() {
    const container = document.getElementById('chatMessagesContainer') || 
                      document.getElementById('campusChatMessages');
    if (container) {
        container.scrollTop = container.scrollHeight;
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        return true;
    }
    return false;
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
    
    const agentStatusText = isAgentOnline ? 'Online' : 'Away';
    const agentStatusColor = isAgentOnline ? '#2ecc71' : '#f39c12';
    
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
                background: ${agentStatusColor};
                margin-left: 4px;
            "></span>
            <span id="agentStatusText" style="font-size: 10px; color: ${agentStatusColor}; margin-left: 4px;">
                ${agentStatusText}
            </span>
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
    
    if (!botBtn || !agentBtn) return;
    
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
async function loadChatHistory(){
 if(!visitorId||!currentChatId)return;
 try{
  const d=await campusChatApi('history');const container=document.getElementById('campusChatMessages');if(!container)return;
  (d.messages||[]).forEach(msg=>{
   const id=String(msg.id);if(renderedChatMessageIds.has(id))return;renderedChatMessageIds.add(id);
   const content=msg.sender==='agent'?'👤 <strong>Agent:</strong> '+escapeChatText(msg.message):escapeChatText(msg.message);
   addChatMessage(msg.sender==='visitor'?'user':'bot',content,msg.created_at);
  });
 }catch(e){console.error('Chat history unavailable:',e);}
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
function subscribeToMessages(){
 if(messageSubscription)clearInterval(messageSubscription);
 if(!visitorId||!currentChatId)return;
 loadChatHistory();messageSubscription=setInterval(loadChatHistory,5000);
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
            
            if (!chatStarted) {
                const hasInfo = checkVisitorInfo();
                if (!hasInfo) {
                    const nameInput = document.getElementById('visitorNameInput');
                    if (nameInput) setTimeout(() => nameInput.focus(), 300);
                }
            } else {
                const input = document.getElementById('campusChatInput');
                if (input) input.focus();
                setTimeout(() => forceScrollToBottom(), 100);
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
// SEND CHAT MESSAGE - FIXED
// ============================================================
async function sendCampusChatMessage(){
 const input=document.getElementById('campusChatInput');if(!input)return;
 const message=input.value.trim();if(!message)return;
 if(!chatStarted){const hasInfo=checkVisitorInfo();if(!hasInfo){const f=document.getElementById('preChatForm');if(f)f.style.display='block';return;}}
 if(!visitorId)visitorId=getVisitorId();
 if(!currentChatId)await createChatSession(localStorage.getItem('campusnexus_visitor_name')||'Anonymous Visitor',localStorage.getItem('campusnexus_visitor_email')||'');
 addChatMessage('user',escapeChatText(message));input.value='';setTimeout(forceScrollToBottom,10);
 try{const d=await campusChatApi('send',{message});if(d.message?.id!==undefined)renderedChatMessageIds.add(String(d.message.id));}
 catch(e){console.error('Message send failed:',e);addChatMessage('bot','Sorry, your message could not be sent. Please try again.');return;}
 if(chatMode==='bot')processBotResponse(message);
 else if(isAgentOnline)addChatMessage('bot','👤 Your message has been sent to a live agent. They will respond shortly...');
 else addChatMessage('bot','⏳ No agents are currently online. Your message has been saved and will be responded to when an agent becomes available.');
}

// ============================================================
// ADD CHAT MESSAGE
// ============================================================
// ADD CHAT MESSAGE - WITH AUTO-SCROLL
// ============================================================
function addChatMessage(type, content, timestamp) {
    let container = document.getElementById('chatMessagesContainer');
    if (!container) {
        container = document.getElementById('campusChatMessages');
    }
    
    if (!container) {
        createChatWidget();
        setTimeout(() => addChatMessage(type, content, timestamp), 100);
        return;
    }
    
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
    
    // Multiple scroll attempts
    setTimeout(() => forceScrollToBottom(), 10);
    setTimeout(() => forceScrollToBottom(), 50);
    setTimeout(() => forceScrollToBottom(), 150);
    setTimeout(() => forceScrollToBottom(), 300);
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
        
        if(visitorId&&currentChatId)campusChatApi('bot_reply',{message:response.replace(/<[^>]*>/g,'')}).then(d=>{if(d.message?.id!==undefined)renderedChatMessageIds.add(String(d.message.id));}).catch(e=>console.warn('Bot reply save failed:',e));
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
    forceScrollToBottom();
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

// ============================================================
// CREATE CHAT WIDGET
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
                
                if (!hasInfo) {
                    const nameInput = document.getElementById('visitorNameInput');
                    if (nameInput) setTimeout(() => nameInput.focus(), 500);
                }
            }
        }, 7000);
    }
    
    setInterval(() => {
        checkAgentStatus();
    }, 30000);
    
    console.log('🔄 Agent status check scheduled (every 30s)');
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
