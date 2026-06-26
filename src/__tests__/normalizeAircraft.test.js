import { describe, it, expect } from 'vitest';
import { normalizeAircraft } from '../normalizeAircraft.js';

// Array format from planeObject.js:
// [hex, alt_baro, gs, track, lat, lon, seen, type, flight]
//   0      1       2     3    4    5     6     7      8

describe('normalizeAircraft', () => {
  it('converts compact array to plain object', () => {
    const compact = ['a1b2c3', 35000, 420, 90, 45.12, -93.45, 3, 'adsb', 'AAL123'];
    const result = normalizeAircraft(compact);
    expect(result).toEqual({
      hex: 'a1b2c3',
      alt_baro: 35000,
      gs: 420,
      track: 90,
      lat: 45.12,
      lon: -93.45,
      seen: 3,
      seen_pos: 3,
      type: 'adsb',
      flight: 'AAL123',
    });
  });

  it('passes a plain object through unchanged', () => {
    const plain = { hex: 'a1b2c3', lat: 45.12, lon: -93.45, alt_baro: 35000, flight: 'AAL123' };
    expect(normalizeAircraft(plain)).toBe(plain);
  });

  it('handles null fields in compact array', () => {
    const compact = ['a1b2c3', null, null, null, null, null, 5, 'adsb', null];
    const result = normalizeAircraft(compact);
    expect(result.hex).toBe('a1b2c3');
    expect(result.lat).toBeNull();
    expect(result.alt_baro).toBeNull();
    expect(result.flight).toBeNull();
  });

  it('sets seen_pos equal to seen for compact array', () => {
    const compact = ['abc123', 5000, 200, 180, 40.0, -75.0, 2, 'mlat', 'UAL456'];
    const result = normalizeAircraft(compact);
    expect(result.seen).toBe(2);
    expect(result.seen_pos).toBe(2);
  });
});
