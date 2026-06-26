// -*- mode: javascript; indent-tabs-mode: t; c-basic-offset: 8 -*-
"use strict";

let NBSP='\u00a0';
let NNBSP='\u202f';
let NUMSP='\u2007';
let DEGREES='\u00b0'
let ENDASH='\u2013';
let UP_TRIANGLE='\u25b2'; // U+25B2 BLACK UP-POINTING TRIANGLE
let DOWN_TRIANGLE='\u25bc'; // U+25BC BLACK DOWN-POINTING TRIANGLE
let EM_QUAD = '\u2001';

let TrackDirections = ["North","NE","East","SE","South","SW","West","NW"];
let TrackDirectionArrows = ["\u21e7","\u2b00","\u21e8","\u2b02","\u21e9","\u2b03","\u21e6","\u2b01"];

let UnitLabels = {
    'altitude': { metric: "m", imperial: "ft", nautical: "ft"},
    'speed': { metric: "km/h", imperial: "mph", nautical: "kt" },
    'distance': { metric: "km", imperial: "mi", nautical: "nmi" },
    'verticalRate': { metric: "m/s", imperial: "ft/min", nautical: "ft/min" },
    'distanceShort': { metric: "m", imperial: "ft", nautical: "m" }
};

let aircraftCategories = {
    'A0': 'Unspecified powered aircraft',
    'A1': `Light (< 15${NNBSP}500${NBSP}lb)`,
    'A2': `Small (15${NNBSP}500 to 75${NNBSP}000${NBSP}lb)`,
    'A3': `Large (75${NNBSP}000 to 300${NNBSP}000${NBSP}lb)`,
    'A4': 'High Vortex Large(aircraft such as B-757)',
    'A5': `Heavy (> 300${NNBSP}000${NBSP}lb)`,
    'A6': `High Performance (> 5${NBSP}g acceleration and > 400${NBSP}kt)`,
    'A7': 'Rotorcraft',
    'B0': 'Unspecified unpowered aircraft or UAV or spacecraft',
    'B1': 'Glider/sailplane',
    'B2': 'Lighter-than-Air',
    'B3': 'Parachutist/Skydiver',
    'B4': 'Ultralight/hang-glider/paraglider',
    'B6': 'Unmanned Aerial Vehicle',
    'B7': 'Space/Trans-atmospheric vehicle',
    'C0': 'Unspecified ground installation or vehicle',
    'C1': `Surface Vehicle ${ENDASH} Emergency Vehicle`,
    'C2': `Surface Vehicle ${ENDASH} Service Vehicle`,
    'C3': 'Fixed Ground or Tethered Obstruction'
};

// formatting helpers

function get_category_label(category) {
    if (!category)
        return '';
    let label = aircraftCategories[category];
    if (!label)
        return '';
    return label;
}

function get_unit_label(quantity, systemOfMeasurement) {
	let labels = UnitLabels[quantity];
	if (labels !== undefined && labels[systemOfMeasurement] !== undefined) {
		return labels[systemOfMeasurement];
	}
	return "";
}

// track in degrees (0..359)
function format_track_brief(track, rounded) {
	if (track == null){
		return "n/a";
	}

	return track.toFixed(rounded ? 0 : 1) + DEGREES;
}

// track in degrees (0..359)
function format_track_long(track, rounded) {
	if (track == null){
		return "n/a";
	}

	let trackDir = Math.floor((360 + track % 360 + 22.5) / 45) % 8;
	return  TrackDirections[trackDir] + ":" + NNBSP + track.toFixed(rounded ? 0 : 1) + DEGREES;
}
function format_track_arrow(track) {
	if (track == null){
		return "";
	}

	let trackDir = Math.floor((360 + track % 360 + 22.5) / 45) % 8;
	return  TrackDirectionArrows[trackDir];
}

// alt in feet
function format_altitude_brief(alt, vr, displayUnits, withUnits) {
	let alt_text;

	if (alt == null){
		return NBSP + '?' + NBSP;
	} else if (alt === "ground"){
		return "ground";
	}

	alt_text = Math.round(convert_altitude(alt, displayUnits)).toString();
    if (withUnits)
        alt_text += NNBSP + get_unit_label("altitude", displayUnits);

	// Vertical Rate Triangle
	let verticalRateTriangle = "";
	if (vr > 245){
		verticalRateTriangle = UP_TRIANGLE;
	} else if (vr < -245){
		verticalRateTriangle = DOWN_TRIANGLE;
	} else {
		verticalRateTriangle = ''
	}

	return verticalRateTriangle + alt_text.padStart(5, NUMSP);
}

