// menu-service/server.js
// Trusts gateway headers (x-user-id, x-user-role); contains NO JWT logic.
require('dotenv').config();
const express = require('express');
const connectDB = require('./db');
const menuRoutes = require('./routes/menu');

const app = express();
app.use(express.json());

const INSTANCE = process.env.INSTANCE_NAME || 'menu-service';

// Log every request with the replica name so round-robin is screenshot-able.
app.use((req, res, next) => {
  console.log(`[${INSTANCE}] ${req.method} ${req.url} (user=${req.headers['x-user-id'] || '-'})`);
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: INSTANCE }));

// Mounted at root: /menu, /menu/:id, /cart (gateway already stripped the prefix).
app.use('/', menuRoutes);

const PORT = process.env.PORT || 3002;
connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`[${INSTANCE}] listening on ${PORT}`));
});
