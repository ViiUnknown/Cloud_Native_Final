// order-service/db.js
const mongoose = require('mongoose');

async function connectDB(uri) {
  if (!uri) {
    console.error('[DB] MONGO_URI is not set');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    console.log('[DB] Connected to MongoDB Atlas:', mongoose.connection.name);
  } catch (err) {
    console.error('[DB] Connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
