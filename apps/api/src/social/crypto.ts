import { NotImplementedError } from '../utils/httpError.js';

/**
 * AES-256-GCM encryption for OAuth tokens at rest, keyed by ENCRYPTION_KEY (32 bytes, base64).
 * TODO(Phase 4, §13): implement (random IV per value; store iv + tag + ciphertext).
 */
export function encryptToken(_plain: string): string {
  throw new NotImplementedError(4);
}

export function decryptToken(_encrypted: string): string {
  throw new NotImplementedError(4);
}
