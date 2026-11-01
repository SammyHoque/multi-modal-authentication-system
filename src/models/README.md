# Models

This folder stores local MediaPipe model files used by the authentication system.

## Files

- `gesture_recognizer.task` is used for hand gesture landmark detection.
- `face_landmarker.task` is used for facial landmark and blendshape detection.

## Notes

Do not rename these files unless the matching model paths are also updated in the JavaScript files. The app loads these models directly from this folder.
