// Graphical Password Authentication Backend
// Technologies: Node.js, Express, PostgreSQL
// Features:
// - Multi-factor authentication (gesture, face motion, voice, Face ID)
// - All authentication templates are encrypted before storage

// -------------------- Imports --------------------
// Core backend + security middleware
// Express & Middleware
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

// Environment Variables
require('dotenv').config();

// Database + Encryption Utils
const pool = require('./db');
const { encryptTemplate, decryptTemplate } = require('./utils/encryption');

// -------------------- App Setup --------------------
const app = express();
const PORT = process.env.PORT || 4000;

// File upload handling
const multer = require("multer");
const upload = multer();

// Python Face ID Service 
const { encodeFaceWithPython } = require("./utils/facePythonService");

// Allow frontend to communicate with backend
app.use(cors({
  origin: [
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3001',
    'http://localhost:3001',
    'http://127.0.0.1:4000',
    'http://localhost:4000'
  ],
  credentials: true
}));

app.use(express.json());

// Session management (used to track logged-in user)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}));

// -------------------- Rate Limiting --------------------
// Prevent brute force attacks on login/register routes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    message: 'Too many login attempts. Please try again later.'
  }
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    message: 'Too many registration attempts. Please try again later.'
  }
});

const authSaveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    message: 'Too many authentication save attempts. Please try again later.'
  }
});

// -------------------- Input Validation --------------------
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  return typeof username === 'string' && username.trim().length >= 3;
}

// -------------------- Utility: Distance Calculation --------------------
// Used for Face ID matching (compare embeddings)
function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return Infinity;
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }

  return Math.sqrt(sum);
}

app.get('/', (req, res) => {
  res.send('Backend is running');
});

app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      message: 'Database connected successfully',
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Database connection failed',
      error: error.message,
    });
  }
});

// -------------------- User Registration --------------------
// Creates a new user account (no password, graphical auth only)
app.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, email } = req.body;

    const cleanUsername = username?.trim();
    const cleanEmail = email?.trim().toLowerCase();

    if (!cleanUsername) {
      return res.status(400).json({
        message: 'Username is required',
      });
    }

    if (!isValidUsername(cleanUsername)) {
      return res.status(400).json({
        message: 'Username must be at least 3 characters long',
      });
    }

    if (!cleanEmail) {
      return res.status(400).json({
        message: 'Email is required',
      });
    }

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({
        message: 'Please enter a valid email address',
      });
    }

    const newUser = await pool.query(
      'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING *',
      [cleanUsername, cleanEmail]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser.rows[0],
    });
  } catch (error) {
    console.error(error);

    if (error.code === '23505') {
      return res.status(400).json({
        message: 'Username or email already exists',
      });
    }

    res.status(500).json({
      message: 'Registration failed',
    });
  }
});

