// Habit Tracker 로직 (app.js)

// --- 전역 변수 및 상태 관리 ---
let currentUser = null;
let currentUserKey = null;
let habits = [];
let habitLogs = {}; // 날짜별 습관 수행 상태 {'YYYY-MM-DD': { habitId: 'status' }} 'status': 'completed', 'skipped', 'postponed'
let selectedDate = new Date();

const icons = {
    '운동': 'ph-person-simple-run',
    '공부': 'ph-book-open',
    '독서': 'ph-books',
    '건강': 'ph-heartbeat',
    '기타': 'ph-star'
};

// --- DOM 요소 ---
const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');
const loginForm = document.getElementById('login-form');
const nicknameInput = document.getElementById('nickname');
const passwordInput = document.getElementById('password');
const displayNameSpan = document.getElementById('display-name');
const logoutBtn = document.getElementById('logout-btn');

const bottomNavItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

const addHabitBtn = document.getElementById('add-habit-btn');
const habitModal = document.getElementById('habit-modal');
const closeModalBtn = document.querySelector('.close-modal-btn');
const habitForm = document.getElementById('habit-form');
const habitListEl = document.getElementById('habit-list');
const modalTitle = document.getElementById('modal-title');
const editHabitIdInput = document.getElementById('edit-habit-id');
const modalDeleteBtn = document.getElementById('modal-delete-btn');

const todayProgressText = document.getElementById('today-progress-text');
const todayProgressPercentage = document.getElementById('today-progress-percentage');
const todayProgressCircle = document.getElementById('today-progress-circle');
const currentDateEl = document.getElementById('current-date');
const prevDateBtn = document.getElementById('prev-date-btn');
const nextDateBtn = document.getElementById('next-date-btn');
const todayBtn = document.getElementById('today-btn');

// --- 초기화 ---
function init() {
    loadData();
    if (currentUserKey) {
        showMainView();
        renderDashboard();
        renderStats();
    } else {
        showLoginView();
    }
    setupEventListeners();
    
    // 알림 권한 요청
    if ("Notification" in window) {
        Notification.requestPermission();
    }
    
    // 1분마다 알림 체크
    setInterval(checkNotifications, 60000);
}

// --- 이벤트 리스너 설정 ---
function setupEventListeners() {
    // 로그인
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const nickname = nicknameInput.value.trim();
        const password = passwordInput.value;
        if (nickname && password) {
            currentUser = nickname;
            currentUserKey = `${nickname}_${password}`;
            
            // 데이터 로드
            loadData();
            // 로드된 후 저장(새로운 유저일 경우 생성)
            saveData();
            
            showMainView();
            renderDashboard();
            if(document.getElementById('tab-stats').classList.contains('active')) {
                renderStats();
            }
        }
    });

    // 로그아웃
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('currentUserKey');
        localStorage.removeItem('currentUserName');
        currentUser = null;
        currentUserKey = null;
        habits = [];
        habitLogs = {};
        nicknameInput.value = '';
        passwordInput.value = '';
        showLoginView();
    });

    // 탭 전환
    bottomNavItems.forEach(item => {
        item.addEventListener('click', () => {
            bottomNavItems.forEach(nav => nav.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.add('hidden'));
            tabContents.forEach(tab => tab.classList.remove('active'));
            
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('active');
            
            if(targetId === 'tab-stats') {
                renderStats();
            }
        });
    });

    // 날짜 이동
    if (prevDateBtn) {
        prevDateBtn.addEventListener('click', () => {
            selectedDate.setDate(selectedDate.getDate() - 1);
            renderDashboard();
            if(document.getElementById('tab-stats').classList.contains('active')) {
                renderStats();
            }
        });
        nextDateBtn.addEventListener('click', () => {
            selectedDate.setDate(selectedDate.getDate() + 1);
            renderDashboard();
            if(document.getElementById('tab-stats').classList.contains('active')) {
                renderStats();
            }
        });
        todayBtn.addEventListener('click', () => {
            selectedDate = new Date();
            renderDashboard();
            if(document.getElementById('tab-stats').classList.contains('active')) {
                renderStats();
            }
        });
    }

    // 습관 모달 제어
    addHabitBtn.addEventListener('click', () => {
        modalTitle.textContent = '새로운 습관 만들기';
        editHabitIdInput.value = '';
        habitForm.reset();
        document.querySelectorAll('input[name="days"]').forEach(cb => cb.checked = true);
        modalDeleteBtn.classList.add('hidden');
        habitModal.classList.remove('hidden');
    });
    
    closeModalBtn.addEventListener('click', () => habitModal.classList.add('hidden'));
    
    // 습관 폼 제출
    habitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('habit-name').value;
        const category = document.querySelector('input[name="category"]:checked').value;
        const days = Array.from(document.querySelectorAll('input[name="days"]:checked')).map(cb => parseInt(cb.value));
        const time = document.getElementById('habit-time').value;
        const habitId = editHabitIdInput.value;

        const newHabit = {
            id: habitId || Date.now().toString(),
            name,
            category,
            days,
            time
        };

        if (habitId) {
            const index = habits.findIndex(h => h.id === habitId);
            if (index !== -1) {
                newHabit.createdAt = habits[index].createdAt;
                habits[index] = newHabit;
            }
        } else {
            newHabit.createdAt = new Date().toISOString();
            habits.push(newHabit);
        }

        saveData();
        habitModal.classList.add('hidden');
        renderDashboard();
        if(document.getElementById('tab-stats').classList.contains('active')) {
            renderStats();
        }
    });

    // 습관 삭제 로직
    modalDeleteBtn.addEventListener('click', () => {
        const habitId = editHabitIdInput.value;
        if (!habitId) return;
        
        if (confirm('이 습관을 정말 삭제하시겠습니까? 관련된 모든 기록이 삭제됩니다.')) {
            habits = habits.filter(h => h.id !== habitId);
            // Delete from logs
            Object.keys(habitLogs).forEach(date => {
                if(habitLogs[date][habitId]) {
                    delete habitLogs[date][habitId];
                }
            });
            saveData();
            habitModal.classList.add('hidden');
            renderDashboard();
            if(document.getElementById('tab-stats').classList.contains('active')) {
                renderStats();
            }
        }
    });
}

