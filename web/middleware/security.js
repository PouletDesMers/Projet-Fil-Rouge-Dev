const crypto = require('crypto');

// Middleware de validation des entrées
const validateInput = {
  email: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  },
  
  password: (password) => {
    return password && password.length >= 8 && password.length <= 128;
  },
  
  name: (name) => {
    const nameRegex = /^[a-zA-ZÀ-ÿ\s\-']{2,100}$/;
    return nameRegex.test(name);
  },
  
  phone: (phone) => {
    if (!phone) return true; // Optionnel
    const phoneRegex = /^\+?[0-9\s\-\(\)]{8,20}$/;
    return phoneRegex.test(phone);
  },
  
  // Validation générale contre XSS
  sanitizeString: (str) => {
    if (typeof str !== 'string') return str;
    return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/javascript:/gi, '')
              .replace(/on\w+\s*=/gi, '');
  },
  
  // Validation d'ID numérique
  id: (id) => {
    const numId = parseInt(id);
    return !isNaN(numId) && numId > 0;
  }
};

// Middleware de vérification CSRF pour les formulaires
const csrfToken = (req, res, next) => {
  if (req.method === 'GET') {
    // Générer token CSRF pour les formulaires
    const token = crypto.randomBytes(32).toString('hex');
    req.session = req.session || {};
    req.session.csrfToken = token;
    res.locals.csrfToken = token;
  } else {
    // Vérifier token CSRF pour POST/PUT/DELETE
    const token = req.body._csrf || req.headers['x-csrf-token'];
    if (!token || !req.session || token !== req.session.csrfToken) {
      return res.status(403).json({ error: 'Token CSRF invalide' });
    }
  }
  next();
};

// Middleware de logging de sécurité
const securityLogger = (req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    method: req.method,
    url: req.url,
    referer: req.get('Referer')
  };
  
  // Logger les requêtes suspectes
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i,  // XSS tentative
    /union.*select/i,  // SQL injection tentative
    /exec\(/i,  // Code injection
    /eval\(/i   // Code injection
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.url) || 
    pattern.test(JSON.stringify(req.body)) ||
    pattern.test(req.get('User-Agent') || '')
  );
  
  if (isSuspicious) {
    console.warn('[SECURITY ALERT] Suspicious request detected:', logData);
  }
  
  next();
};

// Middleware de validation des fichiers uploadés
const validateFileUpload = (req, res, next) => {
  if (!req.files || Object.keys(req.files).length === 0) {
    return next();
  }
  
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain'
  ];
  
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  for (let file of Object.values(req.files)) {
    if (!allowedMimes.includes(file.mimetype)) {
      return res.status(400).json({ 
        error: 'Type de fichier non autorisé' 
      });
    }
    
    if (file.size > maxSize) {
      return res.status(400).json({ 
        error: 'Fichier trop volumineux (max 5MB)' 
      });
    }
  }
  
  next();
};

module.exports = {
  validateInput,
  csrfToken,
  securityLogger,
  validateFileUpload
};