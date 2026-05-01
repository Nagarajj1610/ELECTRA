import NodeCache from 'node-cache';
import logger from './logger.ts';
import { env } from './config/env.ts';
import { ConstituencyInfo } from './types/index.ts';
import { GEO_CACHE_TTL, GEO_CACHE_CHECK } from './constants.ts';
import { AppError } from './utils/AppError.ts';

const geoCache = new NodeCache({ stdTTL: GEO_CACHE_TTL, checkperiod: GEO_CACHE_CHECK });

const PINCODE_DATA: Record<string, ConstituencyInfo> = {
  "110001": { state: "Delhi", lokSabha: "New Delhi", vidhanSabha: "New Delhi" },
  "400001": { state: "Maharashtra", lokSabha: "Mumbai South", vidhanSabha: "Colaba" },
  "500001": { state: "Telangana", lokSabha: "Hyderabad", vidhanSabha: "Goshamahal" },
  "600001": { state: "Tamil Nadu", lokSabha: "Chennai Central", vidhanSabha: "Harbour" },
  "700001": { state: "West Bengal", lokSabha: "Kolkata Uttar", vidhanSabha: "Jorasanko" },
};

/**
 * Returns the Maps API key from environment config.
 * @returns {string} The API key
 */
export const getMapsKey = (): string => env.MAPS_API_KEY || '';

/**
 * Fallback generic constituency response.
 * @returns {ConstituencyInfo} Generic info
 */
const getGenericFallback = (): ConstituencyInfo => ({
  state: 'India',
  lokSabha: 'Check voters.eci.gov.in for your constituency',
  vidhanSabha: 'Check voters.eci.gov.in for your assembly segment',
});

/**
 * Parses state from Google Geocoding API response.
 * @param {any} data - JSON response from Google
 * @returns {string} State name
 */
const parseStateFromGeocode = (data: any): string => {
  const components = data.results[0].address_components;
  const stateComp = components.find((c: any) => c.types.includes('administrative_area_level_1'));
  if (stateComp?.long_name) return stateComp.long_name;
  return data.results[0].formatted_address.split(',').slice(-2, -1)[0]?.trim() || 'India';
};

/**
 * Calls Google Geocoding API to resolve pincode.
 * @param {string} pincode - Indian pincode
 * @returns {Promise<ConstituencyInfo>} Constituency data
 */
const fetchGeocode = async (pincode: string): Promise<ConstituencyInfo> => {
  const apiKey = env.MAPS_API_KEY;
  if (!apiKey || apiKey === 'YOUR_MAPS_API_KEY') throw new AppError('Maps API not configured', 500);

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(pincode + ',India')}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new AppError(`Geocoding HTTP ${res.status}`, res.status);
  
  const data = await res.json();
  if (data.status !== 'OK' || data.results.length === 0) throw new AppError('No results from Geocoding API', 404);

  return {
    state: parseStateFromGeocode(data),
    lokSabha: 'Visit voters.eci.gov.in to find your constituency',
    vidhanSabha: 'Visit voters.eci.gov.in to find your assembly segment',
  };
};

/**
 * Looks up constituency data for a given Indian pincode.
 * First checks static table, then cache, then Google API.
 * @param {string} pincode - 6 digit pincode
 * @returns {Promise<ConstituencyInfo>} The constituency info
 */
export const lookupConstituency = async (pincode: string): Promise<ConstituencyInfo> => {
  if (PINCODE_DATA[pincode]) return PINCODE_DATA[pincode];
  
  const cached = geoCache.get<ConstituencyInfo>(pincode);
  if (cached) return cached;

  try {
    const result = await fetchGeocode(pincode);
    geoCache.set(pincode, result);
    return result;
  } catch (err: any) {
    logger.warn(`Geocoding failed for pincode ${pincode}: ${err?.message || err}`);
    return getGenericFallback();
  }
};
