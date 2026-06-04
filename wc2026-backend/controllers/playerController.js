// ================================================
// controllers/playerController.js  —  Player Logic
// ================================================

const PlayerModel = require('../models/playerModel');

const playerController = {

  // GET /api/players
  // Supports query params: ?position=FWD&team=Brazil&maxPrice=10&sortBy=total_pts
  async getAllPlayers(req, res, next) {
    try {
      const { position, team, maxPrice, sortBy } = req.query;
      const players = await PlayerModel.getAll({ position, team, maxPrice, sortBy });

      res.json({
        success: true,
        count: players.length,
        data: players,
      });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/players/:id
  async getPlayerById(req, res, next) {
    try {
      const player = await PlayerModel.findById(req.params.id);
      if (!player) {
        return res.status(404).json({ success: false, message: 'Player not found' });
      }
      res.json({ success: true, data: player });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/players/teams
  async getTeams(req, res, next) {
    try {
      const teams = await PlayerModel.getTeams();
      res.json({ success: true, data: teams });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = playerController;
