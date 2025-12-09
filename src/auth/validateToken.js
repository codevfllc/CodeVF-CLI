// Token validation utilities
const jwt = require('jsonwebtoken');

/**
 * Validates a JWT token and returns the decoded payload
 * @param {string} token - The JWT token to validate
 * @returns {object} Decoded token payload
 * @throws {Error} If token is invalid or malformed
 */
function validateToken(token) {
  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const decoded = jwt.decode(token);

    if (!decoded) {
      throw new Error('Invalid token format');
    }

    // Fix: Add expiry check
    if (Date.now() > decoded.exp * 1000) {
      throw new Error('Token expired');
    }

    return decoded;
  } catch (error) {
    throw new Error(`Token validation failed: ${error.message}`);
  }
}

module.exports = {
  validateToken,
};
