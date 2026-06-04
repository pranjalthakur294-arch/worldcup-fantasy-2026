// ============================================================
// models/teamModel.js
// ============================================================
// The MODEL is the only place that runs SQL.
// Controllers call these functions — they never touch SQL.
//
// This file handles everything related to the `teams` table.
//
// MySQL TABLE STRUCTURE (run this once in your DB):
//
// CREATE TABLE teams (
//   id               INT AUTO_INCREMENT PRIMARY KEY,
//   user_id          INT          NOT NULL,
//   team_name        VARCHAR(100) NOT NULL,
//   player_ids       JSON         NOT NULL,   -- stores [1,4,7,...]
//   captain_id       INT          NOT NULL,
//   budget_remaining DECIMAL(5,1) NOT NULL DEFAULT 0.0,
//   created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
//   updated_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
//                                ON UPDATE CURRENT_TIMESTAMP,
//   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
//   UNIQUE KEY unique_user_team (user_id)      -- one team per user
// );
// ============================================================

const db = require('../config/db');

const TeamModel = {

  // ----------------------------------------------------------
  // findByUserId(userId)
  // ----------------------------------------------------------
  // Gets the saved team for a specific user.
  // Returns the team row or null if the user has no team yet.
  //
  // Called by:
  //   • getMyTeam controller  →  GET /api/teams/my
  //   • saveTeam model method →  to check INSERT vs UPDATE
  // ----------------------------------------------------------
  async findByUserId(userId) {
    const [rows] = await db.query(
      `SELECT
         t.id,
         t.user_id,
         t.team_name,
         t.player_ids,
         t.captain_id,
         t.budget_remaining,
         t.created_at,
         t.updated_at
       FROM teams t
       WHERE t.user_id = ?
       LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  },

  // ----------------------------------------------------------
  // saveTeam({ userId, teamName, playerIds, captainId, budgetRemaining })
  // ----------------------------------------------------------
  // UPSERT pattern:
  //   • If user already has a team  → UPDATE the existing row
  //   • If user has no team yet     → INSERT a new row
  //
  // WHY UPSERT instead of always INSERT?
  //   Each user can only have ONE team. We reuse the same row
  //   so we don't fill the DB with duplicate team rows.
  //
  // playerIds is stored as JSON in MySQL:
  //   [1, 4, 7, 12, ...] → stored as the string "[1,4,7,12,...]"
  //   When we read it back we JSON.parse() it in the controller.
  //
  // Returns the team's database ID (useful for the response).
  // ----------------------------------------------------------
  async saveTeam({ userId, teamName, playerIds, captainId, budgetRemaining }) {
    // Store the array as a JSON string in MySQL
    const playerIdsJson = JSON.stringify(playerIds);

    // Check if a team already exists for this user
    const existing = await this.findByUserId(userId);

    if (existing) {
      // ── UPDATE path ─────────────────────────────────────
      // User already has a team — overwrite their existing one
      await db.query(
        `UPDATE teams
         SET
           team_name        = ?,
           player_ids       = ?,
           captain_id       = ?,
           budget_remaining = ?,
           updated_at       = NOW()
         WHERE user_id = ?`,
        [teamName, playerIdsJson, captainId, budgetRemaining, userId]
      );
      return existing.id; // return the existing row's ID

    } else {
      // ── INSERT path ─────────────────────────────────────
      // First time this user saves a team
      const [result] = await db.query(
        `INSERT INTO teams
           (user_id, team_name, player_ids, captain_id, budget_remaining)
         VALUES
           (?, ?, ?, ?, ?)`,
        [userId, teamName, playerIdsJson, captainId, budgetRemaining]
      );
      return result.insertId; // MySQL gives us the new row's auto-increment ID
    }
  },

  // ----------------------------------------------------------
  // deleteByUserId(userId)
  // ----------------------------------------------------------
  // Deletes a user's team — useful for a "reset team" feature later.
  // ----------------------------------------------------------
  async findAll() {
  const [rows] = await db.query(
    `SELECT * FROM teams`
  );

  return rows;
},

// ----------------------------------------------------------
// deleteByUserId(userId)
// ----------------------------------------------------------
async updatePoints(userId, totalPoints, gwPoints) {

  await db.query(
    `
    UPDATE teams
    SET
      total_points = ?,
      gw_points = ?
    WHERE user_id = ?
    `,
    [totalPoints, gwPoints, userId]
  );
},
  async deleteByUserId(userId) {
    const [result] = await db.query(
      'DELETE FROM teams WHERE user_id = ?',
      [userId]
    );
    return result.affectedRows > 0; // true if a row was deleted
  },
};

module.exports = TeamModel;
