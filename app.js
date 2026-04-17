'use strict';

// ── Storage keys ──
const KEY_BALANCE   = 'tt_balance';
const KEY_LOG       = 'tt_log';       // today's log
const KEY_LOG_DATE  = 'tt_log_date';
const KEY_ALLTIME   = 'tt_alltime';   // cumulative stats (never reset)

// ── State ──
let balance   = 0;
let todayLog  = [];    // [{id, cat, dir, mins, time}]
let allTime   = {};    // {cat: totalMins, …}

// overlay state
let selCat    = null;
let selDir    = null;
let selTicks  = {};    // {cat: count}

// long-press state
let pressTimer   = null;
let pressRingTimer = null;
let pressStart   = null;

// ── Init ──
function init() {
  loadState();
  renderBalance();
  renderLog();
  renderStats();
  bindCircle();
  bindOverlayClose();
}

// ── Persistence ──
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadState() {
  balance  = parseInt(localStorage.getItem(KEY_BALANCE) || '0', 10);
  allTime  = JSON.parse(localStorage.getItem(KEY_ALLTIME) || '{}');

  const savedDate = localStorage.getItem(KEY_LOG_DATE);
  if (savedDate === todayKey()) {
    todayLog = JSON.parse(localStorage.getItem(KEY_LOG) || '[]');
  } else {
    todayLog = [];
    saveTodayLog();
  }
}

function saveTodayLog() {
  localStorage.setItem(KEY_LOG_DATE, todayKey());
  localStorage.setItem(KEY_LOG, JSON.stringify(todayLog));
}

function saveBalance() {
  localStorage.setItem(KEY_BALANCE, String(balance));
}

function saveAllTime() {
  localStorage.setItem(KEY_ALLTIME, JSON.stringify(allTime));
}

// ── Render Balance / Rings ──
function renderBalance() {
  document.getElementById('balanceNum').textContent = balance;
  document.body.classList.toggle('negative', balance < 0);

  const abs = Math.abs(balance);

  // Outer ring: progress within current hour block
  const outerCirc = 2 * Math.PI * 128;  // 804.25
  const minsInHour = abs % 60;
  const outerPct = minsInHour / 60;
  const outerOffset = outerCirc * (1 - outerPct);
  document.getElementById('ringOuter').style.strokeDashoffset = outerOffset;

  // Inner ring: quarters = completed hours (max 4)
  const hours = Math.floor(abs / 60);
  const q = Math.min(hours, 4);
  ['ringQ1','ringQ2','ringQ3','ringQ4'].forEach((id, i) => {
    document.getElementById(id).classList.toggle('active', i < q);
  });
}

// ── Render Log ──
function renderLog() {
  const list = document.getElementById('logList');
  const empty = document.getElementById('logEmpty');
  const totalEl = document.getElementById('logTotal');

  if (todayLog.length === 0) {
    empty.style.display = '';
    list.innerHTML = '';
    list.appendChild(empty);
    totalEl.textContent = '';
    return;
  }

  empty.style.display = 'none';
  // Build list newest-first
  const items = [...todayLog].reverse();
  list.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'log-item';
    div.dataset.id = item.id;
    const sign = item.dir === 'earn' ? '+' : '−';
    div.innerHTML = `
      <span class="log-dot ${item.dir}"></span>
      <span class="log-cat">${item.cat}</span>
      <span class="log-amt ${item.dir}">${sign}${item.mins}m</span>
      <span class="log-time">${item.time}</span>
      <button class="log-del" onclick="deleteLog('${item.id}')">✕</button>
    `;
    list.appendChild(div);
  });

  // summary
  const earned = todayLog.filter(i => i.dir === 'earn').reduce((a,b) => a + b.mins, 0);
  const used   = todayLog.filter(i => i.dir === 'use').reduce((a,b)  => a + b.mins, 0);
  totalEl.textContent = `+${earned}m / −${used}m`;
}

