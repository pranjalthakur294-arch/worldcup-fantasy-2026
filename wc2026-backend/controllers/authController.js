// ================================================
// controllers/authController.js  —  Auth Logic
// ================================================
// Controllers receive the request, call the model,
// and send back a response. No SQL lives here.
// ================================================

const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const UserModel = require('../models/userModel');

// Helper: create a signed JWT token for a user
const createToken = (userId) => {
  return jwt.sign(
    { id: userId },                          // payload (what's stored in token)
    process.env.JWT_SECRET,                  // secret key from .env
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const authController = {

  // POST /api/auth/register
  async register(req, res, next) {
    try {
      const { username, email, password } = req.body;

      // 1. Check email not already taken
      const exists = await UserModel.emailExists(email);
      if (exists) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
      }

      // 2. Hash the password (never store plain text!)
      const hashedPassword = await bcrypt.hash(password, 12);

      // 3. Create user in DB
      const userId = await UserModel.create({ username, email, hashedPassword });

      // 4. Create JWT token
      const token = createToken(userId);

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        token,
        user: { id: userId, username, email },
      });
    } catch (err) {
      next(err); // passes to global error handler
    }
  },

  // POST /api/auth/login
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // 1. Find user
      const user = await UserModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      // 2. Compare password with stored hash
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid email or password' });
      }

      // 3. Create token and respond
      const token = createToken(user.id);

      res.json({
        success: true,
        message: 'Logged in successfully',
        token,
        user: { id: user.id, username: user.username, email: user.email },
      });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/auth/me  (protected route)
  async getMe(req, res, next) {
    try {
      const user = await UserModel.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      res.json({ success: true, user });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;
