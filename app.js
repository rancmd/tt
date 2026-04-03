// ── Constants ──
const MAX_TAPS   = 4;           // 4 taps = 60 min → next tap resets to 0
const OUTER_R    = 128;
const OUTER_C    = +(2 * Math.PI * OUTER_R).toFixed(3); // ~804.248
// RESET_MS removed — timing now split into DELAY_MS + FILL_MS in startPress
const RESET_R    = 136;
const RESET_C    = +(2 * Math.PI * RESET_R).toFixed(3); // ~854.513

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
    const raw = localStorage.getItem('trkr_v7');
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
  localStorage.setItem('trkr_v7', JSON.stringify(state));
}

// ── Render ──
function render() {
  const bal = state.balance;
  document.getElementById('balance-val').textContent = bal;

  // Circle 1 (outer, r=128): minutes within current hour (0–59)
  const minInHour = bal % 60;
  const outerRing = document.getElementById('ring-outer');
  outerRing.setAttribute('stroke-dasharray', OUTER_C);
  outerRing.style.strokeDashoffset = OUTER_C * (1 - minInHour / 60);

  // Circle 2 (inner, r=104): completed full hours shown as quarters (1–4)
  // Each quarter is a separate <circle> with hardcoded dasharray/dashoffset in the SVG.
  // We just toggle opacity here.
  const hours = Math.min(Math.floor(bal / 60), 4);
  document.getElementById('q1').style.opacity = hours >= 1 ? '1' : '0';
  document.getElementById('q2').style.opacity = hours >= 2 ? '1' : '0';
  document.getElementById('q3').style.opacity = hours >= 3 ? '1' : '0';
  document.getElementById('q4').style.opacity = hours >= 4 ? '1' : '0';

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

// ── Long-press reset ──
// Ring appears after DELAY_MS; total hold = DELAY_MS + FILL_MS
const DELAY_MS = 1000;   // wait before showing ring
const FILL_MS  = 2000;   // ring fills over this time (total hold = 3s)

let pressTimer   = null;
let delayTimer   = null;
let pressStart   = null;
let animFrame    = null;
let pressing     = false;

function startPress(e) {
  if (document.getElementById('overlay').classList.contains('open')) return;
  pressing   = true;
  pressStart = null; // set when ring actually starts

  const resetRing = document.getElementById('reset-ring');
  const resetSvg  = document.getElementById('reset-svg');
  const circleBtn = document.getElementById('circle-btn');

  resetRing.setAttribute('stroke-dasharray', RESET_C);
  resetRing.style.strokeDashoffset = RESET_C;

  // After DELAY_MS, show ring and start animation
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
        doReset();
      }
    }
    animFrame = requestAnimationFrame(animateRing);
  }, DELAY_MS);

  // Total timeout
  pressTimer = setTimeout(doReset, DELAY_MS + FILL_MS);
}

function cancelPress() {
  if (!pressing) return;
  pressing = false;
  clearTimeout(pressTimer);
  clearTimeout(delayTimer);
  cancelAnimationFrame(animFrame);

  const resetRing = document.getElementById('reset-ring');
  const resetSvg  = document.getElementById('reset-svg');
  const circleBtn = document.getElementById('circle-btn');

  resetSvg.style.opacity = '0';
  resetRing.style.strokeDashoffset = RESET_C;
  circleBtn.classList.remove('pressing');
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

  // Hide reset ring
  const resetSvg  = document.getElementById('reset-svg');
  const resetRing = document.getElementById('reset-ring');
  const circleBtn = document.getElementById('circle-btn');
  resetSvg.style.opacity = '0';
  resetRing.style.strokeDashoffset = RESET_C;
  circleBtn.classList.remove('pressing');

  // Show toast
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
  // Switch to new category → clear previous
  if (!currentSel || currentSel.id !== id) {
    if (currentSel) {
      const ob = document.getElementById(`cat-${currentSel.id}`);
      const oc = document.getElementById(`count-${currentSel.id}`);
      if (ob) ob.classList.remove('active');
      if (oc) { oc.classList.remove('visible'); oc.textContent = '0'; }
    }
    currentSel = { id, side, taps: 0 };
  }

  // Increment; reset to 0 after MAX_TAPS
  currentSel.taps = (currentSel.taps >= MAX_TAPS) ? 0 : currentSel.taps + 1;

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
    btn.disabled    = true;
    btn.textContent = 'Confirm';
    warn.textContent = '';
    return;
  }

  const mins    = currentSel.taps * 15;
  let warning   = '';
  let disabled  = false;

  if (currentSel.side === 'spend' && mins > state.balance) {
    warning  = `Not enough balance — you have ${state.balance} min`;
    disabled = true;
  }

  warn.textContent = warning;
  btn.disabled     = disabled;
  const sign       = currentSel.side === 'earn' ? '+' : '−';
  btn.textContent  = `Confirm ${sign}${mins} min`;
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

  // Circle interactions
  const wrap = document.getElementById('circle-wrap');

  // Tap = open overlay (short press)
  // Long press = reset

  let didLongPress = false;

  wrap.addEventListener('pointerdown', (e) => {
    didLongPress = false;
    startPress(e);
    pressTimer = setTimeout(() => {
      didLongPress = true;
    }, RESET_MS - 100);
  });

  wrap.addEventListener('pointerup', (e) => {
    cancelPress();
    if (!didLongPress) {
      openOverlay();
    }
    didLongPress = false;
  });

  wrap.addEventListener('pointerleave', cancelPress);
  wrap.addEventListener('pointercancel', cancelPress);

  // Backdrop
  document.getElementById('overlay-backdrop').addEventListener('click', closeOverlay);

  // Log scroll
  document.getElementById('log-list').addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
});
