require('dotenv').config();
const express = require('express');
const connectDB = require('./db');
const paymentRoutes = require('./routes/payment');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'payment-service' }));

// Mounted at root: /payment, /payment/status, /payment/history, /payment/:id.
app.use('/', paymentRoutes);

const PORT = process.env.PORT || 3004;
connectDB(process.env.MONGO_URI).then(() => {
  app.listen(PORT, () => console.log(`[payment-service] listening on ${PORT}`));
});
