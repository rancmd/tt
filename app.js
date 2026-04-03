// ── Constants ──
const SCREEN_LIMIT_PER_TYPE = 4; // 4 × 15 = 60 min per screen type per day
const CIRC_R = 96;
const CIRC_C = 2 * Math.PI * CIRC_R; // ~603

const EARN_CATS = [
  { id: 'homework', icon: '📖', name: 'Homework',  pts: '1 page = 15 min' },
  { id: 'reading',  icon: '📚', name: 'Reading',   pts: '15 min session'  },
  { id: 'dog',      icon: '🐕', name: 'Dog Walk',  pts: '15 min session'  },
  { id: 'activity', icon: '⚽', name: 'Activity',  pts: '15 min session'  },
];

const SPEND_CATS = [
  { id: 'tv',       icon: '📺', name: 'TV',       pts: '15 min', limitKey: 'tv'       },
  { id: 'computer', icon: '💻', name: 'Computer', pts: '15 min', limitKey: 'computer' },
  { id: 'phone',    icon: '📱', name: 'Phone',    pts: '15 min', limitKey: 'phone'    },
  { id: 'tablet',   icon: '📟', name: 'Tablet',   pts: '15 min', limitKey: 'tablet'   },
];

// ── State ──
let state = loadState();
let selections = {}; // { catId: count }

// ── Persistence ──
function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadState() {
  try {
    const raw = localStorage.getItem('trkr_v3');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.date !== today()) {
        s.history = [];
        s.spentToday = {};
        s.date = today();
      }
      return s;
    }
  } catch (e) {}
  return { balance: 0, history: [], spentToday: {}, date: today() };
}

function saveState() {
  state.date = today();
  localStorage.setItem('trkr_v3', JSON.stringify(state));
}

// ── Render ──
function render() {
  // Balance circle
  const bal = state.balance;
  document.getElementById('balance-val').textContent = bal;

  const maxDisplay = 120;
  const progress = Math.min(bal / maxDisplay, 1);
  const offset = CIRC_C * (1 - progress);
  document.getElementById('ring-progress').style.strokeDashoffset = offset;
  document.getElementById('ring-progress').setAttribute('stroke-dasharray', CIRC_C);

  // Date
  const d = new Date();
  document.getElementById('header-date').textContent =
    d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  // Log list
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
let overlayMode = 'earn';

function openOverlay(mode) {
  overlayMode = mode;
  selections = {};

  const overlay = document.getElementById('overlay');
  const sheet = document.getElementById('overlay-sheet');

  // Build sheet title
  document.getElementById('sheet-title').textContent =
    mode === 'earn' ? 'Earn Screen Time' : 'Use Screen Time';
  document.getElementById('sheet-subtitle').textContent =
    mode === 'earn'
      ? 'Tap activities to add — each tap = 15 min'
      : 'Tap to log what was used — each tap = 15 min';

  // Build categories
  buildCategories();
  updateConfirm();

  overlay.classList.add('open');
}

function closeOverlay() {
  document.getElementById('overlay').classList.remove('open');
}

function buildCategories() {
  const earnCol = document.getElementById('earn-col');
  const spendCol = document.getElementById('spend-col');

  earnCol.innerHTML = EARN_CATS.map(cat => `
    <button class="cat-btn earn-btn" id="cat-${cat.id}" onclick="tapCat('${cat.id}', 'earn')">
      <div class="cat-top">
        <span class="cat-icon">${cat.icon}</span>
        <span class="cat-count" id="count-${cat.id}">0</span>
      </div>
      <div class="cat-name">${cat.name}</div>
      <div class="cat-pts">${cat.pts}</div>
    </button>
  `).join('');

  spendCol.innerHTML = SPEND_CATS.map(cat => {
    const spent = state.spentToday[cat.id] || 0;
    const atLimit = spent >= SCREEN_LIMIT_PER_TYPE;
    const usedMins = spent * 15;
    return `
      <button class="cat-btn spend-btn ${atLimit ? 'disabled-cat' : ''}"
        id="cat-${cat.id}" onclick="tapCat('${cat.id}', 'spend')">
        <div class="cat-top">
          <span class="cat-icon">${cat.icon}</span>
          <span class="cat-count" id="count-${cat.id}">0</span>
        </div>
        <div class="cat-name">${cat.name}</div>
        <div class="cat-pts">${cat.pts} <span class="limit-pill">${usedMins}/60</span></div>
      </button>
    `;
  }).join('');
}

function tapCat(id, side) {
  if (overlayMode !== side) return;

  if (!selections[id]) selections[id] = 0;
  selections[id]++;

  // If spend, check limit
  if (side === 'spend') {
    const cat = SPEND_CATS.find(c => c.id === id);
    const alreadySpent = state.spentToday[id] || 0;
    const maxMore = SCREEN_LIMIT_PER_TYPE - alreadySpent;
    if (selections[id] > maxMore) {
      selections[id] = maxMore;
    }
  }

  // Update count badge
  const countEl = document.getElementById(`count-${id}`);
  const btn = document.getElementById(`cat-${id}`);
  const n = selections[id];
  countEl.textContent = n;
  if (n > 0) {
    countEl.classList.add('visible');
    btn.classList.add('active');
  }

  updateConfirm();
}

function updateConfirm() {
  const totalUnits = Object.values(selections).reduce((a, b) => a + b, 0);
  const totalMins = totalUnits * 15;

  const totalEl = document.getElementById('confirm-total');
  const bdEl = document.getElementById('confirm-breakdown');
  const btn = document.getElementById('confirm-btn');
  const warn = document.getElementById('confirm-warning');

  totalEl.innerHTML = `${totalMins} <span>min</span>`;

  // Build breakdown string
  const cats = overlayMode === 'earn' ? EARN_CATS : SPEND_CATS;
  const parts = cats
    .filter(c => selections[c.id] > 0)
    .map(c => `${c.icon} ×${selections[c.id]}`);
  bdEl.textContent = parts.join('  ·  ');

  let warning = '';
  let disabled = totalMins === 0;

  if (overlayMode === 'spend') {
    if (totalMins > state.balance) {
      warning = `Not enough time — balance is ${state.balance} min`;
      disabled = true;
    }
  }

  warn.textContent = warning;
  btn.disabled = disabled;
  btn.className = `confirm-btn ${overlayMode === 'spend' ? 'spend-confirm' : ''}`;
  btn.textContent = disabled && totalMins === 0
    ? 'Tap to select'
    : `${overlayMode === 'earn' ? 'Add' : 'Use'} ${totalMins} min`;
}

function confirmLog() {
  const cats = overlayMode === 'earn' ? EARN_CATS : SPEND_CATS;
  const ts = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  cats.forEach(cat => {
    const n = selections[cat.id] || 0;
    if (!n) return;
    const mins = n * 15;

    if (overlayMode === 'earn') {
      state.balance += mins;
      state.history.push({
        type: 'earn', icon: cat.icon, name: cat.name, mins, timestamp: ts,
      });
    } else {
      state.balance = Math.max(0, state.balance - mins);
      state.spentToday[cat.id] = (state.spentToday[cat.id] || 0) + n;
      state.history.push({
        type: 'spend', icon: cat.icon, name: cat.name, mins, timestamp: ts,
      });
    }
  });

  saveState();
  render();
  closeOverlay();
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  render();

  // Close overlay on backdrop click
  document.getElementById('overlay-backdrop').addEventListener('click', closeOverlay);

  // Prevent scroll bleed
  document.getElementById('overlay-sheet').addEventListener('touchmove', e => e.stopPropagation());
});
