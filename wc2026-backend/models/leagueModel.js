// models/leagueModel.js
const db = require('../config/db'); // adjust path to match your db config

// ─── TABLE CREATION ──────────────────────────────────────────────────────────

const CREATE_LEAGUES_TABLE = `
  CREATE TABLE IF NOT EXISTS leagues (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100)  NOT NULL,
    invite_code   CHAR(6)       NOT NULL UNIQUE,
    commissioner_id INT         NOT NULL,
    max_teams     INT           NOT NULL DEFAULT 10,
    created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_commissioner
      FOREIGN KEY (commissioner_id) REFERENCES users(id) ON DELETE CASCADE
  )
`;

const CREATE_LEAGUE_MEMBERS_TABLE = `
  CREATE TABLE IF NOT EXISTS league_members (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    league_id  INT NOT NULL,
    user_id    INT NOT NULL,
    joined_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_league  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    CONSTRAINT fk_member  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
    CONSTRAINT uq_membership UNIQUE (league_id, user_id)   -- prevents duplicates
  )
`;

const initTables = async () => {
  await db.query(CREATE_LEAGUES_TABLE);
  await db.query(CREATE_LEAGUE_MEMBERS_TABLE);
};

// ─── LEAGUE QUERIES ──────────────────────────────────────────────────────────

/**
 * Insert a new league row and auto-enrol the commissioner as first member.
 * Returns the newly created league's id.
 */
const createLeague = async (name, inviteCode, commissionerId, maxTeams) => {
  const [result] = await db.query(
    `INSERT INTO leagues (name, invite_code, commissioner_id, max_teams)
     VALUES (?, ?, ?, ?)`,
    [name, inviteCode, commissionerId, maxTeams]
  );
  const leagueId = result.insertId;

  // Commissioner is automatically a member
  await db.query(
    `INSERT INTO league_members (league_id, user_id) VALUES (?, ?)`,
    [leagueId, commissionerId]
  );

  return leagueId;
};

/**
 * Find a league by its 6-character invite code.
 */
const findLeagueByInviteCode = async (inviteCode) => {
  const [rows] = await db.query(
    `SELECT * FROM leagues WHERE invite_code = ?`,
    [inviteCode]
  );
  return rows[0] || null;
};

/**
 * Find a league by its primary key.
 */
const findLeagueById = async (leagueId) => {
  const [rows] = await db.query(
    `SELECT * FROM leagues WHERE id = ?`,
    [leagueId]
  );
  return rows[0] || null;
};

/**
 * Check whether a user already belongs to a given league.
 */
const findMembership = async (leagueId, userId) => {
  const [rows] = await db.query(
    `SELECT id FROM league_members WHERE league_id = ? AND user_id = ?`,
    [leagueId, userId]
  );
  return rows[0] || null;
};

/**
 * Count current members in a league.
 */
const getMemberCount = async (leagueId) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS total FROM league_members WHERE league_id = ?`,
    [leagueId]
  );
  return rows[0].total;
};

/**
 * Add a user to a league.
 */
const addMember = async (leagueId, userId) => {
  const [result] = await db.query(
    `INSERT INTO league_members (league_id, user_id) VALUES (?, ?)`,
    [leagueId, userId]
  );
  return result.insertId;
};

/**
 * Fetch all leagues a user belongs to, including member count.
 */
const getLeaguesByUser = async (userId) => {
  const [rows] = await db.query(
    `SELECT
       l.id,
       l.name,
       l.invite_code,
       l.max_teams,
       l.created_at,
       l.commissioner_id,
       (l.commissioner_id = ?) AS is_commissioner,
       (SELECT COUNT(*) FROM league_members lm2 WHERE lm2.league_id = l.id) AS member_count
     FROM leagues l
     INNER JOIN league_members lm ON lm.league_id = l.id
     WHERE lm.user_id = ?
     ORDER BY l.created_at DESC`,
    [userId, userId]
  );
  return rows;
};

/**
 * Verify an invite_code is not already taken (used before insert).
 */
const inviteCodeExists = async (inviteCode) => {
  const [rows] = await db.query(
    `SELECT id FROM leagues WHERE invite_code = ?`,
    [inviteCode]
  );
  return rows.length > 0;
};

const getLeaderboard = async (leagueId) => {

  const [rows] = await db.query(
    `
    SELECT
      u.id,
      u.username,
      t.team_name,
      t.total_points,
      t.gw_points
    FROM league_members lm
    JOIN users u
      ON lm.user_id = u.id
    LEFT JOIN teams t
      ON t.user_id = u.id
    WHERE lm.league_id = ?
    ORDER BY t.total_points DESC
    `,
    [leagueId]
  );

  return rows;
};
module.exports = {
  initTables,
  createLeague,
  findLeagueByInviteCode,
  findLeagueById,
  findMembership,
  getMemberCount,
  addMember,
  getLeaguesByUser,
  inviteCodeExists,
  getLeaderboard
};
