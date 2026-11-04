'use strict';
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { db, initDb } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.SESSION_SECRET || 'fallback-secret-change-me';

// 1. Initialize Database (Creates tables if they don't exist)
initDb();

// 2. Setup File Uploads
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// 3. Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', express.static(path.join(__dirname, '..', 'public')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use('/uploads', express.static(uploadDir));

// 4. Auth Middleware
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) { res.status(401).json({ error: 'Invalid token' }); }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    const hash = await bcrypt.hash(password, 10);
    db.prepare('INSERT INTO users (email, password_hash, full_name) VALUES (?, ?, ?)').run(email, hash, fullName);
    res.status(201).json({ success: true });
  } catch (err) { res.status(400).json({ error: 'Email already exists' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign({ id: user.id, role: user.role, name: user.full_name }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, name: user.full_name, role: user.role } });
});

// --- PUBLIC DATA ROUTES ---
app.get('/api/data/:type', (req, res) => {
  try {
    const data = db.prepare(`SELECT * FROM ${req.params.type} ORDER BY created_at DESC`).all();
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Invalid data request' }); }
});

// --- PAYMENTS (USER) ---
app.post('/api/payments/submit', requireAuth, upload.single('proof'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Proof image required' });
  const orderId = 'TP-' + Math.floor(100000 + Math.random() * 900000);
  db.prepare(`INSERT INTO payments (user_id, order_id, amount, method, proof_image_path) VALUES (?, ?, ?, ?, ?)`)
    .run(req.user.id, orderId, req.body.amount, req.body.method, '/uploads/' + req.file.filename);
  res.status(201).json({ success: true, orderId });
});

// --- PAYMENTS (ADMIN) ---
app.get('/api/admin/payments', requireAuth, requireAdmin, (req, res) => {
  try {
    const payments = db.prepare(`SELECT p.*, u.full_name, u.email FROM payments p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC`).all();
    res.json(payments);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/payments/:id/approve', requireAuth, requireAdmin, (req, res) => {
  try {
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
    db.prepare(`UPDATE payments SET status = 'approved' WHERE id = ?`).run(payment.id);
    db.prepare(`UPDATE users SET role = 'vip' WHERE id = ?`).run(payment.user_id);
    const expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    db.prepare(`INSERT INTO memberships (user_id, tier, status, expires_at) VALUES (?, 'vip', 'active', ?) ON CONFLICT(user_id) DO UPDATE SET status='active', expires_at=excluded.expires_at`)
      .run(payment.user_id, expiresAt.toISOString());
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/payments/:id/reject', requireAuth, requireAdmin, (req, res) => {
  db.prepare(`UPDATE payments SET status = 'rejected' WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

// --- AUDITIONS (USER) ---
app.post('/api/auditions/apply', upload.fields([
  { name: 'idDocumentFront', maxCount: 1 }, 
  { name: 'idDocumentBack', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), (req, res) => {
  try {
    const { fullName, email, address, ssn } = req.body;
    
    if (!req.files || !req.files['idDocumentFront'] || !req.files['idDocumentBack'] || !req.files['selfie']) {
      return res.status(400).json({ error: 'All documents and selfie are required' });
    }

    const frontFile = '/uploads/' + req.files['idDocumentFront'][0].filename;
    const backFile = '/uploads/' + req.files['idDocumentBack'][0].filename;
    const selfieFile = '/uploads/' + req.files['selfie'][0].filename;

    db.prepare(`
      INSERT INTO audition_applications (full_name, email, address, ssn, front_id_path, back_id_path, selfie_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(fullName, email, address, ssn, frontFile, backFile, selfieFile);
    
    res.status(201).json({ success: true, message: 'Application submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process application' });
  }
});

// --- AUDITIONS (ADMIN) ---
app.get('/api/admin/applications', requireAuth, requireAdmin, (req, res) => {
  try {
    const apps = db.prepare('SELECT * FROM audition_applications ORDER BY created_at DESC').all();
    res.json(apps);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admin/applications/:id/approve', requireAuth, requireAdmin, (req, res) => {
  try {
    db.prepare("UPDATE audition_applications SET status = 'approved' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// --- CONTENT MANAGEMENT (ADMIN) ---
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
    }
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create content' });
  }
});

// 5. Start Server
app.listen(PORT, () => console.log(`🚀 Real Server running at http://localhost:${PORT}`));