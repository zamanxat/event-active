// Enactus Event — біріккен скрипт
const _URL = "https://gsqbinxeecrtkhazbels.supabase.co";
const _KEY = "sb_publishable_AxrDKmh2Np6DDcKfJitu4g_mHZPG48x";
const _supabase = supabase.createClient(_URL, _KEY);

let state = { users: [], levels: [], settings: {}, currentTab: 'users', sobrashkaOffDayEdit: false, sobrashkaSavedExpanded: false };
let sortOrder = 'desc';

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function toNum(val, def = 0) {
    const n = Number(val);
    return isNaN(n) ? def : n;
}

/** Ашық (орындалмаған) тапсырмалар саны */
function countOpenTasks(user) {
    let tasks = [];
    try {
        tasks = JSON.parse(user.tasks || '[]');
    } catch {
        tasks = [];
    }
    return tasks.filter((t) => !t.done).length;
}

/**
 * Жиналыс күні режимінде «Сақталғандар»: статус бар ЖӘНЕ сақтау уақытының
 * күнтізбелік күні = бүгін (локальді). meetingDayKey-пен салыстыру кейде UTC/уақыт
 * айырмасынан қате беретін еді.
 */
function isSobrashkaStatusRecordedToday(u) {
    const st = u.sobrashka_status;
    if (!st) return false;
    const atRaw = u.sobrashka_status_at ?? u.sobrashkaStatusAt;
    if (atRaw == null || atRaw === '') return false;
    const t = new Date(typeof atRaw === 'string' ? atRaw : String(atRaw)).getTime();
    if (isNaN(t)) return false;
    return localDayKeyFromMs(t) === localDayKeyNow();
}

/** Бүгінгі жиналыс күні үшін: браузер сессиясында сақталған ID (БД-да sobrashka_status_at болмаса да тізім дұрыс болуы үшін) */
function sobrashkaSessionSavedKey() {
    return `enactus_sobr_saved_${localDayKeyNow()}`;
}

function getSobrashkaSessionSavedIds() {
    try {
        const raw = sessionStorage.getItem(sobrashkaSessionSavedKey());
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
        return [];
    }
}

function rememberSobrashkaMeetingSaved(userId) {
    const sid = String(userId);
    const ids = getSobrashkaSessionSavedIds();
    if (ids.includes(sid)) return;
    ids.push(sid);
    try {
        sessionStorage.setItem(sobrashkaSessionSavedKey(), JSON.stringify(ids));
    } catch {
        /* ignore */
    }
}

/** «Сақталғандар» бөлімінде көрсету керек пе */
function isSobrashkaInSavedSectionToday(u) {
    return isSobrashkaStatusRecordedToday(u) || getSobrashkaSessionSavedIds().includes(String(u.id));
}

/** Жиналыс статусына балл дельтасы (prev → next, next бос болса тек алынады) */
function sobrashkaScoreDelta(prev, next, pts) {
    const p = pts || {};
    const ptPresent = toNum(p.points_active_attendance, 5);
    const ptAbsent = toNum(p.points_absent, -10);
    const ptActive = toNum(p.points_sobrashka_active, 10);
    const ptReason = toNum(p.points_sobrashka_reason, 0);
    let d = 0;
    if (prev === 'present') d -= ptPresent;
    else if (prev === 'absent') d -= ptAbsent;
    else if (prev === 'active') d -= ptActive;
    else if (prev === 'reason') d -= ptReason;
    if (next === 'present') d += ptPresent;
    else if (next === 'absent') d += ptAbsent;
    else if (next === 'active') d += ptActive;
    else if (next === 'reason') d += ptReason;
    return d;
}

/** YYYY-MM-DD тексеру (мерзім дұрыс күн болуы керек) */
function isValidTaskDeadlineDate(s) {
    if (!s || typeof s !== 'string') return false;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
    if (!m) return false;
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    if (mo < 0 || mo > 11 || d < 1 || d > 31) return false;
    const dt = new Date(y, mo, d);
    return dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d;
}

function parseDeadlineDaysDiff(deadlineStr, nowDate) {
    if (!deadlineStr) return 999;
    const parts = String(deadlineStr).trim().split(/[-/]/);
    if (parts.length < 3) return 999;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return 999;
    const deadline = new Date(y, m, d, 0, 0, 0);
    const completed = nowDate || new Date();
    const completedStart = new Date(completed.getFullYear(), completed.getMonth(), completed.getDate(), 0, 0, 0);
    return Math.round((completedStart - deadline) / (24 * 60 * 60 * 1000));
}

let _meetingCountdownInterval = null;

function parseMeetingDateMs(str) {
    if (!str || str === 'EMPTY') return null;
    const trimmed = String(str).trim();
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) return parsed;
    const m = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[,\s]+(\d{1,2})?:?(\d{2})?)?$/);
    if (m) {
        const d = parseInt(m[1], 10), mo = parseInt(m[2], 10) - 1, y = parseInt(m[3], 10);
        const hh = m[4] != null && m[4] !== '' ? parseInt(m[4], 10) : 0;
        const mm = m[5] != null ? parseInt(m[5], 10) : 0;
        const dt = new Date(y, mo, d, hh, mm, 0, 0);
        return isNaN(dt.getTime()) ? null : dt.getTime();
    }
    return null;
}

function localDayKeyFromMs(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localDayKeyNow() {
    return localDayKeyFromMs(Date.now());
}

function msToDatetimeLocalValue(ms) {
    if (ms == null || isNaN(ms)) return '';
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatMeetingReadable(ms) {
    try {
        return new Date(ms).toLocaleString('kk-KZ', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return new Date(ms).toLocaleString();
    }
}

function renderMeetingCountdown() {
    const root = document.getElementById('meeting-countdown');
    const hint = document.getElementById('meeting-date-hint');
    if (!root || !hint) return;
    const ms = parseMeetingDateMs(state.settings?.meeting_date);
    if (!ms) {
        root.innerHTML = '<span class="text-sm font-bold opacity-90">Күні белгіленбеген</span>';
        hint.textContent = '';
        return;
    }
    const now = Date.now();
    const diff = ms - now;
    hint.textContent = formatMeetingReadable(ms);
    if (diff <= 0) {
        root.innerHTML = '<span class="text-sm sm:text-base font-bold">Жиналыс уақыты өтті</span>';
        return;
    }
    const sec = Math.floor(diff / 1000);
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    const box = (n, label) => `
        <div class="countdown-cell">
            <div class="num text-lg sm:text-2xl font-mono">${n}</div>
            <div class="text-[9px] sm:text-[10px] font-semibold opacity-80 mt-0.5">${label}</div>
        </div>`;
    const dayRow = days > 0 ? `<div class="countdown-day-row countdown-cell py-2"><div class="num text-xl sm:text-2xl font-mono">${days}</div><div class="text-[10px] font-semibold opacity-80 mt-0.5">күн</div></div>` : '';
    root.innerHTML = `
        <div class="countdown-grid cols-3 w-full">
            ${dayRow}
            ${box(hours, 'сағ')}
            ${box(mins, 'мин')}
            ${box(String(secs).padStart(2, '0'), 'сек')}
        </div>`;
}

function startMeetingCountdownTick() {
    if (_meetingCountdownInterval) clearInterval(_meetingCountdownInterval);
    _meetingCountdownInterval = setInterval(() => {
        const stats = document.getElementById('page-stats');
        if (stats && !stats.classList.contains('hidden')) renderMeetingCountdown();
    }, 1000);
}

function restoreWindowScroll(y) {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.scrollTo(0, y);
        });
    });
}

/** Қолданба сияқты: бет пен скроллды жаңартқанда қалпына келтіру */
const LS_UI_PAGE = 'enactus_ui_page';
const LS_ADMIN_TAB = 'enactus_admin_tab';
const LS_SCROLL_STATS = 'enactus_scroll_stats';
const LS_SCROLL_ADMIN = 'enactus_scroll_admin';

function persistAppScrollPosition() {
    try {
        const admin = document.getElementById('page-admin');
        const isAdmin = admin && !admin.classList.contains('hidden');
        const y = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
        localStorage.setItem(isAdmin ? LS_SCROLL_ADMIN : LS_SCROLL_STATS, String(y));
    } catch {
        /* ignore */
    }
}

