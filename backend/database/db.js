'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

const dbPath = process.env.DB_PATH || './data/platform.db';
const absPath = path.isAbsolute(dbPath) ? dbPath : path.join(__dirname, dbPath);
fs.mkdirSync(path.dirname(absPath), { recursive: true });

const db = new Database(absPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  
  // Auto-seed the Admin Passcode (1012)
  const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  
  if (!adminExists) {
    const defaultEmail = 'admin@tylerperry.com';
    const defaultPasscode = '1012';
    const hash = bcrypt.hashSync(defaultPasscode, 10);
    
    db.prepare(`
      INSERT INTO users (email, password_hash, full_name, role) 
      VALUES (?, ?, ?, 'admin')
    `).run(defaultEmail, hash, 'System Administrator');
    
    console.log('====================================================');
    console.log('✅ AUTO-SEEDED ADMIN PASSCODE: 1012');
    console.log('====================================================');
  }
}

if (require.main === module) {
  initDb();
}

module.exports = { db, initDb };