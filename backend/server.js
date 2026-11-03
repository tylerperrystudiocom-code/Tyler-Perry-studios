'use strict';
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const multer = require('multer');
const { db, initDb } = require('./database/db');
const { requireAuth, requireAdmin } = require('./middleware/authMiddleware');

// --- IMPORT ROUTES ---
const authRoutes = require('./routes/auth');
const auditionsRoutes = require('./routes/auditions');
const membersRoutes = require('./routes/members');
const eventsRoutes = require('./routes/events');
const adsRoutes = require('./routes/advertisements');
const galleryRoutes = require('./routes/gallery');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Initialize Database & Tables
initDb();

// 2. File Upload Setup (Multer)
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// 3. Global Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Serve Static Frontend Files
app.use('/', express.static(path.join(__dirname, '..', 'public')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use('/uploads', express.static(path.join(uploadDir)));

// 5. API Routes (Using Middleware)
app.use('/api/auth', authRoutes);
app.use('/api/auditions', auditionsRoutes);
app.use('/api/members', membersRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/advertisements', adsRoutes);
app.use('/api/gallery', galleryRoutes);

// 6. Custom Payment Routes (Protected by Middleware)
app.post('/api/payments/submit', requireAuth, upload.single('proof'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Payment proof image required' });
    
    const orderId = 'TP-' + Math.floor(100000 + Math.random() * 900000);
    const { method, amount } = req.body;
    const imagePath = '/uploads/' + req.file.filename;
    
    db.prepare(`
      INSERT INTO payments (user_id, order_id, amount, method, proof_image_path, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(req.user.id, orderId, amount, method, imagePath);
    
    res.status(201).json({ success: true, orderId, message: 'Payment submitted for admin review' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit payment' });
  }
});

app.get('/api/admin/payments', requireAuth, requireAdmin, (req, res) => {
  try {
    const payments = db.prepare(`
      SELECT p.*, u.full_name, u.email 
      FROM payments p 
      JOIN users u ON p.user_id = u.id 
      ORDER BY p.created_at DESC
    `).all();
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

app.post('/api/admin/payments/:id/approve', requireAuth, requireAdmin, (req, res) => {
  try {
    const paymentId = req.params.id;
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
    
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (payment.status !== 'pending') return res.status(400).json({ error: 'Payment already processed' });
    
    // 1. Update payment status
    db.prepare(`UPDATE payments SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(paymentId);
    
    // 2. Upgrade user to VIP
    db.prepare(`UPDATE users SET role = 'vip' WHERE id = ?`).run(payment.user_id);
    
    // 3. Create Membership record (Valid for 1 year)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    db.prepare(`
      INSERT INTO memberships (user_id, tier, status, expires_at) 
      VALUES (?, 'vip', 'active', ?)
      ON CONFLICT(user_id) DO UPDATE SET status='active', expires_at=excluded.expires_at
    `).run(payment.user_id, expiresAt.toISOString());
    
    res.json({ success: true, message: 'Payment approved and VIP activated' });
  } catch (err) {
    res.status(500).json({ error: 'Approval failed' });
  }
});

app.post('/api/admin/payments/:id/reject', requireAuth, requireAdmin, (req, res) => {
  db.prepare(`UPDATE payments SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);
  res.json({ success: true, message: 'Payment rejected' });
});

// 7. Admin Content Management Route
app.post('/api/admin/:type', requireAuth, requireAdmin, upload.single('image'), (req, res) => {
  const { type } = req.params;
  const { title, description, link_url, content, event_date, location, category } = req.body;
  const image_url = req.file ? '/uploads/' + req.file.filename : null;
  
  try {
    if (type === 'advertisements') {
      db.prepare('INSERT INTO advertisements (title, description, image_url, link_url) VALUES (?, ?, ?, ?)').run(title, description, image_url, link_url);
    } else if (type === 'gallery') {
      db.prepare('INSERT INTO gallery (title, image_url, category) VALUES (?, ?, ?)').run(title, image_url, category || 'General');
    } else if (type === 'news') {
      db.prepare('INSERT INTO news (title, excerpt, content, image_url) VALUES (?, ?, ?, ?)').run(title, description, content, image_url);
    } else if (type === 'events') {
      db.prepare('INSERT INTO events (title, description, event_date, location, image_url) VALUES (?, ?, ?, ?, ?)').run(title, description, event_date, location, image_url);
    } else if (type === 'opportunities') {
      db.prepare('INSERT INTO opportunities (title, description, category) VALUES (?, ?, ?)').run(title, description, category || 'Casting');
    } else {
      return res.status(400).json({ error: 'Invalid content type' });
    }
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create content' });
  }
});

// 8. Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 9. 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 10. Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Tyler Perry Platform Backend running on http://localhost:${PORT}`);
});