// --- AUDITION APPLICATION ROUTE (WITH EMAIL) ---
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
    
    // Save to database
    db.prepare(`
      INSERT INTO audition_applications (full_name, email, address, ssn, front_id_path, back_id_path, selfie_path)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(fullName, email, address, ssn, frontFile, backFile, selfieFile);
    
    res.status(201).json({ success: true, message: 'Application submitted for admin review' });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to process application' });
  }
});

// GET ALL AUDITION APPLICATIONS (Admin Only)
app.get('/api/admin/applications', requireAuth, requireAdmin, (req, res) => {
  try {
    const apps = db.prepare('SELECT * FROM audition_applications ORDER BY created_at DESC').all();
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// APPROVE APPLICATION (Admin Only)
app.post('/api/admin/applications/:id/approve', requireAuth, requireAdmin, (req, res) => {
  try {
    db.prepare("UPDATE audition_applications SET status = 'approved' WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: 'Application approved' });
  } catch (err) {
    res.status(500).json({ error: 'Approval failed' });
  }
});