/**
 * Tests that PlaneObject.setNull() delegates to its embedded PlaneModel.
 *
 * PlaneObject is a legacy browser global — loaded via vm.runInContext with
 * minimum global stubs. We set _model state directly to avoid PlaneObject.updateData's
 * large global surface area; the behavior under test is the setNull delegation.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import vm from 'vm';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PlaneModel } from '../PlaneModel.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let PlaneObject;

beforeAll(() => {
    const ctx = vm.createContext({
        PlaneModel,
        g: { planes: {}, planesOrdered: [] },
        console,
        findICAORange: () => ({ country: 'USA', country_code: 'US' }),
        registration_from_hexid: () => 'N12345',
        milRanges: [],
    });

    const src = readFileSync(
        resolve(__dirname, '../../html/js/planeObject.js'),
        'utf8'
    );
    vm.runInContext(src, ctx);

    // Stub side-effectful methods so construction doesn't trigger network calls
    ctx.PlaneObject.prototype.checkForDB = function() {};
    ctx.PlaneObject.prototype.dataChanged = function() {};
    ctx.PlaneObject.prototype.getAircraftData = function() {};

    PlaneObject = ctx.PlaneObject;
});

// ─── setNull() → _model delegation ────────────────────────────────────────────

describe('PlaneObject.setNull() → _model delegation', () => {
    it('does not throw during construction (setNull called before _model is assigned)', () => {
        // constructor calls setNull() before this._model = new PlaneModel(...)
        // the guard `if (this._model)` must prevent a crash
        expect(() => new PlaneObject('a1b2c3')).not.toThrow();
    });

    it('resets _model.lat to null after setNull()', () => {
        const plane = new PlaneObject('b1c2d3');
        // Set model state directly — avoids PlaneObject.updateData's global surface
        plane._model.updateData({ lat: 45.12, lon: -93.45, seen: 1, seen_pos: 1 });
        expect(plane._model.lat).toBe(45.12); // confirm data is in model

        plane.setNull();

        expect(plane._model.lat).toBeNull();
    });

    it('resets _model.flight to null after setNull()', () => {
        const plane = new PlaneObject('c1d2e3');
        plane._model.updateData({ flight: 'AAL123', seen: 1, seen_pos: 1 });

        plane.setNull();

        expect(plane._model.flight).toBeNull();
    });

    it('resets _model.alt_baro to null after setNull()', () => {
        const plane = new PlaneObject('d1e2f3');
        plane._model.updateData({ alt_baro: 35000, seen: 1, seen_pos: 1 });

        plane.setNull();

        expect(plane._model.alt_baro).toBeNull();
    });

    it('resets _model.gs and _model.track to null after setNull()', () => {
        const plane = new PlaneObject('e1f2a3');
        plane._model.updateData({ gs: 420, track: 90, seen: 1, seen_pos: 1 });

        plane.setNull();

        expect(plane._model.gs).toBeNull();
        expect(plane._model.track).toBeNull();
    });
});
