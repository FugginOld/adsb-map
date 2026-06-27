const FRESH_TIMEOUT = { adsc: 120, ground: 30 };
const FRESH_DEFAULT = 15;

const DEAD_TIMEOUT = { adsc: 2100, ais: 1200 };
const DEAD_DEFAULT = 480;

export class StalenessOracle {
    evaluate(model, now) {
        const seen = model.seen;
        const type = model.type;

        if (seen == null) return 'stale';

        const freshLimit = FRESH_TIMEOUT[type] ?? FRESH_DEFAULT;
        if (seen < freshLimit) return 'fresh';

        const deadLimit = DEAD_TIMEOUT[type] ?? DEAD_DEFAULT;
        if (seen >= deadLimit) return 'dead';

        return 'stale';
    }
}
