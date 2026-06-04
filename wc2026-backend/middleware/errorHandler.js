// ================================================
// middleware/errorHandler.js  —  Global Error Handler
// ================================================
// This is a special Express middleware with 4 params.
// Express knows it's an error handler because of (err, req, res, next).
//
// HOW IT WORKS:
//   In any controller, instead of:
//     res.status(500).json({ message: 'Something broke' })
//   You can just do:
//     next(error)              ← Express passes it here automatically
//   Or throw a custom error:
//     const err = new Error('Player not found');
//     err.statusCode = 404;
//     next(err);
// ================================================

const errorHandler = (err, req, res, next) => {
  // Read the status code from the error object, or default to 500
  const statusCode = err.statusCode || 500;

  // Log the error to the terminal (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.error(`\n❌ Error [${statusCode}]: ${err.message}`);
    console.error(err.stack);
  }

  // Send a clean JSON error response to the client
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Only include stack trace in development (never expose in production!)
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
