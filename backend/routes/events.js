'use strict';
const express = require('express');
const router = express.Router();
const { db } = require('../database/db');

// Get all events
router.get('/', (req, res) => {
  try {
    const events = db.prepare('SELECT * FROM events ORDER BY event_date ASC').all();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;