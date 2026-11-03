'use strict';
const express = require('express');
const router = express.Router();
const { db } = require('../database/db');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

/**
 * GET /api/members/me
 * Fetch the current logged-in user's profile and membership status.
 */
router.get('/me', requireAuth, (req, res) => {
  try {
    const member = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.role, u.created_at, 
             m.tier, m.status AS membership_status, m.expires_at 
      FROM users u 
      LEFT JOIN memberships m ON u.id = m.user_id 
      WHERE u.id = ?
    `).get(req.user.id);
    
    if (!member) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(member);
  } catch (err) {
    console.error('Error fetching member profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/members
 * (Admin Only) Fetch a list of all registered members.
 */
router.get('/', requireAuth, requireAdmin, (req, res) => {
  try {
    const members = db.prepare(`
      SELECT u.id, u.full_name, u.email, u.role, u.created_at,
             m.tier, m.status AS membership_status, m.expires_at 
      FROM users u 
      LEFT JOIN memberships m ON u.id = m.user_id 
      ORDER BY u.created_at DESC
    `).all();
    
    res.json(members);
  } catch (err) {
    console.error('Error fetching all members:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/members/:id/role
 * (Admin Only) Update a user's role (e.g., upgrade to VIP or demote to member).
 */
router.put('/:id/role', requireAuth, requireAdmin, (req, res) => {
  try {
    const { role } = req.body;
    const userId = req.params.id;
    
    if (!['member', 'vip', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role specified' });
    }
    
    // Prevent admins from accidentally demoting themselves
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'You cannot change your own admin role' });
    }
    
    const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // If upgrading to VIP, ensure a membership record exists
    if (role === 'vip') {
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      
      db.prepare(`
        INSERT INTO memberships (user_id, tier, status, expires_at) 
        VALUES (?, 'vip', 'active', ?)
        ON CONFLICT(user_id) DO UPDATE SET status='active', expires_at=excluded.expires_at
      `).run(userId, expiresAt.toISOString());
    }
    
    res.json({ success: true, message: `User role updated to ${role}` });
  } catch (err) {
    console.error('Error updating member role:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;