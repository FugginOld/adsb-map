export class PlaneRenderer {
    constructor(model, { source, createPoint } = {}) {
        this._model = model;
        this._source = source;
        this._createPoint = createPoint;
        this._feature = { geometry: null };
        source.addFeature(this._feature);
    }

    sync() {
        if (this._model.lat != null && this._model.lon != null) {
            this._feature.geometry = this._createPoint(this._model.lon, this._model.lat);
        }
    }

    remove() {
        this._source.removeFeature(this._feature);
    }
}
