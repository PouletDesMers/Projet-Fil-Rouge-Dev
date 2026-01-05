const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, 'frontend')));

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