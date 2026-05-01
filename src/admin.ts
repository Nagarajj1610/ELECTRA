import { timingSafeEqual } from 'crypto';
import { getStats } from './logger.ts';
import { env } from './config/env.ts';
import { AppError } from './errors/AppError.ts';

/**
 * Compares two strings in a timing-safe manner.
 * @param {string} a - Input string
 * @param {string} b - Reference string
 * @returns {boolean} True if equal
 */
const safeCompare = (a: string, b: string): boolean => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
};

/**
 * Returns administrative statistics if the password is correct.
 * @param {string} password - Admin password
 * @returns {AdminStats} Statistics data
 * @throws {AppError} 401 if unauthorized
 */
export const getAdminStats = (password: string) => {
  if (!safeCompare(password, env.ADMIN_PASSWORD)) {
    throw new AppError('Unauthorized', 401, 'AUTH_FAILED');
  }
  return getStats();
};