// -------------------- Save Authentication Methods --------------------
// Stores enabled methods + encrypted templates in the database
// Face ID uses Python embedding and is encrypted before saving
app.post('/save-auth-methods', authSaveLimiter, upload.single('faceIdImage'), async (req, res) => {
  try {
    const { userId, voicePassphrase } = req.body;

    // Multipart form submissions can send structured fields as JSON strings,
    // so we normalize them here before validating or saving.
    const enabled =
      typeof req.body.enabled === 'string'
        ? JSON.parse(req.body.enabled)
        : req.body.enabled;

    const gestureTemplate =
      typeof req.body.gestureTemplate === 'string'
        ? JSON.parse(req.body.gestureTemplate)
        : req.body.gestureTemplate;

    const faceSequence =
      typeof req.body.faceSequence === 'string'
        ? JSON.parse(req.body.faceSequence)
        : req.body.faceSequence;

    const voiceTemplate =
      typeof req.body.voiceTemplate === 'string'
        ? JSON.parse(req.body.voiceTemplate)
        : req.body.voiceTemplate;

    if (!userId) {
      return res.status(400).json({
        message: 'User ID is required'
      });
    }

    if (enabled?.gesture && !gestureTemplate) {
      return res.status(400).json({
        message: 'Gesture is enabled but no gesture template was provided'
      });
    }

    if (enabled?.faceMotion && (!faceSequence || faceSequence.length === 0)) {
      return res.status(400).json({
        message: 'Face motion is enabled but no face sequence was provided'
      });
    }

    if (enabled?.voice && (!voiceTemplate || !voicePassphrase)) {
      return res.status(400).json({
        message: 'Voice is enabled but voice template or passphrase is missing'
      });
    }

    if (enabled?.faceId && !req.file) {
      return res.status(400).json({
        message: 'Face ID is enabled but no face image was provided'
      });
    }

    await pool.query(
      `INSERT INTO user_auth_methods
        (user_id, gesture_enabled, face_motion_enabled, voice_enabled, face_id_enabled)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id)
       DO UPDATE SET
         gesture_enabled = EXCLUDED.gesture_enabled,
         face_motion_enabled = EXCLUDED.face_motion_enabled,
         voice_enabled = EXCLUDED.voice_enabled,
         face_id_enabled = EXCLUDED.face_id_enabled`,
      [
        userId,
        enabled?.gesture || false,
        enabled?.faceMotion || false,
        enabled?.voice || false,
        enabled?.faceId || false
      ]
    );

    // Each method is stored independently so a user can enable, update, or
    // remove individual authentication factors without affecting the others.
    if (enabled?.gesture && gestureTemplate) {
      const encryptedGestureTemplate = encryptTemplate(gestureTemplate);

      await pool.query(
        `INSERT INTO gesture_auth (user_id, gesture_template)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET gesture_template = EXCLUDED.gesture_template`,
        [userId, JSON.stringify(encryptedGestureTemplate)]
      );
    } else {
      await pool.query('DELETE FROM gesture_auth WHERE user_id = $1', [userId]);
    }

    if (enabled?.faceMotion && faceSequence && faceSequence.length > 0) {
      const encryptedFaceSequence = encryptTemplate(faceSequence);

      await pool.query(
        `INSERT INTO face_motion_auth (user_id, face_sequence)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET face_sequence = EXCLUDED.face_sequence`,
        [userId, JSON.stringify(encryptedFaceSequence)]
      );
    } else {
      await pool.query('DELETE FROM face_motion_auth WHERE user_id = $1', [userId]);
    }

    if (enabled?.voice && voiceTemplate && voicePassphrase) {
      const encryptedVoiceTemplate = encryptTemplate(voiceTemplate);

      await pool.query(
        `INSERT INTO voice_auth (user_id, voice_template, passphrase)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id)
        DO UPDATE SET
          voice_template = EXCLUDED.voice_template,
          passphrase = EXCLUDED.passphrase`,
        [userId, JSON.stringify(encryptedVoiceTemplate), voicePassphrase]
      );
    } else {
      await pool.query('DELETE FROM voice_auth WHERE user_id = $1', [userId]);
    }

    if (enabled?.faceId) {
      // Face ID templates are generated by the Python service first, then the
      // resulting embedding is encrypted before it is persisted.
      const pythonResult = await encodeFaceWithPython(req.file.buffer, req.file.originalname);
      const finalFaceIdTemplate = pythonResult.embedding;

      if (!finalFaceIdTemplate) {
        return res.status(400).json({
          message: 'Failed to prepare Face ID template'
        });
      }

      const encryptedFaceIdTemplate = encryptTemplate(finalFaceIdTemplate);

      await pool.query(
        `INSERT INTO face_id_auth (user_id, face_embedding)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET face_embedding = EXCLUDED.face_embedding`,
        [userId, JSON.stringify(encryptedFaceIdTemplate)]
      );
    } else {
      await pool.query('DELETE FROM face_id_auth WHERE user_id = $1', [userId]);
    }

    res.status(200).json({
      message: 'Authentication methods saved successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Failed to save authentication methods',
    });
  }
});

// -------------------- Login --------------------
// Verifies user exists and returns enabled authentication methods
app.post('/login-user', loginLimiter, async (req, res) => {
  try {
    const { username, email } = req.body;

    const cleanUsername = username?.trim();
    const cleanEmail = email?.trim().toLowerCase();

    if (!cleanUsername) {
      return res.status(400).json({
        message: 'Username is required'
      });
    }

    if (!cleanEmail) {
      return res.status(400).json({
        message: 'Email is required'
      });
    }

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({
        message: 'Please enter a valid email address'
      });
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2',
      [cleanUsername, cleanEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    req.session.userId = user.id;

    const methodsResult = await pool.query(
      'SELECT * FROM user_auth_methods WHERE user_id = $1',
      [user.id]
    );

    const methods = methodsResult.rows[0] || null;

    res.json({
      message: 'User found',
      user,
      methods
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Login failed',
    });
  }
});

// -------------------- Session Check --------------------
// Returns currently logged-in user from session
app.get('/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        message: 'Not logged in'
      });
    }

    const userResult = await pool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [req.session.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.json({
      message: 'Session is active',
      user: userResult.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Failed to fetch session user'
    });
  }
});

