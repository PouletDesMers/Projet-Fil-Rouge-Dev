const rateLimit = require('express-rate-limit');

// Rate limiting pour les tentatives de login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 tentatives par IP
  message: {
    error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Réinitialiser après succès
  skipSuccessfulRequests: true,
  // Logging des tentatives
  handler: (req, res) => {
    console.error(`[SECURITY] Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiting général pour l'API
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requêtes par minute par IP
  message: {
    error: 'Trop de requêtes. Ralentissez le rythme.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting strict pour les endpoints sensibles
const strictLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 requêtes maximum
  message: {
    error: 'Limite de requêtes atteinte pour cet endpoint sensible.'
  }
});

module.exports = {
  loginLimiter,
  apiLimiter,
  strictLimiter
};