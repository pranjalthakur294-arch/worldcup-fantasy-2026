// ============================================================
// controllers/teamController.js
// ============================================================
// The CONTROLLER sits between the route and the model.
// It receives the HTTP request, runs business logic,
// calls the model, and sends back the HTTP response.
//
// It NEVER writes SQL — that lives in the model.
// It NEVER defines URLs — that lives in the route file.
//
// This controller handles:
//   POST /api/teams      ← save/update the user's squad
//   GET  /api/teams/my   ← fetch the user's saved squad
//   DELETE /api/teams/my ← delete (reset) the user's squad
// ============================================================

const TeamModel   = require('../models/teamModel');
const { calculateTeamPoints } = require('../services/pointsService');
const PlayerModel = require('../models/playerModel');

// ── Business rules ────────────────────────────────────────
// Keep these as named constants so they're easy to change later
const BUDGET    = 500;          // $100m total budget
const MAX_SQUAD = 15;           // exactly 15 players
const POS_MAX   = {             // max players per position
  GK:  2,
  DEF: 5,
  MID: 5,
  FWD: 3,
};
const POS_MIN = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 3
};

const teamController = {

  // ──────────────────────────────────────────────────────────
  // POST /api/teams
  // ──────────────────────────────────────────────────────────
  // Saves (or updates) the logged-in user's fantasy squad.
  //
  // req.user.id  — comes from the JWT middleware (authMiddleware.js)
  //                It decoded the token and attached the user's ID.
  //
  // req.body     — the JSON payload sent by the frontend:
  //   {
  //     "team_name":        "My Dream Squad",
  //     "player_ids":       [1, 4, 7, 9, 12, 15, 16, 19, 22, 24, 26, 3, 8, 20, 27],
  //     "captain_id":       26,
  //     "budget_remaining": 9.2
  //   }
  // ──────────────────────────────────────────────────────────
  async saveTeam(req, res, next) {
    try {
      // ── Step 1: Destructure the incoming request body ────
      const { team_name, player_ids, captain_id, budget_remaining } = req.body;
      const userId = req.user.id; // injected by JWT middleware

      // ── Step 2: Basic presence checks ───────────────────
      // These catch completely missing fields before anything else
      if (!team_name || typeof team_name !== 'string' || team_name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'team_name must be at least 2 characters long',
        });
      }

      if (!Array.isArray(player_ids)) {
        return res.status(400).json({
          success: false,
          message: 'player_ids must be an array of player IDs',
        });
      }

      if (!captain_id) {
        return res.status(400).json({
          success: false,
          message: 'captain_id is required',
        });
      }

      // ── Step 3: Validate exactly 15 players ─────────────
      if (player_ids.length !== MAX_SQUAD) {
        return res.status(400).json({
          success: false,
          message: `You must select exactly ${MAX_SQUAD} players. You selected ${player_ids.length}.`,
        });
      }

      // ── Step 4: No duplicate player IDs ─────────────────
      const uniqueIds = new Set(player_ids);
      if (uniqueIds.size !== player_ids.length) {
        return res.status(400).json({
          success: false,
          message: 'Duplicate players detected. Each player can only appear once.',
        });
      }

      // ── Step 5: Fetch real player data from the database ─
      // We never trust the frontend's player data —
      // we look up the actual players by ID from our own DB.
      const players = await PlayerModel.findByIds(player_ids);

      // Check that all IDs actually exist in the DB
      if (players.length !== MAX_SQUAD) {
        return res.status(400).json({
          success: false,
          message: 'One or more player IDs are invalid. Please refresh and try again.',
        });
      }

      // ── Step 6: Validate position counts ────────────────
      // Count how many of each position the user picked
      const posCounts = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
      players.forEach(p => {
        posCounts[p.position] = (posCounts[p.position] || 0) + 1;
      });

      // Check each position against its max allowed
      for (const [pos, max] of Object.entries(POS_MAX)) {
        if (posCounts[pos] > max) {
          return res.status(400).json({
            success: false,
            message: `Too many ${pos}s selected. Maximum allowed: ${max}. You have: ${posCounts[pos]}.`,
          });
        }
      }

      // Check each position against its minimum required
      for (const [pos, min] of Object.entries(POS_MIN)) {
        if ((posCounts[pos] || 0) < min) {
          return res.status(400).json({
            success: false,
            message: `Not enough ${pos}s. Minimum required: ${min}. You have: ${posCounts[pos] || 0}.`,
          });
        }
      }

      // ── Step 7: Validate budget ──────────────────────────
      // Calculate actual total cost from real DB prices (not frontend values)
      const totalCost = players.reduce((sum, p) => sum + parseFloat(p.price), 0);
      const roundedCost = Math.round(totalCost * 10) / 10;

      if (roundedCost > BUDGET) {
        return res.status(400).json({
          success: false,
          message: `Squad total cost $${roundedCost}m exceeds the $${BUDGET}m budget.`,
        });
      }

      // ── Step 8: Validate captain is in the squad ─────────
      const captainInSquad = player_ids.includes(Number(captain_id));
      if (!captainInSquad) {
        return res.status(400).json({
          success: false,
          message: 'Selected captain must be one of your 15 squad players.',
        });
      }

      // ── Step 9: Calculate final budget remaining ─────────
      // Always calculate from real DB data — never trust the frontend value
      const calculatedBudgetRemaining = Math.round((BUDGET - roundedCost) * 10) / 10;

      // ── Step 10: Save to database ─────────────────────────
      const teamId = await TeamModel.saveTeam({
        userId,
        teamName:        team_name.trim(),
        playerIds:       player_ids,
        captainId:       Number(captain_id),
        budgetRemaining: calculatedBudgetRemaining,
      });

      // ── Step 11: Build a helpful response ────────────────
      // Include enough info so the frontend can confirm success
      const captain = players.find(p => p.id === Number(captain_id));

      return res.status(200).json({
        success: true,
        message: 'Squad saved successfully! 🎉',
        data: {
          team_id:          teamId,
          team_name:        team_name.trim(),
          player_count:     players.length,
          captain:          { id: captain.id, name: captain.name, position: captain.position },
          total_cost:       roundedCost,
          budget_remaining: calculatedBudgetRemaining,
          position_summary: posCounts,  // e.g. { GK: 2, DEF: 5, MID: 5, FWD: 3 }
        },
      });

    } catch (err) {
      // Pass any unexpected error to the global error handler
      next(err);
    }
  },

  // ──────────────────────────────────────────────────────────
  // GET /api/teams/my
  // ──────────────────────────────────────────────────────────
  // Returns the logged-in user's saved team.
  // Frontend uses this to re-load their team on page visit.
  // ──────────────────────────────────────────────────────────
  async getMyTeam(req, res, next) {
    try {
      const team = await TeamModel.findByUserId(req.user.id);

      if (!team) {
        return res.status(404).json({
          success: false,
          message: 'You have not saved a team yet. Go build one!',
        });
      }

      // player_ids is stored as a JSON string in MySQL.
      // We parse it back into a real JS array before sending.
if (typeof team.player_ids === 'string') {
  team.player_ids = JSON.parse(team.player_ids);
}
      return res.status(200).json({
        success: true,
        data: team,
      });

    } catch (err) {
      next(err);
    }
  },

  // ──────────────────────────────────────────────────────────
  // DELETE /api/teams/my
  // ──────────────────────────────────────────────────────────
  // Allows a user to reset their team entirely.
  // Useful for the "Start over" button on the frontend.
  // ──────────────────────────────────────────────────────────
  async deleteMyTeam(req, res, next) {
    try {
      const deleted = await TeamModel.deleteByUserId(req.user.id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'No team found to delete.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Your team has been reset successfully.',
      });

    } catch (err) {
      next(err);
    }
  },
};
const recalculatePoints = async (req, res) => {

    try {

        const teams = await TeamModel.findAll();

        const result = [];

        for (const team of teams) {

           const points =
    await calculateTeamPoints(team);

await TeamModel.updatePoints(
    team.user_id,
    points.totalPoints,
    points.gwPoints
);

result.push({
    team: team.team_name,
    ...points
});
        }

        res.json(result);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

teamController.recalculatePoints = recalculatePoints;

module.exports = teamController;
