# Python Face Service

A small Flask API that detects a single face in an uploaded image and returns a face embedding using the `face_recognition` library.

## Features

- Health check endpoint for confirming the service is running.
- Face encoding endpoint that accepts an uploaded image file.
- Validation for missing images, no detected faces, and multiple detected faces.
- JSON response containing a face embedding that can be stored or compared by another service.

## Tech Stack

- Python
- Flask
- face_recognition
- dlib
- Pillow
- NumPy

## Setup

Create and activate a virtual environment:

```bash
python -m venv venv
source venv/bin/activate
```

Install the Python dependencies:

```bash
pip install -r requirements.txt
```

## Running the Service

Start the Flask service:

```bash
python app.py
```

By default, the API runs at:

```text
http://127.0.0.1:5001
```

## API Endpoints

### Health Check

```http
GET /health
```

Example:

```bash
curl http://127.0.0.1:5001/health
```

Successful response:

```json
{
  "ok": true,
  "message": "Python face service is running"
}
```

### Encode Face

```http
POST /encode-face
```

Send an image file using the form field name `image`.

Example:

```bash
curl -X POST http://127.0.0.1:5001/encode-face \
  -F "image=@path/to/image.jpg"
```

Successful response:

```json
{
  "ok": true,
  "embedding": [0.0123, -0.0456],
  "length": 128
}
```

The actual `embedding` array contains 128 values.

## Error Responses

If no image file is uploaded:

```json
{
  "ok": false,
  "error": "No image file provided"
}
```

If no face is detected:

```json
{
  "ok": false,
  "error": "No face detected"
}
```

If more than one face is detected:

```json
{
  "ok": false,
  "error": "Multiple faces detected"
}
```

If an embedding cannot be generated:

```json
{
  "ok": false,
  "error": "Could not generate face encoding"
}
```

## Project Structure

```text
.
├── app.py
├── requirements.txt
├── package.json
└── README.md
```

## Notes

- The service expects exactly one clear face per uploaded image.
- The app runs with `debug=True`, which is useful during development but should be disabled before production deployment.
- `face_recognition` and `dlib` may require native build tools depending on your operating system.
