from flask import Flask, request, jsonify
import face_recognition
import numpy as np
from PIL import Image
import io

app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "ok": True,
        "message": "Python face service is running"
    })


@app.route("/encode-face", methods=["POST"])
def encode_face():
    try:
        if "image" not in request.files:
            return jsonify({
                "ok": False,
                "error": "No image file provided"
            }), 400

        image_file = request.files["image"]

        # Normalize the uploaded file into an RGB numpy array because
        # `face_recognition` expects image data in that format.
        image_bytes = image_file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(image)

        face_locations = face_recognition.face_locations(image_np)
        if len(face_locations) == 0:
            return jsonify({
                "ok": False,
                "error": "No face detected"
            }), 400

        # This service is designed to return one embedding per request, so we
        # reject group photos or ambiguous uploads.
        if len(face_locations) > 1:
            return jsonify({
                "ok": False,
                "error": "Multiple faces detected"
            }), 400

        # Reuse the detected location so the encoder only processes the face
        # we already validated instead of searching the image again.
        encodings = face_recognition.face_encodings(image_np, face_locations)
        if not encodings:
            return jsonify({
                "ok": False,
                "error": "Could not generate face encoding"
            }), 400

        # Convert to a plain list so Flask can serialize the embedding as JSON.
        embedding = encodings[0].tolist()

        return jsonify({
            "ok": True,
            "embedding": embedding,
            "length": len(embedding)
        })

    except Exception as e:
        return jsonify({
            "ok": False,
            "error": str(e)
        }), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
