// ================================================
// middleware/authMiddleware.js  —  JWT Auth Guard
// ================================================
// This middleware PROTECTS routes that need login.
//
// HOW IT WORKS:
//   1. Client sends request with header:
//        Authorization: Bearer eyJhbGci...
//   2. This middleware reads + verifies that token
//   3. If valid → attaches user info to req.user
//      and calls next() to continue to the controller
//   4. If invalid/missing → sends 401 Unauthorized
//
// HOW TO USE on a route:
//   const protect = require('../middleware/authMiddleware');
//   router.post('/save', protect, teamController.saveTeam);
//   ↑ protect runs first, then saveTeam only if token is valid
// ================================================

const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  // 1. Get the Authorization header
  const authHeader = req.headers['authorization'];

  // 2. Check the header exists and starts with "Bearer "
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  // 3. Extract just the token part (after "Bearer ")
  const token = authHeader.split(' ')[1];

  try {

  console.log('JWT_SECRET =', process.env.JWT_SECRET);

  const decoded = jwt.verify(
    token,
    process.env.JWT_SECRET
  );

  req.user = decoded;

  next();

} catch (err) {

  console.log(err);

  return res.status(401).json({
    success: false,
    message: 'Invalid or expired token. Please log in again.',
  });
}
};

module.exports = protect;
