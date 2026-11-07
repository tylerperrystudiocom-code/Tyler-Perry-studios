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

// 1. Initialize Database
initDb();

// 2. SAFE MIGRATION: Add passcode column if it doesn't exist yet
try {
  db.exec("ALTER TABLE audition_applications ADD COLUMN passcode TEXT NOT NULL DEFAULT '0000'");
} catch (e) {
  // Column already exists. Safe to ignore.
}

// 3. Setup File Uploads
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// 4. Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', express.static(path.join(__dirname, '..', 'public')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use('/uploads', express.static(uploadDir));

// 5. Auth Middleware
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

// --- ADMIN LOGIN (Passcode 1012) ---
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // Hardcoded admin bypass
  if (email === 'admin@tylerperry.com' && password === '1012') {
    const token = jwt.sign({ id: 1, role: 'admin', name: 'System Administrator' }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ token, user: { id: 1, name: 'System Administrator', role: 'admin' } });
  }
  
  // Database login for regular users
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign({ id: user.id, role: user.role, name: user.full_name }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, name: user.full_name, role: user.role } });
});

// --- USER LOGIN (Email + Passcode) ---
app.post('/api/auth/user-login', (req, res) => {
  try {
    const { email, passcode } = req.body;
    const applicant = db.prepare('SELECT * FROM audition_applications WHERE email = ? AND passcode = ?').get(email, passcode);
    
    if (!applicant) {
      return res.status(401).json({ error: 'Invalid email or passcode' });
    }
    
    const token = jwt.sign({ id: applicant.id, role: 'applicant', name: applicant.full_name }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, user: { name: applicant.full_name, email: applicant.email, selfie: applicant.selfie_path } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- FORGOT PASSCODE ---
app.post('/api/auth/forgot-passcode', (req, res) => {
  try {
    const { email } = req.body;
    const applicant = db.prepare('SELECT passcode FROM audition_applications WHERE email = ?').get(email);
    
    if (!applicant) {
      return res.status(404).json({ error: 'No account found with that email address.' });
    }
    res.json({ success: true, passcode: applicant.passcode });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- PUBLIC DATA ROUTES ---
app.get('/api/data/:type', (req, res) => {
  try {
    const data = db.prepare(`SELECT * FROM ${req.params.type} ORDER BY created_at DESC`).all();
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Invalid data request' }); }
});

// --- AUDITIONS (USER APPLY) ---
app.post('/api/auditions/apply', upload.fields([
  { name: 'idDocumentFront', maxCount: 1 },
  { name: 'idDocumentBack', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), (req, res) => {
  try {
    const { fullName, email, passcode, address, ssn } = req.body;
    
    if (!req.files || !req.files['idDocumentFront'] || !req.files['idDocumentBack'] || !req.files['selfie']) {
      return res.status(400).json({ error: 'All documents and selfie are required' });
    }
    
    const frontFile = '/uploads/' + req.files['idDocumentFront'][0].filename;
    const backFile = '/uploads/' + req.files['idDocumentBack'][0].filename;
    const selfieFile = '/uploads/' + req.files['selfie'][0].filename;
    
    db.prepare(`
      INSERT INTO audition_applications (full_name, email, passcode, address, ssn, front_id_path, back_id_path, selfie_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(fullName, email, passcode, address, ssn, frontFile, backFile, selfieFile);
    
    res.status(201).json({ success: true, message: 'Application submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process application' });
  }
});

// --- ADMIN: VIEW & APPROVE APPLICATIONS ---
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

// --- ADMIN: PAYMENTS ---
app.get('/api/admin/payments', requireAuth, requireAdmin, (req, res) => {
  try {
    const payments = db.prepare(`SELECT p.*, u.full_name, u.email FROM payments p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC`).all();
    res.json(payments);
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// --- ADMIN: CONTENT UPLOAD ---
app.post('/api/admin/:type', requireAuth, requireAdmin, upload.single('image'), (req, res) => {
  const { type } = req.params;
  const { title, description } = req.body;
  const image_url = req.file ? '/uploads/' + req.file.filename : null;
  
  try {
    if (type === 'advertisements') {
      db.prepare('INSERT INTO advertisements (title, description, image_url) VALUES (?, ?, ?)').run(title, description, image_url);
    } else if (type === 'gallery') {
      db.prepare('INSERT INTO gallery (title, image_url, category) VALUES (?, ?, ?)').run(title, image_url, 'General');
    } else if (type === 'news') {
      db.prepare('INSERT INTO news (title, excerpt, content, image_url) VALUES (?, ?, ?, ?)').run(title, description, description, image_url);
    }
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create content' });
  }
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));