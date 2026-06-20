// order-service/routes/order.js
// Gateway strips /admin or /customer, so these are short sub-routes:
//   POST /order              (customer create)
//   GET  /order              (admin -> all orders, customer -> own orders, by x-user-role)
//   PUT  /order/:id/accept   (admin accept)
//   PUT  /order/:id/status   (admin update status)
const express = require('express');
const Order = require('../models/Order');

const router = express.Router();

// customer: create order
router.post('/order', async (req, res) => {
  try {
    const customerId = req.headers['x-user-id'];
    if (!customerId) return res.status(400).json({ error: 'Missing user context' });
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items[] is required' });
    }
    const total = items.reduce(
      (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 1),
      0
    );
    const order = await Order.create({ customerId, items, total, status: 'pending' });
    return res.status(201).json(order);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// view orders: admin sees all, customer sees only their own
router.get('/order', async (req, res) => {
  try {
    const role = req.headers['x-user-role'];
    const customerId = req.headers['x-user-id'];
    const filter = role === 'admin' ? {} : { customerId };
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// admin: accept an order
router.put('/order/:id/accept', async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: 'accepted' },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.json(order);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// admin: update order status
router.put('/order/:id/status', async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['pending', 'accepted', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'status must be pending|accepted|completed' });
    }
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    return res.json(order);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
