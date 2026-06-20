// order-service/models/Order.js
const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customerId: { type: String, required: true },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'completed'],
      default: 'pending'
    },
    createdAt: { type: Date, default: Date.now }
  },
  {
    collection: 'orders' // explicit collection name
  }
);

module.exports = mongoose.model('Order', orderSchema);
