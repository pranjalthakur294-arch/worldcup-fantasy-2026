// ============================================================
// routes/teamRoutes.js
// ============================================================
// Routes are a simple MAP:
//   HTTP Method + URL path  →  middleware chain  →  controller function
//
// This file defines 3 endpoints, all under the /api/teams prefix
// (the prefix itself is set in server.js: app.use('/api/teams', teamRoutes))
//
// ┌──────────────────┬────────────────────────────────────────┐
// │ Full URL         │ What it does                           │
// ├──────────────────┼────────────────────────────────────────┤
// │ POST /api/teams  │ Save or update the user's squad        │
// │ GET  /api/teams/my │ Get the user's saved squad           │
// │ DELETE /api/teams/my │ Reset/delete the user's squad      │
// └──────────────────┴────────────────────────────────────────┘
//
// ALL routes here are PROTECTED — a valid JWT token is required.
// The `protect` middleware runs FIRST on every request.
// If the token is missing or invalid, protect() returns 401
// and the controller never runs.
// ============================================================

const express        = require('express');
const router         = express.Router();
const teamController = require('../controllers/teamController');
const protect        = require('../middleware/authMiddleware');

// ── Apply JWT auth to ALL routes in this file ───────────────
// router.use(protect) means every route below automatically
// requires a valid token. You don't need to add protect to
// each route individually.
router.use(protect);

// ── POST /api/teams ─────────────────────────────────────────
// Save or update the logged-in user's fantasy squad.
//
// Request flow:
//   1. protect middleware  → verifies JWT, sets req.user
//   2. teamController.saveTeam → validates + saves to DB
//
// Body expected (JSON):
//   {
//     "team_name":        "My Dream Squad",
//     "player_ids":       [1, 4, 7, 9, 12, 15, 16, 19, 22, 24, 26, 3, 8, 20, 27],
//     "captain_id":       26,
//     "budget_remaining": 9.2
//   }
router.post('/', teamController.saveTeam);

// ── GET /api/teams/my ───────────────────────────────────────
// Fetch the logged-in user's saved squad.
// Used when the user revisits the app and we want to reload
// their previously saved team into the frontend UI.
//
// No body needed — user identity comes from the JWT token.
router.get('/my', teamController.getMyTeam);

// ── DELETE /api/teams/my ────────────────────────────────────
// Delete the logged-in user's squad entirely.
// Useful for a "Reset team / Start over" button on the frontend.
router.delete('/my', teamController.deleteMyTeam);
router.post('/recalculate-points', teamController.recalculatePoints);
module.exports = router;
