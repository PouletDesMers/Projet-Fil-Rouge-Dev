const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');
const { securityLogger, csrfOriginGuard } = require('./middleware/security');
const { loginLimiter, apiLimiter, strictLimiter } = require('./middleware/rateLimiting');
const { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail, sendAdminNotification, sendNewsletterEmail } = require('./backend/js/modules/email');
const { generateResetToken, saveResetToken, validateResetToken, markTokenAsUsed } = require('./backend/js/modules/reset-tokens');
const app = express();
const port = process.env.PORT || 3000;

// ── Upload configuration ────────────────────────────────────────────────
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Seules les images sont acceptees'), false);
  }
});

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max for CSV/XLSX
});
// ─────────────────────────────────────────────────────────────────────────────

// Stripe (facultatif — désactivé si la clé n'est pas configurée)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';
let stripe = null;
if (STRIPE_SECRET_KEY && STRIPE_SECRET_KEY !== 'sk_test_VOTRE_CLE_ICI') {
  try { stripe = require('stripe')(STRIPE_SECRET_KEY); console.log('[Stripe] SDK chargé'); } catch (e) { console.warn('[Stripe] SDK non disponible:', e.message); }
}

// Codes promo locaux (demo — utilisés quand Stripe n'est pas actif ou en complément)
let DEMO_PROMO_CODES = [
  { code: 'WELCOME20', type: 'percent', discount: 20, label: 'WELCOME20 (−20%)', active: true, timesRedeemed: 0 },
  { code: 'CYNA10',    type: 'percent', discount: 10, label: 'CYNA10 (−10%)',    active: true, timesRedeemed: 0 },
  { code: 'PROMO50',   type: 'amount',  discount: 50, label: 'PROMO50 (−50€)',   active: true, timesRedeemed: 0 },
];

// Middleware
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(securityLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(csrfOriginGuard({
  allowedOrigins: [process.env.FRONTEND_URL, process.env.APP_ORIGIN, 'http://localhost:3000'],
}));
app.use('/api', apiLimiter);
app.use('/admin/api', strictLimiter);

function isRequestSecure(req) {
  if (req.secure) return true;
  const forwardedProto = req.headers['x-forwarded-proto'];
  return typeof forwardedProto === 'string' && forwardedProto.split(',')[0].trim() === 'https';
}

// Middleware to get auth token from header or cookie
function getAuthToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const parts = authHeader.split(' ');
    return parts[1] || authHeader;
  }
  // Check for token in cookies (both possible names)
  return req.cookies.token || req.cookies.authToken || null;
}

// Middleware to check if user is admin
async function checkAdminAuth(req, res, next) {
  try {
    const token = getAuthToken(req);
    
    if (!token) {
      // Allow the dedicated backend login page without authentication
      if (req.path === '/login.html' || req.path === '/login') {
        return next();
      }
      // For HTML pages, redirect to the backend login page
      if (req.path.endsWith('.html') || req.path === '/backend' || req.path === '/backend/') {
        return res.redirect('/backend/login.html?redirect=/backend/');
      }
      // For API/JSON requests, return JSON error
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    // Forward the token to the API to verify user and get profile
    const response = await axios.get('http://api:8080/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const userProfile = response.data;
    
    // Check if user is admin
    if (!userProfile || userProfile.role !== 'admin') {
      // For HTML pages, redirect to the backend login page with error
      if (req.path.endsWith('.html') || req.path === '/backend' || req.path === '/backend/') {
        return res.redirect('/backend/login.html?error=admin_required');
      }
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Store user info in request for later use
    req.user = userProfile;
    next();
  } catch (error) {
    console.error('Auth check failed:', error.message);
    // For HTML pages, redirect to auth page
    if (req.path.endsWith('.html') || req.path === '/backend' || req.path === '/backend/') {
      return res.redirect('/backend/login.html?error=unauthorized');
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Middleware to check if user is authenticated (any role)
async function checkAuth(req, res, next) {
  try {
    const token = getAuthToken(req);
    
    if (!token) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    // Forward the token to the API to verify user and get profile
    const response = await axios.get('http://api:8080/api/user/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const userProfile = response.data;
    if (!userProfile) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Store user info in request for later use
    req.user = userProfile;
    next();
  } catch (error) {
    console.error('Auth check failed:', error.message);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Secure login endpoint - stores token in httpOnly cookie
app.post('/auth/login', loginLimiter, async (req, res) => {
  try {
    const response = await axios.post('http://api:8080/api/login', req.body);
    const data = response.data;
    
    // 2FA required: forward the response with 200 so the frontend can show the 2FA step
    if (data.requires_2fa) {
      return res.json({ requires_2fa: true });
    }

    if (data.token) {
      // SÉCURISÉ: httpOnly cookie
      // sameSite: 'lax' permet l'accès depuis des IPs locales (192.168.x.x, etc.)
      // tout en protégeant contre le CSRF
      res.cookie('authToken', data.token, {
        httpOnly: true,  // Cannot be read by JavaScript (XSS protection)
        secure: process.env.NODE_ENV === 'production' || isRequestSecure(req),
        sameSite: 'lax', // lax = compatible réseau local, protège contre CSRF
        maxAge: 8 * 60 * 60 * 1000, // 8 heures
        path: '/' // Accessible sur tout le site
      });
      
      // Récupérer les infos utilisateur avec le token
      let userProfile = null;
      if (data.user_id) {
        try {
          const userResponse = await axios.get(`http://api:8080/api/users/${data.user_id}`, {
            headers: { 'Authorization': `Bearer ${data.token}` }
          });
          userProfile = userResponse.data;
        } catch (userError) {
          console.error('Error fetching user profile:', userError.message);
        }
      }
      
      // Log de sécurité
      console.log(`[SECURITY] User login: ${userProfile?.email || 'unknown'} from IP: ${req.ip}`);
      
      // Return user info WITHOUT the token
      return res.json({
        success: true,
        user: userProfile,
        password_needs_change: !!data.password_needs_change,
        message: data.message || 'Login successful'
      });
    }
    
    res.status(400).json(data);
  } catch (error) {
    // Log des tentatives d'auth échouées
    console.error(`[SECURITY] Failed login attempt from IP: ${req.ip}, Error: ${error.message}`);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Login failed'
    });
  }
});

// Logout endpoint - clears httpOnly cookie
app.post('/auth/logout', (req, res) => {
  res.clearCookie('authToken', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get current user profile (uses cookie token)
app.get('/auth/profile', async (req, res) => {
  try {
    const token = getAuthToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const response = await axios.get('http://api:8080/api/user/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to get profile'
    });
  }
});

// Request password reset
app.post('/api/auth/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Vérifier que l'email existe
    const userExists = await axios.get(`http://api:8080/api/users/exists?email=${encodeURIComponent(email)}`);

    if (!userExists.data.exists) {
      // Pour la sécu, on fait semblant que ça a marché (pas d'énumération d'emails)
      return res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
    }

    // Générer un token
    const resetToken = generateResetToken();
    saveResetToken(email, resetToken);

    // Envoyer l'email
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password.html?token=${resetToken}`;
    await sendPasswordResetEmail(email, resetToken);

    res.json({ success: true, message: 'Email sent' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || 'Failed to request password reset' });
  }
});

// Reset password with token
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    // Valider le token
    const validation = validateResetToken(token);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const email = validation.email;

    // Appeler l'API pour réinitialiser le mot de passe
    const response = await axios.post('http://api:8080/api/password-reset', {
      email,
      password
    });

    // Marquer le token comme utilisé
    markTokenAsUsed(token);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to reset password'
    });
  }
});

// Save verification token (called from Node.js after user creation)
app.post('/api/save-verification-token', async (req, res) => {
  try {
    const response = await axios.post('http://api:8080/api/save-verification-token', req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Error saving verification token:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to save verification token'
    });
  }
});

// Verify email with token
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Call API to verify email
    const response = await axios.post('http://api:8080/api/verify-email', { token });

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to verify email'
    });
  }
});

// Resend verification email
app.post('/api/auth/resend-verification-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Call API to resend verification
    const response = await axios.post('http://api:8080/api/resend-verification-email', { email });

    res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Error:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to resend verification email'
    });
  }
});

// =============================================================================
// ROUTES API SPÉCIFIQUES ET CONTRÔLÉES
// =============================================================================
// Au lieu d'un proxy générique, on expose seulement les endpoints nécessaires

// Routes publiques (catalogue, carrousel)
app.get('/api/public/categories', async (req, res) => {
  try {
    const response = await axios.get('http://api:8080/api/public/categories');
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to fetch categories'
    });
  }
});

app.get('/api/public/products/:slug', async (req, res) => {
  try {
    const response = await axios.get(`http://api:8080/api/public/products/${req.params.slug}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to fetch products'
    });
  }
});

app.get('/api/public/carousel-images', async (req, res) => {
  try {
    const response = await axios.get('http://api:8080/api/public/carousel-images');
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to fetch carousel images'
    });
  }
});

app.get('/api/public/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const response = await axios.get(`http://api:8080/api/public/search?q=${encodeURIComponent(q)}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Search failed'
    });
  }
});

