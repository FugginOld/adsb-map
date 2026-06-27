// IIFE entry point — assigns src/ modules to window for use by non-module scripts.
// When script.js is eventually converted to ESM, replace these window assignments
// with direct imports from the individual modules.
import { normalizeAircraft } from './normalizeAircraft.js';

window.normalizeAircraft = normalizeAircraft;
