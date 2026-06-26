import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(import.meta.dirname, 'src/browser.js'),
            formats: ['iife'],
            name: '_adsbBundle',
            fileName: () => 'adsb-bundle.js',
        },
        outDir: 'html',
        emptyOutDir: false,
    },
    test: {
        environment: 'node',
    },
});
