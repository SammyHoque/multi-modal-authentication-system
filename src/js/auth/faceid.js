export function getFaceCenterQuality(landmarks) {
  if (!landmarks || !landmarks.length) return null;

  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const forehead = landmarks[10];
  const chin = landmarks[152];

  if (!leftCheek || !rightCheek || !forehead || !chin) return null;

  const centerX = (leftCheek.x + rightCheek.x) / 2;
  const centerY = (forehead.y + chin.y) / 2;
  const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
  const faceHeight = Math.abs(chin.y - forehead.y);

  return { centerX, centerY, faceWidth, faceHeight };
}

export function isFaceWellPositioned(landmarks) {
  const q = getFaceCenterQuality(landmarks);
  if (!q) return false;

  // Keep Face ID strict enough that we only capture/verify when the face is centred and large enough.
  const centeredX = q.centerX > 0.38 && q.centerX < 0.62;
  const centeredY = q.centerY > 0.32 && q.centerY < 0.68;
  const largeEnough = q.faceWidth > 0.22 && q.faceHeight > 0.26;

  return centeredX && centeredY && largeEnough;
}

export async function captureFaceImageFromVideo(video) {
  if (!video || !video.videoWidth || !video.videoHeight) {
    throw new Error("Video is not ready");
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to capture face image"));
        return;
      }
      resolve(blob);
    }, "image/jpeg", 0.95);
  });
}
