// routes/leagueRoutes.js
const express = require('express');
console.log("LEAGUE ROUTES LOADED");
const router  = express.Router();

const {
  createLeague,
  joinLeague,
  getMyLeagues,
  getLeaderboard
} = require('../controllers/leagueController');
const authMiddleware = require('../middleware/authMiddleware'); // ← same middleware used in auth/player/team routes

// All league routes are JWT-protected
router.use(authMiddleware);

// POST /api/leagues/create  –  create a new league
router.post('/create', createLeague);

router.post('/join', joinLeague);

router.get('/my', getMyLeagues);

router.get('/:id/leaderboard', getLeaderboard);

module.exports = router;
