// IIFE entry point — assigns src/ modules to window for use by non-module scripts.
// When script.js is eventually converted to ESM, replace these window assignments
// with direct imports from the individual modules.
import { normalizeAircraft } from './normalizeAircraft.js';
import { PlaneModel } from './PlaneModel.js';
import { PlaneRenderer } from './PlaneRenderer.js';

// OL-aware createPoint factory — kept here so PlaneRenderer itself stays OL-free
function olCreatePoint(lon, lat) {
    return new ol.geom.Point(ol.proj.fromLonLat([lon, lat]));
}

window.normalizeAircraft = normalizeAircraft;
window.PlaneModel = PlaneModel;
window.PlaneRenderer = PlaneRenderer;
window.olCreatePoint = olCreatePoint;
