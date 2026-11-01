# Page Controllers

This folder contains JavaScript files that control each HTML page.

## Files

- `index.js` handles the landing page flow.
- `signin.js` signs the user in and stores the current account state.
- `register.js` controls authentication method setup and saves registered methods.
- `login.js` controls webcam-based login verification and method status feedback.
- `dashboard.js` loads dashboard details and displays the user's registered security methods.

## Notes

These files connect UI elements to the backend and authentication helpers. Keep heavy detection logic in `js/auth/` where possible.
