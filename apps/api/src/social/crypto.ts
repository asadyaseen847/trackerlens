import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

/**
 * The 32-byte key from ENCRYPTION_KEY (base64). Outside production a fixed development key is
 * used so local runs work without setup; production refuses to start without the variable.
 */
function keyFrom(encryptionKey: string | undefined): Buffer {
  if (encryptionKey) {
    const key = Buffer.from(encryptionKey, 'base64');
    if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes, base64-encoded');
    return key;
  }
  if (process.env['NODE_ENV'] === 'production') throw new Error('ENCRYPTION_KEY is not set');
  return createHash('sha256').update('trackerlens-dev-only-encryption-key').digest();
}

/**
 * Encrypts an OAuth token for storage (§13): AES-256-GCM with a random 12-byte IV.
 * Output: "v1.<iv>.<auth tag>.<ciphertext>", each part base64url.
 */
export function encryptToken(plain: string, encryptionKey: string | undefined): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyFrom(encryptionKey), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, data]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
    .join('.');
}

/** Decrypts encryptToken() output. Throws if the value was tampered with or the key is wrong. */
export function decryptToken(encrypted: string, encryptionKey: string | undefined): string {
  const [version, iv, tag, data] = encrypted.split('.');
  if (version !== VERSION || !iv || !tag || data === undefined)
    throw new Error('Unknown token format');
  const decipher = createDecipheriv(
    ALGORITHM,
    keyFrom(encryptionKey),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
