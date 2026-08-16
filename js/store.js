'use strict';

/**
 * Estado central de la aplicación con persistencia en localStorage.
 * Todo el estado vive bajo una sola clave versionada, lo que facilita
 * migraciones futuras y evita claves sueltas inconsistentes.
 */
const Store = (() => {
    const STORAGE_KEY = 'etiquetas-almacen.v2';

    /** Clave normalizada de un código AX (sin espacios, en mayúsculas). */
    const normCode = (value) => String(value ?? '').trim().toUpperCase();

    // Texto de almacén que traían por defecto las versiones anteriores. Ahora
    // el campo nace vacío (cada almacén escribe el suyo en ⚙️ Configuración),
    // así que ese valor heredado se limpia y queda solo como placeholder.
    const LEGACY_HEADER_TEXT = 'BRONCO RIG-91';

    function normalizeHeaderText(value) {
        const text = String(value ?? '').trim();
        return text === LEGACY_HEADER_TEXT ? '' : text;
    }

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
        // Listas de códigos AX para autocompletar el Nombre. Cada archivo
        // cargado (CSV/Excel) se guarda como una lista independiente que
        // toma el nombre del archivo: [{id, name, codes: {CODIGO: NOMBRE}}].
        codeLists: [],
        // Lista usada al autocompletar. '' = buscar en todas.
        activeCodeListId: '',
        settings: {
            // Vacío a propósito: se personaliza en ⚙️ Configuración.
            headerText: '',
            logoLeft: '',
            // Biblioteca de logos derechos: [{id, src}]. El primero es el
            // predeterminado; cada partida guarda item.logoIndex (0 =
            // predeterminado), lo que también sirve al exportar/importar.
            rightLogos: [],
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

    /** Normaliza un mapa CODIGO → NOMBRE descartando entradas vacías. */
    function normalizeCodes(raw) {
        const codes = {};
        if (!raw || typeof raw !== 'object') return codes;
        for (const [key, value] of Object.entries(raw)) {
            const code = normCode(key);
            const nombre = String(value ?? '').trim();
            if (code && nombre) codes[code] = nombre;
        }
        return codes;
    }

    /**
     * Normaliza las listas guardadas. `legacyMap` es el mapa único de la
     * versión anterior (state.codigosAX), que pasa a ser la primera lista.
     */
    function normalizeCodeLists(rawLists, legacyMap) {
        const lists = [];
        for (const raw of Array.isArray(rawLists) ? rawLists : []) {
            if (!raw || typeof raw !== 'object') continue;
            const codes = normalizeCodes(raw.codes);
            if (Object.keys(codes).length === 0) continue;
            lists.push({
                id: String(raw.id || Utils.uid()),
                name: String(raw.name || '').trim() || 'Lista de códigos',
                codes,
            });
        }
        if (lists.length === 0) {
            const legacy = normalizeCodes(legacyMap);
            if (Object.keys(legacy).length > 0) {
                lists.push({ id: Utils.uid(), name: 'Lista de códigos', codes: legacy });
            }
        }
        return lists;
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return migrateFromV1();
            const parsed = JSON.parse(raw);
            const base = freshState();
            const merged = {
                ...base,
                ...parsed,
                settings: {
                    ...base.settings,
                    ...(parsed.settings || {}),
                    layout: normalizeLayout((parsed.settings || {}).layout),
                    // Migración: el texto de almacén heredado del valor por
                    // defecto anterior se vacía; uno escrito a mano se respeta.
                    headerText: normalizeHeaderText((parsed.settings || {}).headerText),
                },
            };
            // Migración: el mapa único de códigos pasa a ser la primera lista.
            merged.codeLists = normalizeCodeLists(parsed.codeLists, parsed.codigosAX);
            delete merged.codigosAX;
            merged.activeCodeListId = typeof parsed.activeCodeListId === 'string' ? parsed.activeCodeListId : '';
            if (!merged.codeLists.some((list) => list.id === merged.activeCodeListId)) {
                merged.activeCodeListId = '';
            }
            // Migración: el logo derecho único anterior pasa a ser el primer
            // logo (predeterminado) de la biblioteca.
            if (!Array.isArray(merged.settings.rightLogos)) merged.settings.rightLogos = [];
            if (merged.settings.logoRight && merged.settings.rightLogos.length === 0) {
                merged.settings.rightLogos.push({ id: Utils.uid(), src: merged.settings.logoRight });
            }
            delete merged.settings.logoRight;
            delete merged.settings.perItemLogo;
            // Migración: la referencia por nombre (versión anterior) pasa a
            // ser por posición (0 = predeterminado).
            for (const item of merged.materials || []) {
                if (!Number.isInteger(item.logoIndex)) {
                    const idx = item.logoName
                        ? merged.settings.rightLogos.findIndex((logo) => logo.name === item.logoName)
                        : -1;
                    item.logoIndex = idx > 0 ? idx : 0;
                }
                delete item.logoName;
                // Migración: la categoría (lista fija) pasa a ser el área
                // (texto libre); se conserva lo que ya tuviera la partida.
                if (item.area === undefined) item.area = String(item.categoria ?? '').trim();
                delete item.categoria;
            }
            return merged;
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
        if (old('logoRight')) {
            state.settings.rightLogos.push({ id: Utils.uid(), src: old('logoRight') });
        }
        if (old('headerText')) state.settings.headerText = normalizeHeaderText(old('headerText'));
        if (old('geminiApiKey')) state.settings.geminiApiKey = old('geminiApiKey');

        try {
            const csv = old('codigosAX');
            if (csv) state.codeLists = normalizeCodeLists(null, JSON.parse(csv));
        } catch { /* CSV corrupto: se ignora */ }

        // El layout de la versión anterior NO se migra a propósito: sus
        // dimensiones por defecto no cabían físicamente en la hoja (causa de
        // los saltos de página) y los nuevos valores por defecto sí caben.

        return state;
    }

    const state = load();

    // Avisos de guardado: los usa el historial para detectar los cambios
    // sin tener que instrumentar cada sitio que muta el estado.
    const saveListeners = [];

    function onSaved(listener) {
        saveListeners.push(listener);
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error('No se pudo guardar el estado:', error);
            Utils.toast('No se pudo guardar la configuración (¿almacenamiento lleno?)', 'error');
        }
        // Se avisa aunque falle el guardado: el estado en memoria ya cambió.
        for (const listener of saveListeners) listener();
    }

    // ---------- Listas de códigos AX ----------

    // Índice plano de todas las listas para las búsquedas del autocompletado.
    // Se reconstruye solo cuando cambian las listas.
    let entriesCache = null;

    function invalidateCodes() {
        entriesCache = null;
    }

    function allEntries() {
        if (!entriesCache) {
            entriesCache = [];
            for (const list of state.codeLists) {
                for (const [codigo, nombre] of Object.entries(list.codes)) {
                    entriesCache.push({ codigo, nombre, listId: list.id, listName: list.name });
                }
            }
        }
        return entriesCache;
    }

    /**
     * Listas en las que se busca. Con `listId` vacío (o apuntando a una
     * lista borrada) se buscan todas.
     */
    function scopedLists(listId) {
        const id = listId === undefined ? state.activeCodeListId : listId;
        const found = id ? state.codeLists.find((list) => list.id === id) : null;
        return found ? [found] : state.codeLists;
    }

    function codeCount(list) {
        return Object.keys(list.codes).length;
    }

    function totalCodeCount() {
        return state.codeLists.reduce((sum, list) => sum + codeCount(list), 0);
    }

    /**
     * Nombre asociado a un código AX. Busca en la lista activa (o en la
     * indicada por `listId`); sin lista seleccionada busca en todas.
     */
    function lookupNombre(codigo, listId) {
        const key = normCode(codigo);
        if (!key) return null;
        for (const list of scopedLists(listId)) {
            // hasOwnProperty: evita devolver propiedades heredadas de Object.
            if (Object.prototype.hasOwnProperty.call(list.codes, key)) {
                const nombre = list.codes[key];
                if (typeof nombre === 'string' && nombre) return nombre;
            }
        }
        return null;
    }

    /**
     * Sugerencias para el autocompletado. Coincide por código (prioridad a
     * los que empiezan igual) y también por nombre, para poder buscar
     * «BANDA» y quedarse con su código.
     * @returns {Array<{codigo, nombre, listId, listName}>}
     */
    function searchCodigos(query, options = {}) {
        const q = normCode(query);
        if (!q) return [];
        const limit = options.limit || 8;
        const listId = options.listId === undefined ? state.activeCodeListId : options.listId;
        const scope = new Set(scopedLists(listId).map((list) => list.id));

        const matches = [];
        for (const entry of allEntries()) {
            if (!scope.has(entry.listId)) continue;
            let score;
            if (entry.codigo === q) score = 0;
            else if (entry.codigo.startsWith(q)) score = 1;
            else if (entry.codigo.includes(q)) score = 2;
            else if (entry.nombre.toUpperCase().includes(q)) score = 3;
            else continue;
            matches.push({ score, entry });
        }
        matches.sort((a, b) => a.score - b.score || a.entry.codigo.localeCompare(b.entry.codigo));
        return matches.slice(0, limit).map((match) => match.entry);
    }

    /**
     * Añade (o reemplaza, si ya existe una con el mismo nombre) una lista.
     * Volver a cargar el mismo archivo actualiza su contenido.
     */
    function addCodeList(name, codes) {
        const clean = normalizeCodes(codes);
        const listName = String(name || '').trim() || 'Lista de códigos';
        const existing = state.codeLists.find((list) => list.name.toLowerCase() === listName.toLowerCase());
        const list = existing || { id: Utils.uid(), name: listName, codes: {} };
        list.codes = clean;
        if (!existing) state.codeLists.push(list);
        invalidateCodes();
        save();
        return { list, replaced: Boolean(existing), count: codeCount(list) };
    }

    function renameCodeList(id, name) {
        const list = state.codeLists.find((item) => item.id === id);
        if (!list) return null;
        list.name = String(name || '').trim() || list.name;
        invalidateCodes();
        save();
        return list;
    }

    function removeCodeList(id) {
        const index = state.codeLists.findIndex((list) => list.id === id);
        if (index === -1) return false;
        state.codeLists.splice(index, 1);
        if (state.activeCodeListId === id) state.activeCodeListId = '';
        invalidateCodes();
        save();
        return true;
    }

    function clearCodeLists() {
        state.codeLists.length = 0;
        state.activeCodeListId = '';
        invalidateCodes();
        save();
    }

    /** Selecciona la lista usada al autocompletar ('' = todas). */
    function setActiveCodeList(id) {
        state.activeCodeListId = state.codeLists.some((list) => list.id === id) ? id : '';
        save();
        return state.activeCodeListId;
    }

    return {
        state,
        save,
        onSaved,
        lookupNombre,
        searchCodigos,
        addCodeList,
        renameCodeList,
        removeCodeList,
        clearCodeLists,
        setActiveCodeList,
        codeCount,
        totalCodeCount,
        PAGE_SIZES,
        DEFAULT_LAYOUT,
        LAYOUT_PRESETS,
    };
})();
