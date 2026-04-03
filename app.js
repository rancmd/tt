// ── Constants ──
const MAX_TAPS = 4; // 4 taps = 60 min → 5th tap resets to 0

// Outer ring: 0–60 min arc (one full hour)
const OUTER_R = 128;
const OUTER_C = +(2 * Math.PI * OUTER_R).toFixed(2); // ~804

const EARN_CATS = [
  { id: 'homework', icon: '📖', name: 'Homework',  pts: '1 page = 15 min' },
  { id: 'reading',  icon: '📚', name: 'Reading',   pts: '15 min session'  },
  { id: 'dog',      icon: '🐕', name: 'Dog Walk',  pts: '15 min session'  },
  { id: 'activity', icon: '⚽', name: 'Activity',  pts: '15 min session'  },
];

const SPEND_CATS = [
  { id: 'tv',       icon: '📺', name: 'TV',       pts: '15 min' },
  { id: 'computer', icon: '💻', name: 'Computer', pts: '15 min' },
  { id: 'phone',    icon: '📱', name: 'Phone',    pts: '15 min' },
  { id: 'tablet',   icon: '📟', name: 'Tablet',   pts: '15 min' },
];

// ── State ──
let state = loadState();
let currentSel = null; // { id, side, taps }

// ── Persistence ──
function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadState() {
  try {
    const raw = localStorage.getItem('trkr_v6');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.date !== today()) {
        s.history = [];
        s.date = today();
      }
      return s;
    }
  } catch (e) {}
  return { balance: 0, history: [], date: today() };
}

function saveState() {
  state.date = today();
  localStorage.setItem('trkr_v6', JSON.stringify(state));
}

// ── Render ──
function render() {
  const bal = state.balance;
  document.getElementById('balance-val').textContent = bal;

  // Outer ring: current minute within the hour (0–60)
  const minInHour = bal % 60;
  const outerOffset = OUTER_C * (1 - minInHour / 60);
  const outerRing = document.getElementById('ring-outer');
  outerRing.setAttribute('stroke-dasharray', OUTER_C);
  outerRing.style.strokeDashoffset = outerOffset;

  // Inner ring: completed full hours (0–4), shown as filled quarters
  const completedHours = Math.min(Math.floor(bal / 60), 4);
  if (typeof window.setQuartersFilled === 'function') {
    window.setQuartersFilled(completedHours);
  }

  // Date
  const d = new Date();
  document.getElementById('header-date').textContent =
    d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Log
  const list = document.getElementById('log-list');
  if (!state.history.length) {
    list.innerHTML = '<div class="log-empty">No activity logged today</div>';
  } else {
    list.innerHTML = [...state.history].reverse().map(h => `
      <div class="log-item">
        <div class="log-icon ${h.type}">${h.icon}</div>
        <div class="log-info">
          <div class="log-name">${h.name}</div>
          <div class="log-time">${h.timestamp}</div>
        </div>
        <div class="log-mins ${h.type}">${h.type === 'earn' ? '+' : '−'}${h.mins} min</div>
      </div>
    `).join('');
  }
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
  // Switching to a different category — clear previous
  if (!currentSel || currentSel.id !== id) {
    if (currentSel) {
      const oldBtn   = document.getElementById(`cat-${currentSel.id}`);
      const oldCount = document.getElementById(`count-${currentSel.id}`);
      if (oldBtn)   { oldBtn.classList.remove('active'); }
      if (oldCount) { oldCount.classList.remove('visible'); oldCount.textContent = '0'; }
    }
    currentSel = { id, side, taps: 0 };
  }

  // Increment — if already at max (4), next tap resets to 0
  currentSel.taps++;
  if (currentSel.taps > MAX_TAPS) {
    currentSel.taps = 0;
  }

  const n = currentSel.taps;
  const countEl = document.getElementById(`count-${id}`);
  const btn     = document.getElementById(`cat-${id}`);

  countEl.textContent = n;
  countEl.classList.toggle('visible', n > 0);
  btn.classList.toggle('active', n > 0);

  updateConfirm();
}

function updateConfirm() {
  const btn  = document.getElementById('confirm-btn');
  const warn = document.getElementById('confirm-warning');

  const hasSel = currentSel && currentSel.taps > 0;

  if (!hasSel) {
    btn.disabled = true;
    btn.textContent = 'Confirm';
    warn.textContent = '';
    return;
  }

  const mins = currentSel.taps * 15;
  let warning  = '';
  let disabled = false;

  if (currentSel.side === 'spend' && mins > state.balance) {
    warning  = `Not enough balance — you have ${state.balance} min`;
    disabled = true;
  }

  warn.textContent = warning;
  btn.disabled     = disabled;

  const sign = currentSel.side === 'earn' ? '+' : '−';
  btn.textContent = `Confirm ${sign}${mins} min`;
}

function confirmLog() {
  if (!currentSel || currentSel.taps === 0) return;

  const ts   = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const mins = currentSel.taps * 15;
  const { id, side } = currentSel;
  const cat  = [...EARN_CATS, ...SPEND_CATS].find(c => c.id === id);

  if (side === 'earn') {
    state.balance += mins;
    state.history.push({ type: 'earn', icon: cat.icon, name: cat.name, mins, timestamp: ts });
  } else {
    state.balance = Math.max(0, state.balance - mins);
    state.history.push({ type: 'spend', icon: cat.icon, name: cat.name, mins, timestamp: ts });
  }

  saveState();
  render();
  closeOverlay();
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  render();
  document.getElementById('overlay-backdrop').addEventListener('click', closeOverlay);
  document.getElementById('log-list').addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
});
