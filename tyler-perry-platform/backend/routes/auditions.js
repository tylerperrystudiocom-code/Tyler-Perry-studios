'use strict';
const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// Get all active opportunities
router.get('/', (req, res) => {
  try {
    const opportunities = db.prepare('SELECT * FROM opportunities ORDER BY created_at DESC').all();
    res.json(opportunities);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single opportunity
router.get('/:id', (req, res) => {
  try {
    const opp = db.prepare('SELECT * FROM opportunities WHERE id = ?').get(req.params.id);
    if (!opp) return res.status(404).json({ error: 'Not found' });
    res.json(opp);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;