// alt in feet
function format_altitude_long(alt, vr, displayUnits) {
	let alt_text = "";

	if (alt == null) {
		return "n/a";
	} else if (alt === "ground") {
		return "on ground";
	}

	alt_text = Math.round(convert_altitude(alt, displayUnits)).toString() + NNBSP + get_unit_label("altitude", displayUnits);

	if (vr > 192) {
		return UP_TRIANGLE + NNBSP + alt_text;
	} else if (vr < -192) {
		return DOWN_TRIANGLE + NNBSP + alt_text;
	} else {
		return alt_text;
	}
}

// alt in feet
function format_altitude(alt, displayUnits) {
	let alt_text = "";

	if (alt == null) {
		return "n/a";
	} else if (alt === "ground") {
		return "on ground";
	}

	alt_text = Math.round(convert_altitude(alt, displayUnits)).toString() + NNBSP + get_unit_label("altitude", displayUnits);

    return alt_text;
}


// alt ground/airborne
function format_onground (alt) {
	if (alt == null) {
		return "n/a";
	} else if (alt === "ground") {
		return "on ground";
	} else {
		return "airborne";
	}
}

// alt in feet
function convert_altitude(alt, displayUnits) {
	if (displayUnits === "metric") {
		return alt * 0.3048;  // feet to meters
	}

	return alt;
}

// speed in knots
function format_speed_brief(speed, displayUnits, withUnits) {
	if (speed == null || isNaN(speed)) {
		return "";
	}
    let speed_text = Math.round(convert_speed(speed, displayUnits)).toString();
    if (withUnits)
        speed_text += NNBSP + get_unit_label("speed", displayUnits);

	return speed_text;
}

// speed in knots
function format_speed_long(speed, displayUnits) {
	if (speed == null) {
		return "n/a";
	}

	let speed_text = Math.round(convert_speed(speed, displayUnits)) + NNBSP + get_unit_label("speed", displayUnits);

	return speed_text;
}

// speed in knots
function convert_speed(speed, displayUnits) {
	if (displayUnits === "metric") {
		return speed * 1.852;  // knots to kilometers per hour
	}
	else if (displayUnits === "imperial") {
		return speed * 1.151;  // knots to miles per hour
	}

	return speed;
}

// dist in meters
function format_distance_brief(dist, displayUnits) {
	if (dist == null) {
		return "";
	}

	return convert_distance(dist, displayUnits).toFixed(1);
}

// dist in meters
function format_distance_long(dist, displayUnits, fixed) {
	if (dist == null) {
		return "n/a";
	}

	if (typeof fixed === 'undefined') {
		fixed = 1;
	}

	let dist_text = convert_distance(dist, displayUnits).toFixed(fixed) + NNBSP + get_unit_label("distance", displayUnits);

	return dist_text;
}

function format_distance_short (dist, displayUnits) {
	if (dist == null) {
		return "n/a";
	}

	let dist_text = Math.round(convert_distance_short(dist, displayUnits)) + NNBSP + get_unit_label("distanceShort", displayUnits);

	return dist_text;
}

// dist in meters
function convert_distance(dist, displayUnits) {
	if (displayUnits === "metric") {
		return (dist / 1000); // meters to kilometres
	}
	else if (displayUnits === "imperial") {
		return (dist / 1609); // meters to miles
	}
	return (dist / 1852); // meters to nautical miles
}

// dist in meters
// converts meters to feet or just returns metres
function convert_distance_short(dist, displayUnits) {
	if (displayUnits === "imperial") {
		return (dist / 0.3048); // meters to feet
	}
	return dist; // just meters
}

// rate in ft/min
function format_vert_rate_brief(rate, displayUnits) {
	if (rate == null) {
		return "";
	}

	return convert_vert_rate(rate, displayUnits).toFixed(displayUnits === "metric" ? 1 : 0);
}

// rate in ft/min
function format_vert_rate_long(rate, displayUnits) {
	if (rate == null){
		return "n/a";
	}

	let rate_text = convert_vert_rate(rate, displayUnits).toFixed(displayUnits === "metric" ? 1 : 0) + NNBSP + get_unit_label("verticalRate", displayUnits);

	return rate_text;
}

