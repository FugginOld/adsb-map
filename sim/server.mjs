/**
 * ADS-B simulation server.
 *
 * Serves html/ as the web root and provides virtual endpoints that return
 * animated aircraft positions so the map runs without a real receiver.
 *
 * Usage:
 *   node sim/server.mjs          # default port 8080
 *   PORT=3000 node sim/server.mjs
 */

import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, extname, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const HTML_DIR = resolve(ROOT, 'html');
const PORT = parseInt(process.env.PORT ?? '8080');

// Base aircraft positions — loaded once, animated per-request.
const baseAircraft = JSON.parse(
    readFileSync(resolve(__dirname, 'sample-aircraft.json'), 'utf8')
);
const startTime = Date.now() / 1000;

// Static receiver config — tells the app: plain JSON, no globe tiles, no history.
const RECEIVER_JSON = JSON.stringify({
    version: 'adsb-map-sim',
    refresh: 1000,
    history: 0,
    binCraft: false,
    zstd: false,
    reapi: false,
    lat: 27.9506,
    lon: -82.4572,
});

const MIME = {
    '.html':  'text/html; charset=utf-8',
    '.js':    'application/javascript',
    '.mjs':   'application/javascript',
    '.css':   'text/css',
    '.json':  'application/json',
    '.png':   'image/png',
    '.jpg':   'image/jpeg',
    '.jpeg':  'image/jpeg',
    '.svg':   'image/svg+xml',
    '.ico':   'image/x-icon',
    '.wasm':  'application/wasm',
    '.gz':    'application/gzip',
    '.zst':   'application/octet-stream',
    '.ttf':   'font/ttf',
    '.woff':  'font/woff',
    '.woff2': 'font/woff2',
};

/**
 * Dead-reckoning: advance each aircraft's lat/lon based on its ground speed
 * and track heading over `elapsedSeconds` since the server started.
 *
 * 1 knot = 1 nm/h; 1° lat = 60 nm; 1° lon = 60 nm × cos(lat).
 */
function animateAircraft(elapsedSeconds) {
    return baseAircraft.map(ac => {
        const elapsedHours = elapsedSeconds / 3600;
        const distNm = ac.gs * elapsedHours;
        const trackRad = (ac.track * Math.PI) / 180;
        const latRad = (ac.lat * Math.PI) / 180;

        const deltaLat = (distNm / 60) * Math.cos(trackRad);
        const deltaLon = (distNm / (60 * Math.cos(latRad))) * Math.sin(trackRad);

        const newLat = ac.lat + deltaLat;
        // Wrap longitude into [-180, 180]
        const newLon = ((ac.lon + deltaLon + 180) % 360 + 360) % 360 - 180;

        return {
            ...ac,
            lat: Math.round(newLat * 1e5) / 1e5,
            lon: Math.round(newLon * 1e5) / 1e5,
            seen: 0.3,
            seen_pos: 0.3,
        };
    });
}

function serveStatic(pathname, res) {
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    const fullPath = resolve(join(HTML_DIR, rel));

    // Path traversal guard
    const relCheck = relative(HTML_DIR, fullPath);
    if (relCheck.startsWith('..') || isAbsolute(relCheck)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    if (!existsSync(fullPath)) {
        console.log(`  404  ${pathname}`);
        res.writeHead(404);
        res.end('Not Found');
        return;
    }

    try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
            const index = join(fullPath, 'index.html');
            if (existsSync(index)) {
                const body = readFileSync(index);
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(body);
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
            return;
        }

        const ext = extname(fullPath).toLowerCase();
        const body = readFileSync(fullPath);
        res.writeHead(200, {
            'Content-Type': MIME[ext] ?? 'application/octet-stream',
            'Content-Length': body.length,
        });
        res.end(body);
    } catch {
        res.writeHead(500);
        res.end('Server Error');
    }
}

const server = createServer((req, res) => {
    const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
    const now = Date.now() / 1000;

    res.setHeader('Access-Control-Allow-Origin', '*');

    switch (pathname) {
        case '/data/aircraft.json':
            // Polled every second — suppress from log to avoid noise
        {
            const body = JSON.stringify({
                now,
                messages: Math.floor(50000 + (now - startTime) * 5),
                aircraft: animateAircraft(now - startTime),
            });
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            });
            res.end(body);
            return;
        }

        case '/data/receiver.json':
            console.log('  200  /data/receiver.json');
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
            });
            res.end(RECEIVER_JSON);
            return;

        case '/upintheair.json':
            // Return 404 — no outline data in sim. The .always() handler in early.js
            // still fires on failure, resolving configureReceiver. A 200 with {} would
            // set calcOutlineData = {} (truthy), causing drawUpintheair() to crash on
            // data.rings.length and silently kill the Promise chain.
            console.log('  404  /upintheair.json (expected — no outline data in sim)');
            res.writeHead(404);
            res.end('Not Found');
            return;

        default:
            serveStatic(pathname, res);
    }
});

server.listen(PORT, () => {
    console.log(`\nADS-B sim server  →  http://localhost:${PORT}`);
    console.log(`Simulating ${baseAircraft.length} aircraft over Tampa, FL`);
    console.log('Aircraft positions animate in real-time (dead-reckoning).\n');
    console.log('Press Ctrl+C to stop.\n');
});
