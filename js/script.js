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
    if (scrollProgress) scrollProgress.style.width = progress + '%';
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

    // Close menu when a link is clicked
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open');
            menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        });
    });
}

// ============================================================
// MOBILE MENU (Alternate version with backdrop)
// ============================================================
function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    const backdrop = document.getElementById('mobileMenuBackdrop');
    if (mobileMenu) mobileMenu.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
}

// Close mobile menu on backdrop click
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
        // Also close chat if open
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

// ============================================================
// CAMPUS CHAT FUNCTIONS
// ============================================================

// Toggle chat widget
function toggleCampusChat() {
    const window = document.getElementById('campusChatWindow');
    const toggle = document.getElementById('campusChatToggle');
    
    if (window) {
        window.classList.toggle('open');
        const isOpen = window.classList.contains('open');
        
        // Update toggle icon
        if (toggle) {
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.className = isOpen ? 'fas fa-times' : 'fas fa-comment-dots';
            }
        }
        
        // Hide notification when opened
        if (isOpen) {
            const notification = document.getElementById('chatNotification');
            if (notification) notification.style.display = 'none';
            const input = document.getElementById('campusChatInput');
            if (input) input.focus();
            localStorage.setItem('campusChatOpen', 'true');
        } else {
            localStorage.setItem('campusChatOpen', 'false');
        }
    } else {
        // If chat widget doesn't exist on this page, create it
        createChatWidget();
    }
}

// Close chat window
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

// Handle Enter key in chat input
function handleCampusChatKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendCampusChatMessage();
    }
}

// Get visitor IP
async function getVisitorIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch {
        return 'unknown';
    }
}

// Send chat message
async function sendCampusChatMessage() {
    const input = document.getElementById('campusChatInput');
    if (!input) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    // Add message to UI
    addChatMessage('user', message);
    input.value = '';
    
    // Get visitor ID
    let visitorId = localStorage.getItem('campusnexus_visitor_id');
    if (!visitorId) {
        visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('campusnexus_visitor_id', visitorId);
    }
    
    // Get or create chat session
    let chatId = localStorage.getItem('campusnexus_chat_id');
    if (!chatId) {
        chatId = 'chat_' + Date.now();
        localStorage.setItem('campusnexus_chat_id', chatId);
        
        // Create chat session in Supabase
        try {
            const ip = await getVisitorIP();
            const { error } = await supabase
                .from('chat_sessions')
                .insert([{
                    chat_id: chatId,
                    visitor_id: visitorId,
                    visitor_ip: ip,
                    visitor_page: window.location.href,
                    status: 'active',
                    created_at: new Date().toISOString()
                }]);
            
            if (error) console.error('Error creating chat session:', error);
        } catch (error) {
            console.error('Supabase error:', error);
        }
    }
    
    // Save message to Supabase
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .insert([{
                chat_id: chatId,
                visitor_id: visitorId,
                sender: 'visitor',
                message: message,
                created_at: new Date().toISOString()
            }]);
        
        if (error) console.error('Error saving message:', error);
    } catch (error) {
        console.error('Supabase error:', error);
    }
    
    // Process bot response
    processBotResponse(message);
}

