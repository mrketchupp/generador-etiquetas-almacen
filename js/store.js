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
        marginTopMm: 10,
        marginLeftMm: 10,
        labelWidthMm: 92,
        labelHeightMm: 39,
        gapXMm: 4,
        gapYMm: 4,
        fontSizePx: 10,
        showBorder: true,
    };

    const LAYOUT_PRESETS = [
        { id: 'carta-2x6', label: 'Carta · 2 × 6 (92 × 39 mm) — estándar', layout: { ...DEFAULT_LAYOUT } },
        {
            // Hojas precortadas J-5163 / Avery 5163: etiqueta de 4 × 2 in,
            // margen superior 0.5 in, lateral 5/32 in, separación horizontal
            // 3/16 in y vertical 0. Sin borde para no marcar el precorte.
            id: 'carta-2x5-j5163',
            label: 'Carta · 2 × 5 precortada (102 × 51 mm, J-5163 / Avery 5163)',
            layout: { pageSize: 'letter', marginTopMm: 12.7, marginLeftMm: 3.97, labelWidthMm: 101.6, labelHeightMm: 50.8, gapXMm: 4.76, gapYMm: 0, fontSizePx: 11, showBorder: false },
        },
        { id: 'carta-3x8', label: 'Carta · 3 × 8 (60 × 30 mm) — compacta', layout: { pageSize: 'letter', marginTopMm: 10, marginLeftMm: 10, labelWidthMm: 60, labelHeightMm: 30, gapXMm: 2.5, gapYMm: 2.5, fontSizePx: 8, showBorder: true } },
        { id: 'carta-1x4', label: 'Carta · 1 × 4 (180 × 58 mm) — grande', layout: { pageSize: 'letter', marginTopMm: 12.7, marginLeftMm: 12.7, labelWidthMm: 180, labelHeightMm: 58, gapXMm: 5, gapYMm: 5, fontSizePx: 13, showBorder: true } },
        { id: 'a4-2x6', label: 'A4 · 2 × 6 (93 × 42 mm)', layout: { pageSize: 'a4', marginTopMm: 10, marginLeftMm: 10, labelWidthMm: 93, labelHeightMm: 42, gapXMm: 3, gapYMm: 3, fontSizePx: 10, showBorder: true } },
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
            geminiModel: '',
            layout: { ...DEFAULT_LAYOUT },
        },
    };

    function freshState() {
        return JSON.parse(JSON.stringify(DEFAULT_STATE));
    }

    /**
     * Normaliza un layout guardado al modelo actual. Acepta el modelo
     * anterior con margen y separación uniformes (marginMm / gapMm) y lo
     * convierte a los campos por eje.
     */
    function normalizeLayout(raw) {
        const layout = { ...DEFAULT_LAYOUT };
        if (!raw || typeof raw !== 'object') return layout;
        if (typeof raw.marginMm === 'number') {
            layout.marginTopMm = raw.marginMm;
            layout.marginLeftMm = raw.marginMm;
        }
        if (typeof raw.gapMm === 'number') {
            layout.gapXMm = raw.gapMm;
            layout.gapYMm = raw.gapMm;
        }
        for (const key of Object.keys(DEFAULT_LAYOUT)) {
            if (raw[key] !== undefined) layout[key] = raw[key];
        }
        return layout;
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
                    layout: normalizeLayout((parsed.settings || {}).layout),
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
