// ================================================
// routes/playerRoutes.js  —  Player Endpoints
// ================================================
// Full URLs:
//   GET /api/players              ← all players (with filters)
//   GET /api/players/teams        ← list of all teams
//   GET /api/players/:id          ← single player
//
// NOTE: /teams must be defined BEFORE /:id
// otherwise Express will treat "teams" as an :id param
// ================================================

const express          = require('express');
const router           = express.Router();
const playerController = require('../controllers/playerController');

router.get('/',       playerController.getAllPlayers);
router.get('/teams',  playerController.getTeams);      // ← before /:id !
router.get('/:id',    playerController.getPlayerById);

module.exports = router;
