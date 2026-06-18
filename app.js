/* =====================================================
   FIFA WORLD CUP 2026 — FANTASY FOOTBALL
   app.js — Player data, state, and all game logic
   ===================================================== */

async function loadPlayers() {
  try {
    const response = await fetch('https://worldcup-fantasy-2026-api.onrender.com/api/players');
    const result = await response.json();
    PLAYERS = result.data.map(p => ({
      ...p,
      pos:      p.position,
      pts:      Number(p.total_pts)      || 0,
      selected: Number(p.selected_pct)   || 0,
      md:       Number(p.md_pts)         || 0,
      country:  p.country_code,
      ppm:      Number(p.pts_per_million)|| 0,
      // Normalise price: backend may send "8.40" (string) or 840 (cents) — handle both
      price: (() => {
        const raw = parseFloat(p.price);
        if (isNaN(raw)) return 0;
        // If price looks like it's in pence/cents (e.g. 840 instead of 8.4), divide by 100
        return raw > 50 ? parseFloat((raw / 100).toFixed(1)) : raw;
      })(),
    }));
    filteredPlayers = [...PLAYERS];

    // Populate team filter dropdown
    const teams = [...new Set(PLAYERS.map(p => p.team))].sort();
    const sel = document.getElementById('filter-team');
    if (sel) {
      teams.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t; opt.textContent = t;
        sel.appendChild(opt);
      });
    }

    console.log(`Loaded ${PLAYERS.length} players`);
  } catch (err) {
    console.error('Failed to load players', err);
    showToast('Failed to load players');
  }
}

let PLAYERS = [];

// =====================================================
// CONSTANTS
// =====================================================
const BUDGET    = 100;           // $100m
const MAX_SQUAD = 15;
const POS_MAX   = { GK: 2, DEF: 5, MID: 5, FWD: 3 };

const SQUAD_ROWS = [
  { pos: 'FWD', slots: 3 },
  { pos: 'MID', slots: 5 },
  { pos: 'DEF', slots: 5 },
  { pos: 'GK',  slots: 2 },
];

const STARTER_ROWS = [
  { pos: 'FWD', slots: 3 },
  { pos: 'MID', slots: 5 },
  { pos: 'DEF', slots: 5 },
  { pos: 'GK',  slots: 1 },
];

// =====================================================
// STATE
// =====================================================
let squad      = [];
let starters   = [];
let bench      = [];
let captainId  = null;
let sortKey    = 'pts';
let filteredPlayers = [...PLAYERS];

// Substitution state
let subMode       = false;   // are we mid-sub?
let subSourceId   = null;    // id of player being swapped out
let subSourceType = null;    // 'starter' or 'bench'

// =====================================================
// HELPERS
// =====================================================
const getPlayer     = id  => PLAYERS.find(p => p.id === id);
const getBudgetUsed = ()  => squad.reduce((sum, id) => {
  const p = getPlayer(id);
  const price = p ? parseFloat(p.price) : 0;
  return sum + (isNaN(price) ? 0 : price);
}, 0);
const getBudgetLeft = ()  => {
  const used = getBudgetUsed();
  const left = BUDGET - used;
  if (isNaN(left)) return BUDGET;
  return Math.max(0, Math.round(left * 10) / 10);
};
const countByPos    = pos => squad.filter(id => { const p = getPlayer(id); return p && p.pos === pos; }).length;

function countStarterPositions() {
  const list = starters.map(getPlayer);
  return {
    GK:  list.filter(p => p.pos === 'GK').length,
    DEF: list.filter(p => p.pos === 'DEF').length,
    MID: list.filter(p => p.pos === 'MID').length,
    FWD: list.filter(p => p.pos === 'FWD').length
  };
}

function isValidStartingFormation() {
  const c = countStarterPositions();
  return c.GK === 1 && c.DEF >= 3 && c.DEF <= 5 && c.MID >= 3 && c.MID <= 5 && c.FWD >= 1 && c.FWD <= 3;
}

// =====================================================
// FILTERS & SORT
// =====================================================
function applyFilters() {
  const pos      = document.getElementById('filter-pos').value;
  const team     = document.getElementById('filter-team').value;
  const maxPrice = document.getElementById('filter-price').value;

  filteredPlayers = PLAYERS.filter(p => {
    if (pos      !== 'All' && p.pos  !== pos)                  return false;
    if (team     !== 'All' && p.team !== team)                  return false;
    if (maxPrice !== 'All' && p.price > parseFloat(maxPrice))  return false;
    return true;
  });
  renderPlayerList();
}