// ── Render Stats ──
function renderStats() {
  const grid = document.getElementById('statsGrid');
  const totalRow = document.getElementById('statsTotalRow');

  const earnCats = ['Homework','Reading','Dog Walk','Other','Bonus'];
  const useCats  = ['TV','Computer','Phone','Tablet','Play'];

  const earnIcons = {
    Homework: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>`,
    Reading:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`,
    'Dog Walk': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="2"/><path d="M3 22l3-8 2 3 3-5 5 10"/><path d="M18 6l2-2M20 8l2-2M18 10l2 2"/></svg>`,
    Other:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    Bonus:    `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
  };
  const useIcons = {
    TV:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>`,
    Computer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    Phone:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    Tablet:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    Play:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none"/><line x1="15" y1="10" x2="15" y2="14"/><line x1="13" y1="12" x2="17" y2="12"/></svg>`,
  };

  grid.innerHTML = '';

  let totalEarnMins = 0;
  let totalUseMins  = 0;

  [...earnCats, ...useCats].forEach(cat => {
    const mins = allTime[cat] || 0;
    const isEarn = earnCats.includes(cat);
    const isBonus = cat === 'Bonus';
    const iconType = isBonus ? 'bonus-icon' : (isEarn ? 'earn-icon' : 'use-icon');
    const icon = isEarn ? earnIcons[cat] : useIcons[cat];
    if (isEarn) totalEarnMins += mins; else totalUseMins += mins;

    const hrs  = Math.floor(mins / 60);
    const rem  = mins % 60;
    const val  = hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`;

    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="stat-card-icon ${iconType}">${icon}</div>
      <div class="stat-card-label">${cat}</div>
      <div class="stat-card-value">${val}</div>
      <div class="stat-card-sub">${mins} min total</div>
    `;
    grid.appendChild(card);
  });

  // Total row
  const totalEarnHrs = (totalEarnMins / 60).toFixed(1);
  const totalUseHrs  = (totalUseMins  / 60).toFixed(1);
  totalRow.innerHTML = `
    <div class="stats-total-label">All Time</div>
    <div class="stats-total-value">${totalEarnHrs}h earned · ${totalUseHrs}h used</div>
    <div class="stats-total-sub">
      ${totalEarnMins} min earned across all activities<br>
      ${totalUseMins} min of screen time used
    </div>
  `;
}

// ── Tab switching ──
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  if (name === 'stats') renderStats();
}

// ── Overlay ──
function openOverlay() {
  selCat   = null;
  selDir   = null;
  selTicks = {};
  resetOverlayUI();
  document.getElementById('overlay').classList.add('open');
}

function closeOverlay() {
  document.getElementById('overlay').classList.remove('open');
}

function bindOverlayClose() {
  document.getElementById('overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('overlay')) closeOverlay();
  });
}

function resetOverlayUI() {
  document.querySelectorAll('.ov-btn').forEach(btn => {
    btn.classList.remove('selected');
    const cat = btn.dataset.cat;
    document.getElementById('ticks-' + cat).textContent = '';
  });
  const cb = document.getElementById('confirmBtn');
  cb.disabled = true;
  cb.textContent = 'Select activity';
  cb.classList.remove('use-active');
}

function selectCat(btn) {
  const cat = btn.dataset.cat;
  const dir = btn.dataset.dir;

  // If different category: reset
  if (selCat !== cat) {
    document.querySelectorAll('.ov-btn').forEach(b => b.classList.remove('selected'));
    selTicks = {};
    selCat = cat;
    selDir = dir;
  }

  // Increment ticks (1–4, then reset to 0)
  selTicks[cat] = ((selTicks[cat] || 0) + 1) % 5;
  if (selTicks[cat] === 0) {
    // reset this cat
    btn.classList.remove('selected');
    selCat = null; selDir = null;
    document.getElementById('ticks-' + cat).textContent = '';
    const cb = document.getElementById('confirmBtn');
    cb.disabled = true; cb.textContent = 'Select activity'; cb.classList.remove('use-active');
    return;
  }

  btn.classList.add('selected');
  const count = selTicks[cat];
  document.getElementById('ticks-' + cat).textContent = '●'.repeat(count);

  const mins = count * 15;
  const cb = document.getElementById('confirmBtn');
  cb.disabled = false;
  if (dir === 'earn') {
    cb.textContent = `+ ${mins} min`;
    cb.classList.remove('use-active');
  } else {
    cb.textContent = `− ${mins} min`;
    cb.classList.add('use-active');
  }
}

