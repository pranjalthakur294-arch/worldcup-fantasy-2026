// ================================================
// middleware/validateRequest.js  —  Input Validation
// ================================================
// Validates request body fields BEFORE they reach
// the controller. Keeps controllers clean.
//
// HOW TO USE on a route:
//   const { validateRegister } = require('../middleware/validateRequest');
//   router.post('/register', validateRegister, authController.register);
// ================================================

// ---- Register validation ----
const validateRegister = (req, res, next) => {
  const { username, email, password } = req.body;
  const errors = [];

  if (!username || username.trim().length < 3)
    errors.push('Username must be at least 3 characters');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.push('A valid email is required');

  if (!password || password.length < 6)
    errors.push('Password must be at least 6 characters');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next(); // all good → go to controller
};

// ---- Login validation ----
const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email) errors.push('Email is required');
  if (!password) errors.push('Password is required');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
};

// ---- Save Team validation ----
const validateSaveTeam = (req, res, next) => {
  const { teamName, playerIds, captainId } = req.body;
  const errors = [];

  if (!teamName || teamName.trim().length < 2)
    errors.push('Team name must be at least 2 characters');

  if (!Array.isArray(playerIds) || playerIds.length !== 15)
    errors.push('You must select exactly 15 players');

  if (!captainId)
    errors.push('You must select a captain');

  if (!playerIds.includes(captainId))
    errors.push('Captain must be one of your selected players');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  next();
};

module.exports = { validateRegister, validateLogin, validateSaveTeam };
