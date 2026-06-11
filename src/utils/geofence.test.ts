import { getDistanceInMeters } from './geofence';

describe('Geofence Distance Calculations', () => {
  // Configurable Target Office Coordinates (e.g. Hyderabad Hitec City area)
  const officeCoords = { lat: 17.4435, lng: 78.385 };

  it('should calculate 0 meters for the exact same coordinates', () => {
    const distance = getDistanceInMeters(
      officeCoords.lat,
      officeCoords.lng,
      officeCoords.lat,
      officeCoords.lng
    );
    expect(Math.round(distance)).toBe(0);
  });

  it('should calculate a short distance for coordinates close to the office', () => {
    // Roughly 5 meters away
    const distance = getDistanceInMeters(
      officeCoords.lat,
      officeCoords.lng,
      17.443545,
      78.385002
    );
    expect(distance).toBeLessThan(10);
  });

  it('should calculate a long distance for coordinates far from the office', () => {
    // Roughly 1.5 km away
    const distance = getDistanceInMeters(
      officeCoords.lat,
      officeCoords.lng,
      17.4567,
      78.3891
    );
    expect(distance).toBeGreaterThan(1000);
  });
});
