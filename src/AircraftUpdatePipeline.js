import { normalizeAircraft } from './normalizeAircraft.js';
import { PlaneModel } from './PlaneModel.js';
import { StalenessOracle } from './StalenessOracle.js';

export class MapPlaneStore {
    constructor() { this._planes = new Map(); }
    get(hex) { return this._planes.get(hex) ?? null; }
    set(hex, model) { this._planes.set(hex, model); }
}

export class AircraftUpdatePipeline {
    constructor(store, oracle = new StalenessOracle()) {
        this._store = store;
        this._oracle = oracle;
    }

    ingest({ now, aircraft }) {
        const changes = [];
        for (const raw of aircraft) {
            const data = normalizeAircraft(raw);
            const hex = data.hex;
            const isNew = this._store.get(hex) == null;
            const model = isNew ? new PlaneModel(hex) : this._store.get(hex);
            model.updateData(data);
            if (isNew) this._store.set(hex, model);
            const level = this._oracle.evaluate(model, now);
            const changeType = level === 'dead' ? 'dead'
                : level === 'stale' ? 'stale'
                : isNew ? 'new' : 'updated';
            changes.push({ hex, changeType, model });
        }
        return changes;
    }
}
