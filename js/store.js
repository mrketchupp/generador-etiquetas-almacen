'use strict';

/**
 * Estado central de la aplicación con persistencia en localStorage.
 * Todo el estado vive bajo una sola clave versionada, lo que facilita
 * migraciones futuras y evita claves sueltas inconsistentes.
 */
const Store = (() => {
    const STORAGE_KEY = 'etiquetas-almacen.v2';

    const PAGE_SIZES = {
        letter: { label: 'Carta (215.9 × 279.4 mm)', widthMm: 215.9, heightMm: 279.4 },
        a4: { label: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
    };

    // 2 columnas × 6 filas en hoja carta. A diferencia del diseño original
    // (3.75in × 1.67in con margen 0.5in, que NO cabía físicamente y causaba
    // desbordes), estas dimensiones sí entran en el área útil de la hoja.
    const DEFAULT_LAYOUT = {
        pageSize: 'letter',
        marginMm: 10,
        labelWidthMm: 92,
        labelHeightMm: 39,
        gapMm: 4,
        fontSizePx: 10,
    };

    const LAYOUT_PRESETS = [
        { id: 'carta-2x6', label: 'Carta · 2 × 6 (92 × 39 mm) — estándar', layout: { ...DEFAULT_LAYOUT } },
        { id: 'carta-3x8', label: 'Carta · 3 × 8 (60 × 30 mm) — compacta', layout: { pageSize: 'letter', marginMm: 10, labelWidthMm: 60, labelHeightMm: 30, gapMm: 2.5, fontSizePx: 8 } },
        { id: 'carta-1x4', label: 'Carta · 1 × 4 (180 × 58 mm) — grande', layout: { pageSize: 'letter', marginMm: 12.7, labelWidthMm: 180, labelHeightMm: 58, gapMm: 5, fontSizePx: 13 } },
        { id: 'a4-2x6', label: 'A4 · 2 × 6 (93 × 42 mm)', layout: { pageSize: 'a4', marginMm: 10, labelWidthMm: 93, labelHeightMm: 42, gapMm: 3, fontSizePx: 10 } },
    ];

    const DEFAULT_STATE = {
        mode: 'material',
        materials: [],
        axItems: [],
        codigosAX: {},
        settings: {
            headerText: 'BRONCO RIG-91',
            logoLeft: '',
            logoRight: '',
            geminiApiKey: '',
            layout: { ...DEFAULT_LAYOUT },
        },
    };

    function freshState() {
        return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return migrateFromV1();
            const parsed = JSON.parse(raw);
            const base = freshState();
            return {
                ...base,
                ...parsed,
                settings: {
                    ...base.settings,
                    ...(parsed.settings || {}),
                    layout: { ...DEFAULT_LAYOUT, ...((parsed.settings || {}).layout || {}) },
                },
            };
        } catch (error) {
            console.error('No se pudo cargar el estado guardado:', error);
            return freshState();
        }
    }

    /** Migra la configuración de la versión anterior (claves sueltas). */
    function migrateFromV1() {
        const state = freshState();
        const old = (key) => localStorage.getItem(key);

        if (old('logoLeft')) state.settings.logoLeft = old('logoLeft');
        if (old('logoRight')) state.settings.logoRight = old('logoRight');
        if (old('headerText')) state.settings.headerText = old('headerText');
        if (old('geminiApiKey')) state.settings.geminiApiKey = old('geminiApiKey');

        try {
            const csv = old('codigosAX');
            if (csv) state.codigosAX = JSON.parse(csv) || {};
        } catch { /* CSV corrupto: se ignora */ }

        // El layout de la versión anterior NO se migra a propósito: sus
        // dimensiones por defecto no cabían físicamente en la hoja (causa de
        // los saltos de página) y los nuevos valores por defecto sí caben.

        return state;
    }

    const state = load();

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error('No se pudo guardar el estado:', error);
            Utils.toast('No se pudo guardar la configuración (¿almacenamiento lleno?)', 'error');
        }
    }

    /** Busca el nombre asociado a un código AX en la tabla cargada por CSV. */
    function lookupNombre(codigo) {
        const key = String(codigo || '').trim().toUpperCase();
        return state.codigosAX[key] || null;
    }

    return { state, save, lookupNombre, PAGE_SIZES, DEFAULT_LAYOUT, LAYOUT_PRESETS };
})();
