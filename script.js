const _URL = "https://gsqbinxeecrtkhazbels.supabase.co";
const _KEY = "sb_publishable_AxrDKmh2Np6DDcKfJitu4g_mHZPG48x";
const _supabase = supabase.createClient(_URL, _KEY);

let state = { users: [], levels: [], settings: {}, currentTab: 'users' };

let sortOrder = 'desc'; // 'desc' — жоғарыдан төмен, 'asc' — төменнен жоғары

async function init() {
    const { data: users } = await _supabase.from('users').select('*');
    const { data: levels } = await _supabase.from('levels').select('*').order('min_score', { ascending: true });
    const { data: settings } = await _supabase.from('settings').select('*').limit(1).single();
    state.users = users || [];
    state.levels = levels || [];
    state.settings = settings || {};
    renderStats();
    updateNav();
}

function renderStats() {
    const container = document.getElementById('leaderboard');
    const meetingInfo = document.getElementById('meeting-info');
    // Жиналыс уақыты
    if (state.settings.meeting_date && state.settings.meeting_date !== 'EMPTY') {
        meetingInfo.innerHTML = state.settings.meeting_date;
    } else {
        meetingInfo.innerHTML = 'Уақыты белгісіз';
    }

    // Сортировка кнопкасы — ортасына және стильді
    let html = `
        <div class="flex justify-center mb-6">
            <button onclick="toggleSortOrder()" 
                class="bg-[#fbbf24] text-black px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg hover:scale-105 transition-all border border-yellow-400 focus:ring-2 focus:ring-yellow-400"
                style="min-width:180px">
                <span class="flex items-center gap-1">
                    <i data-lucide="arrow-up" class="${sortOrder === 'asc' ? 'text-yellow-900' : 'text-slate-400'} w-5 h-5"></i>
                    <i data-lucide="arrow-down" class="${sortOrder === 'desc' ? 'text-yellow-900' : 'text-slate-400'} w-5 h-5"></i>
                </span>
                <span>
                    ${sortOrder === 'desc' ? 'Жоғарыдан төмен' : 'Төменнен жоғары'}
                </span>
            </button>
        </div>
    `;

    // Пайдаланушыларды сортировка жасау
    let sortedUsers = [...state.users];
    sortedUsers.sort((a, b) => sortOrder === 'desc' ? b.score - a.score : a.score - b.score);

    sortedUsers.forEach((user, index) => {
        const myLevel = [...state.levels].reverse().find(l => user.score >= l.min_score) || state.levels[0];
        const nextLevel = state.levels.find(l => l.min_score > user.score);
        let progress = nextLevel ? ((user.score - myLevel.min_score) / (nextLevel.min_score - myLevel.min_score)) * 100 : 100;
        const toNext = nextLevel ? nextLevel.min_score - user.score : 0;
        const isTopLevel = myLevel.min_score === Math.max(...state.levels.map(l => l.min_score));
        let tasks = [];
        try { tasks = JSON.parse(user.tasks || '[]'); } catch {}

        html += `
            <div class="glass p-6 rounded-[2.5rem] relative overflow-hidden group mb-6">
                <div class="flex justify-between items-start mb-6">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-2xl flex items-center justify-center font-black text-2xl text-yellow-900 border-2 border-yellow-500 shadow-lg">
                            ${index + 1}
                        </div>
                        <div>
                            <h4 class="font-black text-xl text-white flex items-center gap-2">
                                ${user.name}
                                <span class="w-2.5 h-2.5 rounded-full ${user.is_active ? 'bg-green-500 shadow-[0_0_12px_#22c55e]' : 'bg-red-500'}"></span>
                                ${isTopLevel ? '<i data-lucide="award" class="w-7 h-7 text-yellow-400 animate-bounce"></i>' : ''}
                            </h4>
                            <div class="flex items-center gap-1.5 mt-1">
                                <span class="text-[10px] font-black uppercase tracking-[0.2em]" style="color:${myLevel.color}">${myLevel.name}</span>
                                ${nextLevel ? `<span class="ml-2 text-xs text-slate-400">Келесі деңгейге <b>${toNext}</b> ұпай қалды</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-3xl font-black text-blue-400 font-mono">${user.score}</span>
                        <p class="text-[9px] uppercase font-black opacity-30 tracking-widest">Ұпай</p>
                    </div>
                </div>
                ${tasks.length > 0 ? `
                <div class="bg-black/20 rounded-2xl p-4 mb-5 border border-white/5">
                    <div class="font-bold mb-2 text-yellow-400">Ағымдағы тапсырмалар:</div>
                    <ul class="space-y-2">
                        ${tasks.map(t => `
                            <li class="flex items-center gap-2 bg-slate-800/50 rounded-xl p-3">
                                <span class="flex-1">${t.task}</span>
                                <span class="text-xs text-slate-400">${t.deadline}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                ` : ''}
                <div class="bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-white/5">
                    <div class="h-full rounded-full transition-all duration-1000" style="width:${Math.max(5, progress)}%; background:${myLevel.color}"></div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html || '<p class="text-center opacity-30 py-20">Команда жиналмады...</p>';
    lucide.createIcons();
}

function toggleSortOrder() {
    sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    renderStats();
}

function updateNav() {
    const isLogged = localStorage.getItem('admin_logged') === 'true';
    const nav = document.getElementById('nav-actions');
    nav.innerHTML = isLogged ? `
        <button onclick="showPage('stats')" class="p-3 glass rounded-xl text-blue-500"><i data-lucide="bar-chart-3"></i></button>
        <button onclick="showPage('admin')" class="p-3 glass rounded-xl text-blue-500"><i data-lucide="command"></i></button>
        <button onclick="logoutAdmin()" class="p-3 glass rounded-xl text-red-500"><i data-lucide="log-out"></i></button>
    ` : `
        <button onclick="document.getElementById('admin-auth').classList.remove('hidden')" class="btn-gold px-6 py-2.5 rounded-xl font-black text-xs uppercase flex items-center gap-2">
            <i data-lucide="lock"></i> Админ
        </button>
    `;
    lucide.createIcons();
}

function showPage(p) {
    document.getElementById('page-stats').classList.add('hidden');
    document.getElementById('page-admin').classList.add('hidden');
    if (p === 'stats') document.getElementById('page-stats').classList.remove('hidden');
    if (p === 'admin') document.getElementById('page-admin').classList.remove('hidden');
}

function showPopup({ title, text, icon, confirmText, onConfirm }) {
    const modal = document.getElementById('custom-modal');
    const titleEl = document.getElementById('modal-title');
    const textEl = document.getElementById('modal-text');
    const iconEl = document.getElementById('modal-icon');
    titleEl.innerText = title || '';
    textEl.innerHTML = text || '';
    iconEl.innerHTML = icon ? `<i data-lucide="${icon}" class="w-10 h-10 mx-auto"></i>` : '';
    document.getElementById('modal-actions').innerHTML = onConfirm ? `
        <button onclick="closePopup()" class="flex-1 py-4 bg-slate-800 rounded-2xl font-bold">Бас тарту</button>
        <button id="modal-confirm-btn" class="flex-1 py-4 btn-gold rounded-2xl font-bold">${confirmText || 'Растау'}</button>
    ` : `
        <button onclick="closePopup()" class="w-full py-4 btn-gold rounded-2xl font-bold">Жабу</button>
    `;
    modal.classList.remove('hidden');
    setTimeout(() => { modal.style.opacity = 1; }, 10);
    lucide.createIcons();
    if (onConfirm) {
        document.getElementById('modal-confirm-btn').onclick = async () => {
            await onConfirm();
            closePopup();
        };
    }
}
function closePopup() {
    const modal = document.getElementById('custom-modal');
    modal.style.opacity = 0;
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

window.onload = function() {
    if (localStorage.getItem('admin_logged') === 'true') {
        showPage('admin');
    } else {
        showPage('stats');
    }
    updateNav();
    init();
};

// Кнопкаға id беріңіз: <button id="save-btn" ...>
async function saveSomething(event) {
    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    const oldText = btn.innerText;
    btn.innerText = 'Жүктелуде...';
    try {
        // ...логика...
        btn.innerText = 'Сақталды!';
        setTimeout(() => { btn.innerText = oldText; btn.disabled = false; }, 1200);
    } catch {
        btn.innerText = 'Қате!';
        setTimeout(() => { btn.innerText = oldText; btn.disabled = false; }, 1200);
    }
}

// Мысалы, тапсырма сақтау функциясының басына немесе соңына қосыңыз:
async function saveTask(event) {
    if (event) event.preventDefault();
    const btn = document.getElementById('save-task-btn');
    btn.disabled = true;
    const oldText = btn.innerText;
    btn.innerText = 'Жүктелуде...';
    try {
        // ...тапсырманы сақтау логикасы...
        btn.innerText = 'Сақталды!';
        setTimeout(() => { btn.innerText = oldText; btn.disabled = false; }, 1200);
    } catch {
        btn.innerText = 'Қате!';
        setTimeout(() => { btn.innerText = oldText; btn.disabled = false; }, 1200);
    }
}

// Файлдың соңына қосыңыз:
document.addEventListener('touchstart', function preventZoom(e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', function preventDoubleTapZoom(e) {
    const now = new Date().getTime();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Тапсырма сақтағанда немесе кез келген жерде (мысалы, saveTask ішінде):
localStorage.setItem('scrollY', window.scrollY);

// window.onload ішінде (файлдың басында немесе соңында):
window.onload = function() {
    // ...бар код...
    const scrollY = localStorage.getItem('scrollY');
    if (scrollY) {
        setTimeout(() => window.scrollTo(0, parseInt(scrollY)), 100);
        localStorage.removeItem('scrollY');
    }
    // ...бар код...
};

async function registerPushToken(userId) {
    try {
        const token = await messaging.getToken({ vapidKey: 'YOUR_VAPID_KEY' });
        if (token) {
            await _supabase.from('users').update({ push_token: token }).eq('id', userId);
        }
    } catch (e) {
        console.log('FCM token error:', e);
    }
}

// Қолданушы кіргенде:
registerPushToken(currentUserId);