function sortBy(key) {
  sortKey = key;
  renderPlayerList();
}

// =====================================================
// RENDER — PLAYER LIST (right panel)
// =====================================================
function renderPlayerList() {
  const sorted = [...filteredPlayers].sort((a, b) => b[sortKey] - a[sortKey]);
  document.getElementById('player-list').innerHTML = sorted.map(p => {
    const isSel = squad.includes(p.id);
    return `
      <div class="player-row ${isSel ? 'selected-row' : ''}" onclick="togglePlayer(${p.id})">
        <div class="player-info">
          ${isSel
            ? `<div class="check-icon">✓</div>`
            : `<div class="player-avatar">${p.country}</div>`}
          <div>
            <div class="player-row-name">${p.name}</div>
            <div class="player-row-team">${p.team} · <span class="player-row-pos">${p.pos}</span></div>
          </div>
        </div>
        <div class="cell-r">$${p.price}m</div>
        <div class="cell-r pts">${p.pts}</div>
        <div class="cell-r pct">${p.selected}%</div>
        <div class="cell-r">${p.md}</div>
        <div class="cell-r">${p.ppm}</div>
      </div>`;
  }).join('');
}

// =====================================================
// RENDER — PITCH (left panel, create-team page)
// =====================================================
function renderPitch() {
  let html = '';
  SQUAD_ROWS.forEach(row => {
    const inPos = squad.map(getPlayer).filter(p => p.pos === row.pos);
    html += `<div class="position-row">`;
    for (let i = 0; i < row.slots; i++) {
      const player = inPos[i];
      if (player) {
        html += `
          <div class="player-slot">
            <div class="player-jersey jersey-filled" style="position:relative">
              <span style="font-size:22px">${player.emoji}</span>
              <span class="remove-btn" onclick="event.stopPropagation(); removePlayer(${player.id})">✕</span>
            </div>
            <div class="player-card-label filled">${player.name.split(' ').pop()}</div>
            <div class="player-price-label">$${player.price}m</div>
          </div>`;
      } else {
        html += `
          <div class="player-slot" onclick="document.getElementById('filter-pos').value='${row.pos}'; applyFilters()">
            <div class="player-jersey jersey-empty">
              <span style="font-size:18px; color:rgba(0,180,216,0.6)">+</span>
            </div>
            <div class="pos-label">${row.pos}</div>
          </div>`;
      }
    }
    html += `</div>`;
  });
  document.getElementById('pitch-positions').innerHTML = html;
}

// =====================================================
// RENDER — CAPTAIN PAGE
// =====================================================
function renderCaptain() {
  const rows = STARTER_ROWS
    .map(r => starters.map(getPlayer).filter(p => p.pos === r.pos))
    .filter(r => r.length > 0);

  document.getElementById('captain-rows').innerHTML = rows.map(row =>
    `<div class="captain-row">
      ${row.map(player => `
        <div class="captain-slot ${captainId === player.id ? 'is-captain' : ''}" onclick="selectCaptain(${player.id})">
          <div class="captain-jersey">
            <span style="font-size:30px">${player.emoji}</span>
            ${captainId === player.id ? '<div class="captain-badge">C</div>' : ''}
          </div>
          <div class="captain-name">${player.name}</div>
          <div class="captain-date">15 Jun</div>
        </div>`).join('')}
    </div>`
  ).join('');
}