function confirmAction() {
  if (!selCat) return;
  const count = selTicks[selCat] || 0;
  if (count === 0) return;

  const mins = count * 15;
  const dir  = selDir;

  if (dir === 'earn') {
    balance += mins;
    // track all-time (earn only)
    allTime[selCat] = (allTime[selCat] || 0) + mins;
    saveAllTime();
  } else {
    balance -= mins;
  }
  saveBalance();

  // add to log
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  const entry = { id: Date.now().toString(), cat: selCat, dir, mins, time: timeStr };
  todayLog.push(entry);
  saveTodayLog();

  renderBalance();
  renderLog();
  closeOverlay();
  showToast(dir === 'earn' ? `+${mins} min earned ✓` : `−${mins} min used`);
}

// ── Delete log item ──
function deleteLog(id) {
  const idx = todayLog.findIndex(i => i.id === id);
  if (idx === -1) return;
  const item = todayLog[idx];
  if (item.dir === 'earn') {
    balance -= item.mins;
  } else {
    balance += item.mins;
  }
  todayLog.splice(idx, 1);
  saveBalance();
  saveTodayLog();
  renderBalance();
  renderLog();
}

// ── Circle long-press ──
function bindCircle() {
  const wrap = document.getElementById('circleWrap');

  const startPress = () => {
    pressStart = Date.now();
    // Show reset ring after 1 second
    pressRingTimer = setTimeout(() => {
      const ring = document.getElementById('ringReset');
      ring.classList.add('visible');
      ring.style.transition = 'stroke-dashoffset 2s linear, opacity 0.3s';
      ring.style.strokeDashoffset = '0';
    }, 1000);

    // Actually reset after 3 seconds
    pressTimer = setTimeout(() => {
      doReset();
    }, 3000);
  };

  const cancelPress = () => {
    clearTimeout(pressTimer);
    clearTimeout(pressRingTimer);
    const ring = document.getElementById('ringReset');
    ring.classList.remove('visible');
    ring.style.transition = 'stroke-dashoffset 0.1s, opacity 0.3s';
    ring.style.strokeDashoffset = '867.08';
    pressTimer = null;
    pressRingTimer = null;
  };

  wrap.addEventListener('mousedown',  startPress);
  wrap.addEventListener('touchstart', startPress, { passive: true });
  wrap.addEventListener('mouseup',    () => { if (pressTimer) { cancelPress(); openOverlay(); } });
  wrap.addEventListener('touchend',   e => {
    if (pressTimer) {
      cancelPress();
      if (Date.now() - pressStart < 500) openOverlay();
    }
  });
  wrap.addEventListener('mouseleave', () => { if (pressTimer) cancelPress(); });
}

function doReset() {
  balance  = 0;
  todayLog = [];
  saveBalance();
  saveTodayLog();
  // Do NOT reset allTime
  renderBalance();
  renderLog();
  const ring = document.getElementById('ringReset');
  ring.classList.remove('visible');
  ring.style.strokeDashoffset = '867.08';
  showToast('Timer reset ✓');
}

// ── Toast ──
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── Cat ──
let catTimer = null;
function catSpeak() {
  const bubble = document.getElementById('catBubble');
  bubble.classList.add('show');
  clearTimeout(catTimer);
  catTimer = setTimeout(() => bubble.classList.remove('show'), 2000);
}

// ── Boot ──
init();
