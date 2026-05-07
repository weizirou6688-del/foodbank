const EARTH_RADIUS_KM = 6371;
const KILOMETERS_TO_MILES = 0.621371;
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
export function kilometersToMiles(distanceKm: number) {
  return distanceKm * KILOMETERS_TO_MILES;
}
export function formatDistanceMiles(distanceKm: number, fractionDigits = 1) {
  return `${kilometersToMiles(distanceKm).toFixed(fractionDigits)} miles`;
}
export function formatDistanceKilometers(
  distanceKm: number,
  fractionDigits = 2,
) {
  return `${distanceKm.toFixed(fractionDigits)} km`;
}