// =====================================================
// RENDER — SAVE PAGE  (with substitution support)
// =====================================================
function renderSave() {
  const startersList = starters.map(getPlayer);
  const benchList    = bench.map(getPlayer);

  const pitchRows = STARTER_ROWS
    .map(r => startersList.filter(p => p.pos === r.pos))
    .filter(r => r.length > 0);

  // ── Starters ──
  document.getElementById('save-rows').innerHTML = pitchRows.map(row =>
    `<div class="save-row">
      ${row.map(p => {
        const isSource  = subMode && subSourceId === p.id;
        const highlight = subMode && subSourceType === 'bench';
        return `
          <div class="save-slot ${isSource ? 'sub-source' : ''} ${highlight ? 'sub-target' : ''}"
               onclick="handleSubClick('starter', ${p.id})">
            <div class="save-jersey ${captainId === p.id ? 'cap' : ''}">
              <span style="font-size:22px">${p.emoji}</span>
              ${captainId === p.id ? '<div class="cap-c">C</div>' : ''}
            </div>
            <div class="save-name">${p.name}</div>
            <div class="save-price">$${p.price}m</div>
            <div class="save-pos-tag">${p.pos}</div>
            ${!subMode
              ? `<button class="sub-btn" onclick="event.stopPropagation(); startSub('starter',${p.id})">⇄</button>`
              : ''}
          </div>`;
      }).join('')}
    </div>`
  ).join('');

  // ── Bench ──
  const posOrder   = ['GK','DEF','MID','FWD'];
  const sortedBench = [...benchList].sort((a,b) => posOrder.indexOf(a.pos) - posOrder.indexOf(b.pos));

  document.getElementById('bench-row').innerHTML = sortedBench.map((p, i) => {
    const isSource  = subMode && subSourceId === p.id;
    const highlight = subMode && subSourceType === 'starter';
    return `
      <div class="bench-card ${isSource ? 'sub-source' : ''} ${highlight ? 'sub-target' : ''}"
           onclick="handleSubClick('bench', ${p.id})">
        <div class="bench-jersey"><span style="font-size:22px">${p.emoji}</span></div>
        <div class="bench-name">${p.name}</div>
        <div class="bench-price">$${p.price}m</div>
        <div class="bench-order">${i === 0 ? 'GK' : `${i}. ${p.pos}`}</div>
        ${!subMode
          ? `<button class="sub-btn" onclick="event.stopPropagation(); startSub('bench',${p.id})">⇄</button>`
          : ''}
      </div>`;
  }).join('');

  // Cancel sub banner
  const existing = document.getElementById('sub-cancel-bar');
  if (subMode) {
    if (!existing) {
      const bar = document.createElement('div');
      bar.id = 'sub-cancel-bar';
      bar.style.cssText = 'text-align:center;padding:10px;background:rgba(0,180,216,0.15);border:1px solid var(--wc-teal);border-radius:8px;margin:8px 0;font-size:13px;font-weight:600;color:var(--wc-teal)';
      bar.innerHTML = `Select the player to swap with <button onclick="cancelSub()" style="margin-left:12px;background:none;border:1px solid var(--wc-gray);border-radius:12px;padding:3px 12px;color:var(--wc-gray);cursor:pointer;font-size:12px">Cancel</button>`;
      document.querySelector('.bench-section').before(bar);
    }
  } else {
    if (existing) existing.remove();
  }
}

// =====================================================
// SUBSTITUTION LOGIC
// =====================================================
function startSub(type, id) {
  subMode       = true;
  subSourceId   = id;
  subSourceType = type;
  renderSave();
  showToast(type === 'starter' ? 'Pick a bench player to swap in' : 'Pick a starter to swap with');
}

function cancelSub() {
  subMode = false; subSourceId = null; subSourceType = null;
  renderSave();
}

function handleSubClick(clickedType, clickedId) {
  if (!subMode) return;

  // Clicking the source player again = cancel
  if (clickedId === subSourceId) { cancelSub(); return; }

  // Must click opposite type
  if (clickedType === subSourceType) {
    showToast(subSourceType === 'starter' ? 'Pick a bench player' : 'Pick a starter');
    return;
  }

  // Determine which is starter and which is bench
  const starterId = subSourceType === 'starter' ? subSourceId : clickedId;
  const benchId   = subSourceType === 'bench'   ? subSourceId : clickedId;

  const sPlayer = getPlayer(starterId);
  const bPlayer = getPlayer(benchId);

  // GK rule: only GK ↔ GK
  if (sPlayer.pos === 'GK' || bPlayer.pos === 'GK') {
    if (sPlayer.pos !== bPlayer.pos) {
      showToast('GK can only swap with GK');
      cancelSub(); return;
    }
  }

  // Validate formation after swap
  const newStarters = starters.map(id => id === starterId ? benchId : id);
  const tempStarters = newStarters.map(getPlayer);
  const counts = {
    GK:  tempStarters.filter(p => p.pos === 'GK').length,
    DEF: tempStarters.filter(p => p.pos === 'DEF').length,
    MID: tempStarters.filter(p => p.pos === 'MID').length,
    FWD: tempStarters.filter(p => p.pos === 'FWD').length
  };
  const valid = counts.GK === 1 && counts.DEF >= 3 && counts.DEF <= 5 && counts.MID >= 3 && counts.MID <= 5 && counts.FWD >= 1 && counts.FWD <= 3;
  if (!valid) {
    showToast('Invalid formation — swap not allowed');
    cancelSub(); return;
  }

  // Do the swap
  starters = newStarters;
  bench    = bench.map(id => id === benchId ? starterId : id);

  subMode = false; subSourceId = null; subSourceType = null;
  showToast('Substitution made ✓');
  renderSave();
}

