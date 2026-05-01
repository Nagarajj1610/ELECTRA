import NodeCache from 'node-cache';
import dotenv from 'dotenv';
import logger from './logger.ts';
dotenv.config();

/** Type for constituency lookup result */
export interface ConstituencyInfo {
  state: string;
  lokSabha: string;
  vidhanSabha: string;
}

// Cache geocoding results for 24 hours to reduce API calls
const geoCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

const PINCODE_DATA: Record<string, ConstituencyInfo> = {
  "110001": { state: "Delhi", lokSabha: "New Delhi", vidhanSabha: "New Delhi" },
  "110011": { state: "Delhi", lokSabha: "New Delhi", vidhanSabha: "Connaught Place" },
  "400001": { state: "Maharashtra", lokSabha: "Mumbai South", vidhanSabha: "Colaba" },
  "400051": { state: "Maharashtra", lokSabha: "Mumbai North Central", vidhanSabha: "Bandra West" },
  "500001": { state: "Telangana", lokSabha: "Hyderabad", vidhanSabha: "Goshamahal" },
  "600001": { state: "Tamil Nadu", lokSabha: "Chennai Central", vidhanSabha: "Harbour" },
  "600006": { state: "Tamil Nadu", lokSabha: "Chennai Central", vidhanSabha: "Chepauk-Thiruvallikeni" },
  "700001": { state: "West Bengal", lokSabha: "Kolkata Uttar", vidhanSabha: "Jorasanko" },
  "508206": { state: "Telangana", lokSabha: "Nalgonda", vidhanSabha: "Nagarjuna Sagar" },
  "560001": { state: "Karnataka", lokSabha: "Bangalore Central", vidhanSabha: "Shivajinagar" },
  "560100": { state: "Karnataka", lokSabha: "Bangalore North", vidhanSabha: "Yelahanka" },
  "380001": { state: "Gujarat", lokSabha: "Ahmedabad West", vidhanSabha: "Jamalpur-Khadia" },
  "302001": { state: "Rajasthan", lokSabha: "Jaipur", vidhanSabha: "Hawa Mahal" },
  "226001": { state: "Uttar Pradesh", lokSabha: "Lucknow", vidhanSabha: "Lucknow Central" },
  "800001": { state: "Bihar", lokSabha: "Patna Sahib", vidhanSabha: "Bankipur" },
  "411001": { state: "Maharashtra", lokSabha: "Pune", vidhanSabha: "Kasba Peth" },
};

/**
 * Returns the Maps API key — NOTE: this is only used server-side for geocoding,
 * never exposed to the client. The /api/maps/key endpoint is intentionally
 * restricted; client-side map is initialized with a referrer-restricted key.
 */
export const getMapsKey = (): string => process.env.MAPS_API_KEY || '';

/**
 * Looks up constituency data for a given Indian pincode.
 * First checks in-memory lookup table, then falls back to Google Maps Geocoding API.
 */
export const lookupConstituency = async (pincode: string): Promise<ConstituencyInfo> => {
  // 1. Fast path: static lookup table
  if (PINCODE_DATA[pincode]) {
    return PINCODE_DATA[pincode];
  }

  // 2. Check cache
  const cached = geoCache.get<ConstituencyInfo>(pincode);
  if (cached) return cached;

  // 3. Google Maps Geocoding API fallback
  const apiKey = process.env.MAPS_API_KEY;
  if (apiKey && apiKey !== 'YOUR_MAPS_API_KEY') {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(pincode + ',India')}&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
      const data = await res.json() as { status: string; results: Array<{ formatted_address: string; address_components: Array<{ long_name: string; types: string[] }> }> };

      if (data.status === 'OK' && data.results.length > 0) {
        const components = data.results[0].address_components;
        const stateComponent = components.find(c => c.types.includes('administrative_area_level_1'));
        const state = stateComponent?.long_name ?? data.results[0].formatted_address.split(',').slice(-2, -1)[0]?.trim() ?? 'India';

        const result: ConstituencyInfo = {
          state,
          lokSabha: 'Visit voters.eci.gov.in to find your constituency',
          vidhanSabha: 'Visit voters.eci.gov.in to find your assembly segment',
        };
        geoCache.set(pincode, result);
        return result;
      }
    } catch (err: any) {
      logger.warn(`Geocoding failed for pincode ${pincode}: ${err?.message || err}`);
    }
  }

  // 4. Generic fallback
  return {
    state: 'India',
    lokSabha: 'Check voters.eci.gov.in for your constituency',
    vidhanSabha: 'Check voters.eci.gov.in for your assembly segment',
  };
};
