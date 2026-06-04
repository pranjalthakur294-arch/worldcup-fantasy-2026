// ================================================
// models/userModel.js  —  User Database Queries
// ================================================
// The MODEL is the layer that talks to the database.
// Controllers call these functions — they never write
// raw SQL themselves. This keeps code DRY and clean.
//
// PATTERN:
//   Controller calls  → Model (SQL here) → MySQL → Model → Controller
// ================================================

const db = require('../config/db');

const UserModel = {

  // Find a user by their email address
  // Used during login to check if user exists
  async findByEmail(email) {
    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ? LIMIT 1',
      [email]   // ← parameterised query: NEVER concatenate strings (SQL injection!)
    );
    return rows[0] || null; // return first row or null if not found
  },

  // Find a user by their ID
  // Used after JWT verification to get fresh user data
  async findById(id) {
    const [rows] = await db.query(
      'SELECT id, username, email, created_at FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  // Create a new user (registration)
  // hashedPassword is already hashed by the controller — model never hashes
  async create({ username, email, hashedPassword }) {
    const [result] = await db.query(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    return result.insertId; // returns the new user's ID
  },

  // Check if an email is already taken
  async emailExists(email) {
    const [rows] = await db.query(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    return rows.length > 0;
  },
};

module.exports = UserModel;
