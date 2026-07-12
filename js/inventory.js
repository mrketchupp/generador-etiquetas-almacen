'use strict';

/**
 * Inventario cargado desde Excel. Vive SOLO en memoria: al recargar la
 * página hay que volver a cargar el archivo, pero las partidas que se
 * añadieron a la lista de revisión sí persisten (como el resto).
 *
 * Mapeo Excel → etiqueta:
 *   CANTIDAD → Cantidad · CODIGO AX → Código AX ·
 *   DESCRIPCION → Nombre (con prioridad al autocompletado del CSV de códigos) ·
 *   DIMENSION → Dimensión/Clave almacén · NP → No. Parte · Descripción → vacío.
 * La categoría (INVENTARIABLE/CONSUMIBLES) se deduce del nombre de la hoja.
 */
const Inventory = (() => {
    const { el, toast, clampInt } = Utils;
    const $ = (id) => document.getElementById(id);

    let sheets = [];       // [{name, categoria, items: [...]}]
    let currentSheet = 0;
    let selected = new Set();
    let query = '';
    let onAdd = null;

    const norm = (value) => String(value ?? '').trim().toUpperCase();

    /** Detecta la fila de encabezados y mapea las columnas relevantes. */
    function parseSheet(sheet) {
        let headerIdx = -1;
        let cols = null;
        for (let i = 0; i < Math.min(sheet.rows.length, 10); i++) {
            const cells = sheet.rows[i].map(norm);
            const find = (...names) => cells.findIndex((c) => names.includes(c));
            const candidate = {
                codigo: find('CODIGO AX', 'CÓDIGO AX', 'CODIGO', 'CÓDIGO'),
                descripcion: find('DESCRIPCION', 'DESCRIPCIÓN', 'DESCRIPCION DEL MATERIAL'),
                dimension: find('DIMENSION', 'DIMENSIÓN', 'CLAVE ALMACEN', 'CLAVE ALMACÉN'),
                np: find('NP', 'NO. PARTE', 'NO PARTE'),
                cantidad: find('CANTIDAD', 'CANT', 'CANT.'),
            };
            if (candidate.codigo !== -1 && candidate.descripcion !== -1 && candidate.cantidad !== -1) {
                headerIdx = i;
                cols = candidate;
                break;
            }
        }
        if (headerIdx === -1) return null;

        const categoria = norm(sheet.name).includes('CONSUMIBLE') ? 'CONSUMIBLES' : 'INVENTARIABLE';
        const items = [];
        for (const row of sheet.rows.slice(headerIdx + 1)) {
            const get = (idx) => (idx === -1 ? '' : String(row[idx] ?? '').trim());
            const codigoAx = get(cols.codigo);
            const descripcion = get(cols.descripcion);
            if (!codigoAx && !descripcion) continue;
            items.push({
                id: Utils.uid(),
                codigoAx,
                descripcion,
                dimension: get(cols.dimension),
                np: get(cols.np),
                cantidad: clampInt(get(cols.cantidad), 1, 1),
            });
        }
        return { name: sheet.name, categoria, items };
    }

    async function handleFile(file) {
        const status = $('invStatus');
        status.hidden = false;
        status.className = 'status status--info';
        status.textContent = 'Leyendo archivo…';
        try {
            const raw = await Xlsx.read(file);
            sheets = raw.map(parseSheet).filter((s) => s && s.items.length > 0);
            if (!sheets.length) {
                throw new Error('No se encontraron hojas con columnas CODIGO AX, DESCRIPCION y CANTIDAD');
            }
            currentSheet = 0;
            selected.clear();
            query = '';
            $('invSearch').value = '';
            fillSheetSelect();
            renderList();
            $('invUi').hidden = false;
            const total = sheets.reduce((sum, s) => sum + s.items.length, 0);
            status.className = 'status status--success';
            status.textContent = `✅ ${total} artículos en ${sheets.length} hoja(s). Marca los que necesites y añádelos a la lista.`;
        } catch (error) {
            console.error('Error al leer el inventario:', error);
            sheets = [];
            $('invUi').hidden = true;
            status.className = 'status status--error';
            status.textContent = `❌ ${error.message}. Compara tu archivo con el ejemplo de la guía de abajo.`;
            const help = $('invHelp');
            if (help) help.open = true;
        }
    }

    function fillSheetSelect() {
        const select = $('invSheet');
        select.replaceChildren();
        sheets.forEach((sheet, i) => {
            select.append(el('option', { value: String(i), text: `${sheet.name} (${sheet.items.length})` }));
        });
        select.value = '0';
    }

    function visibleItems() {
        const sheet = sheets[currentSheet];
        if (!sheet) return [];
        if (!query) return sheet.items;
        const q = query.toUpperCase();
        return sheet.items.filter((item) =>
            [item.codigoAx, item.descripcion, item.dimension, item.np].some((v) => v.toUpperCase().includes(q)));
    }

    function renderList() {
        const list = $('invList');
        list.replaceChildren();
        const items = visibleItems();
        if (!items.length) {
            list.append(el('p', { class: 'hint', style: 'padding: 12px;', text: 'Sin resultados en esta hoja.' }));
        }
        for (const item of items) {
            const checkbox = el('input', { type: 'checkbox' });
            checkbox.checked = selected.has(item.id);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) selected.add(item.id);
                else selected.delete(item.id);
                updateToolbar();
            });
            list.append(el('label', { class: 'inv-row' }, [
                checkbox,
                el('span', { class: 'inv-row__code', text: item.codigoAx || '—' }),
                el('span', { class: 'inv-row__desc', text: item.descripcion }),
                el('span', { class: 'inv-row__dim', text: [item.dimension, item.np && `NP ${item.np}`].filter(Boolean).join(' · ') }),
                el('span', { class: 'chip', text: `× ${item.cantidad}` }),
            ]));
        }
        updateToolbar();
    }

    function updateToolbar() {
        const btn = $('invAdd');
        btn.textContent = `➕ Añadir seleccionadas (${selected.size})`;
        btn.disabled = selected.size === 0;
        const items = visibleItems();
        $('invSelectAll').checked = items.length > 0 && items.every((item) => selected.has(item.id));
    }

    function addSelected() {
        const byId = new Map();
        for (const sheet of sheets) {
            for (const item of sheet.items) byId.set(item.id, { item, categoria: sheet.categoria });
        }
        let added = 0;
        for (const id of selected) {
            const found = byId.get(id);
            if (!found) continue;
            const { item, categoria } = found;
            Store.state.materials.push({
                id: Utils.uid(),
                cantidad: item.cantidad,
                codigoAx: item.codigoAx,
                // Prioridad al nombre del CSV de códigos; si no hay, la DESCRIPCION del Excel.
                nombre: Store.lookupNombre(item.codigoAx) || item.descripcion,
                dimension: item.dimension,
                noParte: item.np,
                descripcion: '',
                condicion: 'NUEVO',
                categoria,
                logoIndex: 0,
            });
            added++;
        }
        selected.clear();
        renderList();
        if (onAdd) onAdd();
        toast(`${added} partida(s) añadidas a la lista de revisión`, 'success');
    }

    function init(callbacks) {
        onAdd = callbacks.onAdd;

        $('invFile').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) handleFile(file);
        });
        $('invSheet').addEventListener('change', () => {
            currentSheet = parseInt($('invSheet').value, 10) || 0;
            renderList();
        });
        $('invSearch').addEventListener('input', () => {
            query = $('invSearch').value.trim();
            renderList();
        });
        $('invSelectAll').addEventListener('change', () => {
            const items = visibleItems();
            const allSelected = items.every((item) => selected.has(item.id));
            for (const item of items) {
                if (allSelected) selected.delete(item.id);
                else selected.add(item.id);
            }
            renderList();
        });
        $('invAdd').addEventListener('click', addSelected);
        $('invClear').addEventListener('click', () => {
            sheets = [];
            selected.clear();
            $('invFile').value = '';
            $('invUi').hidden = true;
            $('invStatus').hidden = true;
        });
    }

    return { init };
})();
