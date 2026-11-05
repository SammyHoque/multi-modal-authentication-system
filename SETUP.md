# System Setup Guide

This guide provides step-by-step instructions to set up and run the Graphical Password Authentication System, which includes a frontend, backend, and Python face recognition service.

## Prerequisites

Before starting, ensure you have the following installed on your system:

### Required Software
- **Node.js** (version 18 or higher) - [Download from nodejs.org](https://nodejs.org/)
- **Python** (version 3.9 or higher) - [Download from python.org](https://python.org/)
- **PostgreSQL** (version 12 or higher) - [Download from postgresql.org](https://postgresql.org/)

### Browser Requirements
- **Modern web browser** with camera and microphone support (Chrome 88+, Firefox 85+, Safari 14+, Edge 88+)
- **Camera and microphone permissions** must be granted when prompted
- **HTTPS required for production** (localhost works for development)

### Hardware Requirements
- **Webcam** for gesture, face motion, and face ID authentication
- **Microphone** for voice authentication
- **Modern CPU** for real-time image processing (recommended: Intel i5/AMD Ryzen 5 or better)

### Verify Installations
```bash
# Check Node.js
node --version
npm --version

# Check Python
python --version
pip --version

# Check PostgreSQL (should be running)
psql --version
```

## Project Structure Overview

```
multi-modal-authentication-system/
├── backend/          # Node.js Express server
├── src/             # Frontend HTML/CSS/JS
├── python-face-service/  # Python Flask face recognition API
└── src/models/       # MediaPipe model files (download separately)
```

## 1. Database Setup

### Create PostgreSQL Database
```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Create database (replace 'graphical_auth' with your preferred name)
CREATE DATABASE graphical_auth;

# Create a database user; use these values in backend/.env below
CREATE USER auth_user WITH PASSWORD 'your_password_here';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE graphical_auth TO auth_user;

# Exit PostgreSQL
\q
```

### Database Schema
**Note:** Database tables are now created automatically when the backend server starts. No manual SQL commands are required.

The following tables will be created automatically:
- `users` - User accounts
- `user_auth_methods` - Enabled authentication methods per user
- `gesture_auth` - Encrypted gesture templates
- `face_motion_auth` - Encrypted face motion sequences
- `voice_auth` - Encrypted voice templates and passphrases
- `face_id_auth` - Encrypted face embeddings

## 2. Backend Setup

### Navigate to Backend Directory
```bash
cd backend
```

### Install Dependencies
```bash
npm install
```

### Environment Configuration
Create a `.env` file in the `backend/` directory:

```bash
# Server Configuration
PORT=4000
SESSION_SECRET=your_strong_session_secret_here

# Database Configuration
DB_USER=auth_user
DB_HOST=localhost
DB_NAME=graphical_auth
DB_PASSWORD=your_password_here
DB_PORT=5432

# Encryption Key (generate with: openssl rand -hex 32)
TEMPLATE_ENCRYPTION_KEY=your_64_character_hex_key_here
```

**Important:** Generate a secure encryption key:
```bash
openssl rand -hex 32
```

### Start Backend Server
```bash
node server.js
```

The backend will run on `http://localhost:4000`

## 3. Python Face Service Setup

### Navigate to Python Service Directory
```bash
cd ../python-face-service
```

### Create Virtual Environment
```bash
python -m venv venv
```

### Activate Virtual Environment
```bash
# On macOS/Linux
source venv/bin/activate

# On Windows
venv\Scripts\activate
```

### Install Python Dependencies
```bash
pip install -r requirements.txt
```

**Note:** The `face_recognition` library requires CMake and may need additional system dependencies on some platforms:

- **macOS:** `brew install cmake`
- **Ubuntu/Debian:** `sudo apt-get install cmake build-essential`
- **Windows:** Install Visual Studio Build Tools or use conda

If you encounter issues with dlib compilation, consider using conda:
```bash
conda install -c conda-forge dlib
```

### Start Python Service
```bash
python app.py
```

The face service will run on `http://127.0.0.1:5001`

## 4. Frontend Setup

The frontend consists of static HTML, CSS, and JavaScript files. No build process is required.

### Required Model Files
The MediaPipe model files are excluded from Git and must be downloaded separately. From the repository root, download compatible task models from the official [Gesture Recognizer](https://ai.google.dev/edge/mediapipe/solutions/vision/gesture_recognizer) and [Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) documentation and save them in `src/models/` with these exact names:
- `gesture_recognizer.task`
- `face_landmarker.task`

These files are required for gesture and face recognition functionality.

### Serve Frontend Files
The backend serves API routes only; it does not serve the frontend files. Run a separate static server from `src/`.

From the repository root:
```bash
cd src
python3 -m http.server 3000 --bind 127.0.0.1
```

On Windows, use `python` instead of `python3` if that is the Python command installed. Open `http://127.0.0.1:3000/pages/index.html`. The backend CORS configuration allows this exact local origin; other ports, including the usual Live Server defaults, are not currently allowed.

## 5. Complete System Startup

### Start All Services
Open three terminal windows and run each service:

**Terminal 1 - Backend:**
```bash
cd backend
node server.js
```

**Terminal 2 - Python Face Service:**
```bash
cd python-face-service
source venv/bin/activate  # or venv\Scripts\activate on Windows
python app.py
```

**Terminal 3 - Frontend (if using separate server):**
```bash
cd src
python3 -m http.server 3000 --bind 127.0.0.1
```

### Verify Services are Running
- Backend: `http://localhost:4000`
- Face Service: `http://127.0.0.1:5001/health`
- Frontend: `http://127.0.0.1:3000/pages/index.html`

## 5. Testing Individual Services

Before running the complete system, test each service individually:

### Test Backend
```bash
curl http://localhost:4000/
curl http://localhost:4000/test-db
```

### Test Python Face Service
```bash
curl http://127.0.0.1:5001/health
```

### Test Frontend
Open `http://127.0.0.1:3000/pages/index.html` in your browser and check the browser console for errors.

## 6. Testing the System

1. **Open the application** in your browser at `http://localhost:4000`
2. **Register a new user** using the registration page
3. **Test authentication methods:**
   - Gesture-based login
   - Face motion authentication
   - Voice authentication
   - Face ID upload

## Troubleshooting

### Common Issues

**Backend won't start:**
- Check if PostgreSQL is running
- Verify `.env` file exists and has correct values
- Ensure all npm packages are installed
- Check the backend output for database connection or table initialization errors

**Face service fails:**
- Ensure virtual environment is activated
- Check if all Python packages installed correctly
- Verify Python version is 3.9+
- Try installing dlib with conda if pip installation fails

**Frontend not loading:**
- Confirm the frontend static server and backend API are both running
- Open `/pages/index.html` on the frontend server, not the backend root URL
- Use the documented `127.0.0.1:3000` origin, or add any alternate frontend origin to the backend CORS allowlist
- Check browser console for JavaScript errors
- Ensure MediaPipe models are in `src/models/` directory
- Grant camera/microphone permissions when prompted

**Camera/Microphone not working:**
- Ensure you're using HTTPS in production (localhost works for development)
- Grant permissions in browser when prompted
- Check browser compatibility (Chrome, Firefox, Safari, Edge)
- Verify hardware is working with other applications

**Database connection errors:**
- Verify PostgreSQL credentials in `.env`
- Ensure database and tables exist
- Check if PostgreSQL service is running
- Try connecting manually with `psql`

### Logs and Debugging
- Backend logs appear in the terminal where `node server.js` is running
- Python service logs appear in the terminal where `python app.py` is running
- Browser developer tools (F12) for frontend debugging

## 7. Development Notes

- The system uses AES-256-GCM encryption for storing authentication templates
- Face recognition uses the `face_recognition` Python library
- Gesture recognition uses MediaPipe models
- Session management is handled by `express-session`

## 8. Security Considerations

- This is an academic prototype, not a production-ready authentication system.
- Change default passwords and secrets in production
- Use HTTPS in production
- The current backend session cookie is configured with `secure: false`; change this before deploying behind HTTPS.
- Regularly update dependencies
- Monitor for security vulnerabilities

## Support

If you encounter issues not covered in this guide, check the individual README files in each component directory for more detailed information.