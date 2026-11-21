/**
 * Geolocation & Store Matching Utility
 * Client-side only. Calculates nearest metro store via Haversine formula.
 */

// 5 Indian metro cities with coordinates and default store codes
export const METRO_CITIES = [
  { city: 'Bengaluru', defaultStoreCode: 'BLR-01', lat: 12.9716, lng: 77.5946 },
  { city: 'Mumbai', defaultStoreCode: 'MUM-01', lat: 19.0760, lng: 72.8777 },
  { city: 'Delhi', defaultStoreCode: 'DEL-01', lat: 28.6139, lng: 77.2090 },
  { city: 'Hyderabad', defaultStoreCode: 'HYD-01', lat: 17.3850, lng: 78.4867 },
  { city: 'Chennai', defaultStoreCode: 'CHE-01', lat: 13.0827, lng: 80.2707 },
];

/**
 * Calculates Haversine distance in kilometers between two lat/lng points.
 */
export function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Matches coordinates to the nearest Indian metro city and finds the default store.
 */
export function getNearestMetroStore(lat, lng, availableStores = []) {
  let nearestCity = METRO_CITIES[0];
  let minDistance = Infinity;

  for (const c of METRO_CITIES) {
    const dist = haversineDistanceKm(lat, lng, c.lat, c.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestCity = c;
    }
  }

  // Find corresponding store in availableStores
  const matchedStore =
    availableStores.find((s) => s.storeCode === nearestCity.defaultStoreCode) ||
    availableStores.find((s) => s.city.toLowerCase() === nearestCity.city.toLowerCase()) ||
    availableStores[0] ||
    null;

  return {
    cityName: nearestCity.city,
    defaultStoreCode: nearestCity.defaultStoreCode,
    distanceKm: Math.round(minDistance),
    store: matchedStore,
  };
}

/**
 * Attempts to request device geolocation.
 * Returns { store, cityName, defaultStoreCode, distanceKm } on success, or throws error on refusal/timeout.
 */
export function requestDeviceLocation(availableStores = []) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const result = getNearestMetroStore(latitude, longitude, availableStores);
        resolve(result);
      },
      (error) => {
        reject(error);
      },
      {
        timeout: 8000,
        maximumAge: 600000,
        enableHighAccuracy: false,
      }
    );
  });
}
