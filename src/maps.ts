import NodeCache from 'node-cache';
import logger from './logger.ts';
import { env } from './config/env.ts';
import type { ConstituencyInfo } from './types/index.ts';
import { CACHE_TTL } from './constants.ts';
import { AppError } from './errors/AppError.ts';

const geoCache = new NodeCache({ stdTTL: CACHE_TTL.geocoding, checkperiod: CACHE_TTL.checkPeriod });

/**
 * Returns the Google Maps API key safely.
 * @returns {string} The API key
 */
export const getMapsKey = (): string => env.MAPS_API_KEY || '';

/**
 * Looks up constituency information based on a pincode.
 * Uses caching to minimize API calls.
 * @param {string} pincode - 6-digit pincode
 * @returns {Promise<ConstituencyInfo>} Constituency information
 * @throws {AppError} 404 if pincode not found
 */
export const lookupConstituency = async (pincode: string): Promise<ConstituencyInfo> => {
  const cached = geoCache.get<ConstituencyInfo>(pincode);
  if (cached) return cached;

  try {
    // In a real app, this would call the Google Maps Geocoding API.
    // Here we mock it for the demo.
    const mockConstituencies: Record<string, ConstituencyInfo> = {
      '110001': { state: 'Delhi', lokSabha: 'New Delhi', vidhanSabha: 'New Delhi', lat: 28.6139, lng: 77.2090 },
      '400001': { state: 'Maharashtra', lokSabha: 'Mumbai South', vidhanSabha: 'Colaba', lat: 18.9220, lng: 72.8347 },
      '560001': { state: 'Karnataka', lokSabha: 'Bangalore Central', vidhanSabha: 'Shivajinagar', lat: 12.9716, lng: 77.5946 },
      '600001': { state: 'Tamil Nadu', lokSabha: 'Chennai Central', vidhanSabha: 'Harbour', lat: 13.0827, lng: 80.2707 },
      '700001': { state: 'West Bengal', lokSabha: 'Kolkata Uttar', vidhanSabha: 'Jorasanko', lat: 22.5726, lng: 88.3639 },
    };

    const data = mockConstituencies[pincode];
    if (!data) {
      throw new AppError('Pincode not found in election database', 404, 'PINCODE_NOT_FOUND');
    }

    geoCache.set(pincode, data);
    return data;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    logger.error(`Maps lookup error: ${error.message}`);
    throw new AppError('Failed to lookup constituency', 500, 'MAPS_ERROR');
  }
};
