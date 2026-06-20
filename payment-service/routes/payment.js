const express = require('express');
const Payment = require('../models/Payment');

const router = express.Router();

// customer: make a payment
router.post('/payment', async (req, res) => {
  try {
    const customerId = req.headers['x-user-id'];
    if (!customerId) return res.status(400).json({ error: 'Missing user context' });
    const { orderId, amount, paymentMethod } = req.body || {};
    if (!orderId || amount == null) {
      return res.status(400).json({ error: 'orderId and amount are required' });
    }
    const method = paymentMethod === 'card' ? 'card' : 'cash';
    // Card payments are settled immediately; cash stays pending until an admin confirms.
    const status = method === 'card' ? 'paid' : 'pending';
    const payment = await Payment.create({ orderId, customerId, amount, method, status });
    return res.status(201).json(payment);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// customer: view own payment status (latest first)
router.get('/payment/status', async (req, res) => {
  try {
    const customerId = req.headers['x-user-id'];
    const payments = await Payment.find({ customerId }).sort({ createdAt: -1 });
    return res.json(
      payments.map((p) => ({
        id: p._id,
        orderId: p.orderId,
        amount: p.amount,
        method: p.method,
        status: p.status
      }))
    );
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// customer: full payment history
router.get('/payment/history', async (req, res) => {
  try {
    const customerId = req.headers['x-user-id'];
    const payments = await Payment.find({ customerId }).sort({ createdAt: -1 });
    return res.json(payments);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// admin: view all payments
router.get('/payment', async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    return res.json(payments);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// admin: change a payment status (e.g. confirm a cash payment as paid)
router.put('/payment/:id', async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['pending', 'paid'].includes(status)) {
      return res.status(400).json({ error: 'status must be pending|paid' });
    }
    const payment = await Payment.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    return res.json(payment);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
