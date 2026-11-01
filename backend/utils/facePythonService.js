const axios = require("axios");
const FormData = require("form-data");

const PYTHON_FACE_SERVICE_URL = "http://127.0.0.1:5001";

async function encodeFaceWithPython(imageBuffer, filename = "face.jpg") {
  // The Python service expects a multipart upload so it can run face
  // detection/encoding on the raw image.
  const form = new FormData();
  form.append("image", imageBuffer, {
    filename,
    contentType: "image/jpeg"
  });

  const res = await axios.post(
    `${PYTHON_FACE_SERVICE_URL}/encode-face`,
    form,
    {
      headers: form.getHeaders()
    }
  );

  if (!res.data.ok) {
    throw new Error(res.data.error || "Python face encoding failed");
  }

  return res.data;
}

module.exports = {
  encodeFaceWithPython
};
