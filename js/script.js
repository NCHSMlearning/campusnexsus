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

function processBotResponse(message) {
    const lowerMsg = message.toLowerCase();
    let response = '';
    
    // Check if user is asking about login/account
    if (lowerMsg.includes('login') || lowerMsg.includes('sign in') || lowerMsg.includes('account')) {
        // Check if they mentioned admin or staff
        if (lowerMsg.includes('admin') || lowerMsg.includes('staff')) {
            response = '🔐 <strong>Admin/Staff Login:</strong><br><br>Please visit our <a href="admin-login.html" style="color: #D4A843; text-decoration: underline; font-weight: 600;">Admin Login Page</a>.<br><br>📧 Use your staff email and password to access the dashboard.';
        } else {
            response = '🎓 <strong>Welcome to CampusNexus!</strong><br><br>🔑 This platform is for administrators and staff to manage the institution.<br><br>📅 If you\'re a visitor or prospective student, I\'d be happy to help you:<br>• <strong>Book a demo</strong> to see the platform in action<br>• <strong>Learn about our packages</strong> and pricing<br>• <strong>Get support</strong> for any questions<br><br>Just ask me about <strong>demo</strong>, <strong>pricing</strong>, or <strong>support</strong>! 😊';
        }
    } 
    else if (lowerMsg.includes('demo') || lowerMsg.includes('book') || lowerMsg.includes('schedule')) {
        response = '🎉 <strong>Book a Free Demo of CampusNexus!</strong><br><br>I can help you schedule a personalized demonstration:<br><br>📞 <strong>Call:</strong> +254 790 969 743<br>📧 <strong>Email:</strong> demo@campusnexus.com<br>📱 <strong>WhatsApp:</strong> +254 790 969 743<br><br>Or click the <strong>"Book Demo"</strong> button on our website!<br><br>Our team will get back to you within 24 hours. 🚀';
    } 
    else if (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('package') || lowerMsg.includes('plan')) {
        response = '💰 <strong>CampusNexus Pricing Plans</strong> (per month):<br><br>📋 <strong>Basic</strong>: KES 25,000<br>  • Essential portal access<br>  • Student & Staff Management<br><br>⭐ <strong>Standard</strong>: KES 30,000 <span style="color: #D4A843;">Most Popular!</span><br>  • Full portal access<br>  • Staff training included<br><br>🏆 <strong>Premium</strong>: KES 45,000<br>  • Complete solution<br>  • IT support included<br><br>All packages include POS access!<br><br>📅 <strong>Want to see a demo?</strong> Just ask me about demos!';
    } 
    else if (lowerMsg.includes('help') || lowerMsg.includes('support') || lowerMsg.includes('issue') || lowerMsg.includes('problem')) {
        response = '🛠️ <strong>How can I help you today?</strong><br><br>I can assist with:<br>• 📅 <strong>Booking a demo</strong> - See the platform in action<br>• 💰 <strong>Pricing information</strong> - Find the right package<br>• 🏪 <strong>POS System</strong> - Learn about our integrated POS<br>• 📱 <strong>Attendance tracking</strong> - QR code and GPS features<br>• 📝 <strong>Online exams</strong> - Create and grade exams<br><br>Just ask me about any of these topics! 😊';
    } 
    else if (lowerMsg.includes('pos') || lowerMsg.includes('store') || lowerMsg.includes('shop') || lowerMsg.includes('canteen')) {
        response = '🏪 <strong>CampusNexus POS System</strong><br><br>Our integrated POS system includes:<br><br>✅ Student account sync<br>✅ Real-time inventory tracking<br>✅ Sales analytics & reports<br>✅ Multiple payment methods<br>   (Cash, M-Pesa, Student Cards)<br>✅ Receipt printing<br>✅ Mobile POS ready<br><br>Perfect for campus shops, canteens, and bookstores!<br><br>📅 <strong>Want to see it in action?</strong> Ask me about demos!';
    } 
    else if (lowerMsg.includes('attendance') || lowerMsg.includes('check in')) {
        response = '📱 <strong>Attendance Tracking with CampusNexus</strong><br><br>Features include:<br><br>✅ QR code scanning<br>✅ GPS location verification<br>✅ Real-time reporting<br>✅ Automated notifications<br>✅ Export reports to PDF/Excel<br><br>Students can check in using their mobile devices!<br><br>📅 <strong>Interested?</strong> Ask me about booking a demo!';
    } 
    else if (lowerMsg.includes('exam') || lowerMsg.includes('test') || lowerMsg.includes('assessment')) {
        response = '📝 <strong>Online Exams & Assessments</strong><br><br>Our exam management features:<br><br>✅ Create and schedule exams<br>✅ Auto-grading capabilities<br>✅ Real-time analytics<br>✅ Secure proctoring options<br>✅ Results dashboard<br>✅ Export results to PDF/Excel<br><br>Streamline your assessment process! 🚀';
    } 
    else if (lowerMsg.includes('feature') || lowerMsg.includes('what can you do')) {
        response = '🚀 <strong>CampusNexus Complete Features</strong><br><br>📚 <strong>Core Features:</strong><br>• Student Portal<br>• Lecturer Portal<br>• Online Exams & Assessments<br>• Attendance Tracking (QR + GPS)<br>• Learning Resources<br>• Fee Management<br>• Support Tickets<br><br>🏪 <strong>Integrated POS System:</strong><br>• Student account sync<br>• Real-time inventory<br>• Sales analytics<br><br>📊 <strong>Analytics & Reports</strong><br>• Performance tracking<br>• Engagement metrics<br><br>📱 <strong>Mobile PWA Ready</strong><br><br>📅 <strong>Want a demo?</strong> Just ask! 🎉';
    } 
    else {
        response = '🎓 <strong>Hello! Welcome to CampusNexus!</strong><br><br>I\'m here to help you with:<br><br>📅 <strong>Demos</strong> - See our platform in action<br>💰 <strong>Pricing</strong> - Find the right package for you<br>🏪 <strong>POS System</strong> - Learn about integrated POS<br>📱 <strong>Features</strong> - Explore what we offer<br>🛠️ <strong>Support</strong> - Get help with any issues<br><br><strong>Just ask me about any of these topics!</strong> 😊<br><br>💡 <em>Try typing: "demo", "pricing", "features", or "help"</em>';
    }
    
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
// SUPABASE CONFIGURATION - FIXED WITH CHANNEL SUPPORT
// ============================================================
const SUPABASE_URL = 'https://irahplkvocaakjxuisto.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYWhwbGt2b2NhYWtqeHVpc3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4ODY5ODQsImV4cCI6MjEwMzQ2Mjk4NH0.BFOwdRVDz4r1oYgUjm8zQbthqblGRq4c3WQWQaOhu7g';

// Initialize Supabase client - check if window.supabase exists
if (typeof window.supabase !== 'undefined') {
    try {
        // Check if supabase is already defined globally and has channel method
        if (typeof supabase === 'undefined' || typeof supabase.channel !== 'function') {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('✅ Supabase initialized with realtime support');
        } else {
            console.log('✅ Supabase already initialized');
        }
    } catch (error) {
        console.error('❌ Supabase initialization failed:', error);
        // Create a fallback to prevent errors
        supabase = {
            from: () => ({ insert: () => Promise.resolve({ error: null }) }),
            channel: () => ({ on: () => ({ subscribe: () => {} }) }),
            removeChannel: () => {}
        };
    }
} else {
    console.warn('⚠️ Supabase library not loaded');
    // Create a fallback
    supabase = {
        from: () => ({ insert: () => Promise.resolve({ error: null }) }),
        channel: () => ({ on: () => ({ subscribe: () => {} }) }),
        removeChannel: () => {}
    };
}

// ============================================================
// SUBSCRIBE TO REALTIME MESSAGES - FIXED
// ============================================================
let messageSubscription = null;

function subscribeToChatMessages() {
    const visitorId = localStorage.getItem('campusnexus_visitor_id');
    if (!visitorId) {
        console.log('No visitor ID found, skipping subscription');
        return;
    }
    
    // Check if supabase is available and has the channel method
    if (!supabase) {
        console.warn('⚠️ Supabase not available, skipping realtime subscription');
        return;
    }
    
    if (typeof supabase.channel !== 'function') {
        console.warn('⚠️ Supabase channel method not available. Trying to reinitialize...');
        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('✅ Supabase reinitialized successfully');
        } catch (error) {
            console.error('❌ Failed to reinitialize Supabase:', error);
            return;
        }
    }
    
    if (messageSubscription) {
        try {
            if (typeof supabase.removeChannel === 'function') {
                supabase.removeChannel(messageSubscription);
            }
        } catch(e) {
            console.log('Error removing channel:', e);
        }
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
                        addChatMessage('bot', payload.new.message);
                        const chatWindow = document.getElementById('campusChatWindow');
                        const notification = document.getElementById('chatNotification');
                        if (chatWindow && !chatWindow.classList.contains('open') && notification) {
                            notification.style.display = 'block';
                        }
                    }
                }
            )
            .subscribe();
        console.log('✅ Subscribed to chat messages');
    } catch (error) {
        console.error('❌ Error subscribing to messages:', error);
    }
}

// ============================================================
// RETRY SUPABASE INITIALIZATION IF NEEDED
// ============================================================
setTimeout(function() {
    if (typeof supabase === 'undefined' || typeof supabase.channel !== 'function') {
        console.log('🔄 Retrying Supabase initialization...');
        try {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('✅ Supabase initialized on retry');
            // Resubscribe to messages
            setTimeout(subscribeToChatMessages, 500);
        } catch (error) {
            console.error('❌ Retry failed:', error);
        }
    }
}, 2000);

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
