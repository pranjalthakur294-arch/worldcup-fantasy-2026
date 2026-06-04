// ================================================
// routes/authRoutes.js  —  Auth Endpoints
// ================================================
// Routes are just a MAP of URL + method → controller.
// No logic lives here. Think of them as a switchboard.
//
// Full URLs (prefix set in server.js):
//   POST /api/auth/register
//   POST /api/auth/login
//   GET  /api/auth/me       ← protected (needs token)
// ================================================

const express        = require('express');
const router         = express.Router();
const authController = require('../controllers/authController');
const protect        = require('../middleware/authMiddleware');
const { validateRegister, validateLogin } = require('../middleware/validateRequest');

// Public routes (no token needed)
router.post('/register', validateRegister, authController.register);
router.post('/login',    validateLogin,    authController.login);

// Protected route (token required)
router.get('/me', protect, authController.getMe);

module.exports = router;
