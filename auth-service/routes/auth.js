const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';

// Register a new user (username, password, role)
router.post('/reg', async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: 'username already taken' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      passwordHash,
      role: role === 'admin' ? 'admin' : 'customer'
    });
    return res.status(201).json({ id: user._id, username: user.username, role: user.role });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Login (username, password)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    return res.json({ token, userId: user._id, role: user.role });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
