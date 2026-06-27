import { describe, it, expect } from 'vitest';
import { AircraftUpdatePipeline, MapPlaneStore } from '../AircraftUpdatePipeline.js';
import { StalenessOracle } from '../StalenessOracle.js';
import { PlaneModel } from '../PlaneModel.js';

describe('AircraftUpdatePipeline.ingest()', () => {
    it('returns empty array for empty aircraft list', () => {
        const store = new MapPlaneStore();
        const pipeline = new AircraftUpdatePipeline(store);
        const changes = pipeline.ingest({ now: 1000, aircraft: [] });
        expect(changes).toEqual([]);
    });

    it('returns changeType:new for first-seen aircraft', () => {
        const store = new MapPlaneStore();
        const pipeline = new AircraftUpdatePipeline(store);
        const changes = pipeline.ingest({
            now: 1000,
            aircraft: [{ hex: 'a1b2c3', lat: 45.0, lon: -93.0, alt_baro: 35000, gs: 420, track: 90, seen: 1, type: 'adsb' }],
        });
        expect(changes).toHaveLength(1);
        expect(changes[0].hex).toBe('a1b2c3');
        expect(changes[0].changeType).toBe('new');
        expect(changes[0].model).toBeInstanceOf(PlaneModel);
        expect(store.get('a1b2c3')).toBe(changes[0].model);
    });

    it('returns changeType:updated for known aircraft and mutates the existing model', () => {
        const store = new MapPlaneStore();
        const pipeline = new AircraftUpdatePipeline(store);
        const frame = { hex: 'a1b2c3', lat: 45.0, lon: -93.0, alt_baro: 35000, gs: 420, track: 90, seen: 1, type: 'adsb' };
        pipeline.ingest({ now: 1000, aircraft: [frame] });
        const original = store.get('a1b2c3');

        const changes = pipeline.ingest({ now: 1001, aircraft: [{ ...frame, alt_baro: 36000, seen: 1 }] });
        expect(changes[0].changeType).toBe('updated');
        expect(changes[0].model).toBe(original);
        expect(original.alt_baro).toBe(36000);
    });

    it('normalizes compact array format before updating the model', () => {
        const store = new MapPlaneStore();
        const pipeline = new AircraftUpdatePipeline(store);
        // [hex, alt_baro, gs, track, lat, lon, seen, type, flight]
        const changes = pipeline.ingest({
            now: 1000,
            aircraft: [['a1b2c3', 35000, 420, 90, 45.0, -93.0, 1, 'adsb', 'AAL123']],
        });
        expect(changes[0].changeType).toBe('new');
        expect(changes[0].model.lat).toBe(45.0);
        expect(changes[0].model.alt_baro).toBe(35000);
        expect(changes[0].model.flight).toBe('AAL123');
    });

    it('returns changeType:stale for aircraft not seen within the timeout', () => {
        const store = new MapPlaneStore();
        const pipeline = new AircraftUpdatePipeline(store);
        // seen=16 means last message was 16s ago; ADS-B timeout is 15s
        const changes = pipeline.ingest({
            now: 1000,
            aircraft: [{ hex: 'a1b2c3', lat: 45.0, lon: -93.0, alt_baro: 35000, gs: 420, track: 90, seen: 16, type: 'adsb' }],
        });
        expect(changes[0].changeType).toBe('stale');
    });

    it('returns changeType:dead for aircraft past the reap threshold', () => {
        const store = new MapPlaneStore();
        const pipeline = new AircraftUpdatePipeline(store, new StalenessOracle());
        const changes = pipeline.ingest({
            now: 1000,
            aircraft: [{ hex: 'a1b2c3', lat: 45.0, lon: -93.0, alt_baro: 35000, gs: 420, track: 90, seen: 481, type: 'adsb' }],
        });
        expect(changes[0].changeType).toBe('dead');
    });

    it('returns changeType:new for first-seen aircraft within the timeout', () => {
        const store = new MapPlaneStore();
        const pipeline = new AircraftUpdatePipeline(store);
        const changes = pipeline.ingest({
            now: 1000,
            aircraft: [{ hex: 'a1b2c3', lat: 45.0, lon: -93.0, alt_baro: 35000, gs: 420, track: 90, seen: 10, type: 'adsb' }],
        });
        expect(changes[0].changeType).toBe('new');
    });
});
