// --- FORGOT PASSCODE ROUTE ---
app.post('/api/auth/forgot-passcode', (req, res) => {
  try {
    const { email } = req.body;
    
    // Look up the applicant by email
    const applicant = db.prepare('SELECT passcode FROM audition_applications WHERE email = ?').get(email);
    
    if (!applicant) {
      return res.status(404).json({ error: 'No account found with that email address.' });
    }
    
    // Return the passcode (In a real production app with sensitive data, you would email this instead)
    res.json({ success: true, passcode: applicant.passcode });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});