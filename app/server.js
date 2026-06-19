const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Initialize database with default state if it doesn't exist
function initDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    // Create default state structure
    const defaultState = {
      v: 1,
      profile: { name: '', bodyweight: null, barWeight: 20, rounding: 2.5,
                dbIncrement: 2.5, machineStep: 5,
                plates: [
                  { w: 25, count: 4 }, { w: 20, count: 2 }, { w: 15, count: 2 },
                  { w: 10, count: 2 }, { w: 5, count: 2 }, { w: 2.5, count: 2 }, { w: 1.25, count: 2 }
                ] },
      program: null,
      records: {},
      loadingProfiles: {},
      customEx: [],
      sessions: [],
      checkins: [],
      readinessLog: [],
      skipPenalty: 0,
      lastSkipTs: null,
      orderPenalty: 0,
      lastOrderTs: null
    };
    
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultState, null, 2));
    console.log('Created default database.json');
  }
}

// API Routes
app.get('/api/state', (req, res) => {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('Error reading database:', err);
    res.status(500).json({ error: 'Failed to read database' });
  }
});

app.post('/api/state', (req, res) => {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (err) {
    console.error('Error writing database:', err);
    res.status(500).json({ error: 'Failed to write database' });
  }
});

// Serve the app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
initDatabase();
app.listen(PORT, () => {
  console.log(`IronWave server running at http://localhost:${PORT}`);
  console.log(`Data persisted to: ${DB_PATH}`);
});