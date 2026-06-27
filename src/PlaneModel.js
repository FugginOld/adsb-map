export class PlaneModel {
    constructor(hex) {
        this.hex = hex;
        this.selected = false;
        this.setNull();
    }

    // Stale timeouts mirror planeObject.js: ADS-B/MLAT 15s, ground 30s, ADS-C 120s
    static staleTimeout(type) {
        if (type === 'adsc') return 120;
        if (type === 'ground') return 30;
        return 15;
    }

    isStale(now, lastMessageTime) {
        if (lastMessageTime == null) return true;
        const elapsed = now - lastMessageTime;
        return elapsed > PlaneModel.staleTimeout(this.type);
    }

    // Resets volatile fields between flight legs without destroying the object
    setNull() {
        this.lat      = null;
        this.lon      = null;
        this.alt_baro = null;
        this.gs       = null;
        this.track    = null;
        this.flight   = null;
        this.squawk   = null;
        this.seen     = null;
        this.seen_pos = null;
        this.type     = null;
        this.visible  = true;
    }

    updateData(data) {
        if (data.lat != null && data.lon != null) {
            this.lat = data.lat;
            this.lon = data.lon;
        }
        if (data.alt_baro !== undefined) this.alt_baro = data.alt_baro;
        if (data.gs        !== undefined) this.gs       = data.gs;
        if (data.track     !== undefined) this.track    = data.track;
        if (data.flight    !== undefined) this.flight   = data.flight;
        if (data.squawk    !== undefined) this.squawk   = data.squawk;
        if (data.type      !== undefined) this.type     = data.type;
        if (data.seen      !== undefined) this.seen     = data.seen;
        if (data.seen_pos  !== undefined) this.seen_pos = data.seen_pos;
    }
}
