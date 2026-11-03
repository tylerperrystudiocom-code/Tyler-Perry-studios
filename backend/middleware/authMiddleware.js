'use strict';
const jwt = require('jsonwebtoken');

// Use the same secret from your .env file
const JWT_SECRET = process.env.SESSION_SECRET || 'fallback-secret-change-me';

/**
 * 1. Basic Authentication Middleware
 * Verifies the JWT token sent in the Authorization header.
 * If valid, attaches the decoded user data to req.user.
 */
const requireAuth = (req, res, next) => {
  // Get token from header (Format: "Bearer <token>")
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // e.g., { id: 1, role: 'admin', name: 'System Admin' }
    next(); // Proceed to the route
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

/**
 * 2. Admin Authorization Middleware
 * Must be used AFTER requireAuth.
 * Checks if the authenticated user has the 'admin' role.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next(); // User is an admin, proceed
};

/**
 * 3. VIP Authorization Middleware
 * Must be used AFTER requireAuth.
 * Checks if the user is VIP or an Admin.
 */
const requireVip = (req, res, next) => {
  if (!req.user || (req.user.role !== 'vip' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Access denied. VIP membership required.' });
  }
  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireVip
};