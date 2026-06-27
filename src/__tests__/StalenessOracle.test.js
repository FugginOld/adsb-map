import { describe, it, expect } from 'vitest';
import { StalenessOracle } from '../StalenessOracle.js';
import { PlaneModel } from '../PlaneModel.js';

function makeModel(hex, { seen, type } = {}) {
    const m = new PlaneModel(hex);
    m.updateData({ lat: 1, lon: 1, seen: seen ?? null, seen_pos: seen ?? null, type: type ?? null });
    return m;
}

describe('StalenessOracle.evaluate()', () => {
    it('returns fresh for ADS-B aircraft seen within 15 seconds', () => {
        const oracle = new StalenessOracle();
        const model = makeModel('a1b2c3', { seen: 10, type: 'adsb' });
        expect(oracle.evaluate(model, 1000)).toBe('fresh');
    });

    it('returns stale for ADS-B aircraft past the 15s fresh threshold', () => {
        const oracle = new StalenessOracle();
        const model = makeModel('a1b2c3', { seen: 60, type: 'adsb' });
        expect(oracle.evaluate(model, 1000)).toBe('stale');
    });

    it('returns dead for ADS-B aircraft past the 480s reap threshold', () => {
        const oracle = new StalenessOracle();
        const model = makeModel('a1b2c3', { seen: 481, type: 'adsb' });
        expect(oracle.evaluate(model, 1000)).toBe('dead');
    });

    it('returns fresh for ADS-C aircraft seen within 120 seconds', () => {
        const oracle = new StalenessOracle();
        const model = makeModel('a1b2c3', { seen: 100, type: 'adsc' });
        expect(oracle.evaluate(model, 1000)).toBe('fresh');
    });

    it('returns stale for ADS-C aircraft between 120s and 2100s', () => {
        const oracle = new StalenessOracle();
        const model = makeModel('a1b2c3', { seen: 600, type: 'adsc' });
        expect(oracle.evaluate(model, 1000)).toBe('stale');
    });

    it('returns dead for ADS-C aircraft past the 2100s reap threshold', () => {
        const oracle = new StalenessOracle();
        const model = makeModel('a1b2c3', { seen: 2101, type: 'adsc' });
        expect(oracle.evaluate(model, 1000)).toBe('dead');
    });

    it('returns stale when model.seen is null', () => {
        const oracle = new StalenessOracle();
        const model = makeModel('a1b2c3', { seen: null, type: 'adsb' });
        expect(oracle.evaluate(model, 1000)).toBe('stale');
    });
});
