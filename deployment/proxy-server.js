#!/usr/bin/env node

/**
 * Simple proxy server to solve CORS issues
 * Proxies frontend (8052) and backend (8000) requests
 */

const http = require('http');
const httpProxy = require('http-proxy-middleware');
const express = require('express');
const path = require('path');

const app = express();
const PORT = 8052;

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// Proxy API requests to backend
const apiProxy = httpProxy.createProxyMiddleware({
  target: 'http://127.0.0.1:8000',
  changeOrigin: true,
  logLevel: 'info'
});

// Proxy all API routes
app.use('/lines', apiProxy);
app.use('/gas-volume-calcs', apiProxy);
app.use('/edit_counts', apiProxy);
app.use('/sys_counts', apiProxy);
app.use('/edit', apiProxy);
app.use('/daily', apiProxy);
app.use('/hourly', apiProxy);
app.use('/sys', apiProxy);
app.use('/param', apiProxy);
app.use('/get_report', apiProxy);

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 Production Frontend with API Proxy');
  console.log('='.repeat(60));
  console.log(`📡 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 API Proxy: http://127.0.0.1:8000`);
  console.log(`🕐 Started: ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));
  console.log();
  console.log('💡 Press Ctrl+C to stop');
});