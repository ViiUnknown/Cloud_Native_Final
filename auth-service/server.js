require('dotenv').config();
const express = require('express');
const connectDB = require('./db');
const authRoutes = require('./routes/auth');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'auth-service' }));

// Mounted at root: /reg and /login (gateway already stripped /auth).
app.use('/', authRoutes);

const PORT = process.env.PORT || 3001;
connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`[auth-service] listening on ${PORT}`));
});
