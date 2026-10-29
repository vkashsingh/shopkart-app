require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = Number(process.env.PORT) || 8080;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://mongo:27017/shopkart';

let server;

async function start() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log(`Connected to MongoDB at ${MONGO_URL}`);

    server = app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      console.log('HTTP server closed');
      try {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
        process.exit(0);
      } catch (err) {
        console.error('Error during MongoDB disconnect:', err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();

