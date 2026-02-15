// admin.js

function setActiveTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const tabOrder = ['users','tasks','levels','sobrashka','settings','history'];
    const idx = tabOrder.indexOf(tab);
    if (idx >= 0) document.querySelectorAll('.tab-btn')[idx].classList.add('active');
}

async function switchAdminTab(tab) {
    state.currentTab = tab;
    setActiveTab(tab);
    const box = document.getElementById('admin-content');
    box.innerHTML = '';
    if (tab === 'users') {
        const { data: users } = await _supabase.from('users').select('*');
        box.innerHTML = `
            <div class="glass p-4 md:p-6 rounded-2xl mb-6 flex flex-col gap-4">
                <label class="text-[10px] font-black text-blue-500 uppercase mb-3 block">Жаңа мүше қосу</label>
                <div class="flex flex-col md:flex-row gap-3 mb-2">
                    <input id="new-u-name" class="flex-1 bg-black/40 border border-white/5 rounded-2xl p-4 outline-none focus:border-blue-500" placeholder="Аты">
                    <button onclick="addUser()" class="btn-gold px-8 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2"><i data-lucide="plus"></i> Қосу</button>
                </div>
            </div>
            <div class="grid gap-4">
                ${users.map(u => `
                    <div class="glass p-4 md:p-6 rounded-2xl flex justify-between items-center group gap-4">
                        <div class="flex items-center gap-3 flex-1">
                            <span class="font-bold">${u.name}</span>
                            <span class="text-xs text-slate-500">(${u.score} ұпай)</span>
                            <input type="number" value="${u.score}" min="0" class="w-20 bg-black/20 border border-white/10 rounded-xl p-2" onchange="saveUserScore(${u.id}, this.value)">
                        </div>
                        <button onclick="confirmDeleteUser(${u.id},'${u.name}')" class="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white opacity-100 md:opacity-0 group-hover:opacity-100"><i data-lucide="trash-2"></i></button>
                    </div>
                `).join('')}
            </div>
        `;
        lucide.createIcons();
    }
    if (tab === 'tasks') {
        const { data: users } = await _supabase.from('users').select('*');
        box.innerHTML = users.map(u => {
            let tasks = [];
            try { tasks = JSON.parse(u.tasks || '[]'); } catch {}
            return `
                <div class="glass p-4 md:p-6 rounded-2xl mb-6 flex flex-col gap-4">
                    <div class="font-black mb-2">${u.name}</div>
                    <div class="space-y-2 mb-3">
                        ${tasks.length === 0 ? '<div class="text-slate-500 text-sm">Тапсырма жоқ</div>' : tasks.map((t, i) => `
                            <div class="flex items-center gap-3 bg-slate-800/50 rounded-xl p-3">
                                <span class="flex-1 break-all whitespace-normal text-base font-bold">${t.task}</span>
                                <button onclick="markTaskDone(${u.id},${i})" class="p-2 btn-gold rounded-xl text-black"><i data-lucide="check"></i></button>
                                <button onclick="deleteTask(${u.id},${i})" class="p-2 bg-red-500/10 rounded-xl text-red-500"><i data-lucide="trash-2"></i></button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="flex flex-col md:flex-row gap-3">
                        <input id="task-${u.id}" class="flex-1 bg-black/20 border border-white/10 rounded-xl p-3" placeholder="Жаңа тапсырма">
                        <input id="dl-${u.id}" type="date" class="flex-1 bg-black/20 border border-white/10 rounded-xl p-3">
                        <button onclick="assignTask(${u.id})" class="btn-gold px-5 py-3 rounded-xl font-black flex items-center gap-2"><i data-lucide="plus"></i> Қосу</button>
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    }
    if (tab === 'levels') {
        const { data: levels } = await _supabase.from('levels').select('*').order('min_score', { ascending: true });
        box.innerHTML = `
            <div class="glass p-4 md:p-6 rounded-2xl mb-6 flex flex-col gap-4">
                <label class="text-[10px] font-black text-blue-500 uppercase mb-3 block">Жаңа деңгей қосу</label>
                <div class="flex flex-col md:flex-row gap-3 mb-2">
                    <input id="new-l-name" class="flex-1 bg-black/40 border border-white/5 rounded-2xl p-4 outline-none focus:border-blue-500" placeholder="Аты (мыс: Бронза)">
                    <input id="new-l-score" type="number" class="w-24 bg-black/40 border border-white/5 rounded-2xl p-4 outline-none focus:border-blue-500" placeholder="Ұпай">
                    <input id="new-l-color" type="color" class="color-input" value="#cd7f32">
                    <button onclick="addLevel()" class="btn-gold px-8 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2"><i data-lucide="plus"></i></button>
                </div>
            </div>
            <div class="grid gap-4">
                ${levels.map(l => `
                    <div class="glass p-4 md:p-6 rounded-2xl flex justify-between items-center group gap-4">
                        <div class="flex items-center gap-3 flex-1">
                            <span class="font-bold" style="color:${l.color}">${l.name}</span>
                            <span class="text-xs text-slate-500">(${l.min_score} ұпай)</span>
                        </div>
                        <button onclick="deleteLevel(${l.id})" class="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white opacity-100 md:opacity-0 group-hover:opacity-100"><i data-lucide="trash-2"></i></button>
                    </div>
                `).join('')}
            </div>
        `;
        lucide.createIcons();
    }
    if (tab === 'sobrashka') {
        const { data: users } = await _supabase.from('users').select('*');
        box.innerHTML = `
            <div class="glass p-6 rounded-[2rem] mb-6">
                <div class="mb-3 text-yellow-400 font-black">Собрашка уақыты: ${state.settings.sobrashka_time || '—'}</div>
                <div class="grid gap-3">
                    ${users.map(u => `
                        <div class="flex flex-col md:flex-row md:items-center gap-2 bg-slate-800/50 rounded-xl p-3">
                            <span class="flex-1 font-bold">${u.name}</span>
                            <select id="sobr-select-${u.id}" class="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-base font-bold text-white">
                                <option value="">Таңдау</option>
                                <option value="present" ${u.sobrashka_status === 'present' ? 'selected' : ''}>Келді</option>
                                <option value="absent" ${u.sobrashka_status === 'absent' ? 'selected' : ''}>Келмеді</option>
                                <option value="active" ${u.sobrashka_status === 'active' ? 'selected' : ''}>Активно</option>
                            </select>
                            <button onclick="saveSobrashkaStatus(${u.id})" class="btn-gold px-4 py-2 rounded-xl font-black">Сақтау</button>
                            <div class="text-xs text-slate-400 mt-1 md:mt-0 md:ml-3">
                                ${u.sobrashka_status ? (
                                    u.sobrashka_status === 'present' ? 'Келді' :
                                    u.sobrashka_status === 'absent' ? 'Келмеді' :
                                    u.sobrashka_status === 'active' ? 'Активно' : 'Статус жоқ'
                                ) : 'Статус жоқ'}
                                ${u.sobrashka_status_at ? `<br><span class="text-[10px]">Сақталған: ${new Date(u.sobrashka_status_at).toLocaleString('kk-KZ')}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        lucide.createIcons();
    }
    if (tab === 'settings') {
        box.innerHTML += `
            <div class="glass p-6 rounded-[2rem] mb-6">
                <label class="text-[10px] font-black text-blue-500 uppercase mb-3 block">Собрашка уақыты</label>
                <input id="sobrashka-time" type="text" class="w-full bg-black/40 border border-white/5 rounded-2xl p-4 outline-none focus:border-blue-500 mb-3" value="${state.settings.sobrashka_time || ''}" placeholder="Күнді енгізіңіз (мыс: 01.06.2024, 18:00)">
                <button onclick="saveSobrashkaTime()" class="btn-gold w-full py-4 rounded-2xl font-black mt-2">Сақтау</button>
            </div>
            <div class="glass p-6 rounded-[2rem] mb-6">
                <label class="text-[10px] font-black text-blue-500 uppercase mb-3 block">Собрашкаға қатысу балдары</label>
                <div class="grid grid-cols-1 gap-3 mb-3">
                    <div>
                        <span class="text-xs">Келді</span>
                        <input id="points-present" type="number" class="w-full bg-black/40 border border-white/5 rounded-2xl p-3" value="${state.settings.points_active_attendance ?? 5}">
                    </div>
                    <div>
                        <span class="text-xs">Келмеді</span>
                        <input id="points-absent" type="number" class="w-full bg-black/40 border border-white/5 rounded-2xl p-3" value="${state.settings.points_absent ?? -10}">
                    </div>
                    <div>
                        <span class="text-xs">Активно</span>
                        <input id="points-active" type="number" class="w-full bg-black/40 border border-white/5 rounded-2xl p-3" value="${state.settings.points_sobrashka_active ?? 10}">
                    </div>
                </div>
                <button onclick="saveSobrashkaPoints()" class="btn-gold w-full py-4 rounded-2xl font-black mt-2">Сақтау</button>
            </div>
            <div class="glass p-6 rounded-[2rem] mb-6">
                <label class="text-[10px] font-black text-blue-500 uppercase mb-3 block">Балл параметрлері</label>
                <div class="grid grid-cols-2 gap-3 mb-3">
                    <div>
                        <span class="text-xs">Мерзімінен бұрын</span>
                        <input id="points-early" type="number" class="w-full bg-black/40 border border-white/5 rounded-2xl p-3" value="${state.settings.points_early ?? 10}">
                    </div>
                    <div>
                        <span class="text-xs">Уақытында</span>
                        <input id="points-on-time" type="number" class="w-full bg-black/40 border border-white/5 rounded-2xl p-3" value="${state.settings.points_on_time ?? 7}">
                    </div>
                    <div>
                        <span class="text-xs">Кешігіп</span>
                        <input id="points-late" type="number" class="w-full bg-black/40 border border-white/5 rounded-2xl p-3" value="${state.settings.points_late ?? 3}">
                    </div>
                    <div>
                        <span class="text-xs">Мүлдем орындамаған</span>
                        <input id="points-not-done" type="number" class="w-full bg-black/40 border border-white/5 rounded-2xl p-3" value="${state.settings.points_not_done ?? -5}">
                    </div>
                </div>
                <button onclick="savePointsSettings()" class="btn-gold w-full py-4 rounded-2xl font-black mt-2">Сақтау</button>
            </div>
            <div class="glass p-6 rounded-[2rem] mb-6">
                <label class="text-[10px] font-black text-blue-500 uppercase mb-3 block">Админ құпия сөзі</label>
                <input id="admin-password" type="text" class="w-full bg-black/40 border border-white/5 rounded-2xl p-4 outline-none focus:border-yellow-500 mb-3" value="${state.settings.admin_password || ''}" placeholder="Жаңа құпия сөз">
                <button onclick="saveAdminPassword()" class="btn-gold w-full py-4 rounded-2xl font-black mt-2">Сақтау</button>
            </div>
        `;
    }
    if (tab === 'history') {
        const { data: users } = await _supabase.from('users').select('*');
        box.innerHTML = users.map(u => {
            let history = [];
            try { history = JSON.parse(u.history || '[]'); } catch {}
            return `
                <div class="glass p-6 rounded-2xl mb-6">
                    <div class="font-black mb-2">${u.name}</div>
                    <div class="space-y-2">
                        ${history.length === 0 ? '<div class="text-slate-500 text-sm">Тарих жоқ</div>' : history.map((h, idx) => `
                            <div class="flex items-center gap-2 bg-slate-800/50 rounded-xl p-3">
                                <span class="flex-1">${h.task} <span class="text-xs text-slate-400">(${h.deadline})</span></span>
                                <span class="text-xs ${h.status === 'Орындалды' ? 'text-green-500' : 'text-red-500'}">${h.status}</span>
                                <span class="text-xs text-yellow-500">${h.addScore > 0 ? '+' : ''}${h.addScore}</span>
                                <span class="text-xs text-slate-400">${h.finished_at ? new Date(h.finished_at).toLocaleString('kk-KZ') : ''}</span>
                                <button onclick="deleteHistory(${u.id},${idx})" class="p-2 bg-red-500/10 rounded-xl text-red-500"><i data-lucide="trash-2"></i></button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }
}

async function assignTask(id) {
    const task = document.getElementById(`task-${id}`).value;
    const date = document.getElementById(`dl-${id}`).value;
    if (!task || !date) return;
    const deadline = date;
    const { data: user } = await _supabase.from('users').select('tasks').eq('id', id).single();
    let tasks = [];
    try { tasks = JSON.parse(user.tasks || '[]'); } catch {}
    tasks.push({ task, deadline, done: false, done_at: null });
    const { error } = await _supabase.from('users').update({ tasks: JSON.stringify(tasks) }).eq('id', id);
    if (error) {
        showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
    } else {
        switchAdminTab('tasks');
    }
}

async function markTaskDone(userId, taskIdx) {
    const { data: user } = await _supabase.from('users').select('tasks,history,score').eq('id', userId).single();
    const { data: settings } = await _supabase.from('settings').select('points_early, points_on_time, points_late, points_not_done').limit(1).single();

    let tasks = [];
    try { tasks = JSON.parse(user.tasks || '[]'); } catch {}
    let history = [];
    try { history = JSON.parse(user.history || '[]'); } catch {}

    const now = new Date();
    let task = tasks[taskIdx];
    task.done = true;
    task.done_at = now.toISOString();

    // Балл есептеу (база мәндерімен)
    const deadline = new Date(task.deadline);
    let delta = (now - deadline) / (1000 * 60 * 60 * 24); // күн айырмасы
    let addScore = 0;
    let status = "Орындалды";
    if (delta < 0) addScore = settings.points_early ?? 10;
    else if (delta <= 0.5) addScore = settings.points_on_time ?? 7;
    else if (delta <= 2) addScore = settings.points_late ?? 3;
    else { addScore = settings.points_not_done ?? -5; status = "Орындалмады"; }

    // Баллды жаңарту
    await _supabase.from('users').update({ score: user.score + addScore }).eq('id', userId);

    // Тапсырманы history-ге қосу
    history.push({
        task: task.task,
        deadline: task.deadline,
        status,
        addScore,
        finished_at: now.toISOString()
    });

    // Тапсырманы tasks массивінен алып тастау
    tasks.splice(taskIdx, 1);

    await _supabase.from('users').update({
        tasks: JSON.stringify(tasks),
        history: JSON.stringify(history)
    }).eq('id', userId);

    switchAdminTab('tasks');
}

async function deleteTask(userId, taskIdx) {
    const { data: user } = await _supabase.from('users').select('tasks').eq('id', userId).single();
    let tasks = [];
    try { tasks = JSON.parse(user.tasks || '[]'); } catch {}
    tasks.splice(taskIdx, 1);
    const { error } = await _supabase.from('users').update({ tasks: JSON.stringify(tasks) }).eq('id', userId);
    if (error) {
        showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
    } else {
        switchAdminTab('tasks');
    }
}

async function addLevel() {
    const name = document.getElementById('new-l-name').value;
    const min_score = parseInt(document.getElementById('new-l-score').value);
    const color = document.getElementById('new-l-color').value;
    if (!name || isNaN(min_score)) return;
    const { error } = await _supabase.from('levels').insert({ name, min_score, color });
    if (error) {
        showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
    } else {
        switchAdminTab('levels');
    }
}

async function deleteLevel(id) {
    showPopup({
        title: "Деңгейді өшіру",
        text: "Бұл деңгей барлық қолданушылардан өшеді. Растайсыз ба?",
        icon: "trash-2",
        confirmText: "Өшіру",
        onConfirm: async () => {
            const { error } = await _supabase.from('levels').delete().eq('id', id);
            if (error) {
                showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
            } else {
                switchAdminTab('levels');
            }
        }
    });
}

async function setAttendance(id, present) {
    // attendance-ті settings-те сақтаймыз
    let attendance = {};
    try { attendance = JSON.parse(state.settings.sobrashka_attendance || '{}'); } catch {}
    if (attendance[id]) return; // Бір рет қана басылады

    attendance[id] = present ? 'present' : 'absent';

    // Балл қосу/шегеру
    const { data: user } = await _supabase.from('users').select('score').eq('id', id).single();
    const { data: settings } = await _supabase.from('settings').select('points_active_attendance, points_absent, points_sobrashka_active').limit(1).single();
    let score = user.score;
    if (present) score += settings.points_active_attendance ?? 5;
    else score += settings.points_absent ?? -10;
    await _supabase.from('users').update({ score }).eq('id', id);

    // attendance-ті settings-ке сақтаймыз
    await _supabase.from('settings').update({ sobrashka_attendance: JSON.stringify(attendance) }).eq('id', 1);
    state.settings.sobrashka_attendance = JSON.stringify(attendance);
    switchAdminTab('sobrashka');
}

async function resetAttendance(id) {
    let attendance = {};
    try { attendance = JSON.parse(state.settings.sobrashka_attendance || '{}'); } catch {}
    const prev = attendance[id];
    if (!prev) return;

    // Баллды қайтару/шегеру
    const { data: user } = await _supabase.from('users').select('score').eq('id', id).single();
    const { data: settings } = await _supabase.from('settings').select('points_active_attendance, points_absent').limit(1).single();
    let score = user.score;
    // Егер бұрын статус болған болса, баллды қайтарып тастау
    if (prev === 'present') score -= settings.points_active_attendance ?? 5;
    if (prev === 'absent') score -= settings.points_absent ?? -10;
    // Жаңа статусқа балл қосу
    if (val === 'present') score += settings.points_active_attendance ?? 5;
    if (val === 'absent') score += settings.points_absent ?? -10;
    await _supabase.from('users').update({ score }).eq('id', id);

    // attendance-ті settings-те өшіреміз
    delete attendance[id];
    await _supabase.from('settings').update({ sobrashka_attendance: JSON.stringify(attendance) }).eq('id', 1);
    state.settings.sobrashka_attendance = JSON.stringify(attendance);
    switchAdminTab('sobrashka');
}

async function setActive(id, active) {
    await _supabase.from('users').update({ is_active: active }).eq('id', id);
    switchAdminTab('sobrashka');
}

async function checkAdminPass() {
    const pass = document.getElementById('admin-pass-input').value;
    const { data, error } = await _supabase.from('settings').select('admin_password').limit(1).single();
    if (error || !data) {
        showPopup({ title: "Қате", text: "Базадан құпия сөз табылмады!", icon: "alert-triangle" });
        return;
    }
    if (pass === data.admin_password) {
        localStorage.setItem('admin_logged', 'true');
        document.getElementById('admin-auth').classList.add('hidden');
        showPage('admin');
        switchAdminTab('users'); // По умолчанию мүшелер
        updateNav();
    } else {
        showPopup({ title: "Қате", text: "Құпия сөз дұрыс емес!", icon: "alert-triangle" });
    }
}

function logoutAdmin() {
    localStorage.removeItem('admin_logged');
    showPage('stats');
    updateNav();
}

async function saveSobrashkaTime() {
    const val = document.getElementById('sobrashka-time').value;
    // 'sobrashka_time' орнына 'meeting_date' деп жазыңыз
    const { error } = await _supabase.from('settings').update({ meeting_date: val }).eq('id', 1);

    if (error) {
        showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
    } else {
        showPopup({ title: "Дайын", text: "Собрашка уақыты сақталды", icon: "check" });
        await init(); // Мәліметтерді қайта жүктеп, state-ті жаңартады
        switchAdminTab('settings');
    }
}

async function savePointsActiveAttendance() {
    const val = parseInt(document.getElementById('points-active-attendance').value);
    await _supabase.from('settings').update({ points_active_attendance: val }).eq('id', 1);
    showPopup({ title: "Дайын", text: "Собрашка балы сақталды", icon: "check" });
    init();
}

async function savePointsSettings() {
    await _supabase.from('settings').update({
        points_early: parseInt(document.getElementById('points-early').value),
        points_on_time: parseInt(document.getElementById('points-on-time').value),
        points_late: parseInt(document.getElementById('points-late').value),
        points_not_done: parseInt(document.getElementById('points-not-done').value)
    }).eq('id', 1);
    showPopup({ title: "Дайын", text: "Балл параметрлері сақталды", icon: "check" });
    init();
}

async function addUser() {
    const name = document.getElementById('new-u-name').value;
    if (!name) return;
    await _supabase.from('users').insert({ name, score: 0 });
    document.getElementById('new-u-name').value = '';
    switchAdminTab('users');
}

function confirmDeleteUser(id, name) {
    showPopup({
        title: "Мүшені өшіру",
        text: `${name} қолданушысын өшіргіңіз келе ме?`,
        icon: "trash-2",
        confirmText: "Өшіру",
        onConfirm: async () => {
            await _supabase.from('users').delete().eq('id', id);
            switchAdminTab('users');
        }
    });
}

async function saveMeetingDate() {
    const input = document.getElementById('meeting-date-input');
    let newDate = input.value.trim();
    if (!newDate) newDate = "EMPTY";

    const { data, error } = await _supabase
        .from('settings')
        .update({ meeting_date: newDate })
        .eq('id', 1);

    if (error) {
        alert('Қате! Уақыт сақталмады.');
        console.log(error);
    } else {
        state.settings.meeting_date = newDate;
        renderStats();
        alert('Собрашка уақыты сақталды!');
    }
}

async function saveUserScore(id, score) {
    await _supabase.from('users').update({ score: parseInt(score) }).eq('id', id);
    switchAdminTab('users');
}

async function saveAdminPassword() {
    const val = document.getElementById('admin-password').value;
    if (!val) return showPopup({ title: "Қате", text: "Құпия сөз бос болмауы керек!", icon: "alert-triangle" });
    await _supabase.from('settings').update({ admin_password: val }).eq('id', 1);
    showPopup({ title: "Дайын", text: "Құпия сөз өзгертілді", icon: "check" });
    init();

}
window.onload = function() {
    if (localStorage.getItem('admin_logged') === 'true') {
        showPage('admin');
        switchAdminTab('users'); // По умолчанию мүшелер
    } else {
        showPage('stats');
    }
    updateNav();
    init();
};

function openSobrashkaTab() {
    const today = new Date().toISOString().slice(0, 10);
    const sobDate = (state.settings.sobrashka_time || '').slice(0, 10);
    if (!sobDate) {
        showPopup({ title: "Собрашка күні белгіленбеген!", text: "Алдымен баптаудан собрашка күнін қойыңыз.", icon: "alert-triangle" });
        return;
    }
    if (today !== sobDate) {
        showPopup({ title: "Собрашка бүгін емес!", text: `Собрашка күні: ${state.settings.sobrashka_time}`, icon: "calendar-x" });
        return;
    }
    switchAdminTab('sobrashka');
}

async function saveSobrashkaStatus(id) {
    const select = document.getElementById(`sobr-select-${id}`);
    const val = select.value;
    if (!val) {
        showPopup({ title: "Қате", text: "Статус таңдаңыз!", icon: "alert-triangle" });
        return;
    }
    // settings-ті база арқылы әр басқан сайын қайтадан аламыз!
    const { data: settings } = await _supabase.from('settings').select('points_active_attendance, points_absent, points_sobrashka_active').limit(1).single();
    const { data: user } = await _supabase.from('users').select('score').eq('id', id).single();
    let score = user.score;

    // Әр басқан сайын балл қосылады/шегеріледі (ескі баллды алып тастамаймыз!)
    if (val === 'present') score += settings.points_active_attendance ?? 5;
    if (val === 'absent') score += settings.points_absent ?? -10;
    if (val === 'active') score += settings.points_sobrashka_active ?? 10;

    await _supabase.from('users').update({
        score,
        sobrashka_status: val,
        sobrashka_status_at: new Date().toISOString()
    }).eq('id', id);

    switchAdminTab('sobrashka');
}

async function saveSobrashkaPoints() {
    const present = parseInt(document.getElementById('points-present').value);
    const absent = parseInt(document.getElementById('points-absent').value);
    const active = parseInt(document.getElementById('points-active').value);

    const { error } = await _supabase.from('settings').update({
        points_active_attendance: present,
        points_absent: absent,
        points_sobrashka_active: active
    }).eq('id', 1);

    if (error) {
        showPopup({ title: "Қате", text: error.message, icon: "alert-triangle" });
    } else {
        showPopup({ title: "Дайын", text: "Собрашка балдары сақталды", icon: "check" });
        await init(); // state.settings жаңарту үшін!
        switchAdminTab('settings'); // input-тар жаңару үшін!
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

async function updateMeetingDate(newDate) {
    const { error } = await _supabase
        .from('settings')
        .update({ meeting_date: newDate })
        .eq('id', 1); // settings кестесінде id=1
    if (!error) {
        state.settings.meeting_date = newDate;
        renderStats();
    } else {
        alert('Уақытты жаңарту мүмкін болмады!');
    }
}