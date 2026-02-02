const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const port = 3000;

// Proxy API requests to the Go backend
app.use('/api', createProxyMiddleware({
  target: 'http://api:8080',
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    // If the client already sent an Authorization header, keep it!
    // Otherwise, inject the master secret (for public routes or internal calls)
    if (!req.headers['authorization']) {
      const secret = process.env.API_SECRET || 'change_me_in_production_12345';
      proxyReq.setHeader('Authorization', `Bearer ${secret}`);
    }
  }
}));

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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});