// --- 뷰 전환 ---
function showLoginView() {
    loginView.classList.remove('hidden');
    mainView.classList.add('hidden');
}

function showMainView() {
    loginView.classList.add('hidden');
    mainView.classList.remove('hidden');
    displayNameSpan.textContent = currentUser;
}

// --- 유틸 함수 ---
function getDateString(d) {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return (new Date(d - tzOffset)).toISOString().split('T')[0];
}

function displayDateStr() {
    const options = { month: 'long', day: 'numeric', weekday: 'long' };
    
    const todayStr = getDateString(new Date());
    const selectedStr = getDateString(selectedDate);
    
    if (todayStr === selectedStr) {
        todayBtn.classList.add('hidden');
        currentDateEl.textContent = '오늘의 습관';
    } else {
        todayBtn.classList.remove('hidden');
        currentDateEl.textContent = selectedDate.toLocaleDateString('ko-KR', options);
    }
}

// --- 데이터 렌더링 (대시보드) ---
function renderDashboard() {
    displayDateStr();
    habitListEl.innerHTML = '';
    
    const targetStr = getDateString(selectedDate);
    const targetDay = selectedDate.getDay();
    
    const yesterday = new Date(selectedDate);
    yesterday.setDate(selectedDate.getDate() - 1);
    const yesterdayStr = getDateString(yesterday);
    
    if(!habitLogs[targetStr]) {
        habitLogs[targetStr] = {};
    }

    const displayHabits = habits.filter(h => {
        const normallyScheduled = h.days.includes(targetDay);
        const postponedYesterday = habitLogs[yesterdayStr] && habitLogs[yesterdayStr][h.id] === 'postponed';
        return normallyScheduled || postponedYesterday;
    });
    
    if (displayHabits.length === 0) {
        habitListEl.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-leaf"></i>
                <p>수행할 습관이 없습니다.</p>
            </div>
        `;
        updateProgress(0, 0);
        return;
    }

    let completedCount = 0;

    displayHabits.forEach(habit => {
        const status = habitLogs[targetStr][habit.id];
        if (status === 'completed') completedCount++;

        const li = document.createElement('li');
        li.className = 'habit-item glass-card' + (status === 'postponed' ? ' postponed' : '');
        
        // 아이콘 및 상태 UI 설정
        const iconClass = icons[habit.category] || icons['기타'];
        const isCompleted = status === 'completed';
        
        li.innerHTML = `
            <div class="habit-info">
                <div class="habit-icon">
                    <i class="ph ${iconClass}"></i>
                </div>
                <div class="habit-details">
                    <h4>${habit.name}</h4>
                    <p>${habit.time ? habit.time + ' 알림' : '시간 미지정'}</p>
                </div>
            </div>
            <div class="habit-actions">
                <button class="action-btn btn-edit" title="수정" onclick="openEditModal('${habit.id}')"><i class="ph ph-pencil-simple"></i></button>
                ${status === 'postponed' ? `
                    <button class="action-btn btn-undo" title="미루기 취소" onclick="handleAction('${habit.id}', 'none')"><i class="ph ph-arrow-u-up-left"></i></button>
                ` : !status ? `
                    <button class="action-btn btn-postpone" title="내일로 미루기" onclick="handleAction('${habit.id}', 'postponed')"><i class="ph ph-arrow-u-down-right"></i></button>
                ` : ''}
                <button class="action-btn btn-complete ${isCompleted ? 'active' : ''}" title="${isCompleted ? '취소' : '완료'}" onclick="handleAction('${habit.id}', '${isCompleted ? 'none' : 'completed'}')">
                    <i class="ph ph-check"></i>
                </button>
            </div>
        `;
        habitListEl.appendChild(li);
    });

    updateProgress(completedCount, displayHabits.length);
}

function updateProgress(completed, total) {
    todayProgressText.textContent = `${completed} / ${total} 완료`;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    todayProgressPercentage.textContent = `${percentage}%`;
    const degrees = Math.round((percentage / 100) * 360);
    todayProgressCircle.style.setProperty('--progress', `${degrees}deg`);
}

// --- 액션 핸들러 ---
window.handleAction = function(habitId, action) {
    const targetStr = getDateString(selectedDate);
    
    if (action === 'none') {
        delete habitLogs[targetStr][habitId];
    } else {
        habitLogs[targetStr][habitId] = action;
        
        if (action === 'completed') {
            checkGlobalStreak();
        }
    }
    
    saveData();
    renderDashboard();
};

window.openEditModal = function(id) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    
    modalTitle.textContent = '습관 수정하기';
    editHabitIdInput.value = habit.id;
    
    document.getElementById('habit-name').value = habit.name;
    document.querySelector(`input[name="category"][value="${habit.category}"]`).checked = true;
    
    document.querySelectorAll('input[name="days"]').forEach(cb => {
        cb.checked = habit.days.includes(parseInt(cb.value));
    });
    
    document.getElementById('habit-time').value = habit.time || '';
    
    modalDeleteBtn.classList.remove('hidden');
    habitModal.classList.remove('hidden');
};

function checkGlobalStreak() {
    let streak = 0;
    // 현재 보고 있는 날짜를 기준으로 연속 달성 계산
    const baseDate = new Date(selectedDate);
    
    for(let i=0; i<30; i++) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        const dStr = getDateString(d);
        const dDay = d.getDay();
        
        const yesterday = new Date(d);
        yesterday.setDate(d.getDate() - 1);
        const yesterdayStr = getDateString(yesterday);
        
        // 해당 요일에 스케줄된 습관 찾기
        const scheduledHabits = habits.filter(h => {
            const normallyScheduled = h.days.includes(dDay);
            const postponedYesterday = habitLogs[yesterdayStr] && habitLogs[yesterdayStr][h.id] === 'postponed';
            return normallyScheduled || postponedYesterday;
        });
        
        // 하루에 등록된 습관이 아예 없다면 스트릭이 깨진 것으로 간주
        if (scheduledHabits.length === 0) {
            break;
        }
        
        // 등록된 습관이 모두 'completed' 인지 확인
        let allCompleted = true;
        for (const h of scheduledHabits) {
            if (!habitLogs[dStr] || habitLogs[dStr][h.id] !== 'completed') {
                allCompleted = false;
                break;
            }
        }
        
        if (allCompleted) {
            streak++;
        } else if (i !== 0) {
            // 과거 날짜에서 하나라도 달성하지 못했다면 스트릭 중단
            break;
        } else {
            // 기준일(오늘/선택한날) 다 못채웠다면 축하 안함
            break;
        }
    }
    
    // 올클리어 시 매번 축하 알림 발생 (연속 달성 일수 표시)
    if (streak > 0) {
        fireConfetti();
        showNotification("올클리어 달성!", `🎉 대단해요! 오늘 하루 일과를 모두 마쳤습니다! (🔥 ${streak}일 연속 달성 중)`);
    }
}

function fireConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a855f7', '#06b6d4', '#10b981']
    });
}

// --- 통계 시각화 ---
let weeklyChartInstance = null;

function renderStats() {
    const statsGrid = document.getElementById('habit-stats-grid');
    statsGrid.innerHTML = '';
    
    if(habits.length === 0) {
        statsGrid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: var(--text-muted)">등록된 습관이 없습니다.</p>`;
    }

    // 선택된 주(월~일) 계산
    const baseDateForChart = new Date(selectedDate);
    const dayOfWeek = baseDateForChart.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(baseDateForChart);
    monday.setDate(baseDateForChart.getDate() + diffToMonday);
    
    const weekDates = [];
    for(let i=0; i<7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        weekDates.push({ date: d, str: getDateString(d), day: d.getDay() });
    }

    habits.forEach(habit => {
        // 완료 횟수 계산 (선택된 주간 기준)
        let totalOccurrences = 0;
        let completedOccurrences = 0;
        
        weekDates.forEach(wd => {
            const yesterday = new Date(wd.date);
            yesterday.setDate(wd.date.getDate() - 1);
            const yesterdayStr = getDateString(yesterday);
            
            const normallyScheduled = habit.days.includes(wd.day);
            const postponedYesterday = habitLogs[yesterdayStr] && habitLogs[yesterdayStr][habit.id] === 'postponed';
            const postponedToday = habitLogs[wd.str] && habitLogs[wd.str][habit.id] === 'postponed';
            
            // 원래 스케줄이거나 어제 미뤘더라도, '오늘 미루기' 상태라면 오늘 목표 횟수에서는 제외 (내일로 이관됨)
            if ((normallyScheduled || postponedYesterday) && !postponedToday) {
                totalOccurrences++;
                if(habitLogs[wd.str] && habitLogs[wd.str][habit.id] === 'completed') {
                    completedOccurrences++;
                }
            }
        });
        
        const box = document.createElement('div');
        box.className = 'stat-box';
        box.innerHTML = `
            <div class="stat-value">${completedOccurrences}/${totalOccurrences}</div>
            <div class="stat-label">${habit.name}</div>
        `;
        statsGrid.appendChild(box);
    });

    // 주간 차트 그리기
    renderWeeklyChart();
}