// Routes d'inscription (publiques)
app.post('/api/users', async (req, res) => {
  try {
    // Create user in API
    const response = await axios.post('http://api:8080/api/users', req.body);
    const user = response.data;

    // Generate verification token
    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Save verification token to DB
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24);

    await axios.post('http://api:8080/api/save-verification-token', {
      email: req.body.email,
      token: verificationToken,
      user_id: user.id_utilisateur,
      expires_at: tokenExpiresAt.toISOString()
    });

    // Send verification email
    await sendVerificationEmail(
      req.body.email,
      req.body.firstName || 'User',
      verificationToken
    );

    // Return created user with info about verification email
    res.status(201).json({
      ...user,
      message: 'User created. Please check your email to verify your account.'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Registration failed'
    });
  }
});

app.get('/api/users/exists', async (req, res) => {
  try {
    const response = await axios.get(`http://api:8080/api/users/exists?email=${encodeURIComponent(req.query.email)}`);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Email check failed'
    });
  }
});

// Endpoint de test email
app.post('/api/test/send-email', async (req, res) => {
  try {
    const { type, email, firstName } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let result;
    switch (type) {
      case 'welcome':
        result = await sendWelcomeEmail(email, firstName || 'User');
        break;
      case 'reset':
        result = await sendPasswordResetEmail(email, 'test-token-123');
        break;
      case 'admin':
        result = await sendAdminNotification(email, 'Test', 'Ceci est un email de test');
        break;
      default:
        return res.status(400).json({ error: 'Invalid email type' });
    }

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// ROUTES ADMIN SÉCURISÉES (Panel d'administration)
// =============================================================================

// Middleware pour les routes admin du panel backend
function proxyToApiWithAuth(endpoint) {
  return async (req, res) => {
    try {
      const token = getAuthToken(req);
      
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Vérifier que l'utilisateur est admin
      const userResponse = await axios.get('http://api:8080/api/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (userResponse.data.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      // Construire l'URL et les headers pour l'API
      let url = `http://api:8080/api${endpoint}`;
      const headers = { 'Authorization': `Bearer ${token}`, 'X-Admin-Panel': 'true' };
      
      // Remplacer les paramètres dans l'URL
      Object.keys(req.params).forEach(param => {
        url = url.replace(`:${param}`, req.params[param]);
      });
      
      // Ajouter query parameters
      if (Object.keys(req.query).length > 0) {
        const queryString = new URLSearchParams(req.query).toString();
        url += `?${queryString}`;
      }
      
      // Faire la requête vers l'API selon la méthode HTTP
      let response;
      switch (req.method) {
        case 'GET':
          response = await axios.get(url, { headers });
          break;
        case 'POST':
          response = await axios.post(url, req.body, { headers });
          break;
        case 'PUT':
          response = await axios.put(url, req.body, { headers });
          break;
        case 'DELETE':
          response = await axios.delete(url, { headers });
          break;
        default:
          return res.status(405).json({ error: 'Method not allowed' });
      }
      
      res.json(response.data);
      
    } catch (error) {
      console.error(`API Proxy Error for ${endpoint}:`, error.message);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.error || 'Internal server error'
      });
    }
  };
}

function makePentestCheck(name, passed, details) {
  return { name, passed: Boolean(passed), details };
}

async function runSecurityPentest(req) {
  const checks = [];
  const webBase = process.env.WEB_INTERNAL_BASE || 'http://127.0.0.1:3000';
  const apiBase = process.env.API_INTERNAL_BASE || 'http://api:8080';

  const add = (name, passed, details) => checks.push(makePentestCheck(name, passed, details));

  try {
    const health = await axios.get(`${webBase}/health`, { timeout: 8000, validateStatus: () => true });
    add('Web health endpoint', health.status === 200 && health.data && health.data.status === 'ok', `status=${health.status}`);
  } catch (err) {
    add('Web health endpoint', false, err.message);
  }

  try {
    const home = await axios.get(`${webBase}/`, { timeout: 8000, validateStatus: () => true });
    const requiredHeaders = ['x-content-type-options', 'x-frame-options', 'strict-transport-security', 'referrer-policy'];
    for (const header of requiredHeaders) {
      add(`Header ${header}`, Boolean(home.headers[header]), home.headers[header] || 'missing');
    }
  } catch (err) {
    add('Security headers on /', false, err.message);
  }

  let swaggerJSON = null;
  try {
    const swagger = await axios.get(`${apiBase}/swagger`, { timeout: 8000, validateStatus: () => true });
    add('Swagger endpoint /swagger', swagger.status === 200 && Boolean(swagger.data && swagger.data.openapi), `status=${swagger.status}`);
  } catch (err) {
    add('Swagger endpoint /swagger', false, err.message);
  }

  try {
    const swaggerJsonResp = await axios.get(`${apiBase}/api/swagger.json`, { timeout: 8000, validateStatus: () => true });
    swaggerJSON = swaggerJsonResp.data;
    add('Swagger endpoint /api/swagger.json', swaggerJsonResp.status === 200 && Boolean(swaggerJSON && swaggerJSON.openapi), `status=${swaggerJsonResp.status}`);
  } catch (err) {
    add('Swagger endpoint /api/swagger.json', false, err.message);
  }

  if (swaggerJSON && swaggerJSON.components && swaggerJSON.components.securitySchemes && swaggerJSON.components.securitySchemes.BearerAuth) {
    const bearerFormat = swaggerJSON.components.securitySchemes.BearerAuth.bearerFormat;
    add('OpenAPI bearerFormat is OpaqueToken', bearerFormat === 'OpaqueToken', String(bearerFormat || 'missing'));
  } else {
    add('OpenAPI bearerFormat is OpaqueToken', false, 'BearerAuth scheme missing');
  }

  try {
    const anonAdmin = await axios.get(`${webBase}/admin/api/users`, {
      timeout: 8000,
      maxRedirects: 0,
      validateStatus: () => true,
    });
    add('Anonymous admin access blocked (web)', [401, 403].includes(anonAdmin.status), `status=${anonAdmin.status}`);
  } catch (err) {
    add('Anonymous admin access blocked (web)', false, err.message);
  }

  try {
    const anonApiAdmin = await axios.get(`${apiBase}/api/admin/newsletter/subscribers`, {
      timeout: 8000,
      validateStatus: () => true,
    });
    add('Anonymous admin access blocked (api)', [401, 403].includes(anonApiAdmin.status), `status=${anonApiAdmin.status}`);
  } catch (err) {
    add('Anonymous admin access blocked (api)', false, err.message);
  }

  try {
    const loginStatuses = [];
    for (let i = 0; i < 7; i++) {
      const loginResp = await axios.post(
        `${webBase}/auth/login`,
        { email: 'pentest@example.com', password: 'wrong-password' },
        { timeout: 8000, validateStatus: () => true }
      );
      loginStatuses.push(loginResp.status);
    }
    const seen429 = loginStatuses.includes(429);
    add('Rate limit login (429 observed)', seen429, loginStatuses.join(','));
  } catch (err) {
    add('Rate limit login (429 observed)', false, err.message);
  }

  try {
    const csrfProbe = await axios.post(
      `${webBase}/auth/logout`,
      {},
      {
        timeout: 8000,
        validateStatus: () => true,
        headers: {
          Origin: 'http://evil.example',
          Cookie: 'authToken=fake-token',
        },
      }
    );
    add('CSRF guard blocks cross-origin authenticated write', csrfProbe.status === 403, `status=${csrfProbe.status}`);
  } catch (err) {
    add('CSRF guard blocks cross-origin authenticated write', false, err.message);
  }

  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  return {
    generatedAt: new Date().toISOString(),
    webBase,
    apiBase,
    summary: { passed, failed, total: checks.length },
    checks,
  };
}

app.get('/admin/api/security/pentest', checkAdminAuth, async (req, res) => {
  try {
    const report = await runSecurityPentest(req);
    res.json(report);
  } catch (error) {
    console.error('Pentest endpoint failed:', error.message);
    res.status(500).json({ error: 'Failed to run pentest' });
  }
});

// Routes admin protégées - Panel d'administration uniquement
app.get('/admin/api/users', proxyToApiWithAuth('/users'));
app.post('/admin/api/users', proxyToApiWithAuth('/users'));
app.get('/admin/api/users/:id', proxyToApiWithAuth('/users/:id'));
app.put('/admin/api/users/:id', proxyToApiWithAuth('/users/:id'));
app.delete('/admin/api/users/:id', proxyToApiWithAuth('/users/:id'));
app.post('/admin/api/users/:id/reset-2fa', proxyToApiWithAuth('/users/:id/reset-2fa'));
app.get('/admin/api/users/:id/roles', proxyToApiWithAuth('/admin/users/:id/roles'));
app.post('/admin/api/users/:id/roles', proxyToApiWithAuth('/admin/users/:id/roles'));
app.delete('/admin/api/users/:id/roles/:roleId', proxyToApiWithAuth('/admin/users/:id/roles/:roleId'));
app.get('/admin/api/users/:id/permissions', proxyToApiWithAuth('/admin/users/:id/permissions'));

app.get('/admin/api/categories', proxyToApiWithAuth('/web-categories'));
app.post('/admin/api/categories', proxyToApiWithAuth('/web-categories'));
app.put('/admin/api/categories/:id', proxyToApiWithAuth('/web-categories/:id'));
app.delete('/admin/api/categories/:id', proxyToApiWithAuth('/web-categories/:id'));

app.get('/admin/api/products', proxyToApiWithAuth('/web-products'));
app.post('/admin/api/products', proxyToApiWithAuth('/web-products'));
app.put('/admin/api/products/:id', proxyToApiWithAuth('/web-products/:id'));
app.delete('/admin/api/products/:id', proxyToApiWithAuth('/web-products/:id'));

function normalizeBool(value) {
  if (typeof value === 'boolean') return value;
  if (value == null || value === '') return true;
  const v = String(value).trim().toLowerCase();
  return ['1', 'true', 'oui', 'yes', 'y'].includes(v);
}

function normalizeImages(value) {
  if (!value) return '[]';

  if (Array.isArray(value)) {
    return JSON.stringify(value.filter(Boolean));
  }

  const str = String(value).trim();
  if (!str) return '[]';

  if (str.startsWith('[')) {
    try {
      const arr = JSON.parse(str);
      return JSON.stringify(Array.isArray(arr) ? arr.filter(Boolean) : []);
    } catch (_err) {
      return '[]';
    }
  }

  const arr = str.split('|').map((s) => s.trim()).filter(Boolean);
  return JSON.stringify(arr);
}

function normalizeDecimal(value) {
  if (value === '' || value == null) return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function normalizeInt(value) {
  if (value === '' || value == null) return null;
  const n = parseInt(value, 10);
  return Number.isInteger(n) ? n : null;
}

function parseImportFile(file) {
  const ext = (file.originalname || '').toLowerCase();

  if (ext.endsWith('.csv')) {
    const content = file.buffer.toString('utf8');
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  }

  if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  }

  throw new Error('Format non supporte. Utilisez CSV, XLSX ou XLS.');
}

app.post('/admin/api/products/import', checkAdminAuth, importUpload.single('file'), async (req, res) => {
  const token = getAuthToken(req);

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier recu.' });
    }

    const rows = parseImportFile(req.file);
    const mode = req.body.mode || 'upsert';
    const categoryMode = req.body.categoryMode || 'file';
    const forcedCategoryId = normalizeInt(req.body.forcedCategoryId);

    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const listResponse = await axios.get('http://api:8080/api/web-products', { headers });
    const existingProducts = Array.isArray(listResponse.data) ? listResponse.data : [];

    const keyFor = (slug, idCategorie) => `${String(slug).trim().toLowerCase()}::${idCategorie}`;
    const bySlugAndCategory = new Map();
    existingProducts.forEach((p) => {
      if (p && p.slug && p.id_categorie) {
        bySlugAndCategory.set(keyFor(p.slug, p.id_categorie), p);
      }
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const line = i + 2;

      const nom = String(row.nom || '').trim();
      const slug = String(row.slug || '').trim();

      if (!nom || !slug) {
        skipped++;
        errors.push(`Ligne ${line}: nom ou slug manquant.`);
        continue;
      }

      const rowCategory = normalizeInt(row.id_categorie);
      const idCategorie = categoryMode === 'current' ? forcedCategoryId : rowCategory;

      if (!idCategorie) {
        skipped++;
        errors.push(`Ligne ${line}: id_categorie manquant.`);
        continue;
      }

      const payload = {
        nom,
        slug,
        description_courte: row.description_courte || null,
        description_longue: row.description_longue || null,
        description_html: row.description_html || null,
        images: normalizeImages(row.images),
        prix: normalizeDecimal(row.prix),
        devise: (row.devise || 'EUR').toString().trim().toUpperCase(),
        duree: row.duree || 'mois',
        id_categorie: idCategorie,
        tag: row.tag || 'Standard',
        statut: row.statut || 'Disponible',
        type_achat: row.type_achat || 'panier',
        ordre_affichage: normalizeInt(row.ordre_affichage) ?? 0,
        actif: normalizeBool(row.actif)
      };

      const key = keyFor(payload.slug, payload.id_categorie);
      const existing = bySlugAndCategory.get(key);

      try {
        if (mode === 'insert') {
          if (existing) {
            skipped++;
            errors.push(`Ligne ${line}: produit deja existant pour ce slug/categorie.`);
            continue;
          }

          const createResp = await axios.post('http://api:8080/api/web-products', payload, { headers });
          created++;
          bySlugAndCategory.set(key, createResp.data || payload);
          continue;
        }

        if (existing && existing.id_produit) {
          await axios.put(`http://api:8080/api/web-products/${existing.id_produit}`, {
            ...existing,
            ...payload
          }, { headers });
          updated++;
          bySlugAndCategory.set(key, { ...existing, ...payload });
        } else {
          const createResp = await axios.post('http://api:8080/api/web-products', payload, { headers });
          created++;
          bySlugAndCategory.set(key, createResp.data || payload);
        }
      } catch (err) {
        skipped++;
        const detail = err.response?.data?.error || err.response?.data?.message || err.message;
        errors.push(`Ligne ${line}: ${detail}`);
      }
    }

    return res.json({
      success: true,
      created,
      updated,
      skipped,
      errors
    });
  } catch (err) {
    console.error('Erreur import produits:', err);
    return res.status(500).json({
      message: err.message || 'Erreur serveur pendant l\'import.'
    });
  }
});

app.get('/admin/api/carousel-images', proxyToApiWithAuth('/carousel-images'));
app.post('/admin/api/carousel-images', proxyToApiWithAuth('/carousel-images'));
app.put('/admin/api/carousel-images/:id', proxyToApiWithAuth('/carousel-images/:id'));
app.delete('/admin/api/carousel-images/:id', proxyToApiWithAuth('/carousel-images/:id'));
app.post('/admin/api/carousel-images/reorder', proxyToApiWithAuth('/carousel-images/reorder'));

app.get('/admin/api/api-tokens', proxyToApiWithAuth('/api-tokens'));
app.post('/admin/api/api-tokens', proxyToApiWithAuth('/api-tokens'));
app.delete('/admin/api/api-tokens/:id', proxyToApiWithAuth('/api-tokens/:id'));
app.put('/admin/api/api-tokens/:id/status', proxyToApiWithAuth('/api-tokens/:id/status'));

// Commandes (admin)
app.get('/admin/api/commandes', proxyToApiWithAuth('/commandes'));
app.post('/admin/api/commandes', proxyToApiWithAuth('/commandes'));
app.get('/admin/api/commandes/:id', proxyToApiWithAuth('/commandes/:id'));
app.put('/admin/api/commandes/:id', proxyToApiWithAuth('/commandes/:id'));
app.delete('/admin/api/commandes/:id', proxyToApiWithAuth('/commandes/:id'));

// Alias /orders → /commandes (dashboard.js + orders.js compatibility)
app.get('/admin/api/orders', proxyToApiWithAuth('/commandes'));
app.post('/admin/api/orders', proxyToApiWithAuth('/commandes'));
app.get('/admin/api/orders/:id', proxyToApiWithAuth('/commandes/:id'));
app.put('/admin/api/orders/:id', proxyToApiWithAuth('/commandes/:id'));
app.delete('/admin/api/orders/:id', proxyToApiWithAuth('/commandes/:id'));
app.get('/admin/api/stats/top-products', proxyToApiWithAuth('/admin/stats/top-products'));

// Roles & Permissions (admin)
app.get('/admin/api/roles', proxyToApiWithAuth('/admin/roles'));
app.post('/admin/api/roles', proxyToApiWithAuth('/admin/roles'));
app.put('/admin/api/roles/:id', proxyToApiWithAuth('/admin/roles/:id'));
app.delete('/admin/api/roles/:id', proxyToApiWithAuth('/admin/roles/:id'));
app.get('/admin/api/permissions', proxyToApiWithAuth('/admin/permissions'));
app.get('/admin/api/roles/:id/permissions', proxyToApiWithAuth('/admin/roles/:id/permissions'));
app.post('/admin/api/roles/:id/permissions', proxyToApiWithAuth('/admin/roles/:id/permissions'));
app.delete('/admin/api/roles/:id/permissions/:code', proxyToApiWithAuth('/admin/roles/:id/permissions/:code'));

// Newsletter (admin)
app.get('/admin/api/newsletter/subscribers', proxyToApiWithAuth('/admin/newsletter/subscribers'));
app.get('/admin/api/newsletter/campaigns', proxyToApiWithAuth('/admin/newsletter/campaigns'));
app.post('/admin/api/newsletter/campaigns', proxyToApiWithAuth('/admin/newsletter/campaigns'));
app.post('/admin/api/newsletter/campaigns/:id/send', proxyToApiWithAuth('/admin/newsletter/campaigns/:id/send'));

// GET /admin/api/quotes — Devis (commandes devis_* en DB + enrichissement Stripe)
app.get('/admin/api/quotes', checkAdminAuth, async (req, res) => {
  const token = getAuthToken(req);
  try {
    // Récupérer toutes les commandes depuis l'API Go
    const resp = await axios.get('http://api:8080/api/commandes', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const all = Array.isArray(resp.data) ? resp.data : [];

    // Filtrer uniquement les devis
    const DEVIS_STATUTS = ['devis_demande', 'devis_envoye', 'devis_accepte', 'devis_refuse'];
    const devis = all.filter(c => DEVIS_STATUTS.includes(c.status));

    // Récupérer les quotes Stripe pour enrichir les données (avec line_items et customer expandés)
    let stripeMap = {};
    if (stripe) {
      try {
        const sq = await stripe.quotes.list({ limit: 100, expand: ['data.line_items', 'data.customer'] });
        sq.data.forEach(q => { stripeMap[q.id] = q; });
      } catch (_) {}
    }

    // Construire la liste enrichie
    const enriched = devis.map(c => {
      const stripeId = c.promoCode && c.promoCode.startsWith('qt_') ? c.promoCode : null;
      const sq       = stripeId && stripeMap[stripeId] ? stripeMap[stripeId] : null;
      // Lire le JSON compact local si promoCode n'est pas encore un qt_xxx
      let localMeta = {};
      if (c.promoCode && !c.promoCode.startsWith('qt_')) {
        try { localMeta = JSON.parse(c.promoCode); } catch (_) {}
      }
      return {
        id:       c.id,
        date:     c.orderDate,
        amount:   c.totalAmount,
        status:   c.status,
        userId:   c.userId,
        stripeId: c.promoCode || null,
        stripeQuote: sq ? {
          id:             sq.id,
          status:         sq.status,
          hosted_url:     sq.hosted_quote_url,
          amount_total:   (sq.amount_total || 0) / 100,
          // customer peut être un objet expandé ou un ID string
          customer_email: sq.metadata?.customerEmail || (typeof sq.customer === 'object' ? sq.customer?.email : '') || localMeta.e || '',
          customer_name:  sq.metadata?.customerName  || (typeof sq.customer === 'object' ? sq.customer?.name  : '') || localMeta.n || '',
          company:        sq.metadata?.company        || localMeta.c || '',
          phone:          sq.metadata?.phone          || localMeta.p || '',
          message:        sq.metadata?.message        || localMeta.m || '',
          product:        sq.metadata?.productName    || sq.line_items?.data?.[0]?.description || localMeta.pr || '',
        } : {
          // Pas encore de quote Stripe — on expose les données locales directement
          id: null, status: null, hosted_url: null, amount_total: 0,
          customer_email: localMeta.e || '',
          customer_name:  localMeta.n || '',
          company:        localMeta.c || '',
          phone:          localMeta.p || '',
          message:        localMeta.m || '',
          product:        localMeta.pr || '',
        }
      };
    });

    res.json({ devis: enriched, total: enriched.length, stripeActive: !!stripe });
  } catch (err) {
    console.error('[admin/quotes]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/api/quotes/:id/send-stripe — L'admin crée + envoie un devis Stripe avec son prix
app.post('/admin/api/quotes/:id/send-stripe', checkAdminAuth, async (req, res) => {
  const token    = getAuthToken(req);
  const id       = parseInt(req.params.id);
  const { email, productName, unitPrice, quantity, notes } = req.body || {};

  if (!email || !productName || !unitPrice) {
    return res.status(400).json({ error: 'email, productName et unitPrice sont requis' });
  }

  if (!stripe) {
    return res.status(503).json({ error: 'Stripe non configuré sur ce serveur' });
  }

  try {
    const qty   = Number(quantity) || 1;
    const price = Number(unitPrice);

    // 0. Récupérer la commande pour lire le JSON metadata original (nom/email/société/téléphone du client)
    let clientMeta = {};
    try {
      const cmdResp = await axios.get(`http://api:8080/api/commandes/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const promoCode = cmdResp.data?.promoCode || '';
      if (promoCode && !promoCode.startsWith('qt_')) {
        clientMeta = JSON.parse(promoCode);
      }
    } catch (_) {}

    // 1. Récupérer ou créer un Customer Stripe (l'API Quotes n'accepte pas customer_email directement)
    let customerId;
    const clientName = clientMeta.n || '';
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) {
      customerId = existing.data[0].id;
      // Mettre à jour le nom s'il manquait
      if (clientName && !existing.data[0].name) {
        await stripe.customers.update(customerId, { name: clientName });
      }
    } else {
      const customer = await stripe.customers.create({
        email,
        name: clientName || undefined,
        metadata: { commandeId: String(id) }
      });
      customerId = customer.id;
    }

    // 2. Créer un produit Stripe éphémère (l'API Quotes exige un product ID dans price_data, pas product_data inline)
    const desc = notes ? notes.substring(0, 300) : undefined;
    const product = await stripe.products.create({
      name: productName,
      ...(desc ? { description: desc } : {})
    });

    // 3. Créer le devis Stripe (brouillon)
    const quote = await stripe.quotes.create({
      customer: customerId,
      line_items: [{
        price_data: {
          currency:    'eur',
          product:     product.id,
          unit_amount: Math.round(price * 100)
        },
        quantity: qty
      }],
      metadata: {
        commandeId:    String(id),
        adminSent:     'true',
        productName,
        quantity:      String(qty),
        customerName:  clientMeta.n || '',
        customerEmail: email,
        company:       clientMeta.c || '',
        phone:         clientMeta.p || '',
        message:       clientMeta.m || ''
      }
    });

    // 3. Finaliser → génère le PDF et envoie l'email au client
    const finalized = await stripe.quotes.finalizeQuote(quote.id);

    // 3. Mettre à jour la commande en DB : statut → devis_envoye, montant, quoteId
    await axios.put(
      `http://api:8080/api/commandes/${id}`,
      {
        totalAmount: price * qty,
        status:      'devis_envoye',
        promoCode:   finalized.id   // stocker l'ID Stripe Quote (userId omis → préservé)
      },
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );

    res.json({
      success:   true,
      quoteId:   finalized.id,
      hostedUrl: finalized.hosted_quote_url,
      status:    finalized.status
    });

  } catch (err) {
    console.error('[admin/quotes/send-stripe]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Discounts (admin) ────────────────────────────────────────────────────────

// GET /admin/api/discounts — liste codes locaux + coupons Stripe si dispo
app.get('/admin/api/discounts', checkAdminAuth, async (req, res) => {
  const local = DEMO_PROMO_CODES.map(c => ({ ...c, source: 'local' }));
  if (!stripe) return res.json({ codes: local, stripeActive: false });

  try {
    const [coupons, promos] = await Promise.all([
      stripe.coupons.list({ limit: 50 }),
      stripe.promotionCodes.list({ limit: 50, active: true }),
    ]);
    const stripeCodes = promos.data.map(p => ({
      code:     p.code,
      type:     p.coupon.percent_off ? 'percent' : 'amount',
      discount: p.coupon.percent_off || (p.coupon.amount_off || 0) / 100,
      label:    p.coupon.name || p.code,
      active:   p.active,
      source:   'stripe',
      stripeId: p.id,
      couponId: p.coupon.id,
      maxRedemptions: p.max_redemptions,
      timesRedeemed: p.times_redeemed,
    }));
    res.json({ codes: [...local, ...stripeCodes], stripeActive: true });
  } catch (err) {
    res.json({ codes: local, stripeActive: false, stripeError: err.message });
  }
});

// POST /admin/api/discounts — créer un code local ou Stripe
app.post('/admin/api/discounts', checkAdminAuth, async (req, res) => {
  const { code, type, discount, createInStripe } = req.body || {};
  if (!code || !type || discount == null) {
    return res.status(400).json({ error: 'Champs manquants : code, type, discount' });
  }
  const upper = code.toUpperCase().replace(/\s+/g, '');
  if (DEMO_PROMO_CODES.find(c => c.code === upper)) {
    return res.status(409).json({ error: 'Ce code existe déjà localement' });
  }

  const newCode = {
    code:     upper,
    type:     type,   // 'percent' | 'amount'
    discount: Number(discount),
    label:    `${upper} (${type === 'percent' ? `−${discount}%` : `−${Number(discount).toFixed(2).replace('.', ',')} €`})`,
    active:   true,
    timesRedeemed: 0,
  };
  DEMO_PROMO_CODES.push(newCode);

  // Créer aussi dans Stripe si demandé et que Stripe est actif
  if (createInStripe && stripe) {
    try {
      const couponParams = type === 'percent'
        ? { percent_off: Number(discount), duration: 'once', name: upper }
        : { amount_off: Math.round(Number(discount) * 100), currency: 'eur', duration: 'once', name: upper };
      const coupon = await stripe.coupons.create(couponParams);
      await stripe.promotionCodes.create({ coupon: coupon.id, code: upper });
      newCode.source = 'local+stripe';
    } catch (e) {
      newCode.stripeError = e.message;
    }
  }

  res.status(201).json(newCode);
});

// DELETE /admin/api/discounts/:code — désactiver un code local
app.delete('/admin/api/discounts/:code', checkAdminAuth, async (req, res) => {
  const upper = req.params.code.toUpperCase();
  const idx = DEMO_PROMO_CODES.findIndex(c => c.code === upper);
  if (idx < 0) return res.status(404).json({ error: 'Code introuvable' });
  DEMO_PROMO_CODES.splice(idx, 1);
  res.json({ deleted: upper });
});

// Commandes (utilisateur connecté — filtrées par son ID)
app.get('/api/mes-commandes', checkAuth, async (req, res) => {
  try {
    const token = getAuthToken(req);
    const userId = req.user.id_utilisateur;
    const response = await axios.get('http://api:8080/api/commandes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const commandes = (response.data || []).filter(c => c.userId === userId);
    res.json(commandes);
  } catch (err) {
    console.error('Mes commandes error:', err.message);
    if (err.response && err.response.status >= 500) return res.json([]);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
});

// GET /api/mes-devis — Devis de l'utilisateur connecté (avec enrichissement Stripe si qt_xxx)
app.get('/api/mes-devis', checkAuth, async (req, res) => {
  try {
    const token  = getAuthToken(req);
    const userId = req.user.id_utilisateur;
    const response = await axios.get('http://api:8080/api/commandes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const DEVIS_STATUTS = ['devis_demande', 'devis_envoye', 'devis_accepte', 'devis_refuse'];
    const devis = (response.data || []).filter(c =>
      c.userId === userId && DEVIS_STATUTS.includes(c.status)
    );

    // Enrichir avec Stripe si le promoCode est un qt_xxx
    let stripeMap = {};
    if (stripe) {
      const quoteIds = devis.filter(d => d.promoCode?.startsWith('qt_')).map(d => d.promoCode);
      for (const qid of quoteIds) {
        try {
          stripeMap[qid] = await stripe.quotes.retrieve(qid, { expand: ['line_items'] });
        } catch (_) {}
      }
    }

    const enriched = devis.map(d => {
      let meta = {};
      if (d.promoCode && !d.promoCode.startsWith('qt_')) {
        try { meta = JSON.parse(d.promoCode); } catch (_) {}
      }
      const sq = d.promoCode && stripeMap[d.promoCode] ? stripeMap[d.promoCode] : null;
      // Priorité : metadata Stripe (fiable) > JSON compact local > line_items Stripe
      const productName = sq?.metadata?.productName
        || meta.pr
        || sq?.line_items?.data?.[0]?.description
        || '—';
      const quantity = Number(sq?.metadata?.quantity || meta.q || 1);
      return {
        id:          d.id,
        date:        d.orderDate,
        status:      d.status,
        amount:      d.totalAmount,
        productName,
        quantity,
        message:     meta.m  || '',
        hostedUrl:   sq?.hosted_quote_url || null,
        stripeStatus: sq?.status || null,
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json(enriched);
  } catch (err) {
    console.error('[mes-devis]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin/api/user/profile', proxyToApiWithAuth('/user/profile'));

// — Logs (admin seulement) —
app.get('/admin/api/logs', proxyToApiWithAuth('/logs'));
app.get('/admin/api/logs/stats', proxyToApiWithAuth('/logs/stats'));
app.delete('/admin/api/logs', proxyToApiWithAuth('/logs'));

// — Backups (admin seulement) —
app.post('/admin/api/backup', proxyToApiWithAuth('/admin/backup'));
app.get('/admin/api/backup/list', proxyToApiWithAuth('/admin/backup/list'));
app.get('/admin/api/backup/stats', proxyToApiWithAuth('/admin/backup/stats'));
app.get('/admin/api/backup/schedule', proxyToApiWithAuth('/admin/backup/schedule'));
app.post('/admin/api/backup/schedule', proxyToApiWithAuth('/admin/backup/schedule'));
app.get('/admin/api/backup/download', proxyToApiWithAuth('/admin/backup/download'));
app.post('/admin/api/backup/restore', proxyToApiWithAuth('/admin/backup/restore'));
app.delete('/admin/api/backup', proxyToApiWithAuth('/admin/backup'));

// — Upload d'images pour les produits (admin seulement) —
app.post('/admin/api/upload', checkAdminAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier envoyé' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

// Serve uploaded images
app.use('/uploads', express.static(UPLOADS_DIR));

// =============================================================================
// SWAGGER DYNAMIQUE — spec générée par l'API Go, paths patchés via proxy
// =============================================================================

// Retourne la spec OpenAPI dynamique avec les paths réécrits pour passer par /admin/api
app.get('/admin/api/swagger.json', checkAdminAuth, async (req, res) => {
  try {
    const response = await axios.get('http://api:8080/api/swagger.json');
    const spec = response.data;

    // Réécrire le server URL en relatif (origine courante = port 3000)
    spec.servers = [{ url: '', description: 'Via proxy admin (auth par cookie)' }];

    // Réécrire tous les paths : /api/X → /admin/api/X
    const patchedPaths = {};
    for (const [p, methods] of Object.entries(spec.paths || {})) {
      const newPath = p.replace(/^\/api\//, '/admin/api/');
      patchedPaths[newPath] = methods;
    }
    spec.paths = patchedPaths;

    res.json(spec);
  } catch (error) {
    console.error('Failed to fetch swagger spec:', error.message);
    res.status(500).json({ error: 'Failed to load API spec' });
  }
});

// Catch-all admin proxy — utilisé par Swagger UI "Try it out" pour les routes non explicites
// DOIT être placé après toutes les routes admin explicites
app.all('/admin/api/*', async (req, res) => {
  try {
    const token = getAuthToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    // Vérifier admin
    const userResponse = await axios.get('http://api:8080/api/user/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (userResponse.data.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // /admin/api/X → /api/X sur l'API Go
    const apiPath = req.path.replace(/^\/admin\/api/, '/api');
    let url = `http://api:8080${apiPath}`;

    if (Object.keys(req.query).length > 0) {
      url += '?' + new URLSearchParams(req.query).toString();
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined;
    const response = await axios({ method: req.method.toLowerCase(), url, headers, data: body });
    res.json(response.data);
  } catch (error) {
    console.error(`Admin proxy error for ${req.path}:`, error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Internal server error'
    });
  }
});

// Routes utilisateur (authentification requise mais pas forcément admin)
app.get('/api/user/profile', checkAuth, async (req, res) => {
  try {
    // L'utilisateur est déjà vérifié par checkAuth middleware
    res.json(req.user);
  } catch (error) {
    console.error('Error getting user profile:', error.message);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

app.put('/api/user/profile', checkAuth, async (req, res) => {
  try {
    const token = getAuthToken(req);
    
    // Transférer la requête vers l'API
    const response = await axios.put(`http://api:8080/api/user/profile`, req.body, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error updating user profile:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to update profile'
    });
  }
});

app.post('/api/user/2fa/setup', checkAuth, async (req, res) => {
  try {
    const token = getAuthToken(req);
    
    const response = await axios.post('http://api:8080/api/user/2fa/setup', req.body, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error setting up 2FA:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to setup 2FA'
    });
  }
});

app.delete('/api/user/2fa/remove', checkAuth, async (req, res) => {
  try {
    const token = getAuthToken(req);
    
    const response = await axios.delete('http://api:8080/api/user/2fa/remove', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error removing 2FA:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to remove 2FA'
    });
  }
});

app.post('/api/user/2fa/verify', checkAuth, async (req, res) => {
  try {
    const token = getAuthToken(req);
    
    const response = await axios.post('http://api:8080/api/user/2fa/verify', req.body, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error verifying 2FA:', error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Failed to verify 2FA'
    });
  }
});

// =============================================================================
// PLUS DE PROXY GÉNÉRIQUE - SÉCURITÉ RENFORCÉE
// =============================================================================

// =============================================================================
// STRIPE — Validation code promo + Checkout Session
// =============================================================================

// GET /api/stripe-config — Retourne la clé publique Stripe pour le frontend
app.get('/api/stripe-config', (req, res) => {
  res.json({ publishableKey: STRIPE_PUBLISHABLE_KEY || null });
});

// GET /api/public/top-products — exposé au frontend (pas d'auth)
app.get('/api/public/top-products', async (_req, res) => {
  try {
    const response = await axios.get('http://api:8080/api/public/top-products');
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching public top products:', error.message);
    res.status(error.response?.status || 500).json({ error: 'Failed to load top products' });
  }
});

// POST /api/validate-promo — Valide un code promo Stripe
app.post('/api/validate-promo', async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code manquant' });

  // Toujours vérifier les codes locaux en premier
  const localMatch = DEMO_PROMO_CODES.find(c => c.code === code.toUpperCase() && c.active);
  if (localMatch) {
    localMatch.timesRedeemed = (localMatch.timesRedeemed || 0) + 1;
    return res.json({ valid: true, code: localMatch.code, type: localMatch.type, discount: localMatch.discount, label: localMatch.label });
  }

  if (!stripe) {
    return res.status(400).json({ valid: false, error: 'Code promo invalide' });
  }

  try {
    // Chercher parmi les promotion codes Stripe
    const promos = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
    if (!promos.data.length) {
      return res.status(400).json({ valid: false, error: 'Code promo invalide ou expiré' });
    }
    const promo = promos.data[0];
    const coupon = promo.coupon;

    let type, discount, label;
    if (coupon.percent_off) {
      type = 'percent';
      discount = coupon.percent_off;
      label = `${code.toUpperCase()} (−${discount}%)`;
    } else {
      type = 'amount';
      discount = (coupon.amount_off || 0) / 100; // centimes → euros
      label = `${code.toUpperCase()} (−${discount.toFixed(2).replace('.', ',')} €)`;
    }

    return res.json({ valid: true, code: promo.code, type, discount, label });
  } catch (err) {
    console.error('Stripe promo error:', err.message);
    return res.status(500).json({ error: 'Erreur Stripe' });
  }
});

// POST /api/request-quote — Demande de devis (enregistrement uniquement, pas de prix)
// Le prix est fixé par l'admin qui crée ensuite le devis Stripe via /admin/api/quotes/:id/send-stripe
app.post('/api/request-quote', async (req, res) => {
  const token = getAuthToken(req);
  const {
    productName, productId,
    quantity, name, firstName, email, company, phone, message
  } = req.body || {};

  if (!email || !productName) {
    return res.status(400).json({ error: 'Email et nom du produit requis' });
  }

  const fullName = [firstName, name].filter(Boolean).join(' ');

  // Récupérer le profil si l'utilisateur est connecté
  let userId = null;
  if (token) {
    try {
      const profile = await axios.get('http://api:8080/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      userId = profile.data.id_utilisateur;
    } catch (_) {}
  }

  // Stocker les métadonnées de la demande dans promo_code (JSON compact)
  const meta = JSON.stringify({
    e: email,
    n: fullName.substring(0, 60),
    c: (company || '').substring(0, 60),
    p: (phone   || '').substring(0, 20),
    q: Number(quantity) || 1,
    pr: productName.substring(0, 80),
    m: (message || '').substring(0, 200)
  });

  // Sauvegarder en base comme commande "devis_demande" (montant = 0, sera défini par l'admin)
  if (!userId) {
    return res.status(401).json({ error: 'Vous devez être connecté pour soumettre une demande de devis.' });
  }

  try {
    await axios.post(
      'http://api:8080/api/commandes',
      {
        totalAmount: 0,
        status:      'devis_demande',
        userId:      userId,
        promoCode:   meta
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (e) {
    console.error('[request-quote] DB save failed:', e.message);
    return res.status(500).json({ error: 'Erreur lors de l\'enregistrement de votre demande. Veuillez réessayer.' });
  }

  console.log(`[request-quote] Nouvelle demande de devis : ${fullName || email} — ${productName}`);
  return res.json({ success: true });
});

// POST /api/create-checkout-session — Crée une session de paiement Stripe
app.post('/api/create-checkout-session', checkAuth, async (req, res) => {
  const { items, promoCode } = req.body || {};
  if (!items || !items.length) return res.status(400).json({ error: 'Panier vide' });

  const origin = `${req.protocol}://${req.get('host')}`;

  if (!stripe) {
    return res.json({
      url: `${origin}/mes-commandes.html?checkout=success&demo=1`,
      demo: true,
    });
  }

  try {
    const lineItems = items.map((it) => ({
      price_data: {
        currency: 'eur',
        product_data: { name: it.name },
        unit_amount: Math.round((Number(it.price) || 0) * 100),
      },
      quantity: Number(it.qty) || 1,
    }));

    const sessionParams = {
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/mes-commandes.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/index.html?view=cart`,
      automatic_tax: { enabled: false },
    };

    // Appliquer le code promo
    if (promoCode) {
      // 1. Code local → créer un coupon Stripe à la volée
      const localCode = DEMO_PROMO_CODES.find(c => c.code === promoCode.toUpperCase() && c.active);
      if (localCode) {
        const couponParams = localCode.type === 'percent'
          ? { percent_off: localCode.discount, duration: 'once', name: localCode.code }
          : { amount_off: Math.round(localCode.discount * 100), currency: 'eur', duration: 'once', name: localCode.code };
        const coupon = await stripe.coupons.create(couponParams);
        sessionParams.discounts = [{ coupon: coupon.id }];
      } else {
        // 2. Code Stripe (promotion code)
        const promos = await stripe.promotionCodes.list({ code: promoCode, active: true, limit: 1 });
        if (promos.data.length) {
          sessionParams.discounts = [{ promotion_code: promos.data[0].id }];
        }
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    // NE PAS sauvegarder la commande ici — seulement après confirmation via /api/confirm-order
    return res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    return res.status(500).json({ error: err.message || 'Erreur Stripe' });
  }
});

// POST /api/confirm-order — Appelé depuis mes-commandes.html après paiement confirmé
app.post('/api/confirm-order', checkAuth, async (req, res) => {
  const { sessionId, totalAmount, demo, promoCode, items } = req.body || {};
  const token  = getAuthToken(req);
  const userId = req.user && req.user.id_utilisateur;
  if (!userId) return res.status(401).json({ error: 'Non connecté' });

  let amount = Number(totalAmount) || 0;

  // Récupérer le montant réel depuis Stripe si possible
  if (sessionId && stripe && !demo) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      amount = (session.amount_total || 0) / 100; // centimes → euros
    } catch (e) {
      console.warn('[confirm-order] Impossible de récupérer la session Stripe:', e.message);
    }
  }

  try {
    const normalized = Array.isArray(items) ? items.map(it => ({
      product_slug: it.product_slug || it.slug || it.id || it.productName || it.product_name || '',
      product_name: it.product_name || it.productName || it.name || 'Produit',
      price: Number(it.price) || 0,
      quantity: Number(it.quantity || it.qty || 1) || 1,
      duration: it.duration || ''
    })) : [];

    const r = await axios.post('http://api:8080/api/commandes',
      {
        totalAmount: amount,
        status: 'confirmee',
        userId,
        promoCode: promoCode || '',
        items: normalized,
      },
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    res.status(201).json(r.data);
  } catch (e) {
    console.error('[confirm-order] Erreur:', e.message);
    res.status(500).json({ error: 'Impossible de sauvegarder la commande' });
  }
});

// =============================================================================
// HEALTH CHECK
// =============================================================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OpenAPI spec endpoint - admin only, but served separately for Swagger UI
app.get('/backend/openapi.json', checkAdminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'backend', 'openapi.json'));
});

// Dedicated admin login page
app.get('/backend/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'backend', 'login.html'));
});
app.get('/backend/login', (req, res) => {
  res.redirect('/backend/login.html');
});

// Backend route - admin only
app.use('/backend', checkAdminAuth, express.static(path.join(__dirname, 'backend')));

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, 'frontend')));

// Serve static files from the root directory for favicon.ico
app.use('/favicon.ico', express.static(path.join(__dirname, 'favicon.ico')));

// Serve static files from the img directory
app.use('/img', express.static(path.join(__dirname, 'frontend', 'img')));

// Handle all routes by serving index.html (for SPA behavior if needed, though currently it's multi-page)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/auth.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'auth.html'));
});

// Pages publiques
app.get('/catalogue.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'catalogue.html'));
});

app.get('/categories.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'categories.html'));
});

app.get('/produit.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'produit.html'));
});

// Page protégée - profil utilisateur
app.get('/profil.html', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'profil.html'));
});

// Page protégée - paramètres du compte
app.get('/parametres.html', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'parametres.html'));
});

// Page publique - résultats de recherche
app.get('/recherche.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'recherche.html'));
});

// Page protégée - mes commandes
app.get('/mes-commandes.html', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'mes-commandes.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin/api/') || req.path.startsWith('/auth/')) {
    return res.status(500).json({ error: 'Internal server error' });
  }
  res.status(500).sendFile(path.join(__dirname, 'frontend', 'error.html'));
});

// ── Email Test Route (remove in production) ──────────────────────────────
app.post('/api/test/send-email', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test endpoints disabled in production' });
  }

  const { type, email, firstName } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    let result;
    if (type === 'welcome') {
      result = await sendWelcomeEmail(email, firstName || 'User');
    } else if (type === 'reset') {
      result = await sendPasswordResetEmail(email, 'test-token-12345');
    } else if (type === 'admin') {
      result = await sendAdminNotification(email, 'Test Admin Notification', 'This is a test message');
    } else {
      return res.status(400).json({ error: 'Invalid email type (welcome, reset, admin)' });
    }

    res.json({ success: true, result });
  } catch (error) {
    console.error('Email test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  // API routes return JSON, HTML routes return the error page
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin/api/') || req.path.startsWith('/auth/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).sendFile(path.join(__dirname, 'frontend', 'error.html'));
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${port}/health`);
});
