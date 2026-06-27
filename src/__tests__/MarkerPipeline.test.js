import { describe, it, expect } from 'vitest';
import { MarkerPipeline } from '../MarkerPipeline.js';

describe('MarkerPipeline.select()', () => {
    it('returns shape:unknown for aircraft with no type info', () => {
        const pipeline = new MarkerPipeline();
        const spec = pipeline.select({ type: 'adsb', selected: false });
        expect(spec.shape).toBe('unknown');
        expect(spec.scale).toBe(1);
        expect(spec.color).toBe('#d8f4ff');
    });

    it('returns correct shape and scale for known ICAO type designator', () => {
        const pipeline = new MarkerPipeline();
        const spec = pipeline.select({ type: 'adsb', selected: false, icaoType: 'GLID' });
        expect(spec.shape).toBe('glider');
        expect(spec.scale).toBe(1);
    });

    it('returns MLAT color for mlat data source', () => {
        const pipeline = new MarkerPipeline();
        const spec = pipeline.select({ type: 'mlat', selected: false });
        expect(spec.color).toBe('#FDF7DD');
    });

    it('returns selected color when model.selected is true', () => {
        const pipeline = new MarkerPipeline();
        const spec = pipeline.select({ type: 'adsb', selected: true });
        expect(spec.color).toBe('#88DDFF');
    });

    it('falls back to category when no ICAO type designator is present', () => {
        const pipeline = new MarkerPipeline();
        const spec = pipeline.select({ type: 'adsb', selected: false, category: 'A7' });
        expect(spec.shape).toBe('helicopter');
        expect(spec.scale).toBe(1);
    });

    it('returns ground_square with small scale for AIS vessel', () => {
        const pipeline = new MarkerPipeline();
        const spec = pipeline.select({ type: 'ais', selected: false, category: 'C1' });
        expect(spec.shape).toBe('ground_square');
        expect(spec.color).toBe('#dcdcdc');
    });
});
