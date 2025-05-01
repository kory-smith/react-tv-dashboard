import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

// Convert callback-based scrypt to Promise-based
const scryptAsync = promisify(scrypt);

// Key length for scrypt
const KEY_LENGTH = 64;

/**
 * Hash a password using the crypto module
 * 
 * @param password The password to hash
 * @returns A hashed password string in the format: 'salt:hash'
 */
export async function hashPassword(password: string): Promise<string> {
  // Generate a random salt
  const salt = randomBytes(16).toString('hex');
  
  // Hash the password with the salt
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH) as Buffer;
  
  // Return the salt and hash together
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a password against a hash
 * 
 * @param password The password to verify
 * @param storedHash The stored hash in the format 'salt:hash'
 * @returns Boolean indicating if the password matches
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Extract the salt and hash from the stored hash
  const [salt, hash] = storedHash.split(':');
  
  // If the hash doesn't have the expected format, reject it
  if (!salt || !hash) return false;
  
  // Hash the provided password with the same salt
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH) as Buffer;
  
  // Convert the stored hash from hex to Buffer for comparison
  const storedHashBuffer = Buffer.from(hash, 'hex');
  
  // Compare the derived key with the stored hash using constant-time comparison
  return timingSafeEqual(derivedKey, storedHashBuffer);
} 