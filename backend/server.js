// --- AUDITION APPLICATION ROUTE (WITH PASSCODE) ---
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
    
    // Save to database
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

// --- USER LOGIN ROUTE (EMAIL + PASSCODE) ---
app.post('/api/auth/user-login', (req, res) => {
  try {
    const { email, passcode } = req.body;
    
    // Check the audition_applications table
    const applicant = db.prepare('SELECT * FROM audition_applications WHERE email = ? AND passcode = ?').get(email, passcode);
    
    if (!applicant) {
      return res.status(401).json({ error: 'Invalid email or passcode' });
    }
    
    // Generate a token for the user
    const token = jwt.sign({ id: applicant.id, role: 'applicant', name: applicant.full_name }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      success: true,
      token,
      user: {
        name: applicant.full_name,
        email: applicant.email,
        selfie: applicant.selfie_path
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});