// -------------------- Load Authentication Data --------------------
// Decrypts and returns stored templates for login verification
app.get('/login-auth-data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const methodsResult = await pool.query(
      'SELECT * FROM user_auth_methods WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
      [userId]
    );

    if (methodsResult.rows.length === 0) {
      return res.status(404).json({
        message: 'No authentication methods found for this user'
      });
    }

    const methods = methodsResult.rows[0];

    const gestureResult = await pool.query(
      'SELECT * FROM gesture_auth WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
      [userId]
    );

    const faceMotionResult = await pool.query(
      'SELECT * FROM face_motion_auth WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
      [userId]
    );

    const voiceResult = await pool.query(
      'SELECT * FROM voice_auth WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
      [userId]
    );

    const faceIdResult = await pool.query(
      'SELECT * FROM face_id_auth WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
      [userId]
    );

    let decryptedGestureTemplate = null;
    let decryptedFaceSequence = [];
    let decryptedVoiceTemplate = null;
    let decryptedFaceIdTemplate = null;

    // Some PostgreSQL setups return JSON columns as objects while others
    // return strings, so we support both shapes before decrypting.
    if (gestureResult.rows[0]?.gesture_template) {
      try {
        const rawGestureTemplate = gestureResult.rows[0].gesture_template;

        const encryptedGestureTemplate =
          typeof rawGestureTemplate === 'string'
            ? JSON.parse(rawGestureTemplate)
            : rawGestureTemplate;

        decryptedGestureTemplate = decryptTemplate(encryptedGestureTemplate);
      } catch (error) {
        console.error('Gesture template decrypt failed:', error.message);
        decryptedGestureTemplate = null;
      }
    }

    if (faceMotionResult.rows[0]?.face_sequence) {
      try {
        const rawFaceSequence = faceMotionResult.rows[0].face_sequence;

        const encryptedFaceSequence =
          typeof rawFaceSequence === 'string'
            ? JSON.parse(rawFaceSequence)
            : rawFaceSequence;

        decryptedFaceSequence = decryptTemplate(encryptedFaceSequence);
      } catch (error) {
        console.error('Face motion template decrypt failed:', error.message);
        decryptedFaceSequence = [];
      }
    }

    if (voiceResult.rows[0]?.voice_template) {
      try {
        const rawVoiceTemplate = voiceResult.rows[0].voice_template;

        const encryptedVoiceTemplate =
          typeof rawVoiceTemplate === 'string'
            ? JSON.parse(rawVoiceTemplate)
            : rawVoiceTemplate;

        decryptedVoiceTemplate = decryptTemplate(encryptedVoiceTemplate);
      } catch (error) {
        console.error('Voice template decrypt failed:', error.message);
        decryptedVoiceTemplate = null;
      }
    }

    if (faceIdResult.rows[0]?.face_embedding) {
      try {
        const rawFaceIdTemplate = faceIdResult.rows[0].face_embedding;

        const encryptedFaceIdTemplate =
          typeof rawFaceIdTemplate === 'string'
            ? JSON.parse(rawFaceIdTemplate)
            : rawFaceIdTemplate;

        decryptedFaceIdTemplate = decryptTemplate(encryptedFaceIdTemplate);
      } catch (error) {
        console.error('Face ID template decrypt failed:', error.message);
        decryptedFaceIdTemplate = null;
      }
    }

    res.json({
      message: 'Login auth data fetched successfully',
      methods,
      gestureTemplate: decryptedGestureTemplate,
      faceSequence: decryptedFaceSequence,
      voiceTemplate: decryptedVoiceTemplate,
      voicePassphrase: voiceResult.rows[0]?.passphrase || '',
      faceIdTemplate: decryptedFaceIdTemplate
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Failed to fetch login auth data',
    });
  }
});

// -------------------- Face ID Verification --------------------
app.post('/verify-face-id', upload.single('faceIdImage'), async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        ok: false,
        message: 'User ID is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        ok: false,
        message: 'Face image is required'
      });
    }

    const pythonResult = await encodeFaceWithPython(req.file.buffer, req.file.originalname);
    const liveEmbedding = pythonResult.embedding;

    const faceIdResult = await pool.query(
      'SELECT * FROM face_id_auth WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
      [userId]
    );

    if (faceIdResult.rows.length === 0 || !faceIdResult.rows[0].face_embedding) {
      return res.status(404).json({
        ok: false,
        message: 'No stored Face ID template found'
      });
    }

    const rawFaceIdTemplate = faceIdResult.rows[0].face_embedding;

    const encryptedFaceIdTemplate =
      typeof rawFaceIdTemplate === 'string'
        ? JSON.parse(rawFaceIdTemplate)
        : rawFaceIdTemplate;

    const storedEmbedding = decryptTemplate(encryptedFaceIdTemplate);

    // Smaller distances mean the live face is closer to the stored embedding.
    // The threshold tunes how strict Face ID matching should be.
    const distance = euclideanDistance(liveEmbedding, storedEmbedding);
    const threshold = 0.45;
    const match = distance < threshold;

    res.json({
      ok: true,
      match,
      distance,
      threshold
    });
  } catch (error) {
    console.error('Face ID verify failed:', error.message);
    res.status(500).json({
      ok: false,
      message: 'Face ID verification failed'
    });
  }
});

// -------------------- Logout --------------------
// Destroys session and clears authentication state
app.post('/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error(error);
      return res.status(500).json({
        message: 'Logout failed'
      });
    }

    res.clearCookie('connect.sid');

    res.json({
      message: 'Logged out successfully'
    });
  });
});

// -------------------- Database Initialization --------------------
async function initializeDatabase() {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create user_auth_methods table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_auth_methods (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        gesture_enabled BOOLEAN DEFAULT FALSE,
        face_motion_enabled BOOLEAN DEFAULT FALSE,
        voice_enabled BOOLEAN DEFAULT FALSE,
        face_id_enabled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);

    // Create gesture_auth table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gesture_auth (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        gesture_template JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);

    // Create face_motion_auth table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS face_motion_auth (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        face_sequence JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);

    // Create voice_auth table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS voice_auth (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        voice_template JSONB,
        passphrase VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);

    // Create face_id_auth table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS face_id_auth (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        face_embedding JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  }
}

// -------------------- Start Server --------------------
async function startServer() {
  await initializeDatabase();

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
