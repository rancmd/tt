// ── Constants ──
const MAX_TAPS = 4;
const OUTER_R  = 128;
const OUTER_C  = +(2 * Math.PI * OUTER_R).toFixed(3); // ~804.248
const RESET_R  = 136;
const RESET_C  = +(2 * Math.PI * RESET_R).toFixed(3); // ~854.513
const DELAY_MS = 1000;  // delay before reset ring appears
const FILL_MS  = 2000;  // ring fill duration (total hold = 3s)

const EARN_CATS = [
  { id: 'homework', icon: '📖', name: 'Homework',  pts: '1 page = 15 min' },
  { id: 'reading',  icon: '📚', name: 'Reading',   pts: '15 min session'  },
  { id: 'dog',      icon: '🐕', name: 'Dog Walk',  pts: '15 min session'  },
  { id: 'activity', icon: '⚽', name: 'Activity',  pts: '15 min session'  },
  { id: 'bonus',    icon: '⭐', name: 'Bonus',     pts: '15 min bonus'    },
];

const SPEND_CATS = [
  { id: 'tv',       icon: '📺', name: 'TV',       pts: '15 min' },
  { id: 'computer', icon: '💻', name: 'Computer', pts: '15 min' },
  { id: 'phone',    icon: '📱', name: 'Phone',    pts: '15 min' },
  { id: 'tablet',   icon: '📟', name: 'Tablet',   pts: '15 min' },
  { id: 'play',     icon: '🎮', name: 'Play',     pts: '15 min' },
];

// ── State ──
let state      = loadState();
let currentSel = null;

