const express = require('express');
const mongoose = require('mongoose');
const { register, metricsMiddleware } = require('./metrics');
const productsRouter = require('./routes/products');

const app = express();

app.use(express.json());
app.use(metricsMiddleware);

// Liveness check (no DB call)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness check (checks mongoose connection)
app.get('/ready', (req, res) => {
  if (mongoose.connection.readyState === 1) {
    return res.status(200).json({ status: 'ready' });
  }
  return res.status(503).json({ status: 'not ready' });
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res, next) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    next(err);
  }
});

// Product routes
app.use('/api/products', productsRouter);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Centralized error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: err.message });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

