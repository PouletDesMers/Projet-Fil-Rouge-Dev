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
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Store user info in request for later use
    req.user = userProfile;
    next();
  } catch (error) {
    console.error('Auth check failed:', error.message);
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

// Proxy API requests to the Go backend
app.use('/api', createProxyMiddleware({
  target: 'http://api:8080',
  changeOrigin: true,
  pathRewrite: {},
  onProxyReq: (proxyReq, req, res) => {
    // Set Authorization header if not already present
    if (!req.headers['authorization']) {
      const secret = process.env.API_SECRET || 'change_me_in_production_12345';
      proxyReq.setHeader('Authorization', `Bearer ${secret}`);
    }

    // Handle request body for POST/PUT/PATCH
    if (req.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      // Write body to the proxy request
      proxyReq.write(bodyData);
    }
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(503).json({ error: 'Backend API service unavailable' });
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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