import { normalizeAircraft } from './normalizeAircraft.js';
import { PlaneModel } from './PlaneModel.js';

export class MapPlaneStore {
    constructor() { this._planes = new Map(); }
    get(hex) { return this._planes.get(hex) ?? null; }
    set(hex, model) { this._planes.set(hex, model); }
}

export class AircraftUpdatePipeline {
    constructor(store) {
        this._store = store;
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
            const lastMessageTime = data.seen != null ? now - data.seen : null;
            const stale = model.isStale(now, lastMessageTime);
            const changeType = stale ? 'stale' : isNew ? 'new' : 'updated';
            changes.push({ hex, changeType, model });
        }
        return changes;
    }
}