// ── Persistence ──
function today()        { return new Date().toISOString().slice(0, 10); }
function currentMonth() { const d = new Date(); return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)}`; }

function loadState() {
  try {
    const raw = localStorage.getItem('trkr_v8');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.date !== today()) { s.history = []; s.date = today(); }
      if (!s.allTime)  s.allTime  = {};
      // monthly reset: if stored month differs from current month, wipe allTime
      if (s.statsMonth !== currentMonth()) { s.allTime = {}; s.statsMonth = currentMonth(); }
      return s;
    }
  } catch (e) {}
  return { balance: 0, history: [], date: today(), allTime: {}, statsMonth: currentMonth() };
}

function saveState() {
  state.date = today();
  localStorage.setItem('trkr_v8', JSON.stringify(state));
}

// ── Render ──
function render() {
  const bal = state.balance;
  const isNeg = bal < 0;
  const absBal = Math.abs(bal);

  // Center number — show negative in red
  const valEl = document.getElementById('balance-val');
  valEl.textContent = bal;
  valEl.classList.toggle('negative', isNeg);

  // Outer ring: minutes within current hour (always positive display)
  const minInHour = absBal % 60;
  const outerRing = document.getElementById('ring-outer');
  outerRing.setAttribute('stroke-dasharray', OUTER_C);
  outerRing.style.strokeDashoffset = OUTER_C * (1 - minInHour / 60);
  outerRing.classList.toggle('negative', isNeg);

  // Mirror the entire arc group horizontally when negative so arcs fill counter-clockwise
  const arcGroup = document.getElementById('arc-group');
  if (isNeg) {
    arcGroup.setAttribute('transform', 'translate(0,290) scale(1,-1)');
  } else {
    arcGroup.removeAttribute('transform');
  }

  // Inner quarters: completed hours (floor of abs balance / 60)
  const hours = Math.min(Math.floor(absBal / 60), 4);
  ['q1','q2','q3','q4'].forEach((id, i) => {
    const el = document.getElementById(id);
    el.style.opacity = i < hours ? '1' : '0';
    el.classList.toggle('negative', isNeg);
  });

  // Date
  const d = new Date();
  document.getElementById('header-date').textContent =
    d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Log — each item has an X delete button, passing its index in reversed array
  const list = document.getElementById('log-list');
  if (!state.history.length) {
    list.innerHTML = '<div class="log-empty">No activity logged today</div>';
  } else {
    // We render in reverse (newest first), but delete by original index
    const reversed = [...state.history].map((h, origIdx) => ({ ...h, origIdx })).reverse();
    list.innerHTML = reversed.map(h => `
      <div class="log-item">
        <div class="log-icon ${h.type}">${h.icon}</div>
        <div class="log-info">
          <div class="log-name">${h.name}</div>
          <div class="log-time">${h.timestamp}</div>
        </div>
        <div class="log-mins ${h.type}">${h.type === 'earn' ? '+' : '−'}${h.mins} min</div>
        <button class="log-delete" onclick="deleteLogItem(${h.origIdx})">✕</button>
      </div>
    `).join('');
  }
}

// ── Delete log item ──
function deleteLogItem(origIdx) {
  const item = state.history[origIdx];
  if (!item) return;

  // Reverse the effect on balance
  if (item.type === 'earn') {
    state.balance -= item.mins;
  } else {
    state.balance += item.mins;
  }

  state.history.splice(origIdx, 1);
  saveState();
  render();
}

// ── Long-press reset ──
let pressTimer  = null;
let delayTimer  = null;
let pressStart  = null;
let animFrame   = null;
let pressing    = false;
let didLongPress = false;

function startPress() {
  if (document.getElementById('overlay').classList.contains('open')) return;
  pressing     = true;
  didLongPress = false;

  const resetRing = document.getElementById('reset-ring');
  const resetSvg  = document.getElementById('reset-svg');
  const circleBtn = document.getElementById('circle-btn');

  resetRing.setAttribute('stroke-dasharray', RESET_C);
  resetRing.style.strokeDashoffset = RESET_C;

  delayTimer = setTimeout(() => {
    if (!pressing) return;
    pressStart = performance.now();
    resetSvg.style.opacity = '1';
    circleBtn.classList.add('pressing');

    function animateRing() {
      if (!pressing) return;
      const elapsed  = performance.now() - pressStart;
      const progress = Math.min(elapsed / FILL_MS, 1);
      resetRing.style.strokeDashoffset = RESET_C * (1 - progress);
      if (progress < 1) {
        animFrame = requestAnimationFrame(animateRing);
      } else {
        didLongPress = true;
        doReset();
      }
    }
    animFrame = requestAnimationFrame(animateRing);
  }, DELAY_MS);

  pressTimer = setTimeout(() => {
    didLongPress = true;
    doReset();
  }, DELAY_MS + FILL_MS);
}

function cancelPress() {
  if (!pressing) return;
  pressing = false;
  clearTimeout(pressTimer);
  clearTimeout(delayTimer);
  cancelAnimationFrame(animFrame);

  document.getElementById('reset-svg').style.opacity = '0';
  document.getElementById('reset-ring').style.strokeDashoffset = RESET_C;
  document.getElementById('circle-btn').classList.remove('pressing');
}

function doReset() {
  if (!pressing) return;
  pressing = false;
  clearTimeout(pressTimer);
  clearTimeout(delayTimer);
  cancelAnimationFrame(animFrame);

  state.balance = 0;
  state.history = [];
  // allTime is intentionally preserved — never reset
  saveState();
  render();

  document.getElementById('reset-svg').style.opacity = '0';
  document.getElementById('reset-ring').style.strokeDashoffset = RESET_C;
  document.getElementById('circle-btn').classList.remove('pressing');

  showToast('Timer reset ✓');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ── Overlay ──
function openOverlay() {
  currentSel = null;
  buildCategories();
  updateConfirm();
  document.getElementById('overlay').classList.add('open');
}

function closeOverlay() {
  document.getElementById('overlay').classList.remove('open');
}

function buildCategories() {
  document.getElementById('earn-col').innerHTML = EARN_CATS.map(cat => `
    <button class="cat-btn earn-btn" id="cat-${cat.id}" onclick="tapCat('${cat.id}','earn')">
      <div class="cat-top">
        <span class="cat-icon">${cat.icon}</span>
        <span class="cat-count" id="count-${cat.id}">0</span>
      </div>
      <div class="cat-name">${cat.name}</div>
      <div class="cat-pts">${cat.pts}</div>
    </button>
  `).join('');

  document.getElementById('spend-col').innerHTML = SPEND_CATS.map(cat => `
    <button class="cat-btn spend-btn" id="cat-${cat.id}" onclick="tapCat('${cat.id}','spend')">
      <div class="cat-top">
        <span class="cat-icon">${cat.icon}</span>
        <span class="cat-count" id="count-${cat.id}">0</span>
      </div>
      <div class="cat-name">${cat.name}</div>
      <div class="cat-pts">${cat.pts}</div>
    </button>
  `).join('');
}

function tapCat(id, side) {
  if (!currentSel || currentSel.id !== id) {
    if (currentSel) {
      const ob = document.getElementById(`cat-${currentSel.id}`);
      const oc = document.getElementById(`count-${currentSel.id}`);
      if (ob) ob.classList.remove('active');
      if (oc) { oc.classList.remove('visible'); oc.textContent = '0'; }
    }
    currentSel = { id, side, taps: 0 };
  }

  currentSel.taps = currentSel.taps >= MAX_TAPS ? 0 : currentSel.taps + 1;

  const n       = currentSel.taps;
  const countEl = document.getElementById(`count-${id}`);
  const btn     = document.getElementById(`cat-${id}`);
  countEl.textContent = n;
  countEl.classList.toggle('visible', n > 0);
  btn.classList.toggle('active', n > 0);

  updateConfirm();
}

function updateConfirm() {
  const btn  = document.getElementById('confirm-btn');
  const hasSel = currentSel && currentSel.taps > 0;

  if (!hasSel) {
    btn.disabled = true;
    btn.textContent = 'Confirm';
    btn.style.background = '';
    btn.style.color = '';
    return;
  }

  const mins    = currentSel.taps * 15;
  const isSpend = currentSel.side === 'spend';
  const sign    = isSpend ? '−' : '+';

  btn.disabled = false;
  btn.textContent      = `Confirm ${sign}${mins} min`;
  btn.style.background = isSpend ? 'var(--red)'    : 'var(--accent)';
  btn.style.color      = isSpend ? '#fff'           : 'var(--text)';
}

function confirmLog() {
  if (!currentSel || currentSel.taps === 0) return;
  const ts   = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const mins = currentSel.taps * 15;
  const { id, side } = currentSel;
  const cat  = [...EARN_CATS, ...SPEND_CATS].find(c => c.id === id);

  if (!state.allTime) state.allTime = {};

  if (side === 'earn') {
    state.balance += mins;
    state.history.push({ type: 'earn', icon: cat.icon, name: cat.name, mins, timestamp: ts });
    state.allTime[id] = (state.allTime[id] || 0) + mins;
  } else {
    state.balance -= mins;
    state.history.push({ type: 'spend', icon: cat.icon, name: cat.name, mins, timestamp: ts });
    state.allTime[id] = (state.allTime[id] || 0) + mins;
  }

  saveState();
  render();
  closeOverlay();
}

// ── Stats ──
function renderStats() {
  const el = document.getElementById('stats-list');
  if (!el) return;

  // keep statsMonth in sync
  if (state.statsMonth !== currentMonth()) {
    state.allTime = {};
    state.statsMonth = currentMonth();
    saveState();
  }

  const allTime = state.allTime || {};

  function fmtMins(m) {
    if (m === 0) return '0 min';
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h === 0) return `${r} min`;
    if (r === 0) return `${h}h`;
    return `${h}h ${r}m`;
  }

  const totalEarn  = EARN_CATS.reduce((s, c)  => s + (allTime[c.id] || 0), 0);
  const totalSpend = SPEND_CATS.reduce((s, c) => s + (allTime[c.id] || 0), 0);

  el.innerHTML = `
    <div class="stats-month-title">${currentMonth()}</div>

    <div class="stats-grand">
      <div class="stats-grand-row">
        <span class="stats-grand-label">Total Earned</span>
        <span class="stats-grand-val earn">${fmtMins(totalEarn)}</span>
      </div>
      <div class="stats-grand-row">
        <span class="stats-grand-label">Total Used</span>
        <span class="stats-grand-val spend">${fmtMins(totalSpend)}</span>
      </div>
    </div>

    <div class="stats-section-label">Earned</div>
    ${EARN_CATS.map(c => `
      <div class="stats-row">
        <span class="stats-icon">${c.icon}</span>
        <span class="stats-name">${c.name}</span>
        <span class="stats-val earn">${fmtMins(allTime[c.id] || 0)}</span>
      </div>
    `).join('')}

    <div class="stats-section-label">Used</div>
    ${SPEND_CATS.map(c => `
      <div class="stats-row">
        <span class="stats-icon">${c.icon}</span>
        <span class="stats-name">${c.name}</span>
        <span class="stats-val spend">${fmtMins(allTime[c.id] || 0)}</span>
      </div>
    `).join('')}
  `;
}

// ── Tab switching ──
function switchTab(tab) {
  document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + tab).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
  if (tab === 'stats') renderStats();
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  render();

  const wrap = document.getElementById('circle-wrap');

  wrap.addEventListener('pointerdown', startPress);
  wrap.addEventListener('pointerup', () => {
    cancelPress();
    if (!didLongPress) openOverlay();
  });
  wrap.addEventListener('pointerleave', cancelPress);
  wrap.addEventListener('pointercancel', cancelPress);

  document.getElementById('overlay-backdrop').addEventListener('click', closeOverlay);
  document.getElementById('log-list').addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
});