function renderWeeklyChart() {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    
    // 선택된 날짜가 포함된 주(월요일 ~ 일요일)의 날짜 라벨 및 데이터 추출
    const labels = [];
    const data = [];
    const baseDateForChart = new Date(selectedDate);
    
    // 월요일을 찾기 위한 계산 (0: 일요일, 1: 월요일, ... 6: 토요일)
    const dayOfWeek = baseDateForChart.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(baseDateForChart);
    monday.setDate(baseDateForChart.getDate() + diffToMonday);
    
    for(let i=0; i<7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const weekdayStr = weekdays[d.getDay()];
        labels.push(`${d.getMonth()+1}/${d.getDate()}(${weekdayStr})`);
        
        const dStr = getDateString(d);
        
        let completed = 0;
        if(habitLogs[dStr]) {
            completed = Object.values(habitLogs[dStr]).filter(s => s === 'completed').length;
        }
        data.push(completed);
    }

    if(weeklyChartInstance) {
        weeklyChartInstance.destroy();
    }

    weeklyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '완료한 습관 수',
                data: data,
                backgroundColor: 'rgba(168, 85, 247, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

// --- 알림 (Notification) ---
function checkNotifications() {
    const now = new Date();
    const currentTimeStr = now.toTimeString().slice(0,5); // "HH:MM"
    const todayDay = now.getDay();
    const todayStr = getDateString(now);
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = getDateString(yesterday);
    
    if(!habitLogs[todayStr]) habitLogs[todayStr] = {};

    habits.forEach(habit => {
        const normallyScheduled = habit.days.includes(todayDay);
        const postponedYesterday = habitLogs[yesterdayStr] && habitLogs[yesterdayStr][habit.id] === 'postponed';
        
        if((normallyScheduled || postponedYesterday) && habit.time === currentTimeStr) {
            // 아직 완료/건너뛰기/미루기 처리되지 않은 경우만 알림
            if(!habitLogs[todayStr][habit.id]) {
                showNotification("습관 알림", `'${habit.name}' 시간이 되었습니다!`);
            }
        }
    });
}

function showNotification(title, message) {
    // 1. 브라우저 알림 (지원 및 허용 시)
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: message });
    }
    
    // 2. 인앱 배너 알림
    const banner = document.getElementById('notification-banner');
    document.getElementById('notif-title').textContent = title;
    document.getElementById('notif-message').textContent = message;
    
    banner.classList.remove('hidden');
    
    setTimeout(() => {
        banner.classList.add('hidden');
    }, 5000); // 5초 후 자동 숨김
    
    document.querySelector('.notif-close').onclick = () => banner.classList.add('hidden');
}

// --- 로컬 스토리지 데이터 관리 ---
function loadData() {
    // 앱 초기화 시
    if (!currentUserKey) {
        currentUserKey = localStorage.getItem('currentUserKey');
    }
    
    if (currentUserKey) {
        currentUser = localStorage.getItem('currentUserName') || currentUserKey.split('_')[0];
        const storedHabits = localStorage.getItem(`${currentUserKey}_habits`);
        const storedLogs = localStorage.getItem(`${currentUserKey}_habitLogs`);
        
        habits = storedHabits ? JSON.parse(storedHabits) : [];
        habitLogs = storedLogs ? JSON.parse(storedLogs) : {};
    } else {
        habits = [];
        habitLogs = {};
    }
}

function saveData() {
    if (currentUserKey) {
        localStorage.setItem('currentUserKey', currentUserKey);
        localStorage.setItem('currentUserName', currentUser);
        localStorage.setItem(`${currentUserKey}_habits`, JSON.stringify(habits));
        localStorage.setItem(`${currentUserKey}_habitLogs`, JSON.stringify(habitLogs));
    }
}

// 초기화 실행
init();