function restorePersistedScrollPosition() {
    try {
        const admin = document.getElementById('page-admin');
        const isAdmin = admin && !admin.classList.contains('hidden');
        const y = parseInt(localStorage.getItem(isAdmin ? LS_SCROLL_ADMIN : LS_SCROLL_STATS) || '0', 10);
        if (y < 8) return;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => window.scrollTo(0, y));
        });
    } catch {
        /* ignore */
    }
}

function persistUiPage(p) {
    try {
        localStorage.setItem(LS_UI_PAGE, p);
    } catch {
        /* ignore */
    }
}

function persistAdminTabName(tab) {
    try {
        localStorage.setItem(LS_ADMIN_TAB, tab);
    } catch {
        /* ignore */
    }
}

async function init() {
    const container = document.getElementById('leaderboard');
    if (container) container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full"></div></div>';
    try {
        const [usersRes, levelsRes, settingsRes] = await Promise.all([
            _supabase.from('users').select('*'),
            _supabase.from('levels').select('*').order('min_score', { ascending: true }),
            _supabase.from('settings').select('*').limit(1).maybeSingle()
        ]);
        state.users = usersRes.data || [];
        state.levels = levelsRes.data || [];
        state.settings = settingsRes.data || {};
    } catch (e) {
        if (container) container.innerHTML = `<div class="glass p-6 rounded-2xl text-center text-red-400"><p class="font-bold mb-2">Қате</p><p class="text-sm">${escapeHtml(String(e.message || e))}</p><button onclick="init()" class="btn-gold mt-4 px-6 py-2 rounded-xl">Қайталау</button></div>`;
        updateNav();
        return;
    }
    renderStats();
    renderMeetingCountdown();
    startMeetingCountdownTick();
    updateNav();
}

