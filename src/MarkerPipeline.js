const TYPE_DESIGNATOR_ICONS = {
    'A318': ['a319', 0.95], 'A319': ['a319', 1], 'A19N': ['a319', 1],
    'A320': ['a320', 1], 'A20N': ['a320', 1],
    'A321': ['a321', 1], 'A21N': ['a321', 1],
    'A306': ['heavy_2e', 0.93], 'A330': ['a332', 0.98], 'A332': ['a332', 0.99],
    'A333': ['a332', 1.00], 'A338': ['a332', 1.00], 'A339': ['a332', 1.01],
    'DC10': ['md11', 0.92], 'MD11': ['md11', 0.96],
    'A359': ['a359', 1.00], 'A35K': ['a359', 1.02],
    'A388': ['a380', 1],
    'B731': ['b737', 0.90], 'B732': ['b737', 0.92], 'B735': ['b737', 0.96],
    'B733': ['b737', 0.98], 'B734': ['b737', 0.98], 'B736': ['b737', 0.96],
    'B737': ['b737', 1.00], 'B738': ['b738', 1.00], 'B739': ['b739', 1.00],
    'B37M': ['b737', 1.02], 'B38M': ['b738', 1.00], 'B39M': ['b739', 1.00],
    'B3XM': ['b739', 1.01],
    'B741': ['heavy_4e', 0.96], 'B742': ['heavy_4e', 0.96], 'B743': ['heavy_4e', 0.96],
    'B744': ['heavy_4e', 0.96], 'B74D': ['heavy_4e', 0.96], 'B74S': ['heavy_4e', 0.96],
    'B748': ['b748', 1.00],
    'B752': ['b757', 0.99], 'B753': ['b757', 1.00], 'B762': ['b767', 0.98],
    'B763': ['b767', 1.00], 'B764': ['b767', 1.01],
    'B772': ['b777', 0.99], 'B77L': ['b777', 1.00], 'B773': ['b777', 1.00],
    'B77W': ['b777', 1.01], 'B778': ['b77x', 1.00], 'B779': ['b77x', 1.01],
    'B788': ['b787', 0.98], 'B789': ['b787', 1.00], 'B78X': ['b787', 1.01],
    'GLID': ['glider', 1], 'S6': ['glider', 1], 'S10S': ['glider', 1],
    'SHIP': ['blimp', 0.94], 'BALL': ['balloon', 1],
};

const CATEGORY_ICONS = {
    'A1': ['cessna', 1],
    'A2': ['jet_swept', 0.94],
    'A3': ['airliner', 0.94],
    'A4': ['heavy_2e', 0.94],
    'A5': ['heavy_4e', 0.94],
    'A6': ['hi_perf', 0.94],
    'A7': ['helicopter', 1],
    'B1': ['glider', 1],
    'B2': ['balloon', 1],
    'B4': ['ground_emitter', 1],
    'B6': ['drone', 1],
    'C1': ['ground_square', 0.5],
    'C2': ['ground_square', 0.5],
    'C3': ['ground_square', 0.5],
};

const COLORS = {
    unselected: { adsb: '#d8f4ff', mlat: '#FDF7DD', uat: '#C4FFDC', adsr: '#C4FFDC', adsc: '#9efa9e', modeS: '#d8d8ff', tisb: '#ffd8e6', unknown: '#dcdcdc', other: '#dcdcdc', ais: '#dcdcdc' },
    selected:   { adsb: '#88DDFF', mlat: '#F1DD83', uat: '#66FFA6', adsr: '#66FFA6', adsc: '#75f075', modeS: '#BEBEFF', tisb: '#FFC1D8', unknown: '#bcbcbc', other: '#bcbcbc', ais: '#bcbcbc' },
};

export class MarkerPipeline {
    select(model, config = {}) {
        const colorTable = config.colors ?? COLORS;
        const palette = model.selected ? colorTable.selected : colorTable.unselected;
        const color = palette[model.type] ?? palette.unknown;
        if (model.icaoType && model.icaoType in TYPE_DESIGNATOR_ICONS) {
            const [shape, scale] = TYPE_DESIGNATOR_ICONS[model.icaoType];
            return { shape, scale, color };
        }
        if (model.category && model.category in CATEGORY_ICONS) {
            const [shape, scale] = CATEGORY_ICONS[model.category];
            return { shape, scale, color };
        }
        return { shape: 'unknown', scale: 1, color };
    }
}
