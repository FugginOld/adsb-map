// [hex, alt_baro, gs, track, lat, lon, seen, type, flight]
//   0      1       2     3    4    5     6     7      8
export function normalizeAircraft(ac) {
    if (!Array.isArray(ac)) return ac;
    return {
        hex:      ac[0],
        alt_baro: ac[1],
        gs:       ac[2],
        track:    ac[3],
        lat:      ac[4],
        lon:      ac[5],
        seen:     ac[6],
        seen_pos: ac[6],
        type:     ac[7],
        flight:   ac[8],
    };
}
