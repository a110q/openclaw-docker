import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { getPlatformEnv } from './platform-env';

const scrypt = promisify(nodeScrypt);

function deriveKey() {
  return createHash('sha256').update(getPlatformEnv().OPENCLAW_PLATFORM_CRYPTO_SECRET).digest();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [kind, salt, digest] = storedHash.split(':');
  if (kind !== 'scrypt' || !salt || !digest) return false;
  const computed = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(digest, 'hex');
  if (expected.length !== computed.length) return false;
  return timingSafeEqual(expected, computed);
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(value: string) {
  if (!value) return '';
  const [version, ivHex, tagHex, cipherHex] = value.split(':');
  if (version !== 'v1' || !ivHex || !tagHex || !cipherHex) return '';
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function maskSecret(value: string) {
  if (!value) return '';
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}