// rate in ft/min
function convert_vert_rate(rate, displayUnits) {
	if (displayUnits === "metric") {
		return (rate / 196.85); // ft/min to m/s
	}

	return rate;
}

// p is a [lon, lat] coordinate
function format_latlng(p) {
	return p[1].toFixed(3) + DEGREES + "," + NNBSP + p[0].toFixed(3) + DEGREES;
}

function format_data_source(source) {
	switch (source) {
		case 'uat' :
			return "UAT";
		case 'mlat':
			return "MLAT";
		case 'adsb':
		case 'adsb_icao':
		case 'adsb_other':
			return "ADS-B";
		case 'adsb_icao_nt':
			return "ADS-B noTP";
		case 'adsr':
		case 'adsr_icao':
		case 'adsr_other':
			return "ADS-R or UAT";
		case 'tisb_icao':
		case 'tisb_trackfile':
		case 'tisb_other':
		case 'tisb':
			return "TIS-B";
		case 'modeS':
			return "Mode S";
		case 'ais':
			return "AIS";
		case 'mode_ac':
			return "Mode A/C";
        case 'adsc':
            return jaeroLabel;
        case 'other':
            return "Other";
	}

	return "Unknown";
}

function format_nac_p (value) {
	switch (value) {
		case 0:
			return "EPU ≥ 18.5 km";
		case 1:
			return "EPU < 18.5 km";
		case 2:
			return "EPU < 7.4 km";
		case 3:
			return "EPU < 3.7 km";
		case 4:
			return "EPU < 1.8 km";
		case 5:
			return "EPU < 926 m";
		case 6:
			return "EPU < 555 m";
		case 7:
			return "EPU < 185 m";
		case 8:
			return "EPU < 92 m";
		case 9:
			return "EPU < 30 m";
		case 10:
			return "EPU < 10 m";
		case 11:
			return "EPU < 3 m";
		default:
			return "n/a";

	}
}

function format_nac_v (value) {
	switch (value) {
		case 0:
			return "≥ 10 m/s";
		case 1:
			return "< 10 m/s";
		case 2:
			return "< 3 m/s";
		case 3:
			return "< 1 m/s";
		case 4:
			return "< 0.3 m/s";
		default:
			return "n/a";
	}
}

function format_duration(seconds) {
    if (seconds == null)
        return "n/a";
    if (seconds < 20)
        return seconds.toFixed(1) + ' s';
    if (seconds < 5 * 60)
        return seconds.toFixed(0) + ' s';
    if (seconds < 3 * 60 * 60)
        return (seconds/60).toFixed(0) + ' min';
    return (seconds/60/60).toFixed(0) + ' h';

}

function iOSVersion() {
  if (/iP(hone|od|ad)/.test(navigator.platform)) {
    // supports iOS 2.0 and later: <http://bit.ly/TJjs1V>
    var v = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
    return [parseInt(v[1], 10), parseInt(v[2], 10), parseInt(v[3] || 0, 10)];
  }
}

function ItemCache(maxItems) {
    this.maxItems = maxItems;
    this.items = {};
    this.keys = [];
}
ItemCache.prototype.clear = function() {
    this.items = {};
    this.keys = [];
}
ItemCache.prototype.get = function(key) {
    return this.items[key];
}
ItemCache.prototype.add = function(key, value) {

    if (!(key in this.items)) {
        this.keys.push(key);
    }
    this.items[key] = value;

    if (this.maxItems && this.maxItems > 0) {
        while (this.keys.length > this.maxItems) {
            const key = this.keys.shift();
            delete this.items[key];
        }
    }
}

function itemCacheTest() {
    let a = new ItemCache(4);
    a.add(8, 4);
    a.add(5, 2);
    a.add(4, 2);
    a.add(3, 2);
    a.add(1, 2);
    a.add(1, 3);
    a.add(1, 5);
    let items = JSON.stringify(a.items)
    let keys = JSON.stringify(a.keys);
    const expectedItems = '{"1":5,"3":2,"4":2,"5":2}';
    const expectedKeys = '[5,4,3,1]';
    if (items != expectedItems || keys != expectedKeys || g.get(1) != 5) {
        console.error(`ItemCache broken!`);
        console.log(`got:      items: ${items} keys: ${keys}`);
        console.log(`expected: items: ${expectedItems} keys: ${expectedKeys}`);
    } else {
        console.log(`ItemCache tested correctly!`);
    }
}
