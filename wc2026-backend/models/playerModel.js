// ================================================
// models/playerModel.js  —  Player Database Queries
// ================================================

const db = require('../config/db');

const PlayerModel = {

  // Get ALL players — supports optional filters
  // Used by the player selection panel in the frontend
  async getAll({ position, team, maxPrice, sortBy } = {}) {
    let sql    = 'SELECT * FROM players WHERE 1=1'; // 1=1 trick lets us append AND easily
    const params = [];

    // Dynamically add filters only if they were provided
    if (position && position !== 'All') {
      sql += ' AND position = ?';
      params.push(position);
    }
    if (team && team !== 'All') {
      sql += ' AND team = ?';
      params.push(team);
    }
    if (maxPrice) {
      sql += ' AND price <= ?';
      params.push(parseFloat(maxPrice));
    }

    // Whitelist allowed sort columns to prevent SQL injection
    const allowed = ['price', 'total_pts', 'selected_pct', 'md_pts', 'pts_per_million'];
    const col     = allowed.includes(sortBy) ? sortBy : 'total_pts';
    sql += ` ORDER BY ${col} DESC`;

    const [rows] = await db.query(sql, params);
    return rows;
  },

  // Get a single player by ID
  async findById(id) {
    const [rows] = await db.query(
      'SELECT * FROM players WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  // Get all distinct teams (for the filter dropdown)
  async getTeams() {
    const [rows] = await db.query(
      'SELECT DISTINCT team FROM players ORDER BY team ASC'
    );
    return rows.map(r => r.team);
  },

  // Get players by an array of IDs (used when saving a team)
  async findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    // IN (?, ?, ?) requires a placeholder per item
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await db.query(
      `SELECT * FROM players WHERE id IN (${placeholders})`,
      ids
    );
    return rows;
  },
};

module.exports = PlayerModel;
