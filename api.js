// ============================================================
// public/api.js  —  Frontend ↔ Backend Bridge
// ============================================================
// Add this to your HTML BEFORE app.js:
//   <script src="api.js"></script>
//   <script src="app.js"></script>
//
// This file provides all the functions needed to communicate
// with the Node.js backend. Your app.js calls these functions
// — it never writes fetch() calls directly.
//
// FUNCTIONS EXPORTED (all global, no import needed):
//   Auth.isLoggedIn()           check if user has a token
//   Auth.getUser()              get saved user info
//   loginUser(email, password)  login + store token
//   registerUser(u, e, p)       register + store token
//   logoutUser()                clear token + redirect
//   saveSquad(...)              POST /api/teams
//   loadMyTeam()                GET /api/teams/my-team
//   deleteMyTeam()              DELETE /api/teams/my-team
//   getPlayers(filters)         GET /api/players
// ============================================================

// ── CONFIGURATION ────────────────────────────────────────────
// Change this if your backend runs on a different port or host
const BASE_URL = 'http://localhost:5000/api';

// ============================================================
// AUTH HELPERS
// ============================================================
// Thin wrapper around localStorage so the rest of the code
// doesn't touch localStorage directly. If you ever switch to
// sessionStorage or cookies, you only change it here.
// ============================================================
const Auth = {
  setToken(token) {
    localStorage.setItem('wc2026_token', token);
  },
  getToken() {
    return localStorage.getItem('wc2026_token');
  },
  setUser(user) {
    localStorage.setItem('wc2026_user', JSON.stringify(user));
  },
  getUser() {
    const raw = localStorage.getItem('wc2026_user');
    return raw ? JSON.parse(raw) : null;
  },
  clearAll() {
    localStorage.removeItem('wc2026_token');
    localStorage.removeItem('wc2026_user');
  },
  isLoggedIn() {
    return !!this.getToken();
  },
};

// ============================================================
// BASE FETCH WRAPPER
// ============================================================
// Every API call in this file goes through apiFetch().
// It automatically:
//   • Sets Content-Type: application/json on every request
//   • Attaches the JWT token if one exists in localStorage
//   • Parses the JSON response
//   • Throws a readable error if the server returned 4xx/5xx
//
// You never call this directly — use the named functions below.
// ============================================================
async function apiFetch(endpoint, { method = 'GET', body = null } = {}) {
  const token = Auth.getToken();

  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Attach JWT token if the user is logged in.
      // The backend reads: Authorization: Bearer eyJhbGci...
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    // Only include body for POST/PUT/PATCH
    ...(body && { body: JSON.stringify(body) }),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);
  const data     = await response.json();

  // If HTTP status is 4xx or 5xx, throw a proper error
  // so calling code can catch it and show the user a message
  if (!response.ok) {
    const message = data.message
      || (data.errors && data.errors.join(', '))
      || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

// ============================================================
// REGISTER
// ============================================================
// Creates a new user account. On success, stores the JWT token
// and user info in localStorage so they're immediately logged in.
//
// USAGE:
//   try {
//     const result = await registerUser('Rahul', 'rahul@email.com', 'pass123');
//     console.log('Welcome,', result.user.username);
//   } catch (err) {
//     showToast('❌ ' + err.message); // e.g. "Email already registered"
//   }
// ============================================================
async function registerUser(username, email, password) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body:   { username, email, password },
  });
  Auth.setToken(data.token);
  Auth.setUser(data.user);
  return data;
}

// ============================================================
// LOGIN
// ============================================================
// Logs in an existing user and stores their JWT token.
//
// USAGE:
//   try {
//     const result = await loginUser('rahul@email.com', 'pass123');
//     console.log('Logged in as', result.user.username);
//     goToPage('create-team');
//   } catch (err) {
//     showToast('❌ ' + err.message); // "Invalid email or password"
//   }
// ============================================================
async function loginUser(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body:   { email, password },
  });
  Auth.setToken(data.token);
  Auth.setUser(data.user);
  return data;
}

// ============================================================
// LOGOUT
// ============================================================
// Clears the JWT token and user data from localStorage.
// JWTs are stateless — there's nothing to call on the backend.
//
// USAGE:
//   document.getElementById('logout-btn').addEventListener('click', () => {
//     logoutUser();
//     squad     = [];
//     captainId = null;
//     goToPage('overview');
//   });
// ============================================================
function logoutUser() {
  Auth.clearAll();
  console.log('Logged out.');
}

