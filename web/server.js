const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 3000;

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
        message: data.message || 'Login successful',
        requires_2fa: data.requires_2fa || false
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

app.get('/admin/api/user/profile', proxyToApiWithAuth('/user/profile'));
app.post('/admin/api/upload', proxyToApiWithAuth('/upload'));

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
    const userId = req.user.id_utilisateur;
    
    // Transférer la requête vers l'API
    const response = await axios.put(`http://api:8080/api/users/${userId}/profile`, req.body, {
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${port}/health`);
});