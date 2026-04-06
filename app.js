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
];

const SPEND_CATS = [
  { id: 'tv',       icon: '📺', name: 'TV',       pts: '15 min' },
  { id: 'computer', icon: '💻', name: 'Computer', pts: '15 min' },
  { id: 'phone',    icon: '📱', name: 'Phone',    pts: '15 min' },
  { id: 'tablet',   icon: '📟', name: 'Tablet',   pts: '15 min' },
];

// ── State ──
let state      = loadState();
let currentSel = null;

// ── Persistence ──
function today() { return new Date().toISOString().slice(0, 10); }

function loadState() {
  try {
    const raw = localStorage.getItem('trkr_v8');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.date !== today()) { s.history = []; s.date = today(); }
      return s;
    }
  } catch (e) {}
  return { balance: 0, history: [], date: today() };
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

  // Inner quarters: completed hours (floor of abs balance / 60)
  const hours = Math.min(Math.floor(absBal / 60), 4);
  document.getElementById('q1').style.opacity = hours >= 1 ? '1' : '0';
  document.getElementById('q2').style.opacity = hours >= 2 ? '1' : '0';
  document.getElementById('q3').style.opacity = hours >= 3 ? '1' : '0';
  document.getElementById('q4').style.opacity = hours >= 4 ? '1' : '0';

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
  const warn = document.getElementById('confirm-warning');
  const hasSel = currentSel && currentSel.taps > 0;

  if (!hasSel) {
    btn.disabled = true;
    btn.textContent = 'Confirm';
    warn.textContent = '';
    return;
  }

  const mins = currentSel.taps * 15;
  const sign = currentSel.side === 'earn' ? '+' : '−';

  // No balance check for spend — allow going negative
  warn.textContent = '';
  btn.disabled = false;
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
    state.balance -= mins;  // can go negative — no floor
    state.history.push({ type: 'spend', icon: cat.icon, name: cat.name, mins, timestamp: ts });
  }

  saveState();
  render();
  closeOverlay();
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
