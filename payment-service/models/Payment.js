// payment-service/models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    customerId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['cash', 'card'], default: 'cash' },
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
    createdAt: { type: Date, default: Date.now }
  },
  {
    collection: 'payments' // explicit collection name
  }
);

module.exports = mongoose.model('Payment', paymentSchema);
