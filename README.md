# Graphical Passwords – Preventing Shoulder Surfing

### Multi-Modal Authentication System | Final Year Computer Science Project

A full-stack authentication system developed as part of my BSc Computer Science degree at the **University of Leicester**.

This project explores alternative authentication methods designed to reduce the risks associated with shoulder-surfing attacks, where an attacker observes someone entering their login credentials.

Instead of relying solely on traditional passwords, the system allows users to register and authenticate using **hand gestures, facial motions, voice authentication and facial recognition**.

## Project Overview

Traditional passwords can be vulnerable to observation attacks, particularly when entered in public environments.

The aim of this project was to investigate whether alternative, camera-based and voice-based authentication methods could provide different ways for users to authenticate.

The application combines a browser-based frontend, a Node.js backend, a PostgreSQL database and a Python facial recognition service.

## Key Features

### Hand Gesture Authentication

- Uses MediaPipe to track hand landmarks through a webcam.
- Captures hand movements as authentication gestures.
- Uses Dynamic Time Warping (DTW) to compare registered and attempted gesture sequences.
- Supports gesture-based registration and verification.

### Facial Motion Authentication

- Uses facial landmarks and blendshape information to detect facial movements.
- Supports actions such as blinking, smiling, winking and head movements.
- Allows users to register sequences of facial actions.
- Compares captured movements against registered authentication sequences.

### Voice Authentication

- Allows users to register a spoken passphrase.
- Uses browser speech recognition to process spoken input.
- Extracts audio features for basic voice-pattern comparison.
- Combines passphrase checking with voice-feature similarity.

### Face Recognition

- Uses a Python Flask service for face encoding and verification.
- Generates 128-dimensional facial embeddings using `face_recognition`.
- Compares facial embeddings to determine whether the attempted authentication matches the registered user.

### Backend and Security

- REST API developed using Node.js and Express.
- PostgreSQL database for user accounts and authentication templates.
- AES-256-GCM encryption for stored authentication templates.
- Session-based authentication.
- Rate limiting on sensitive API endpoints.
- Input validation and error handling.

## Technologies Used

| Category | Technologies |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Computer Vision | MediaPipe Tasks Vision |
| Facial Recognition | Python, Flask, face_recognition |
| Authentication | Dynamic Time Warping, speech recognition, audio feature comparison |
| Security | AES-256-GCM, Express Sessions, Rate Limiting |
| Development Tools | VS Code, Git, GitLab |

## Project Structure

```text
multi-modal-authentication-system/
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── utils/
│   │   ├── encryption.js
│   │   └── facePythonService.js
│   └── package.json
│
├── python-face-service/
│   ├── app.py
│   └── requirements.txt
│
├── src/
│   ├── css/
│   ├── js/
│   │   ├── auth/
│   │   ├── pages/
│   │   └── utils/
│   ├── models/
│   └── pages/
│       ├── index.html
│       ├── register.html
│       ├── signin.html
│       ├── login.html
│       └── dashboard.html
│
├── docs/
├── README.md
└── SETUP.md
```

## Running the Project Locally

The application requires PostgreSQL, Node.js and Python.

### 1. Database

Create and configure a PostgreSQL database using the environment variables described in `SETUP.md`.

### 2. Backend

```bash
cd backend
npm install
npm start
```

The backend runs on `http://localhost:4000` by default.

### 3. Python Face Recognition Service

In a separate terminal:

```bash
cd python-face-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

### 4. Frontend

Serve the `src` directory using a local HTTP server or VS Code Live Server.

Make sure the frontend origin matches the backend CORS configuration.

For further configuration details, see [SETUP.md](SETUP.md).

**Note:** MediaPipe model files are excluded from this repository and must be supplied separately as described in the project setup documentation.

## Evaluation

The project included user testing to explore the usability and practicality of the authentication methods.

Evaluation focused on how participants interacted with the registration and login process, the usability of the different authentication methods and potential improvements to the user experience.

The system is an academic prototype and should not be treated as a production-ready authentication solution without further security evaluation.

## Dissertation

This project was developed as part of my final year BSc Computer Science degree at the University of Leicester (2025–2026).

My **53-page dissertation**, *Graphical Passwords: Preventing Shoulder Surfing*, documents the research, design, implementation and evaluation of the multi-modal authentication system.

The dissertation covers:

- **Research and Literature Review:** Traditional authentication vulnerabilities, shoulder-surfing attacks, graphical passwords and biometric authentication.
- **System Design:** Architecture, database structure and authentication workflows.
- **Implementation:** Development of gesture, facial motion, voice and facial recognition authentication using JavaScript, MediaPipe, Node.js, PostgreSQL and Python.
- **Testing and Evaluation:** Usability testing with 10 participants, examining user experience and perceived security.
- **Critical Appraisal:** System limitations, security considerations and potential future improvements.

The evaluation highlighted differences in usability between authentication methods, with gesture authentication presenting greater usability challenges. Formal shoulder-surfing and spoofing attack testing was outside the evaluation scope.

### Read the Full Dissertation

📄 **[Graphical Passwords: Preventing Shoulder Surfing — Dissertation (PDF)](docs/Graphical_Passwords_Dissertation.pdf)**

## What I Learned

Through this project, I gained practical experience in:

- Designing and developing a full-stack application.
- Integrating browser-based computer vision.
- Developing REST APIs and working with PostgreSQL.
- Encrypting and managing authentication templates.
- Connecting Node.js and Python services.
- Implementing and evaluating alternative authentication methods.
- Debugging frontend, backend and database integration issues.
- Planning and evaluating a substantial independent software project.

## Project Context

**University:** University of Leicester  
**Degree:** BSc Computer Science  
**Project:** Final Year Individual Project  
**Academic Year:** 2025–2026

This project was developed for academic research and learning purposes.

## Author

**Sammy Hoque**

[GitHub](https://github.com/SammyHoque) | [LinkedIn](https://www.linkedin.com/in/sammyhoque) | [Portfolio](https://www.sammyhoque.com/)