const express = require('express');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const multer = require('multer');
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
    else cb(new Error('Seules les images sont acceptées'), false);
  }
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
      // For HTML pages, redirect to auth page
      if (req.path.endsWith('.html') || req.path === '/backend' || req.path === '/backend/') {
        return res.redirect('/auth.html?redirect=/backend/');
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
      // For HTML pages, redirect to auth page with error
      if (req.path.endsWith('.html') || req.path === '/backend' || req.path === '/backend/') {
        return res.redirect('/auth.html?error=admin_required');
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
      return res.redirect('/auth.html?error=unauthorized');
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
app.post('/auth/login', async (req, res) => {
  try {
    const response = await axios.post('http://api:8080/api/login', req.body);
    const data = response.data;
    
    // 2FA required: forward the response with 200 so the frontend can show the 2FA step
    if (data.requires_2fa) {
      return res.json({ requires_2fa: true });
    }

    if (data.token) {
      // SÉCURISÉ: httpOnly cookie avec options strictes
      res.cookie('authToken', data.token, {
        httpOnly: true,  // Cannot be read by JavaScript (XSS protection)
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'strict', // CSRF protection
        maxAge: 8 * 60 * 60 * 1000, // 8 heures au lieu de 24h
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
  res.clearCookie('authToken');
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

// Routes d'inscription (publiques)
app.post('/api/users', async (req, res) => {
  try {
    const response = await axios.post('http://api:8080/api/users', req.body);
    res.json(response.data);
  } catch (error) {
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
      const headers = { 'Authorization': `Bearer ${token}` };
      
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

// Routes admin protégées - Panel d'administration uniquement
app.get('/admin/api/users', proxyToApiWithAuth('/users'));
app.get('/admin/api/users/:id', proxyToApiWithAuth('/users/:id'));
app.put('/admin/api/users/:id', proxyToApiWithAuth('/users/:id'));
app.delete('/admin/api/users/:id', proxyToApiWithAuth('/users/:id'));
app.post('/admin/api/users/:id/reset-2fa', proxyToApiWithAuth('/users/:id/reset-2fa'));

app.get('/admin/api/categories', proxyToApiWithAuth('/web-categories'));
app.post('/admin/api/categories', proxyToApiWithAuth('/web-categories'));
app.put('/admin/api/categories/:id', proxyToApiWithAuth('/web-categories/:id'));
app.delete('/admin/api/categories/:id', proxyToApiWithAuth('/web-categories/:id'));

app.get('/admin/api/products', proxyToApiWithAuth('/web-products'));
app.post('/admin/api/products', proxyToApiWithAuth('/web-products'));
app.put('/admin/api/products/:id', proxyToApiWithAuth('/web-products/:id'));
app.delete('/admin/api/products/:id', proxyToApiWithAuth('/web-products/:id'));

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
    // Si la table n'existe pas ou autre erreur serveur → liste vide
    if (err.response && err.response.status >= 500) return res.json([]);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
});

app.get('/admin/api/user/profile', proxyToApiWithAuth('/user/profile'));

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
  const { sessionId, totalAmount, demo, promoCode } = req.body || {};
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
    const r = await axios.post('http://api:8080/api/commandes',
      { totalAmount: amount, status: 'confirmee', userId, promoCode: promoCode || '' },
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