require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = Number(process.env.PORT) || 8080;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo:27017/shopkart';
const RETRY_MS = 5000;

const log = (msg, extra = {}) => console.log(JSON.stringify({ level: 'info', msg, ...extra }));
const logError = (msg, err) => console.error(JSON.stringify({ level: 'error', msg, error: err.message }));

let shuttingDown = false;

// 1. Open the port first: /health works at once, /ready returns 503 until Mongo is up
const server = app.listen(PORT, () => log('server listening', { port: PORT }));
server.on('error', (err) => { logError('server failed to start', err); process.exit(1); });

// 2. Connect to Mongo in the background and keep retrying (never log the URL)
async function connectWithRetry() {
  while (!shuttingDown) {
    try {
      await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 5000 });
      log('connected to MongoDB');
      return;
    } catch (err) {
      logError(`MongoDB not reachable, retrying in ${RETRY_MS / 1000}s`, err);
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }
}
connectWithRetry();

// 3. Graceful shutdown: stop new requests, close the DB, force-exit after 10s
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('shutdown started', { signal });
  setTimeout(() => { logError('forced exit', new Error('shutdown timeout')); process.exit(1); }, 10000).unref();
  server.close(async () => {
    await mongoose.connection.close().catch(() => { });
    log('shutdown complete');
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));