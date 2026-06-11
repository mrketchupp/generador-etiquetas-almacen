'use strict';

/**
 * Render de las tablas de revisión. Las filas se identifican por el id
 * del item (no por índice), por lo que duplicar/eliminar no desincroniza
 * los manejadores. Editar una celda solo actualiza el estado (sin
 * re-render completo), así no se pierde el foco al escribir.
 */
const Tables = (() => {
    const { el, clampInt } = Utils;
    const $ = (id) => document.getElementById(id);

    const CONDICIONES = ['NUEVO', 'USADO NUEVO', 'RESGUARDO'];
    const CATEGORIAS = ['INVENTARIABLE', 'CONSUMIBLES'];

    function inputCell(value, type, onChange) {
        const input = el('input', { type, value: value ?? '' });
        if (type === 'number') input.min = '1';
        input.addEventListener('change', () => onChange(input));
        return el('td', {}, input);
    }

    function selectCell(value, options, onChange) {
        const select = el('select', {});
        for (const option of options) {
            select.append(el('option', { value: option, text: option }));
        }
        select.value = value;
        select.addEventListener('change', () => onChange(select.value));
        return el('td', {}, select);
    }

    function actionCells(item, list, confirmText, onListChanged) {
        const duplicate = () => {
            const copy = { ...item, id: Utils.uid() };
            list.splice(list.indexOf(item) + 1, 0, copy);
            onListChanged();
        };
        const remove = () => {
            if (!confirm(confirmText)) return;
            list.splice(list.indexOf(item), 1);
            onListChanged();
        };
        return [
            el('td', {}, el('button', { class: 'btn btn--small btn--blue', type: 'button', text: 'Duplicar', onclick: duplicate })),
            el('td', {}, el('button', { class: 'btn btn--small btn--danger', type: 'button', text: 'Eliminar', onclick: remove })),
        ];
    }

    function cantidadCell(item) {
        return inputCell(item.cantidad, 'number', (input) => {
            item.cantidad = clampInt(input.value, 1, 1);
            input.value = item.cantidad;
            Store.save();
            updateCounters();
        });
    }

    /** Celda de código AX con autocompletado del nombre desde el CSV. */
    function codigoCell(item, nombreInput) {
        return inputCell(item.codigoAx, 'text', (input) => {
            item.codigoAx = input.value.trim();
            const nombre = Store.lookupNombre(item.codigoAx);
            if (nombre) {
                item.nombre = nombre;
                nombreInput.value = nombre;
            }
            Store.save();
        });
    }

    function textCell(item, field) {
        return inputCell(item[field], 'text', (input) => {
            item[field] = input.value;
            Store.save();
        });
    }

    function materialRow(item, onListChanged) {
        const nombreInput = el('input', { type: 'text', value: item.nombre });
        nombreInput.addEventListener('change', () => {
            item.nombre = nombreInput.value;
            Store.save();
        });

        const row = el('tr', {});
        row.append(
            cantidadCell(item),
            codigoCell(item, nombreInput),
            el('td', {}, nombreInput),
            textCell(item, 'dimension'),
            textCell(item, 'noParte'),
            textCell(item, 'descripcion'),
            selectCell(item.condicion, CONDICIONES, (v) => { item.condicion = v; Store.save(); }),
            selectCell(item.categoria, CATEGORIAS, (v) => { item.categoria = v; Store.save(); }),
            ...actionCells(item, Store.state.materials, '¿Eliminar esta partida?', onListChanged),
        );
        return row;
    }

    function axRow(item, onListChanged) {
        const nombreInput = el('input', { type: 'text', value: item.nombre });
        nombreInput.addEventListener('change', () => {
            item.nombre = nombreInput.value;
            Store.save();
        });

        const row = el('tr', {});
        row.append(
            cantidadCell(item),
            codigoCell(item, nombreInput),
            el('td', {}, nombreInput),
            ...actionCells(item, Store.state.axItems, '¿Eliminar este código?', onListChanged),
        );
        return row;
    }

    function counterText(list) {
        const totalLabels = list.reduce((sum, item) => sum + Math.max(1, item.cantidad || 1), 0);
        return `${list.length} partida(s) · ${totalLabels} etiqueta(s)`;
    }

    function updateCounters() {
        $('materialsCount').textContent = counterText(Store.state.materials);
        $('axCount').textContent = counterText(Store.state.axItems);
    }

    function renderMaterials(onListChanged) {
        const tbody = $('materialsTbody');
        tbody.replaceChildren();
        for (const item of Store.state.materials) {
            tbody.append(materialRow(item, onListChanged));
        }
        $('materialsSection').hidden = Store.state.materials.length === 0;
        updateCounters();
    }

    function renderAx(onListChanged) {
        const tbody = $('axTbody');
        tbody.replaceChildren();
        for (const item of Store.state.axItems) {
            tbody.append(axRow(item, onListChanged));
        }
        $('axSection').hidden = Store.state.axItems.length === 0;
        updateCounters();
    }

    return { renderMaterials, renderAx, CONDICIONES, CATEGORIAS };
})();
