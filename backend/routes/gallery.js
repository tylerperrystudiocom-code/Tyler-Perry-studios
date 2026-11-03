'use strict';
const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// Get all gallery images
router.get('/', (req, res) => {
  try {
    const images = db.prepare('SELECT * FROM gallery ORDER BY created_at DESC').all();
    res.json(images);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;