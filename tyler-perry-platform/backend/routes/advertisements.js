'use strict';
const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// Get all active ads
router.get('/', (req, res) => {
  try {
    const ads = db.prepare('SELECT * FROM advertisements ORDER BY created_at DESC').all();
    res.json(ads);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;