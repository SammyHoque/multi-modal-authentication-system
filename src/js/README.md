# JavaScript

This folder contains the front-end JavaScript for the application.

## Folders

- `auth/` contains reusable authentication logic such as gesture matching, facial motion detection, Face ID helpers, and voice processing.
- `pages/` contains page controllers that connect HTML elements to the authentication logic.
- `utils/` contains shared helper modules used across pages.

## Notes

Page files should mostly handle UI events and page flow. Reusable authentication or helper logic should live in `auth/` or `utils/` so it can be tested and updated in one place.
