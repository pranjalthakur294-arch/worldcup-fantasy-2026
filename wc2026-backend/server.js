// ================================================
// server.js  —  Entry point of the entire backend
// ================================================
// This is the FIRST file Node.js runs.
// It sets up Express, loads all middleware,
// mounts all routes, and starts the HTTP server.
// ================================================

// Step 1: Load environment variables from .env
// Must be the VERY FIRST line before anything else

require('dotenv').config();

require('./config/db');

const express = require('express');
const cors = require('cors');

const authRoutes   = require('./routes/authRoutes');
const playerRoutes = require('./routes/playerRoutes');
const teamRoutes   = require('./routes/teamRoutes');
const leagueRoutes = require('./routes/leagueRoutes');

const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ------------------------------------------------
// GLOBAL MIDDLEWARE
// These run on EVERY request before hitting routes
// ------------------------------------------------

// 1. CORS — allows your frontend (HTML file / React)
//    to talk to this backend without browser blocking
app.use(cors({
  origin: process.env.CLIENT_URL || '*',  // only allow your frontend's URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 2. JSON parser — lets us read req.body as JS object
//    Without this, req.body is always undefined
app.use(express.json());

// 3. URL-encoded parser — handles HTML form submissions
app.use(express.urlencoded({ extended: true }));

// ------------------------------------------------
// ROUTES
// Each route file handles a group of endpoints.
// The prefix (/api/auth, etc.) is set here once.
// ------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/leagues', leagueRoutes);

// ------------------------------------------------
// HEALTH CHECK ROUTE
// Visit http://localhost:5000/api/health to confirm
// the server is running correctly
// ------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status:  'OK',
    message: 'WC2026 Fantasy API is running',
    time:    new Date().toISOString(),
  });
});

// ------------------------------------------------
// 404 HANDLER
// If no route matched, send a clean 404 JSON response
// (must be AFTER all routes)
// ------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ------------------------------------------------
// GLOBAL ERROR HANDLER
// Catches any error thrown with next(error) in routes
// (must be LAST, after the 404 handler)
// ------------------------------------------------
app.use(errorHandler);

// ------------------------------------------------
// START THE SERVER
// ------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n🚀 Server running in ${process.env.NODE_ENV} mode`);
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health\n`);
});