// Add chat message to UI
function addChatMessage(type, content) {
    const container = document.getElementById('campusChatMessages');
    if (!container) {
        // If container doesn't exist, create it
        createChatWidget();
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `campus-chat-message ${type}`;
    
    const sender = type === 'user' ? 'You' : '🎓 CampusNexus Bot';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
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

// Send quick reply
function sendQuickReply(message) {
    const input = document.getElementById('campusChatInput');
    if (input) {
        input.value = message;
        sendCampusChatMessage();
    }
}

// Bot response logic
function processBotResponse(message) {
    const lowerMsg = message.toLowerCase();
    let response = '';
    
    if (lowerMsg.includes('login') || lowerMsg.includes('sign in') || lowerMsg.includes('account')) {
        response = 'You can login at <a href="admin-login.html" style="color: #D4A843;">admin-login.html</a> to access your dashboard. 🔑';
    } else if (lowerMsg.includes('demo') || lowerMsg.includes('book') || lowerMsg.includes('schedule')) {
        response = 'Great! 🎉 You can book a demo by clicking the "Book Demo" button on our website, or email us at <strong>demo@campusnexus.com</strong>';
    } else if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('package') || lowerMsg.includes('plan')) {
        response = 'We have 3 packages:<br>• <strong>Basic</strong>: KES 25,000/month<br>• <strong>Standard</strong>: KES 30,000/month<br>• <strong>Premium</strong>: KES 45,000/month 💰<br>All packages include POS access!';
    } else if (lowerMsg.includes('help') || lowerMsg.includes('support') || lowerMsg.includes('issue') || lowerMsg.includes('problem')) {
        response = 'Our support team is available 24/7.<br>📧 Email: <strong>support@campusnexus.com</strong><br>📱 WhatsApp: <strong>+254 790 969 743</strong><br>🛠️ We\'re here to help!';
    } else if (lowerMsg.includes('pos') || lowerMsg.includes('store') || lowerMsg.includes('shop') || lowerMsg.includes('canteen')) {
        response = 'Our POS system integrates with campus shops, canteens, and bookstores! 🏪<br>• Student account sync<br>• Real-time inventory<br>• Sales analytics<br>• Multiple payment methods';
    } else if (lowerMsg.includes('attendance') || lowerMsg.includes('check in')) {
        response = 'Attendance tracking uses QR codes and geo-location. 📱<br>Students can check in via their mobile devices with:<br>• QR code scanning<br>• GPS verification<br>• Real-time reporting';
    } else if (lowerMsg.includes('exam') || lowerMsg.includes('test') || lowerMsg.includes('assessment')) {
        response = 'Online exams and assessments: 📝<br>• Create and schedule exams<br>• Auto-grading<br>• Real-time analytics<br>• Secure proctoring options';
    } else if (lowerMsg.includes('feature') || lowerMsg.includes('what can you do')) {
        response = 'CampusNexus offers: 🚀<br>• Student & Staff Management<br>• Course Management<br>• Attendance Tracking<br>• Online Exams<br>• Learning Resources<br>• Integrated POS System<br>• Analytics & Reports<br>• Fee Management<br>• Support Tickets';
    } else {
        response = 'Thank you for your message! 🎓 Our team will respond shortly.<br><br>In the meantime, check out our:<br>• <a href="#features" style="color: #D4A843;">Features</a><br>• <a href="#pricing" style="color: #D4A843;">Pricing</a><br>• <a href="#pos" style="color: #D4A843;">POS System</a>';
    }
    
    // Show typing indicator
    showTypingIndicator();
    
    setTimeout(() => {
        hideTypingIndicator();
        addChatMessage('bot', response);
        
        // Save bot response to Supabase
        const visitorId = localStorage.getItem('campusnexus_visitor_id');
        const chatId = localStorage.getItem('campusnexus_chat_id');
        if (visitorId && chatId) {
            try {
                supabase
                    .from('chat_messages')
                    .insert([{
                        chat_id: chatId,
                        visitor_id: visitorId,
                        sender: 'bot',
                        message: response.replace(/<[^>]*>/g, ''), // Strip HTML for storage
                        created_at: new Date().toISOString()
                    }]);
            } catch (error) {
                console.error('Error saving bot response:', error);
            }
        }
    }, 800 + Math.random() * 600);
}

// Typing indicator functions
function showTypingIndicator() {
    const container = document.getElementById('campusChatMessages');
    if (!container) return;
    
    // Remove existing typing indicator
    hideTypingIndicator();
    
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'campus-chat-message bot';
    typingDiv.innerHTML = `
        <div class="campus-msg-bubble">
            <div class="campus-msg-sender">🎓 CampusNexus Bot</div>
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

// Create chat widget dynamically (for pages that don't have it)
function createChatWidget() {
    // Check if widget already exists
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
                    <i class="fas fa-graduation-cap" style="margin-right: 8px;"></i> 
                    CampusNexus Support
                    <span class="chat-status">
                        <span class="online-dot"></span> Online
                    </span>
                </div>
                <button onclick="closeCampusChat()">✕</button>
            </div>
            
            <div class="chat-status-indicator" id="chatStatusIndicator">
                <span>🟢 Connected</span>
                <span id="agentStatus">| Agent online</span>
            </div>
            
            <div class="campus-chat-messages" id="campusChatMessages">
                <div class="campus-chat-message bot">
                    <div class="campus-msg-bubble">
                        <div class="campus-msg-sender">🎓 CampusNexus Bot</div>
                        Hello! 👋 Welcome to CampusNexus.<br>
                        How can I help you today?
                        <span class="campus-msg-time">Just now</span>
                    </div>
                </div>
            </div>
            
            <div class="chat-quick-replies" id="quickReplies">
                <button onclick="sendQuickReply('I need help with login')">🔑 Login Help</button>
                <button onclick="sendQuickReply('I want to book a demo')">📅 Book Demo</button>
                <button onclick="sendQuickReply('I have a question about pricing')">💰 Pricing</button>
                <button onclick="sendQuickReply('I need technical support')">🛠️ Support</button>
            </div>
            
            <div class="campus-chat-input">
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
// SUPABASE CONFIGURATION
// ============================================================
const SUPABASE_URL = 'https://irahplkvocaakjxuisto.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYWhwbGt2b2NhYWtqeHVpc3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4ODY5ODQsImV4cCI6MjEwMzQ2Mjk4NH0.BFOwdRVDz4r1oYgUjm8zQbthqblGRq4c3WQWQaOhu7g';

// Initialize Supabase client
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase initialized for chat');
} catch (error) {
    console.error('❌ Supabase initialization failed:', error);
}

// ============================================================
// SUBSCRIBE TO REALTIME MESSAGES
// ============================================================
let messageSubscription = null;

function subscribeToChatMessages() {
    const visitorId = localStorage.getItem('campusnexus_visitor_id');
    if (!visitorId) return;
    
    if (messageSubscription) {
        messageSubscription.unsubscribe();
    }
    
    try {
        messageSubscription = supabase
            .channel('chat_messages')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `visitor_id=eq.${visitorId}`
                },
                (payload) => {
                    if (payload.new.sender !== 'visitor' && payload.new.sender !== 'bot') {
                        // Only show agent messages in the chat
                        addChatMessage('bot', payload.new.message);
                        // Show notification if chat is closed
                        const chatWindow = document.getElementById('campusChatWindow');
                        const notification = document.getElementById('chatNotification');
                        if (chatWindow && !chatWindow.classList.contains('open') && notification) {
                            notification.style.display = 'block';
                        }
                    }
                }
            )
            .subscribe();
    } catch (error) {
        console.error('Error subscribing to messages:', error);
    }
}

// ============================================================
// INITIALIZE CHAT ON PAGE LOAD
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    // Check if chat elements exist, if not create them
    if (!document.getElementById('campusChatWidget')) {
        createChatWidget();
    }
    
    // Check if chat was previously open
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
        }
    }
    
    // Subscribe to realtime messages
    setTimeout(() => {
        subscribeToChatMessages();
    }, 1000);
    
    // Auto-open chat for new visitors
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
