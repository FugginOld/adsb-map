import { describe, it, expect, vi } from 'vitest';
import { PlaneRenderer } from '../PlaneRenderer.js';
import { PlaneModel } from '../PlaneModel.js';

function makeSource() {
    return { addFeature: vi.fn(), removeFeature: vi.fn() };
}

// Fake createPoint returns a plain object so tests never touch OL
function fakeCreatePoint(lon, lat) {
    return { type: 'Point', lon, lat };
}

describe('PlaneRenderer constructor', () => {
    it('adds a feature to the source on construction', () => {
        const model = new PlaneModel('a1b2c3');
        const source = makeSource();
        new PlaneRenderer(model, { source, createPoint: fakeCreatePoint });
        expect(source.addFeature).toHaveBeenCalledOnce();
    });
});

describe('PlaneRenderer.sync()', () => {
    it('sets geometry when model has a valid position', () => {
        const model = new PlaneModel('a1b2c3');
        model.updateData({ lat: 45.0, lon: -93.0, seen: 1, seen_pos: 1 });
        const source = makeSource();
        const renderer = new PlaneRenderer(model, { source, createPoint: fakeCreatePoint });

        renderer.sync();

        const feature = source.addFeature.mock.calls[0][0];
        expect(feature.geometry).toEqual({ type: 'Point', lon: -93.0, lat: 45.0 });
    });

    it('does not update geometry when model position is null', () => {
        const model = new PlaneModel('a1b2c3');
        const source = makeSource();
        const renderer = new PlaneRenderer(model, { source, createPoint: fakeCreatePoint });

        renderer.sync();

        const feature = source.addFeature.mock.calls[0][0];
        expect(feature.geometry).toBeNull();
    });

    it('updates geometry on repeated sync calls', () => {
        const model = new PlaneModel('a1b2c3');
        const source = makeSource();
        const renderer = new PlaneRenderer(model, { source, createPoint: fakeCreatePoint });

        model.updateData({ lat: 45.0, lon: -93.0, seen: 1, seen_pos: 1 });
        renderer.sync();
        model.updateData({ lat: 46.0, lon: -94.0, seen: 2, seen_pos: 2 });
        renderer.sync();

        const feature = source.addFeature.mock.calls[0][0];
        expect(feature.geometry).toEqual({ type: 'Point', lon: -94.0, lat: 46.0 });
    });
});

describe('PlaneRenderer.sync() — visibility', () => {
    it('skips geometry update when model.visible is false', () => {
        const model = new PlaneModel('a1b2c3');
        model.updateData({ lat: 45.0, lon: -93.0, seen: 1, seen_pos: 1 });
        model.visible = false;
        const source = makeSource();
        const renderer = new PlaneRenderer(model, { source, createPoint: fakeCreatePoint });

        renderer.sync();

        const feature = source.addFeature.mock.calls[0][0];
        expect(feature.geometry).toBeNull();
    });

    it('updates geometry when model.visible is true', () => {
        const model = new PlaneModel('a1b2c3');
        model.updateData({ lat: 45.0, lon: -93.0, seen: 1, seen_pos: 1 });
        const source = makeSource();
        const renderer = new PlaneRenderer(model, { source, createPoint: fakeCreatePoint });

        renderer.sync();

        const feature = source.addFeature.mock.calls[0][0];
        expect(feature.geometry).not.toBeNull();
    });
});

describe('PlaneRenderer.sync() — selected state', () => {
    it('sets feature.selected to false when model.selected is false', () => {
        const model = new PlaneModel('a1b2c3');
        const source = makeSource();
        const renderer = new PlaneRenderer(model, { source, createPoint: fakeCreatePoint });

        renderer.sync();

        const feature = source.addFeature.mock.calls[0][0];
        expect(feature.selected).toBe(false);
    });

    it('sets feature.selected to true when model.selected is true', () => {
        const model = new PlaneModel('a1b2c3');
        model.selected = true;
        const source = makeSource();
        const renderer = new PlaneRenderer(model, { source, createPoint: fakeCreatePoint });

        renderer.sync();

        const feature = source.addFeature.mock.calls[0][0];
        expect(feature.selected).toBe(true);
    });

    it('reflects selected state change on subsequent sync', () => {
        const model = new PlaneModel('a1b2c3');
        const source = makeSource();
        const renderer = new PlaneRenderer(model, { source, createPoint: fakeCreatePoint });
        const feature = source.addFeature.mock.calls[0][0];

        renderer.sync();
        expect(feature.selected).toBe(false);

        model.selected = true;
        renderer.sync();
        expect(feature.selected).toBe(true);
    });
});

describe('PlaneRenderer.remove()', () => {
    it('removes the feature from the source', () => {
        const model = new PlaneModel('a1b2c3');
        const source = makeSource();
        const renderer = new PlaneRenderer(model, { source, createPoint: fakeCreatePoint });

        renderer.remove();

        const addedFeature = source.addFeature.mock.calls[0][0];
        expect(source.removeFeature).toHaveBeenCalledWith(addedFeature);
    });
});
