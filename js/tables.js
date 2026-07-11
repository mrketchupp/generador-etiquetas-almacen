'use strict';

/**
 * Render de las listas de revisión.
 *
 * Materiales: lista de tarjetas estilo Notion — vista compacta con el
 * nombre y las propiedades como chips, y un editor expandible (✏️) con
 * campos amplios que se guarda o cancela. Los items se identifican por
 * id, así duplicar/eliminar nunca desincroniza los manejadores.
 *
 * Códigos AX: tabla simple (solo 3 campos).
 */
const Tables = (() => {
    const { el, clampInt } = Utils;
    const $ = (id) => document.getElementById(id);

    const CONDICIONES = ['NUEVO', 'USADO NUEVO', 'RESGUARDO'];
    const CATEGORIAS = ['INVENTARIABLE', 'CONSUMIBLES'];

    let editingId = null;

    // ---------- Tarjetas de materiales ----------

    function actionBtn(icon, title, onClick) {
        return el('button', { class: 'icon-action', type: 'button', title, 'aria-label': title, text: icon, onclick: onClick });
    }

    function duplicateItem(list, item, onListChanged) {
        const copy = { ...item, id: Utils.uid() };
        list.splice(list.indexOf(item) + 1, 0, copy);
        onListChanged();
    }

    function deleteItem(list, item, confirmText, onListChanged) {
        if (!confirm(confirmText)) return;
        list.splice(list.indexOf(item), 1);
        if (editingId === item.id) editingId = null;
        onListChanged();
    }

    /** Nombre del logo derecho que usará esta partida. */
    function itemLogoName(item) {
        const logos = Store.state.settings.rightLogos;
        if (item.logoName && logos.some((logo) => logo.name === item.logoName)) return item.logoName;
        return logos.length ? `${logos[0].name} (pred.)` : '—';
    }

    function materialCard(item, onListChanged) {
        const chips = el('div', { class: 'item-chips' });
        const addChip = (text, title) => {
            if (text) chips.append(el('span', { class: 'chip', text, title }));
        };
        addChip(`× ${item.cantidad}`, 'Cantidad');
        addChip(item.codigoAx ? `AX ${item.codigoAx}` : '', 'Código AX');
        addChip(item.dimension, 'Dimensión / Clave almacén');
        addChip(item.noParte ? `NP ${item.noParte}` : '', 'No. Parte');
        addChip(item.descripcion, 'Descripción');
        addChip(item.condicion, 'Condición');
        addChip(item.categoria, 'Categoría');
        if (Store.state.settings.perItemLogo) {
            addChip(`Logo: ${itemLogoName(item)}`, 'Logo derecho');
        }

        const materials = Store.state.materials;
        const actions = el('div', { class: 'item-actions' }, [
            actionBtn('✏️', 'Editar', () => { editingId = item.id; onListChanged(); }),
            actionBtn('📋', 'Duplicar', () => duplicateItem(materials, item, onListChanged)),
            actionBtn('🗑️', 'Eliminar', () => deleteItem(materials, item, '¿Eliminar esta partida?', onListChanged)),
        ]);

        return el('div', { class: 'item-card' }, [
            el('div', { class: 'item-card__body' }, [
                el('div', { class: 'item-card__title', text: item.nombre || '(sin nombre)' }),
                chips,
            ]),
            actions,
        ]);
    }

    function materialEditor(item, onListChanged) {
        const fields = {};

        const inputField = (label, key, type = 'text', full = false) => {
            const input = el('input', { class: 'input', type, value: item[key] ?? '' });
            if (type === 'number') input.min = '1';
            fields[key] = input;
            return el('label', { class: `field${full ? ' field--full' : ''}` }, [
                el('span', { class: 'field__label', text: label }),
                input,
            ]);
        };

        const selectField = (label, key, options) => {
            const select = el('select', { class: 'input' });
            for (const option of options) select.append(el('option', { value: option, text: option }));
            select.value = item[key];
            fields[key] = select;
            return el('label', { class: 'field' }, [
                el('span', { class: 'field__label', text: label }),
                select,
            ]);
        };

        const grid = el('div', { class: 'form-grid' }, [
            inputField('Cantidad', 'cantidad', 'number'),
            inputField('Código AX', 'codigoAx'),
            inputField('Nombre', 'nombre', 'text', true),
            inputField('Dimensión / Clave almacén', 'dimension', 'text', true),
            inputField('No. Parte', 'noParte'),
            inputField('Descripción', 'descripcion'),
            selectField('Condición', 'condicion', CONDICIONES),
            selectField('Categoría', 'categoria', CATEGORIAS),
        ]);

        // Autocompletar nombre al cambiar el código AX (si hay CSV cargado)
        fields.codigoAx.addEventListener('change', () => {
            const nombre = Store.lookupNombre(fields.codigoAx.value);
            if (nombre) fields.nombre.value = nombre;
        });

        // Selector de logo derecho por partida (si la opción está activa)
        if (Store.state.settings.perItemLogo) {
            const logos = Store.state.settings.rightLogos;
            const select = el('select', { class: 'input' });
            select.append(el('option', {
                value: '',
                text: logos.length ? `Predeterminado (${logos[0].name})` : 'Predeterminado (sin logos)',
            }));
            for (const logo of logos) select.append(el('option', { value: logo.name, text: logo.name }));
            select.value = logos.some((logo) => logo.name === item.logoName) ? item.logoName : '';
            fields.logoName = select;
            grid.append(el('label', { class: 'field' }, [
                el('span', { class: 'field__label', text: 'Logo derecho' }),
                select,
            ]));
        }

        const save = () => {
            item.cantidad = clampInt(fields.cantidad.value, 1, 1);
            item.codigoAx = fields.codigoAx.value.trim();
            item.nombre = fields.nombre.value.trim();
            item.dimension = fields.dimension.value.trim();
            item.noParte = fields.noParte.value.trim();
            item.descripcion = fields.descripcion.value.trim();
            item.condicion = fields.condicion.value;
            item.categoria = fields.categoria.value;
            if (fields.logoName) item.logoName = fields.logoName.value;
            editingId = null;
            onListChanged();
        };

        const cancel = () => {
            editingId = null;
            onListChanged();
        };

        const editor = el('div', { class: 'item-editor' }, [
            grid,
            el('div', { class: 'inline-controls' }, [
                el('button', { class: 'btn btn--primary', type: 'button', text: '💾 Guardar', onclick: save }),
                el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: cancel }),
            ]),
        ]);

        editor.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
                event.preventDefault();
                save();
            }
        });

        return editor;
    }

    function renderMaterials(onListChanged) {
        const list = $('materialsList');
        list.replaceChildren();
        for (const item of Store.state.materials) {
            list.append(editingId === item.id ? materialEditor(item, onListChanged) : materialCard(item, onListChanged));
        }
        $('materialsSection').hidden = Store.state.materials.length === 0;
        updateCounters();
    }

    // ---------- Tabla de códigos AX ----------

    function inputCell(value, type, onChange) {
        const input = el('input', { type, value: value ?? '' });
        if (type === 'number') input.min = '1';
        input.addEventListener('change', () => onChange(input));
        return el('td', {}, input);
    }

    function axRow(item, onListChanged) {
        const nombreInput = el('input', { type: 'text', value: item.nombre });
        nombreInput.addEventListener('change', () => {
            item.nombre = nombreInput.value;
            Store.save();
        });

        const row = el('tr', {});
        row.append(
            inputCell(item.cantidad, 'number', (input) => {
                item.cantidad = clampInt(input.value, 1, 1);
                input.value = item.cantidad;
                Store.save();
                updateCounters();
            }),
            inputCell(item.codigoAx, 'text', (input) => {
                item.codigoAx = input.value.trim();
                const nombre = Store.lookupNombre(item.codigoAx);
                if (nombre) {
                    item.nombre = nombre;
                    nombreInput.value = nombre;
                }
                Store.save();
            }),
            el('td', {}, nombreInput),
            el('td', {}, el('button', {
                class: 'btn btn--small btn--blue', type: 'button', text: 'Duplicar',
                onclick: () => duplicateItem(Store.state.axItems, item, onListChanged),
            })),
            el('td', {}, el('button', {
                class: 'btn btn--small btn--danger', type: 'button', text: 'Eliminar',
                onclick: () => deleteItem(Store.state.axItems, item, '¿Eliminar este código?', onListChanged),
            })),
        );
        return row;
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

    // ---------- Contadores ----------

    function counterText(list) {
        const totalLabels = list.reduce((sum, item) => sum + Math.max(1, item.cantidad || 1), 0);
        return `${list.length} partida(s) · ${totalLabels} etiqueta(s)`;
    }

    function updateCounters() {
        $('materialsCount').textContent = counterText(Store.state.materials);
        $('axCount').textContent = counterText(Store.state.axItems);
    }

    return { renderMaterials, renderAx, CONDICIONES, CATEGORIAS };
})();
