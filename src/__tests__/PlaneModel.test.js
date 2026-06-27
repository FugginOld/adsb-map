import { describe, it, expect } from 'vitest';
import { PlaneModel } from '../PlaneModel.js';

describe('PlaneModel.updateData()', () => {
    it('updates position from normalized data', () => {
        const plane = new PlaneModel('a1b2c3');
        plane.updateData({ hex: 'a1b2c3', lat: 45.12, lon: -93.45, alt_baro: 35000, gs: 420, track: 90, seen: 1, seen_pos: 1, flight: 'AAL123', type: 'adsb' });
        expect(plane.lat).toBe(45.12);
        expect(plane.lon).toBe(-93.45);
        expect(plane.alt_baro).toBe(35000);
    });

    it('updates callsign and speed', () => {
        const plane = new PlaneModel('a1b2c3');
        plane.updateData({ hex: 'a1b2c3', lat: 0, lon: 0, gs: 420, flight: 'UAL456', seen: 1, seen_pos: 1 });
        expect(plane.flight).toBe('UAL456');
        expect(plane.gs).toBe(420);
    });

    it('tolerates null fields in normalized data', () => {
        const plane = new PlaneModel('a1b2c3');
        plane.updateData({ hex: 'a1b2c3', lat: null, lon: null, alt_baro: null, gs: null, track: null, seen: 5, seen_pos: null, flight: null });
        expect(plane.lat).toBeNull();
        expect(plane.flight).toBeNull();
        expect(plane.seen).toBe(5);
    });

    it('does not overwrite position when incoming lat/lon are null', () => {
        const plane = new PlaneModel('a1b2c3');
        plane.updateData({ lat: 45.0, lon: -93.0, seen: 1, seen_pos: 1 });
        plane.updateData({ lat: null, lon: null, gs: 500, seen: 2, seen_pos: null });
        expect(plane.lat).toBe(45.0);
        expect(plane.gs).toBe(500);
    });
});

describe('PlaneModel.isStale(now)', () => {
    it('returns true when never seen', () => {
        const plane = new PlaneModel('a1b2c3');
        expect(plane.isStale(1000)).toBe(true);
    });

    it('returns false for ADS-B within 15 seconds', () => {
        const plane = new PlaneModel('a1b2c3');
        plane.updateData({ lat: 1, lon: 1, seen: 10, seen_pos: 10, type: 'adsb' });
        const now = 1000;
        const lastMessageTime = now - 10;
        expect(plane.isStale(now, lastMessageTime)).toBe(false);
    });

    it('returns true for ADS-B after 15 seconds', () => {
        const plane = new PlaneModel('a1b2c3');
        plane.updateData({ lat: 1, lon: 1, seen: 16, seen_pos: 16, type: 'adsb' });
        const now = 1000;
        const lastMessageTime = now - 16;
        expect(plane.isStale(now, lastMessageTime)).toBe(true);
    });

    it('returns false for ADS-C within 120 seconds', () => {
        const plane = new PlaneModel('a1b2c3');
        plane.updateData({ lat: 1, lon: 1, seen: 100, seen_pos: 100, type: 'adsc' });
        const now = 1000;
        const lastMessageTime = now - 100;
        expect(plane.isStale(now, lastMessageTime)).toBe(false);
    });

    it('returns true for ADS-C after 120 seconds', () => {
        const plane = new PlaneModel('a1b2c3');
        plane.updateData({ lat: 1, lon: 1, seen: 121, seen_pos: 121, type: 'adsc' });
        const now = 1000;
        const lastMessageTime = now - 121;
        expect(plane.isStale(now, lastMessageTime)).toBe(true);
    });
});

describe('PlaneModel.setNull()', () => {
    it('resets all volatile flight fields to null', () => {
        const plane = new PlaneModel('a1b2c3');
        plane.updateData({ lat: 45.0, lon: -93.0, alt_baro: 35000, gs: 420, track: 90, flight: 'AAL123', squawk: '1200', seen: 1, seen_pos: 1, type: 'adsb' });
        plane.setNull();
        expect(plane.lat).toBeNull();
        expect(plane.lon).toBeNull();
        expect(plane.alt_baro).toBeNull();
        expect(plane.gs).toBeNull();
        expect(plane.track).toBeNull();
        expect(plane.flight).toBeNull();
        expect(plane.squawk).toBeNull();
        expect(plane.seen).toBeNull();
    });

    it('preserves the ICAO hex identity field', () => {
        const plane = new PlaneModel('a1b2c3');
        plane.updateData({ lat: 45.0, lon: -93.0, seen: 1, seen_pos: 1 });
        plane.setNull();
        expect(plane.hex).toBe('a1b2c3');
    });
});

describe('PlaneModel constructor', () => {
    it('stores the ICAO hex address', () => {
        const plane = new PlaneModel('a1b2c3');
        expect(plane.hex).toBe('a1b2c3');
    });

    it('initializes volatile flight fields to null', () => {
        const plane = new PlaneModel('a1b2c3');
        expect(plane.lat).toBeNull();
        expect(plane.lon).toBeNull();
        expect(plane.alt_baro).toBeNull();
        expect(plane.gs).toBeNull();
        expect(plane.track).toBeNull();
        expect(plane.flight).toBeNull();
        expect(plane.squawk).toBeNull();
    });

    it('initializes seen to null', () => {
        const plane = new PlaneModel('a1b2c3');
        expect(plane.seen).toBeNull();
    });

    it('initializes visible to true', () => {
        const plane = new PlaneModel('a1b2c3');
        expect(plane.visible).toBe(true);
    });

    it('initializes selected to false', () => {
        const plane = new PlaneModel('a1b2c3');
        expect(plane.selected).toBe(false);
    });
});

describe('PlaneModel.setNull() — display state', () => {
    it('resets visible to true on a new flight leg', () => {
        const plane = new PlaneModel('a1b2c3');
        plane.visible = false;
        plane.setNull();
        expect(plane.visible).toBe(true);
    });

    it('preserves selected across flight legs', () => {
        const plane = new PlaneModel('a1b2c3');
        plane.selected = true;
        plane.setNull();
        expect(plane.selected).toBe(true);
    });
});
