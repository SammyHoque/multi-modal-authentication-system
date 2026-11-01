const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

const keyHex = process.env.TEMPLATE_ENCRYPTION_KEY;

if (!keyHex) {
  throw new Error("TEMPLATE_ENCRYPTION_KEY is missing from .env");
}

const KEY = Buffer.from(keyHex, "hex");

if (KEY.length !== 32) {
  throw new Error("TEMPLATE_ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
}

function encryptTemplate(templateObject) {
  // AES-GCM needs a unique IV per encryption and returns an auth tag so the
  // data can be checked for tampering during decryption.
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  const plaintext = JSON.stringify(templateObject);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    // These pieces are stored separately so they can be reconstructed later
    // when the template needs to be decrypted for verification.
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    ciphertext: encrypted.toString("hex"),
  };
}

function decryptTemplate(encryptedObject) {
  // Decryption must use the original IV and auth tag that were produced when
  // the template was encrypted.
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    KEY,
    Buffer.from(encryptedObject.iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(encryptedObject.authTag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedObject.ciphertext, "hex")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

module.exports = {
  encryptTemplate,
  decryptTemplate,
};
