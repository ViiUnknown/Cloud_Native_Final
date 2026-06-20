// menu-service/routes/menu.js
// Gateway strips /admin or /customer, so these are short sub-routes:
//   POST   /menu        (admin add)
//   PUT    /menu/:id    (admin update)
//   DELETE /menu/:id    (admin delete)
//   GET    /menu        (customer browse)
//   POST   /cart        (customer add to cart)
const express = require('express');
const Menu = require('../models/Menu');

const router = express.Router();

// admin: add menu item
router.post('/menu', async (req, res) => {
  try {
    const { name, price, available } = req.body || {};
    if (!name || price == null) {
      return res.status(400).json({ error: 'name and price are required' });
    }
    const item = await Menu.create({ name, price, available: available !== false });
    return res.status(201).json(item);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// admin: update menu item
router.put('/menu/:id', async (req, res) => {
  try {
    const item = await Menu.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    return res.json(item);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// admin: delete menu item
router.delete('/menu/:id', async (req, res) => {
  try {
    const item = await Menu.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    return res.json({ deleted: true, id: req.params.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// customer: browse all items
router.get('/menu', async (req, res) => {
  try {
    const items = await Menu.find().sort({ createdAt: -1 });
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// customer: add an item to cart (validates the item exists + is available)
router.post('/cart', async (req, res) => {
  try {
    const { itemId, quantity } = req.body || {};
    const qty = Number(quantity) > 0 ? Number(quantity) : 1;
    const item = await Menu.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    if (!item.available) return res.status(400).json({ error: 'Item not available' });
    return res.json({
      customerId: req.headers['x-user-id'] || null,
      itemId: item._id,
      name: item.name,
      unitPrice: item.price,
      quantity: qty,
      lineTotal: item.price * qty
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