function renderStats() {
    const container = document.getElementById('leaderboard');

    const levels = state.levels || [];
    const maxLevelScore = levels.length ? Math.max(...levels.map(l => l.min_score)) : 0;

    let html = `
        <div class="flex items-center justify-between gap-3 mb-4 sm:mb-5 w-full min-w-0">
            <h2 class="text-[15px] sm:text-lg font-black text-white tracking-tight truncate pr-1">Рейтинг</h2>
            <button type="button" onclick="toggleSortOrder()"
                class="shrink-0 flex items-center gap-2 rounded-full bg-[#fbbf24] text-black pl-2.5 pr-3 sm:pl-3 sm:pr-4 py-2 text-[11px] sm:text-sm font-extrabold shadow-lg shadow-yellow-500/15 border border-yellow-300/90 active:scale-[0.97] transition-transform touch-target max-w-[55%] sm:max-w-none">
                <span class="flex items-center gap-0">
                    <i data-lucide="arrow-up" class="${sortOrder === 'asc' ? 'text-yellow-950' : 'text-yellow-900/30'} w-4 h-4 sm:w-[18px] sm:h-[18px]"></i>
                    <i data-lucide="arrow-down" class="${sortOrder === 'desc' ? 'text-yellow-950' : 'text-yellow-900/30'} w-4 h-4 sm:w-[18px] sm:h-[18px]"></i>
                </span>
                <span class="truncate">${sortOrder === 'desc' ? 'Көп → аз' : 'Аз → көп'}</span>
            </button>
        </div>
    `;

    let sortedUsers = [...(state.users || [])];
    sortedUsers.sort((a, b) => {
        const ca = countOpenTasks(a);
        const cb = countOpenTasks(b);
        if (cb !== ca) return cb - ca;
        return sortOrder === 'desc' ? (b.score || 0) - (a.score || 0) : (a.score || 0) - (b.score || 0);
    });

    sortedUsers.forEach((user, index) => {
        const myLevel = levels.length ? ([...levels].reverse().find(l => (user.score || 0) >= l.min_score) || levels[0]) : { name: '—', color: '#94a3b8', min_score: 0 };
        const nextLevel = levels.find(l => l.min_score > (user.score || 0));
        const myMin = myLevel.min_score || 0;
        let progress = nextLevel ? Math.min(100, Math.max(0, ((user.score || 0) - myMin) / (nextLevel.min_score - myMin) * 100)) : 100;
        const toNext = nextLevel ? nextLevel.min_score - (user.score || 0) : 0;
        const isTopLevel = levels.length && myMin === maxLevelScore;
        let tasks = [];
        try { tasks = JSON.parse(user.tasks || '[]'); } catch {}

        html += `
            <div class="glass p-4 sm:p-5 rounded-xl sm:rounded-2xl relative overflow-hidden mb-3 sm:mb-4 w-full min-w-0">
                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4 sm:mb-6">
                    <div class="flex items-start gap-3 min-w-0 flex-1">
                        <div class="w-11 h-11 sm:w-14 sm:h-14 bg-gradient-to-br from-yellow-400 to-yellow-700 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-lg sm:text-2xl text-yellow-900 border-2 border-yellow-500 shadow-lg flex-shrink-0">${index + 1}</div>
                        <div class="min-w-0 flex-1">
                            <h4 class="font-black text-base sm:text-xl text-white flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span class="break-words">${escapeHtml(user.name)}</span>
                                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0 ${user.is_active ? 'bg-green-500 shadow-[0_0_12px_#22c55e]' : 'bg-red-500'}"></span>
                                ${isTopLevel ? '<i data-lucide="award" class="w-6 h-6 sm:w-7 sm:h-7 text-yellow-400 flex-shrink-0"></i>' : ''}
                            </h4>
                            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                                <span class="text-[10px] font-black uppercase tracking-[0.12em] break-words" style="color:${myLevel.color}">${myLevel.name}</span>
                                ${nextLevel ? `<span class="text-[10px] sm:text-xs text-slate-400 leading-snug">Келесі деңгейге <b>${toNext}</b> ұпай қалды</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="text-left sm:text-right flex-shrink-0 self-start sm:self-auto pl-14 sm:pl-0">
                        <span class="text-2xl sm:text-3xl font-black text-blue-400 font-mono tabular-nums">${user.score}</span>
                        <p class="text-[9px] uppercase font-black opacity-30 tracking-widest">Ұпай</p>
                    </div>
                </div>
                ${tasks.length > 0 ? `
                <div class="bg-black/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-3 sm:mb-5 border border-white/5">
                    <div class="font-semibold mb-1.5 sm:mb-2 text-yellow-400 text-sm">Тапсырмалар</div>
                    <ul class="space-y-1.5 sm:space-y-2">
                        ${tasks.map(t => `
                            <li class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 bg-slate-800/50 rounded-lg sm:rounded-xl p-2 sm:p-3">
                                <span class="flex-1 text-sm sm:text-base">${escapeHtml(t.task)}</span>
                                <span class="text-[10px] sm:text-xs text-slate-400">${escapeHtml(t.deadline || '')}</span>
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
    container.innerHTML = html || '<p class="text-center text-slate-500 py-16 text-sm">Әзірге мүшелер жоқ</p>';
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
        <div class="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        <button onclick="showPage('stats'); init();" class="p-2 sm:p-2.5 glass rounded-xl text-blue-500 hover:bg-white/5 transition-colors touch-target" title="Статистика"><i data-lucide="bar-chart-3" class="w-[22px] h-[22px] sm:w-5 sm:h-5"></i></button>
        <button onclick="showPage('admin')" class="p-2 sm:p-2.5 glass rounded-xl text-blue-500 hover:bg-white/5 transition-colors touch-target" title="Басқару"><i data-lucide="command" class="w-[22px] h-[22px] sm:w-5 sm:h-5"></i></button>
        <button onclick="logoutAdmin()" class="p-2 sm:p-2.5 glass rounded-xl text-red-500 hover:bg-red-500/10 transition-colors touch-target" title="Шығу"><i data-lucide="log-out" class="w-[22px] h-[22px] sm:w-5 sm:h-5"></i></button>
        </div>
    ` : `
        <button onclick="document.getElementById('admin-auth').classList.remove('hidden')" class="btn-gold px-4 sm:px-5 py-2 rounded-xl font-semibold text-sm flex items-center gap-1.5 touch-target">
            <i data-lucide="lock" class="w-4 h-4"></i> Кіру
        </button>
    `;
    lucide.createIcons();
}

function showPage(p) {
    hideAllAdminFloatSaves();
    document.getElementById('page-stats').classList.add('hidden');
    document.getElementById('page-admin').classList.add('hidden');
    if (p === 'stats') {
        document.getElementById('page-stats').classList.remove('hidden');
        renderMeetingCountdown();
        startMeetingCountdownTick();
    }
    if (p === 'admin') document.getElementById('page-admin').classList.remove('hidden');
    persistUiPage(p);
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
        <button onclick="closePopup()" class="w-full sm:flex-1 py-3 bg-slate-800 rounded-xl font-medium text-sm min-h-[48px]">Жоқ</button>
        <button id="modal-confirm-btn" class="w-full sm:flex-1 py-3 btn-gold rounded-xl font-semibold text-sm min-h-[48px]">${confirmText || 'Иә'}</button>
    ` : `
        <button onclick="closePopup()" class="w-full py-3 btn-gold rounded-xl font-semibold text-sm min-h-[48px]">Жабу</button>
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
    if (!modal) return;
    modal.style.opacity = 0;
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
}

function initModalBackdrop() {
    const modal = document.getElementById('custom-modal');
    if (!modal) return;
    modal.onclick = (e) => { if (e.target === modal) closePopup(); };
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) closePopup();
    });
}

function closeAdminAuth() {
    document.getElementById('admin-auth')?.classList.add('hidden');
}

// ——— Admin ———
function setActiveTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const tabOrder = ['users','tasks','levels','sobrashka','settings','history'];
    const idx = tabOrder.indexOf(tab);
    if (idx >= 0) document.querySelectorAll('.tab-btn')[idx].classList.add('active');
}

function hideTasksBatchSaveFab() {
    const fab = document.getElementById('tasks-batch-save-fab');
    if (!fab) return;
    fab.classList.add('hidden');
    fab.disabled = false;
    fab.textContent = 'Сақтау';
}

function hideSobrashkaBatchFab() {
    const fab = document.getElementById('sobrashka-batch-save-fab');
    if (!fab) return;
    fab.classList.add('hidden');
    fab.disabled = false;
    fab.textContent = 'Жалпы сақтау';
}

function hideAllAdminFloatSaves() {
    hideTasksBatchSaveFab();
    hideSobrashkaBatchFab();
}

function updateSobrashkaBatchFabVisibility() {
    const fab = document.getElementById('sobrashka-batch-save-fab');
    if (!fab) return;
    if (state.currentTab !== 'sobrashka') {
        fab.classList.add('hidden');
        return;
    }
    const page = document.getElementById('page-admin');
    if (!page || page.classList.contains('hidden')) {
        fab.classList.add('hidden');
        return;
    }
    let dirty = false;
    document.querySelectorAll('.sobr-offday-select').forEach((sel) => {
        const init = sel.getAttribute('data-initial') || '';
        if ((sel.value || '') !== init) dirty = true;
    });
    const savedList = document.getElementById('sobrashka-saved-edit-list');
    if (savedList && !savedList.classList.contains('hidden')) {
        document.querySelectorAll('.sobr-saved-select').forEach((sel) => {
            const init = sel.getAttribute('data-initial') || '';
            if ((sel.value || '') !== init) dirty = true;
        });
    }
    fab.classList.toggle('hidden', !dirty);
}

function setSobrashkaOffDayEdit(v) {
    state.sobrashkaOffDayEdit = !!v;
    switchAdminTab('sobrashka');
}

function toggleSobrashkaSavedExpanded() {
    state.sobrashkaSavedExpanded = !state.sobrashkaSavedExpanded;
    switchAdminTab('sobrashka');
}

function updateTasksBatchFabVisibility() {
    const fab = document.getElementById('tasks-batch-save-fab');
    if (!fab) return;
    if (state.currentTab !== 'tasks') {
        fab.classList.add('hidden');
        return;
    }
    const page = document.getElementById('page-admin');
    if (!page || page.classList.contains('hidden')) {
        fab.classList.add('hidden');
        return;
    }
    const cards = document.querySelectorAll('#admin-content .task-user-card');
    let any = false;
    cards.forEach((card) => {
        const id = card.dataset.userId;
        if (id == null || id === '') return;
        const ti = document.getElementById(`task-${id}`);
        const di = document.getElementById(`dl-${id}`);
        const t = ti?.value?.trim() || '';
        const d = di?.value?.trim() || '';
        if (t || d) any = true;
    });
    fab.classList.toggle('hidden', !any);
}

function clearTaskDraftHighlights() {
    document.querySelectorAll('#admin-content .task-draft-input').forEach((el) => {
        el.classList.remove('border-red-500', 'ring-2', 'ring-red-500/50');
    });
}

async function switchAdminTab(tab) {
    const savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    hideAllAdminFloatSaves();
    if (tab !== 'sobrashka') {
        state.sobrashkaOffDayEdit = false;
        state.sobrashkaSavedExpanded = false;
    }
    state.currentTab = tab;
    setActiveTab(tab);
    const box = document.getElementById('admin-content');
    box.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full"></div></div>';
    try {
    if (tab === 'users') {
        const { data: users } = await _supabase.from('users').select('*');
        box.innerHTML = `
            <div class="glass p-3 sm:p-5 rounded-xl mb-4 sm:mb-5 flex flex-col gap-2">
                <div class="flex flex-col sm:flex-row gap-2">
                    <input id="new-u-name" class="flex-1 bg-black/30 border border-white/10 rounded-xl p-3 outline-none focus:border-yellow-500/50 min-h-[44px] text-sm" placeholder="Атын енгізіңіз" onkeydown="if(event.key==='Enter')addUser()">
                    <button onclick="addUser()" class="btn-gold px-5 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 touch-target text-sm"><i data-lucide="plus" class="w-4 h-4"></i> Қосу</button>
                </div>
            </div>
            <div class="grid gap-3 sm:gap-4">
                ${(users || []).map(u => `
                    <div class="glass p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                        <div class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <span class="font-bold truncate">${escapeHtml(u.name)}</span>
                            <span class="text-xs text-slate-500 flex-shrink-0">(${u.score ?? 0})</span>
                            <input type="number" data-user-id="${u.id}" value="${u.score ?? 0}" min="0" class="w-16 sm:w-20 bg-black/20 border border-white/10 rounded-lg p-2 min-h-[36px] text-sm" onchange="saveUserScore(${u.id}, this.value)">
                        </div>
                        <button data-id="${u.id}" data-name="${escapeAttr(u.name)}" onclick="confirmDeleteUser(this.dataset.id, this.dataset.name)" class="p-2.5 sm:p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white touch-target self-end sm:self-auto" title="Өшіру"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                `).join('')}
            </div>
        `;
        lucide.createIcons();
    }
    if (tab === 'tasks') {
        const { data: users } = await _supabase.from('users').select('*');
        const sortedTaskUsers = [...(users || [])].sort((a, b) => countOpenTasks(b) - countOpenTasks(a));
        box.innerHTML = sortedTaskUsers.map(u => {
            let tasks = [];
            try { tasks = JSON.parse(u.tasks || '[]'); } catch {}
            return `
                <div class="task-user-card glass p-3 sm:p-6 rounded-xl sm:rounded-2xl mb-4 sm:mb-6 flex flex-col gap-3" data-user-id="${u.id}" data-user-name="${escapeHtml(u.name)}">
                    <div class="font-black mb-1 sm:mb-2 text-base sm:text-lg">${escapeHtml(u.name)}</div>
                    <div class="space-y-2 mb-3">
                        ${tasks.length === 0 ? '<div class="text-slate-500 text-sm py-2">Тапсырма жоқ</div>' : tasks.map((t, i) => `
                            <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-slate-800/50 rounded-xl p-3">
                                <span class="flex-1 break-all whitespace-normal text-sm sm:text-base font-bold min-w-0">${escapeHtml(t.task)} <span class="text-xs text-slate-400 font-normal">(${escapeHtml(t.deadline || '')})</span></span>
                                <div class="grid grid-cols-3 gap-2 sm:flex sm:flex-row sm:gap-2 flex-shrink-0 task-actions w-full sm:w-auto">
                                    <button onclick="markTaskDone(${u.id},${i})" class="min-h-[44px] flex items-center justify-center p-2 sm:p-2.5 btn-gold rounded-xl text-black touch-target" title="Орындалды"><i data-lucide="check" class="w-4 h-4"></i></button>
                                    <button onclick="markTaskNotDone(${u.id},${i})" class="min-h-[44px] flex items-center justify-center p-2 sm:p-2.5 bg-orange-500/20 text-orange-400 rounded-xl hover:bg-orange-500/30 touch-target" title="Істелмеді"><i data-lucide="x-circle" class="w-4 h-4"></i></button>
                                    <button onclick="deleteTask(${u.id},${i})" class="min-h-[44px] flex items-center justify-center p-2 sm:p-2.5 bg-red-500/10 rounded-xl text-red-500 hover:bg-red-500/20 touch-target" title="Өшіру"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="flex flex-col gap-2">
                        <div class="flex flex-col sm:flex-row gap-2">
                            <input id="task-${u.id}" type="text" autocomplete="off" class="task-draft-input flex-1 bg-black/30 border border-white/10 rounded-xl p-3 min-h-[44px] text-sm" placeholder="Тапсырма мәтіні" oninput="updateTasksBatchFabVisibility()" onchange="updateTasksBatchFabVisibility()">
                            <input id="dl-${u.id}" type="date" class="task-draft-input flex-1 sm:max-w-[160px] bg-black/30 border border-white/10 rounded-xl p-3 min-h-[44px] text-sm" oninput="updateTasksBatchFabVisibility()" onchange="updateTasksBatchFabVisibility()">
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
        updateTasksBatchFabVisibility();
    }
    if (tab === 'levels') {
        const { data: levels } = await _supabase.from('levels').select('*').order('min_score', { ascending: true });
        const levelsList = levels || [];
        box.innerHTML = `
            <div class="glass p-3 sm:p-5 rounded-xl mb-4 sm:mb-5 flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
                <input id="new-l-name" class="flex-1 bg-black/30 border border-white/10 rounded-xl p-3 outline-none focus:border-yellow-500/50 min-h-[44px] text-sm" placeholder="Деңгей аты">
                <input id="new-l-score" type="number" class="sm:w-24 bg-black/30 border border-white/10 rounded-xl p-3 min-h-[44px] text-sm" placeholder="Ұпай">
                <input id="new-l-color" type="color" class="color-input h-11 w-14 sm:h-10 sm:w-12 rounded-lg flex-shrink-0" value="#cd7f32">
                <button onclick="addLevel()" class="btn-gold px-5 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 touch-target"><i data-lucide="plus" class="w-4 h-4"></i> Қосу</button>
            </div>
            <div class="grid gap-2 sm:gap-3">
                ${levelsList.length === 0 ? '<div class="glass p-5 rounded-xl text-slate-500 text-center text-sm">Деңгей жоқ</div>' : levelsList.map(l => `
                    <div class="glass p-3 sm:p-4 rounded-xl flex justify-between items-center gap-2 sm:gap-3 min-w-0">
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
                            <span class="font-bold break-words min-w-0" style="color:${escapeAttr(l.color || '#fff')}">${escapeHtml(l.name)}</span>
                            <span class="text-xs text-slate-500">(${l.min_score} ұпай)</span>
                        </div>
                        <button onclick="deleteLevel(${l.id})" class="p-2.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white touch-target" title="Өшіру"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                `).join('')}
            </div>
        `;
        lucide.createIcons();
    }
    if (tab === 'sobrashka') {
        const { data: users } = await _supabase.from('users').select('*');
        const list = users || [];
        const meetMs = parseMeetingDateMs(state.settings?.meeting_date);
        const meetLabel = meetMs ? formatMeetingReadable(meetMs) : '';
        const meetingDayKey = meetMs ? localDayKeyFromMs(meetMs) : '';
        const isMeetingDay = !!(meetMs && meetingDayKey === localDayKeyNow());

        const optHtml = (cur) => {
            const c = cur || '';
            return `
                <option value="">Таңдаңыз</option>
                <option value="present" ${c === 'present' ? 'selected' : ''}>Келді</option>
                <option value="absent" ${c === 'absent' ? 'selected' : ''}>Келмеді</option>
                <option value="active" ${c === 'active' ? 'selected' : ''}>Активно</option>
                <option value="reason" ${c === 'reason' ? 'selected' : ''}>Себепті</option>`;
        };

        if (!meetMs) {
            box.innerHTML = `
                <div class="glass p-5 rounded-xl text-center text-slate-400 text-sm">
                    Жиналыс күні бапталмаған.
                    <span class="text-xs opacity-70 mt-2 block">«Баптау» бөлімінде күн мен уақытты қойыңыз.</span>
                </div>`;
        } else if (!isMeetingDay && !state.sobrashkaOffDayEdit) {
            box.innerHTML = `
                <div class="glass p-5 sm:p-6 rounded-xl text-center">
                    <p class="text-slate-100 font-bold mb-2">Әлі жиналыс күні емес</p>
                    <p class="text-sm text-slate-400 mb-5">${escapeHtml(meetLabel)}</p>
                    <button type="button" onclick="setSobrashkaOffDayEdit(true)" class="btn-gold px-6 py-3 rounded-xl font-bold text-sm touch-target">Өзгерту</button>
                </div>`;
        } else if (!isMeetingDay && state.sobrashkaOffDayEdit) {
            const rows = [...list].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'kk'));
            box.innerHTML = `
                <div class="mb-3">
                    <button type="button" onclick="setSobrashkaOffDayEdit(false)" class="text-sm text-slate-400 hover:text-white underline underline-offset-2">← Артқа</button>
                </div>
                <div id="sobrashka-offday-list" class="glass p-3 sm:p-5 rounded-xl space-y-2">
                    ${rows.map((u) => `
                        <div class="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-800/40 rounded-xl p-3 min-w-0">
                            <span class="flex-1 font-medium text-sm min-w-0 break-words">${escapeHtml(u.name)}</span>
                            <select data-user-id="${u.id}" data-initial="${escapeAttr(u.sobrashka_status || '')}" class="sobr-offday-select w-full sm:flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-medium text-white min-h-[44px]" onchange="updateSobrashkaBatchFabVisibility()">
                                ${optHtml(u.sobrashka_status)}
                            </select>
                        </div>
                    `).join('')}
                </div>
                `;
        } else {
            const pending = list.filter((u) => !isSobrashkaInSavedSectionToday(u)).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'kk'));
            const saved = list.filter((u) => isSobrashkaInSavedSectionToday(u)).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'kk'));
            box.innerHTML = `
                <p class="text-xs font-extrabold text-amber-400 mb-3 tracking-wide">Бүгін — жиналыс күні</p>
                <p class="text-sm font-bold text-white mb-2">Қатысушылар</p>
                <div class="space-y-2 mb-6">
                    ${pending.length
                        ? pending.map((u) => `
                        <div class="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-800/40 rounded-xl p-3 min-w-0">
                            <span class="flex-1 font-medium text-sm min-w-0 break-words">${escapeHtml(u.name)}</span>
                            <select id="sobr-select-${u.id}" class="w-full sm:w-auto sm:min-w-[10rem] bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-medium text-white min-h-[44px]">
                                ${optHtml(u.sobrashka_status)}
                            </select>
                            <button type="button" onclick="saveSobrashkaStatus(${u.id})" class="btn-gold px-4 py-2.5 rounded-xl font-semibold text-sm touch-target shrink-0">Сақтау</button>
                        </div>
                    `).join('')
                        : '<div class="text-slate-500 text-sm py-3 glass rounded-xl px-4">Барлығы белгіленді немесе тізім бос</div>'}
                </div>
                <div class="glass p-4 rounded-xl border border-white/10">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <span class="font-bold text-white">Сақталғандар <span class="text-yellow-500">(${saved.length})</span></span>
                        ${saved.length
                            ? `<button type="button" onclick="toggleSobrashkaSavedExpanded()" class="text-sm btn-gold px-4 py-2 rounded-xl font-bold touch-target">${state.sobrashkaSavedExpanded ? 'Жабу' : 'Өзгерту'}</button>`
                            : ''}
                    </div>
                    <div id="sobrashka-saved-edit-list" class="mt-3 space-y-2 ${state.sobrashkaSavedExpanded ? '' : 'hidden'}">
                        ${saved.map((u) => `
                            <div class="flex flex-col sm:flex-row sm:items-center gap-2 bg-slate-800/50 rounded-xl p-3 min-w-0">
                                <span class="flex-1 font-medium text-sm min-w-0 break-words">${escapeHtml(u.name)}</span>
                                <select id="sobr-saved-select-${u.id}" data-user-id="${u.id}" data-initial="${escapeAttr(u.sobrashka_status || '')}" class="sobr-saved-select w-full sm:flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-medium text-white min-h-[44px]" onchange="updateSobrashkaBatchFabVisibility()">
                                    ${optHtml(u.sobrashka_status)}
                                </select>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
        }
        lucide.createIcons();
        updateSobrashkaBatchFabVisibility();
    }
    if (tab === 'settings') {
        const s = state.settings;
        const dtVal = escapeAttr(msToDatetimeLocalValue(parseMeetingDateMs(s.meeting_date)));
        box.innerHTML = `
            <div class="glass p-4 sm:p-5 rounded-xl mb-4">
                <p class="text-sm font-medium text-slate-300 mb-2">Жиналыс күні мен уақыты</p>
                <input id="sobrashka-time" type="datetime-local" class="w-full bg-black/30 border border-white/10 rounded-xl p-3 outline-none focus:border-yellow-500/50 min-h-[44px] text-sm mb-2" value="${dtVal}">
                <button onclick="saveSobrashkaTime()" class="btn-gold w-full py-3 rounded-xl font-semibold text-sm">Сақтау</button>
            </div>
            <div class="glass p-4 sm:p-5 rounded-xl mb-4">
                <p class="text-sm font-medium text-slate-300 mb-2">Жиналысқа қатысу балдары</p>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    <div><span class="text-xs text-slate-400 block mb-1">Келді</span><input id="points-present" type="number" class="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-sm min-h-[40px]" value="${state.settings.points_active_attendance ?? 5}"></div>
                    <div><span class="text-xs text-slate-400 block mb-1">Келмеді</span><input id="points-absent" type="number" class="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-sm min-h-[40px]" value="${state.settings.points_absent ?? -10}"></div>
                    <div><span class="text-xs text-slate-400 block mb-1">Активно</span><input id="points-active" type="number" class="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-sm min-h-[40px]" value="${state.settings.points_sobrashka_active ?? 10}"></div>
                    <div><span class="text-xs text-slate-400 block mb-1">Себепті</span><input id="points-reason" type="number" class="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-sm min-h-[40px]" value="${state.settings.points_sobrashka_reason ?? 0}"></div>
                </div>
                <button onclick="saveSobrashkaPoints()" class="btn-gold w-full py-3 rounded-xl font-semibold text-sm">Сақтау</button>
            </div>
            <div class="glass p-4 sm:p-5 rounded-xl mb-4">
                <p class="text-sm font-medium text-slate-300 mb-2">Тапсырма балдары</p>
                <div class="grid grid-cols-2 gap-2 mb-2">
                    <div><span class="text-xs text-slate-400 block mb-1">Мерзімінен бұрын</span><input id="points-early" type="number" class="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-sm min-h-[40px]" value="${state.settings.points_early ?? 10}"></div>
                    <div><span class="text-xs text-slate-400 block mb-1">Уақытында</span><input id="points-on-time" type="number" class="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-sm min-h-[40px]" value="${state.settings.points_on_time ?? 7}"></div>
                    <div><span class="text-xs text-slate-400 block mb-1">Кешігіп</span><input id="points-late" type="number" class="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-sm min-h-[40px]" value="${state.settings.points_late ?? 3}"></div>
                    <div><span class="text-xs text-slate-400 block mb-1">Істелмеді</span><input id="points-not-done" type="number" class="w-full bg-black/30 border border-white/10 rounded-lg p-2.5 text-sm min-h-[40px]" value="${state.settings.points_not_done ?? -5}"></div>
                </div>
                <button onclick="savePointsSettings()" class="btn-gold w-full py-3 rounded-xl font-semibold text-sm">Сақтау</button>
            </div>
            <div class="glass p-4 sm:p-5 rounded-xl mb-4">
                <p class="text-sm font-medium text-slate-300 mb-2">Құпия сөз</p>
                <input id="admin-password" type="text" class="w-full bg-black/30 border border-white/10 rounded-xl p-3 outline-none focus:border-yellow-500/50 min-h-[44px] text-sm mb-2" value="${state.settings.admin_password || ''}" placeholder="Жаңа құпия сөз">
                <button onclick="saveAdminPassword()" class="btn-gold w-full py-3 rounded-xl font-semibold text-sm">Сақтау</button>
            </div>
        `;
    }
    if (tab === 'history') {
        const { data: users } = await _supabase.from('users').select('*');
        box.innerHTML = (users || []).map(u => {
            let history = [];
            try { history = JSON.parse(u.history || '[]'); } catch {}
            return `
                <div class="glass p-3 sm:p-6 rounded-xl mb-4">
                    <div class="font-semibold mb-2 text-sm sm:text-base">${escapeHtml(u.name)}</div>
                    <div class="space-y-1.5">
                        ${history.length === 0 ? '<div class="text-slate-500 text-sm py-2">Тарих жоқ</div>' : history.map((h, idx) => `
                            <div class="flex items-center gap-2 bg-slate-800/50 rounded-xl p-3 flex-wrap">
                                <span class="flex-1 min-w-0">${escapeHtml(h.task)} <span class="text-xs text-slate-400">(${escapeHtml(h.deadline || '')})</span></span>
                                <span class="text-xs ${h.status === 'Орындалды' ? 'text-green-500' : 'text-red-500'}">${escapeHtml(h.status || '')}</span>
                                <span class="text-xs text-yellow-500">${(h.addScore > 0 ? '+' : '') + (h.addScore ?? 0)}</span>
                                <span class="text-xs text-slate-400">${h.finished_at ? new Date(h.finished_at).toLocaleString('kk-KZ') : ''}</span>
                                <button onclick="deleteHistory(${u.id},${idx})" class="p-2 bg-red-500/10 rounded-xl text-red-500" title="Өшіру"><i data-lucide="trash-2"></i></button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    }
    } catch (e) {
        box.innerHTML = `<div class="glass p-6 rounded-2xl text-center text-red-400"><p class="font-bold mb-2">Қате</p><p class="text-sm">${escapeHtml(e.message || 'Деректерді жүктеу мүмкін болмады')}</p><button onclick="switchAdminTab('${tab}')" class="btn-gold mt-4 px-6 py-2 rounded-xl">Қайталау</button></div>`;
    } finally {
        persistAdminTabName(tab);
        restoreWindowScroll(savedScrollY);
    }
}

/** Бірнеше мүшеге бір мезгілде жаңа тапсырма қосу (фиксед «Сақтау») */
async function saveAllPendingTasks() {
    const fab = document.getElementById('tasks-batch-save-fab');
    clearTaskDraftHighlights();

    const cards = document.querySelectorAll('#admin-content .task-user-card');
    const errors = [];
    /** @type {{ id: number, name: string, task: string, date: string, taskInput: HTMLInputElement|null, dateInput: HTMLInputElement|null }[]} */
    const toSave = [];

    cards.forEach((card) => {
        const rawId = card.dataset.userId;
        if (rawId == null || rawId === '') return;
        const id = rawId;
        const name = (card.dataset.userName || `ID ${rawId}`).trim() || `ID ${rawId}`;
        const taskInput = document.getElementById(`task-${rawId}`);
        const dateInput = document.getElementById(`dl-${rawId}`);
        const task = taskInput?.value?.trim() || '';
        const dateRaw = (dateInput?.value || '').trim();

        if (!task && !dateRaw) return;

        if (task && !dateRaw) {
            errors.push(`<b>${escapeHtml(name)}</b> — мерзім күнін таңдаңыз`);
            if (taskInput) taskInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/50');
            if (dateInput) dateInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/50');
            return;
        }
        if (!task && dateRaw) {
            errors.push(`<b>${escapeHtml(name)}</b> — тапсырма мәтінін жазыңыз`);
            if (taskInput) taskInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/50');
            if (dateInput) dateInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/50');
            return;
        }

        if (!isValidTaskDeadlineDate(dateRaw)) {
            errors.push(`<b>${escapeHtml(name)}</b> — күн форматы дұрыс емес немесе жарамсыз күн`);
            if (dateInput) dateInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/50');
            return;
        }

        if (task.length < 2) {
            errors.push(`<b>${escapeHtml(name)}</b> — тапсырма тым қысқа (кем дегенде 2 таңба)`);
            if (taskInput) taskInput.classList.add('border-red-500', 'ring-2', 'ring-red-500/50');
            return;
        }

        toSave.push({ id, name, task, date: dateRaw, taskInput, dateInput });
    });

    if (errors.length) {
        showPopup({
            title: 'Толтыру қателері',
            text: `<p class="text-left text-xs sm:text-sm mb-2 text-slate-300">Төмендегі жолдарды түзетіңіз:</p><ul class="text-left text-xs sm:text-sm space-y-2 list-disc pl-4 text-slate-200">${errors.map((e) => `<li>${e}</li>`).join('')}</ul>`,
            icon: 'alert-triangle',
        });
        return;
    }

    if (toSave.length === 0) {
        showPopup({ title: 'Ескерту', text: 'Сақтау үшін кем дегенде бір мүшеге тапсырма мен күнді толтырыңыз.', icon: 'info' });
        return;
    }

    if (fab) {
        fab.disabled = true;
        fab.textContent = 'Сақталуда…';
    }

    const saveErrors = [];
    let okCount = 0;
    try {
        for (const { id, name, task, date, taskInput, dateInput } of toSave) {
            try {
                const { data: user, error: userErr } = await _supabase.from('users').select('tasks').eq('id', id).single();
                if (userErr || !user) throw new Error(userErr?.message || 'Қолданушы табылмады');
                let tasks = [];
                try {
                    tasks = JSON.parse(user.tasks || '[]');
                } catch {
                    tasks = [];
                }
                tasks.push({ task, deadline: date, done: false, done_at: null });
                const { error } = await _supabase.from('users').update({ tasks: JSON.stringify(tasks) }).eq('id', id);
                if (error) throw new Error(error.message);
                if (taskInput) taskInput.value = '';
                if (dateInput) dateInput.value = '';
                okCount += 1;
            } catch (e) {
                const msg = e?.message || 'Белгісіз қате';
                saveErrors.push(`<b>${escapeHtml(name)}</b> — ${escapeHtml(msg)}`);
            }
        }

        updateTasksBatchFabVisibility();

        if (saveErrors.length && okCount === 0) {
            showPopup({
                title: 'Сақтау сәтсіз',
                text: `<ul class="text-left text-xs sm:text-sm space-y-2 list-disc pl-4">${saveErrors.map((e) => `<li>${e}</li>`).join('')}</ul>`,
                icon: 'alert-triangle',
            });
        } else {
            await switchAdminTab('tasks');
            if (saveErrors.length) {
                showPopup({
                    title: 'Ішінара сақталды',
                    text: `<p class="text-sm mb-2">${okCount} мүшеге қосылды. Келесі жолдарда қате болды:</p><ul class="text-left text-xs sm:text-sm space-y-2 list-disc pl-4">${saveErrors.map((e) => `<li>${e}</li>`).join('')}</ul>`,
                    icon: 'alert-triangle',
                });
            } else {
                showPopup({
                    title: 'Сақталды',
                    text: `${okCount} мүшеге тапсырма қосылды.`,
                    icon: 'check-circle',
                });
            }
        }
    } catch (e) {
        showPopup({ title: 'Қате', text: escapeHtml(e.message || 'Сақтау сәтсіз аяқталды'), icon: 'alert-triangle' });
    } finally {
        if (fab) {
            fab.disabled = false;
            fab.textContent = 'Сақтау';
            updateTasksBatchFabVisibility();
        }
    }
}

async function markTaskDone(userId, taskIdx) {
    const { data: user, error: userErr } = await _supabase.from('users').select('tasks,history,score').eq('id', userId).single();
    if (userErr || !user) {
        showPopup({ title: "Қате", text: "Қолданушы табылмады", icon: "alert-triangle" });
        return;
    }
    const { data: settings } = await _supabase.from('settings').select('points_early, points_on_time, points_late, points_not_done').limit(1).maybeSingle();
    let tasks = [];
    try { tasks = JSON.parse(user.tasks || '[]'); } catch {}
    let history = [];
    try { history = JSON.parse(user.history || '[]'); } catch {}

    const task = tasks[taskIdx];
    if (!task) {
        showPopup({ title: "Қате", text: "Тапсырма табылмады", icon: "alert-triangle" });
        return;
    }
    if (task.done) {
        showPopup({ title: "Қате", text: "Бұл тапсырма бұрын орындалған", icon: "alert-triangle" });
        return;
    }

    const now = new Date();
    const pts = settings || {};
    const daysDiff = parseDeadlineDaysDiff(task.deadline, now);
    let addScore = 0;
    let status = "Орындалды";
    if (daysDiff < 0) addScore = toNum(pts.points_early, 10);
    else if (daysDiff === 0) addScore = toNum(pts.points_on_time, 7);
    else addScore = toNum(pts.points_late, 3);

    const currentScore = toNum(user.score, 0);
    const newScore = currentScore + addScore;

    task.done = true;
    task.done_at = now.toISOString();
    history.push({ task: task.task, deadline: task.deadline, status, addScore, finished_at: now.toISOString() });
    tasks.splice(taskIdx, 1);

    const { error } = await _supabase.from('users').update({
        score: Math.round(newScore),
        tasks: JSON.stringify(tasks),
        history: JSON.stringify(history)
    }).eq('id', userId);

    if (error) {
        showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
        return;
    }
    switchAdminTab('tasks');
}

async function markTaskNotDone(userId, taskIdx) {
    const { data: user, error: userErr } = await _supabase.from('users').select('tasks,history,score').eq('id', userId).single();
    if (userErr || !user) {
        showPopup({ title: "Қате", text: "Қолданушы табылмады", icon: "alert-triangle" });
        return;
    }
    const { data: settings } = await _supabase.from('settings').select('points_not_done').limit(1).maybeSingle();
    let tasks = [];
    try { tasks = JSON.parse(user.tasks || '[]'); } catch {}
    let history = [];
    try { history = JSON.parse(user.history || '[]'); } catch {}

    const task = tasks[taskIdx];
    if (!task) {
        showPopup({ title: "Қате", text: "Тапсырма табылмады", icon: "alert-triangle" });
        return;
    }
    if (task.done) {
        showPopup({ title: "Қате", text: "Бұл тапсырма бұрын белгіленген", icon: "alert-triangle" });
        return;
    }

    const addScore = toNum(settings?.points_not_done, -5);
    const status = "Орындалмады";
    const now = new Date();
    const currentScore = toNum(user.score, 0);
    const newScore = currentScore + addScore;

    history.push({ task: task.task, deadline: task.deadline, status, addScore, finished_at: now.toISOString() });
    tasks.splice(taskIdx, 1);

    const { error } = await _supabase.from('users').update({
        score: Math.round(newScore),
        tasks: JSON.stringify(tasks),
        history: JSON.stringify(history)
    }).eq('id', userId);

    if (error) {
        showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
        return;
    }
    switchAdminTab('tasks');
}

async function deleteTask(userId, taskIdx) {
    const { data: user } = await _supabase.from('users').select('tasks').eq('id', userId).single();
    let tasks = [];
    try { tasks = JSON.parse(user?.tasks || '[]'); } catch {}
    const task = tasks[taskIdx];
    showPopup({
        title: "Тапсырманы өшіру",
        text: task ? `"${escapeHtml(task.task)}" өшіріледі. Жалғастырасыз ба?` : "Тапсырманы өшіргіңіз келе ме?",
        icon: "trash-2",
        confirmText: "Өшіру",
        onConfirm: async () => {
            tasks.splice(taskIdx, 1);
            const { error } = await _supabase.from('users').update({ tasks: JSON.stringify(tasks) }).eq('id', userId);
            if (error) showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
            else switchAdminTab('tasks');
        }
    });
}

async function addLevel() {
    const name = document.getElementById('new-l-name')?.value?.trim();
    const min_score = parseInt(document.getElementById('new-l-score')?.value, 10);
    const color = document.getElementById('new-l-color')?.value || '#cd7f32';
    if (!name || isNaN(min_score) || min_score < 0) {
        showPopup({ title: "Қате", text: "Аты мен ұпайды дұрыс енгізіңіз!", icon: "alert-triangle" });
        return;
    }
    const { error } = await _supabase.from('levels').insert({ name, min_score, color });
    if (error) showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
    else {
        document.getElementById('new-l-name').value = '';
        document.getElementById('new-l-score').value = '';
        switchAdminTab('levels');
    }
}

async function deleteLevel(id) {
    showPopup({
        title: "Өшіру",
        text: "Бұл деңгейді өшіргіңіз келе ме?",
        icon: "trash-2",
        confirmText: "Өшіру",
        onConfirm: async () => {
            const { error } = await _supabase.from('levels').delete().eq('id', id);
            if (error) showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
            else switchAdminTab('levels');
        }
    });
}

async function checkAdminPass() {
    updateAdminAuthInfo();
    const now = Date.now();
    let adminAttempts = parseInt(localStorage.getItem('admin_attempts') || '0');
    let adminBlockedUntil = parseInt(localStorage.getItem('admin_blocked_until') || '0');
    if (adminBlockedUntil && now < adminBlockedUntil) {
        const left = Math.ceil((adminBlockedUntil - now) / 1000);
        showPopup({ title: "Блок", text: `Қалған уақыт: ${left} сек`, icon: "lock" });
        return;
    }
    const pass = document.getElementById('admin-pass-input')?.value ?? '';
    const { data, error } = await _supabase.from('settings').select('admin_password').limit(1).maybeSingle();
    if (error || !data?.admin_password) {
        showPopup({ title: "Қате", text: "Базадан құпия сөз табылмады!", icon: "alert-triangle" });
        return;
    }
    if (pass === data.admin_password) {
        localStorage.setItem('admin_attempts', '0');
        localStorage.setItem('admin_blocked_until', '0');
        localStorage.setItem('admin_logged', 'true');
        document.getElementById('admin-auth').classList.add('hidden');
        showPage('admin');
        updateNav();
        await init();
        await switchAdminTab(localStorage.getItem(LS_ADMIN_TAB) || 'users');
        restorePersistedScrollPosition();
    } else {
        adminAttempts++;
        localStorage.setItem('admin_attempts', adminAttempts);
        const left = 3 - adminAttempts;
        if (adminAttempts >= 3) {
            adminBlockedUntil = now + 60 * 1000;
            localStorage.setItem('admin_blocked_until', adminBlockedUntil);
            showPopup({ title: "Блок", text: "3 рет қате. 1 минут күтеңіз.", icon: "lock" });
        } else {
            showPopup({ title: "Қате", text: `Құпия сөз қате. Қалған: ${left} рет`, icon: "alert-triangle" });
        }
        updateAdminAuthInfo();
    }
}

function logoutAdmin() {
    localStorage.removeItem('admin_logged');
    showPage('stats');
    updateNav();
}

async function saveSobrashkaTime() {
    const raw = document.getElementById('sobrashka-time')?.value?.trim();
    if (!raw) {
        showPopup({ title: "Қате", text: "Күн мен уақытты таңдаңыз", icon: "alert-triangle" });
        return;
    }
    const d = new Date(raw);
    if (isNaN(d.getTime())) {
        showPopup({ title: "Қате", text: "Уақыт дұрыс емес", icon: "alert-triangle" });
        return;
    }
    const iso = d.toISOString();
    const { error } = await _supabase.from('settings').update({ meeting_date: iso }).eq('id', 1);
    if (error) showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
    else {
        state.settings.meeting_date = iso;
        renderMeetingCountdown();
        showPopup({ title: "Сақталды", text: "Жиналыс уақыты жаңартылды", icon: "check" });
        await init();
        switchAdminTab('settings');
    }
}

async function savePointsSettings() {
    const early = parseInt(document.getElementById('points-early')?.value, 10);
    const onTime = parseInt(document.getElementById('points-on-time')?.value, 10);
    const late = parseInt(document.getElementById('points-late')?.value, 10);
    const notDone = parseInt(document.getElementById('points-not-done')?.value, 10);
    if ([early, onTime, late, notDone].some(v => isNaN(v))) {
        showPopup({ title: "Қате", text: "Барлық баллдарды дұрыс енгізіңіз!", icon: "alert-triangle" });
        return;
    }
    const { error } = await _supabase.from('settings').update({
        points_early: early,
        points_on_time: onTime,
        points_late: late,
        points_not_done: notDone
    }).eq('id', 1);
    if (error) showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
    else {
        showPopup({ title: "Сақталды", text: "Тапсырма балдары жаңартылды", icon: "check" });
        init();
    }
}

async function addUser() {
    const input = document.getElementById('new-u-name');
    const name = input?.value?.trim();
    if (!name) {
        showPopup({ title: "Қате", text: "Атын енгізіңіз", icon: "alert-triangle" });
        return;
    }
    const { error } = await _supabase.from('users').insert({ name, score: 0 });
    if (error) showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
    else {
        if (input) input.value = '';
        switchAdminTab('users');
    }
}

function confirmDeleteUser(id, name) {
    showPopup({
        title: "Өшіру",
        text: `${name || 'Бұл мүшені'} өшіргіңіз келе ме?`,
        icon: "trash-2",
        confirmText: "Өшіру",
        onConfirm: async () => {
            const { error } = await _supabase.from('users').delete().eq('id', id);
            if (error) showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
            else switchAdminTab('users');
        }
    });
}

async function saveUserScore(id, score) {
    const val = parseInt(score, 10);
    const input = document.querySelector(`#admin-content input[data-user-id="${id}"]`);
    const prev = state.users.find(u => String(u.id) === String(id))?.score ?? 0;
    if (isNaN(val) || val < 0) {
        showPopup({ title: "Қате", text: "Ұпай дұрыс емес!", icon: "alert-triangle" });
        if (input) input.value = prev;
        return;
    }
    const { error } = await _supabase.from('users').update({ score: val }).eq('id', id);
    if (error) {
        showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
        if (input) input.value = prev;
        return;
    }
    const u = state.users.find(x => String(x.id) === String(id));
    if (u) u.score = val;
    renderStats();
    if (input) {
        input.classList.add('ring-2', 'ring-green-500/60');
        setTimeout(() => input.classList.remove('ring-2', 'ring-green-500/60'), 600);
    }
}

async function saveAdminPassword() {
    const val = document.getElementById('admin-password')?.value?.trim();
    if (!val) return showPopup({ title: "Қате", text: "Құпия сөзді енгізіңіз", icon: "alert-triangle" });
    const { error } = await _supabase.from('settings').update({ admin_password: val }).eq('id', 1);
    if (error) showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
    else {
        showPopup({ title: "Сақталды", text: "Құпия сөз өзгертілді", icon: "check" });
        init();
    }
}

async function saveSobrashkaStatus(id) {
    const select = document.getElementById(`sobr-select-${id}`);
    const val = select?.value;
    if (!val) {
        showPopup({ title: "Қате", text: "Статус таңдаңыз!", icon: "alert-triangle" });
        return;
    }
    const { data: settings } = await _supabase.from('settings').select('points_active_attendance, points_absent, points_sobrashka_active, points_sobrashka_reason').limit(1).maybeSingle();
    const { data: user } = await _supabase.from('users').select('score, sobrashka_status, sobrashka_status_at').eq('id', id).single();
    if (!user) {
        showPopup({ title: "Қате", text: "Қолданушы табылмады", icon: "alert-triangle" });
        return;
    }
    const prev = user.sobrashka_status || '';
    const meetMs = parseMeetingDateMs(state.settings?.meeting_date);
    const mKey = meetMs ? localDayKeyFromMs(meetMs) : '';
    const isMeetingDay = !!(mKey && mKey === localDayKeyNow());

    if (val === prev) {
        if (isMeetingDay && mKey && prev && !isSobrashkaInSavedSectionToday(user)) {
            const { error } = await _supabase.from('users').update({ sobrashka_status_at: new Date().toISOString() }).eq('id', id);
            if (error) showPopup({ title: 'Қате', text: error.message, icon: 'alert-triangle' });
            else {
                rememberSobrashkaMeetingSaved(id);
                await init();
                await switchAdminTab('sobrashka');
            }
        }
        return;
    }

    const pts = settings || {};
    const delta = sobrashkaScoreDelta(prev, val, pts);
    const newScore = Math.round(toNum(user.score, 0) + delta);

    const { error } = await _supabase.from('users').update({
        score: newScore,
        sobrashka_status: val,
        sobrashka_status_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
    else {
        if (isMeetingDay) rememberSobrashkaMeetingSaved(id);
        await init();
        await switchAdminTab('sobrashka');
    }
}

async function saveSobrashkaBatchFabClick() {
    if (document.getElementById('sobrashka-offday-list')) {
        await saveSobrashkaBatchOffDay();
        return;
    }
    const savedPanel = document.getElementById('sobrashka-saved-edit-list');
    if (savedPanel && !savedPanel.classList.contains('hidden')) {
        await saveSobrashkaBatchSavedSection();
    }
}

async function saveSobrashkaBatchOffDay() {
    const fab = document.getElementById('sobrashka-batch-save-fab');
    const { data: settings } = await _supabase.from('settings').select('points_active_attendance, points_absent, points_sobrashka_active, points_sobrashka_reason').limit(1).maybeSingle();
    const pts = settings || {};
    const selects = document.querySelectorAll('#sobrashka-offday-list .sobr-offday-select');
    const updates = [];
    selects.forEach((sel) => {
        const id = sel.dataset.userId;
        const initial = sel.getAttribute('data-initial') || '';
        const val = sel.value || '';
        if (val === initial) return;
        updates.push({ id, val, initial });
    });
    if (!updates.length) return;
    if (fab) {
        fab.disabled = true;
        fab.textContent = 'Сақталуда…';
    }
    try {
        for (const { id, val } of updates) {
            const { data: user } = await _supabase.from('users').select('score, sobrashka_status').eq('id', id).single();
            if (!user) continue;
            const prev = user.sobrashka_status || '';
            const delta = sobrashkaScoreDelta(prev, val, pts);
            const newScore = Math.round(toNum(user.score, 0) + delta);
            const payload = val
                ? { score: newScore, sobrashka_status: val, sobrashka_status_at: new Date().toISOString() }
                : { score: newScore, sobrashka_status: null, sobrashka_status_at: null };
            const { error } = await _supabase.from('users').update(payload).eq('id', id);
            if (error) throw new Error(error.message);
        }
        await init();
        switchAdminTab('sobrashka');
        showPopup({ title: 'Сақталды', text: `${updates.length} жазба жаңартылды`, icon: 'check-circle' });
    } catch (e) {
        showPopup({ title: 'Қате', text: escapeHtml(e.message || 'Қате'), icon: 'alert-triangle' });
    } finally {
        if (fab) {
            fab.disabled = false;
            fab.textContent = 'Жалпы сақтау';
            updateSobrashkaBatchFabVisibility();
        }
    }
}

async function saveSobrashkaBatchSavedSection() {
    const fab = document.getElementById('sobrashka-batch-save-fab');
    const { data: settings } = await _supabase.from('settings').select('points_active_attendance, points_absent, points_sobrashka_active, points_sobrashka_reason').limit(1).maybeSingle();
    const pts = settings || {};
    const selects = document.querySelectorAll('#sobrashka-saved-edit-list .sobr-saved-select');
    const updates = [];
    selects.forEach((sel) => {
        const id = sel.dataset.userId;
        const initial = sel.getAttribute('data-initial') || '';
        const val = sel.value || '';
        if (val === initial) return;
        updates.push({ id, val, initial });
    });
    if (!updates.length) return;
    if (fab) {
        fab.disabled = true;
        fab.textContent = 'Сақталуда…';
    }
    try {
        for (const { id, val } of updates) {
            const { data: user } = await _supabase.from('users').select('score, sobrashka_status').eq('id', id).single();
            if (!user) continue;
            const prev = user.sobrashka_status || '';
            const delta = sobrashkaScoreDelta(prev, val, pts);
            const newScore = Math.round(toNum(user.score, 0) + delta);
            const payload = val
                ? { score: newScore, sobrashka_status: val, sobrashka_status_at: new Date().toISOString() }
                : { score: newScore, sobrashka_status: null, sobrashka_status_at: null };
            const { error } = await _supabase.from('users').update(payload).eq('id', id);
            if (error) throw new Error(error.message);
        }
        await init();
        switchAdminTab('sobrashka');
        showPopup({ title: 'Сақталды', text: `${updates.length} жазба жаңартылды`, icon: 'check-circle' });
    } catch (e) {
        showPopup({ title: 'Қате', text: escapeHtml(e.message || 'Қате'), icon: 'alert-triangle' });
    } finally {
        if (fab) {
            fab.disabled = false;
            fab.textContent = 'Жалпы сақтау';
            updateSobrashkaBatchFabVisibility();
        }
    }
}

async function saveSobrashkaPoints() {
    const present = parseInt(document.getElementById('points-present')?.value, 10);
    const absent = parseInt(document.getElementById('points-absent')?.value, 10);
    const active = parseInt(document.getElementById('points-active')?.value, 10);
    const reason = parseInt(document.getElementById('points-reason')?.value, 10);
    if ([present, absent, active, reason].some(v => isNaN(v))) {
        showPopup({ title: "Қате", text: "Барлық баллдарды дұрыс енгізіңіз!", icon: "alert-triangle" });
        return;
    }
    const { error } = await _supabase.from('settings').update({
        points_active_attendance: present,
        points_absent: absent,
        points_sobrashka_active: active,
        points_sobrashka_reason: reason
    }).eq('id', 1);

    if (error) showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
    else {
        showPopup({ title: "Сақталды", text: "Жиналыс балдары жаңартылды", icon: "check" });
        await init();
        switchAdminTab('settings');
    }
}

async function deleteHistory(userId, idx) {
    const { data: user } = await _supabase.from('users').select('history').eq('id', userId).single();
    let history = [];
    try { history = JSON.parse(user.history || '[]'); } catch {}
    history.splice(idx, 1);
    await _supabase.from('users').update({ history: JSON.stringify(history) }).eq('id', userId);
    switchAdminTab('history');
}

function openSobrashkaTab() {
    showPage('admin');
    switchAdminTab('sobrashka');
}

function updateAdminAuthInfo() {
    const now = Date.now();
    let adminAttempts = parseInt(localStorage.getItem('admin_attempts') || '0');
    let adminBlockedUntil = parseInt(localStorage.getItem('admin_blocked_until') || '0');
    const leftAttempts = Math.max(0, 3 - adminAttempts);
    const leftSeconds = adminBlockedUntil && now < adminBlockedUntil ? Math.ceil((adminBlockedUntil - now) / 1000) : 0;
    const infoEl = document.getElementById('admin-auth-info');
    if (!infoEl) return;
    infoEl.innerHTML = `
        <div class="text-xs text-slate-400 mt-2">
            Қалған: <span class="font-medium text-yellow-400">${leftAttempts}</span> рет<br>
            ${leftSeconds > 0 ? `Блок: <span class="font-medium text-red-500">${leftSeconds} сек</span>` : ''}
        </div>
    `;
}

document.addEventListener('touchstart', function preventPinchZoom(e) {
    if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', function preventDoubleTapZoom(e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 280) e.preventDefault();
    lastTouchEnd = now;
}, { passive: false });

/* iOS Safari: pinch */
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

let _scrollPersistTimer = null;
window.addEventListener(
    'scroll',
    () => {
        clearTimeout(_scrollPersistTimer);
        _scrollPersistTimer = setTimeout(persistAppScrollPosition, 200);
    },
    { passive: true },
);
window.addEventListener('pagehide', persistAppScrollPosition);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistAppScrollPosition();
});

window.addEventListener('load', () => {
    (async () => {
        initModalBackdrop();
        const logged = localStorage.getItem('admin_logged') === 'true';
        if (logged) {
            showPage('admin');
        } else {
            const saved = localStorage.getItem(LS_UI_PAGE);
            showPage(saved === 'admin' ? 'stats' : saved || 'stats');
        }
        updateNav();
        await init();
        if (logged) {
            await switchAdminTab(localStorage.getItem(LS_ADMIN_TAB) || 'users');
        }
        restorePersistedScrollPosition();

        const adminAuth = document.getElementById('admin-auth');
        if (adminAuth) adminAuth.addEventListener('transitionend', updateAdminAuthInfo);
        const adminPassInput = document.getElementById('admin-pass-input');
        if (adminPassInput) adminPassInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') checkAdminPass(); });
    })();
});
