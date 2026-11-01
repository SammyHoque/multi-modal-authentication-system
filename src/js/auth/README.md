# Authentication Logic

This folder contains reusable logic for each authentication method.

## Files

- `gesture_dtw.js` records gesture frames and compares gestures using Dynamic Time Warping.
- `face.js` detects facial motion events such as blink, wink, smile, mouth open, head movement, and tilt.
- `faceid.js` contains Face ID helper functions for checking face position and capturing a webcam image.
- `voice.js` records voice audio, extracts a voiceprint, and compares voice/passphrase input.

## Notes

Keep method-specific detection and matching code here. Page files should call these helpers rather than duplicating authentication logic.
