import axios from 'axios';

/**
 * Reverse geocode coordinates into a human-readable address via OpenStreetMap
 * Nominatim (free, no API key). Returns null on any failure/timeout so callers
 * can fall back to raw coordinates instead of blocking the conversation.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { format: 'json', lat, lon: lng, zoom: 18 },
      headers: { 'User-Agent': 'NovaGo-WhatsApp-Ordering/1.0' },
      timeout: 5_000,
    });
    return data?.display_name || null;
  } catch (err) {
    console.error('[geocoding] reverseGeocode failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
