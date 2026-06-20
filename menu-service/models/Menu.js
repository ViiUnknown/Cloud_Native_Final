// menu-service/models/Menu.js
const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    available: { type: Boolean, default: true }
  },
  {
    collection: 'menu', // explicit collection name
    timestamps: true
  }
);

module.exports = mongoose.model('Menu', menuSchema);
