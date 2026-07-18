/**
 * India-first backend defaults. Override with APP_REGION env if needed later.
 */
const APP_REGION = (process.env.APP_REGION || 'IN').toUpperCase();

const isIndia = APP_REGION === 'IN';

/** Regional timezone for date/time behavior outside the rolling swipe limit. */
const APP_TIMEZONE = process.env.APP_TIMEZONE || (isIndia ? 'Asia/Kolkata' : 'UTC');

/** Major Indian cities for backfill / geocoding (lowercase keys). Includes Bengaluru + Bangalore. */
const INDIA_CITY_COORDS = {
  bengaluru: { lat: 12.9716, lon: 77.5946 },
  bangalore: { lat: 12.9716, lon: 77.5946 },
  mumbai: { lat: 19.076, lon: 72.8777 },
  'mumbai metropolitan': { lat: 19.076, lon: 72.8777 },
  delhi: { lat: 28.6139, lon: 77.209 },
  'new delhi': { lat: 28.6139, lon: 77.209 },
  'delhi ncr': { lat: 28.6139, lon: 77.209 },
  noida: { lat: 28.5355, lon: 77.391 },
  gurgaon: { lat: 28.4595, lon: 77.0266 },
  gurugram: { lat: 28.4595, lon: 77.0266 },
  hyderabad: { lat: 17.385, lon: 78.4867 },
  chennai: { lat: 13.0827, lon: 80.2707 },
  pune: { lat: 18.5204, lon: 73.8567 },
  kolkata: { lat: 22.5726, lon: 88.3639 },
  ahmedabad: { lat: 23.0225, lon: 72.5714 },
  jaipur: { lat: 26.9124, lon: 75.7873 },
  chandigarh: { lat: 30.7333, lon: 76.7794 },
  kochi: { lat: 9.9312, lon: 76.2673 },
  indore: { lat: 22.7196, lon: 75.8577 },
  lucknow: { lat: 26.8467, lon: 80.9462 },
  raebareli: { lat: 26.2293, lon: 81.2339 },
};

/** Default recommendation radius when client does not send maxDistance (km). */
const DEFAULT_MAX_DISTANCE_KM = isIndia ? 50 : 100;

function normalizeCityKey(city) {
  if (typeof city !== 'string') return '';
  return city.trim().toLowerCase().replace(/\s+/g, ' ');
}

function lookupCityCoords(city) {
  const key = normalizeCityKey(city);
  if (!key) return null;
  return INDIA_CITY_COORDS[key] || null;
}

module.exports = {
  APP_REGION,
  APP_TIMEZONE,
  DEFAULT_MAX_DISTANCE_KM,
  INDIA_CITY_COORDS,
  normalizeCityKey,
  lookupCityCoords,
};
