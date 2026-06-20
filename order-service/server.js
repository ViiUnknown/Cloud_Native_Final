// order-service/server.js
// Trusts gateway headers (x-user-id, x-user-role); contains NO JWT logic.
require('dotenv').config();
const express = require('express');
const connectDB = require('./db');
const orderRoutes = require('./routes/order');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order-service' }));

// Mounted at root: /order, /order/:id/accept, /order/:id/status.
app.use('/', orderRoutes);

const PORT = process.env.PORT || 3003;
connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`[order-service] listening on ${PORT}`));
});