// =====================================================
// SQUAD ACTIONS
// =====================================================
function togglePlayer(id) {
  const player = getPlayer(id);
  if (squad.includes(id)) {
    squad = squad.filter(x => x !== id);
  } else {
    if (squad.length >= MAX_SQUAD) { showToast('Squad full! (15/15)'); return; }
    if (countByPos(player.pos) >= POS_MAX[player.pos]) { showToast(`Max ${POS_MAX[player.pos]} ${player.pos}s`); return; }
    if (getBudgetLeft() < player.price || getBudgetLeft() - player.price < 0) { showToast('Not enough budget!'); return; }
    squad.push(id);
  }
  updateFooter();
  renderPitch();
  renderPlayerList();
}

function removePlayer(id) {
  squad = squad.filter(x => x !== id);
  updateFooter();
  renderPitch();
  renderPlayerList();
}

function selectCaptain(id) {
  captainId = id;
  renderCaptain();
}

// =====================================================
// FOOTER STATE
// =====================================================
function updateFooter() {
  const left = getBudgetLeft();
  document.getElementById('players-count').innerHTML   = `${squad.length}<span>/15</span>`;
  document.getElementById('budget-remaining').textContent = `$${left}m`;
  const btn = document.getElementById('continue-btn');
  if (btn) btn.classList.toggle('ready', squad.length === MAX_SQUAD);
}

// =====================================================
// NAVIGATION
// =====================================================
function goToPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  window.scrollTo(0, 0);
}

function tryGoToCaptain() {
  if (squad.length < MAX_SQUAD) { showToast('Select all 15 players first'); return; }

  const players = squad.map(getPlayer);
  starters = []; bench = [];

  const gks  = players.filter(p => p.pos === 'GK');
  starters.push(gks[0].id);
  bench.push(gks[1].id);

  const defs = players.filter(p => p.pos === 'DEF');
  starters.push(...defs.slice(0,3).map(p => p.id));
  bench.push(...defs.slice(3).map(p => p.id));

  const mids = players.filter(p => p.pos === 'MID');
  starters.push(...mids.slice(0,4).map(p => p.id));
  bench.push(...mids.slice(4).map(p => p.id));

  const fwds = players.filter(p => p.pos === 'FWD');
  starters.push(...fwds.slice(0,3).map(p => p.id));
  bench.push(...fwds.slice(3).map(p => p.id));

  renderCaptain();
  goToPage('captain');
}

function tryGoToSave() {
  if (!captainId) { showToast('Select a captain first'); return; }
  subMode = false; subSourceId = null; subSourceType = null;
  renderSave();
  goToPage('save');
}

async function saveTeam() {
  if (!Auth.isLoggedIn()) { showToast('Please login first'); return; }
  try {
    const result = await saveSquad('My Dream Squad', squad, captainId, getBudgetLeft());
    showToast(result.message);
    console.log('Team saved:', result);
    setTimeout(() => { window.location.href = 'fantasy_extension.html'; }, 1500);
  } catch (err) {
    console.error(err);
    showToast('❌ ' + err.message);
  }
}

// =====================================================
// TOAST
// =====================================================
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// =====================================================
// RESTORE SAVED TEAM
// =====================================================
async function tryRestoreTeam() {
  if (!Auth.isLoggedIn()) return;
  try {
    const result = await loadMyTeam();
    const saved  = result.data;
    squad     = saved.player_ids;
    captainId = saved.captain_id;
    updateFooter();
    renderPitch();
    renderPlayerList();
    showToast(`✅ ${saved.team_name} restored`);
  } catch (err) {
    console.log('No saved team found');
  }
}

// =====================================================
// OVERVIEW — show correct CTA based on login + team
// =====================================================
async function updateOverviewCTA() {
  const btn = document.getElementById('overview-cta-btn');
  if (!btn) return;

  if (!Auth.isLoggedIn()) {
    // Not logged in → go to auth
    btn.textContent = 'Create Team';
    btn.onclick = () => window.location.href = 'auth.html';
    return;
  }

  try {
    const result = await loadMyTeam();
    if (result && result.data) {
      // Team exists → Join League
      btn.textContent = 'Join League';
      btn.onclick = () => window.location.href = 'fantasy_extension.html';
    } else {
      btn.textContent = 'Create Team';
      btn.onclick = () => goToPage('create-team');
    }
  } catch {
    btn.textContent = 'Create Team';
    btn.onclick = () => goToPage('create-team');
  }
}

// =====================================================
// INIT
// =====================================================
(async function init() {
  await loadPlayers();
  await tryRestoreTeam();
  renderPlayerList();
  renderPitch();
  updateFooter();
  await updateOverviewCTA();
})();