// ============================================================
// SAVE SQUAD
// ============================================================
// Sends the user's built squad to POST /api/teams.
// The backend validates every rule server-side (15 players,
// budget, position limits, captain in squad) and saves to MySQL.
//
// PARAMETERS:
//   teamName        {string}   Name for the squad
//   playerIds       {number[]} Array of exactly 15 player IDs
//   captainId       {number}   ID of the chosen captain
//   budgetRemaining {number}   How much budget is left (e.g. 9.2)
//
// USAGE — wire into your "Save team" button in app.js:
//
//   async function saveTeam() {
//     if (!Auth.isLoggedIn()) {
//       showToast('Please log in to save your team');
//       return;
//     }
//     try {
//       const result = await saveSquad(
//         'My Dream Squad',
//         squad,           // your array of 15 player IDs from state
//         captainId,       // your captainId from state
//         getBudgetLeft()  // your existing getBudgetLeft() function
//       );
//       showToast(result.message);  // "Squad saved successfully! 🎉"
//     } catch (err) {
//       showToast('❌ ' + err.message); // backend validation error
//     }
//   }
// ============================================================
async function saveSquad(teamName, playerIds, captainId, budgetRemaining) {
  return await apiFetch('/teams', {
    method: 'POST',
    body: {
      team_name:        teamName,
      player_ids:       playerIds,
      captain_id:       captainId,
      budget_remaining: budgetRemaining,
    },
  });
}

// ============================================================
// LOAD MY TEAM
// ============================================================
// Calls GET /api/teams/my-team to fetch the user's saved squad.
// The backend returns FULL player objects (not just IDs), plus
// helpers like position_summary, starters, bench, and captain.
//
// Call this on page load to restore the user's squad from the DB.
//
// FULL RESPONSE SHAPE:
//   {
//     "success": true,
//     "has_team": true,
//     "data": {
//       "team_id":          1,
//       "team_name":        "My Dream Squad",
//       "captain_id":       26,
//       "budget_remaining": 9.2,
//       "player_ids":       [26, 27, 16, ...],   ← raw IDs for state
//       "players":          [ {...}, {...}, ... ],← full player objects
//       "starters":         [ 11 players ],       ← first 11
//       "bench":            [ 4 players ],        ← last 4
//       "captain":          { id, name, position, price, ... },
//       "position_summary": { "GK":2, "DEF":5, "MID":5, "FWD":3 },
//       "player_count":     15,
//       "is_complete":      true,
//       "created_at":       "2026-05-28T10:30:00.000Z",
//       "updated_at":       "2026-05-28T14:22:00.000Z"
//     }
//   }
//
// USAGE — call this in your app.js init block:
//
//   async function tryRestoreTeam() {
//     if (!Auth.isLoggedIn()) return; // not logged in, skip
//     try {
//       const result = await loadMyTeam();
//
//       if (!result.has_team) return; // user hasn't built one yet
//
//       const saved = result.data;
//
//       // Restore your state variables
//       squad     = saved.player_ids;   // array of IDs
//       captainId = saved.captain_id;
//
//       // Re-render the UI with the loaded data
//       renderPitch();
//       renderPlayerList();
//       updateFooter();
//
//       showToast(`✅ ${saved.team_name} restored!`);
//
//     } catch (err) {
//       // Only show error if it's not "no team yet" (which is normal)
//       if (!err.message.includes('not saved')) {
//         showToast('Could not load your team: ' + err.message);
//       }
//     }
//   }
// ============================================================
async function loadMyTeam() {
  return await apiFetch('/teams/my', { method: 'GET' });
}

// ============================================================
// DELETE MY TEAM
// ============================================================
// Resets the user's squad. Use for a "Start Over" button.
//
// USAGE:
//   async function resetTeam() {
//     if (!confirm('Are you sure? This will clear your saved squad.')) return;
//     try {
//       await deleteMyTeam();
//       squad     = [];
//       captainId = null;
//       renderPitch();
//       renderPlayerList();
//       updateFooter();
//       showToast('Squad reset. Start fresh! 🔄');
//     } catch (err) {
//       showToast('❌ ' + err.message);
//     }
//   }
// ============================================================
async function deleteMyTeam() {
  return await apiFetch('/teams/my', { method: 'DELETE' });
}

// ============================================================
// GET PLAYERS
// ============================================================
// Loads players from the backend with optional filters.
// Use this to replace the hardcoded PLAYERS array in app.js.
//
// USAGE:
//   const result = await getPlayers({ position: 'FWD', maxPrice: 10 });
//   const PLAYERS = result.data; // array of player objects
//
//   // Or with all filters:
//   const result = await getPlayers({
//     position: 'MID',
//     team:     'Brazil',
//     maxPrice: 12,
//     sortBy:   'total_pts',
//   });
// ============================================================
async function getPlayers(filters = {}) {
  const params = new URLSearchParams();
  if (filters.position && filters.position !== 'All') params.set('position', filters.position);
  if (filters.team     && filters.team     !== 'All') params.set('team',     filters.team);
  if (filters.maxPrice && filters.maxPrice !== 'All') params.set('maxPrice', filters.maxPrice);
  if (filters.sortBy)                                  params.set('sortBy',   filters.sortBy);

  const qs = params.toString() ? `?${params.toString()}` : '';
  return await apiFetch(`/players${qs}`, { method: 'GET' });
}
