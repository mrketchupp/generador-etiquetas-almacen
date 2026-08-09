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

    // Duración del cierre del editor; debe coincidir con la animación CSS.
    const EDITOR_CLOSE_MS = 150;

    let editingId = null;
    // Solo se anima al abrir de verdad, no en cada redibujado de la lista.
    let editorJustOpened = false;

    const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    /** Logo derecho efectivo de la partida (posición en la biblioteca). */
    function itemLogo(item) {
        const logos = Store.state.settings.rightLogos;
        if (!logos.length) return null;
        const idx = Number.isInteger(item.logoIndex) && logos[item.logoIndex] ? item.logoIndex : 0;
        return { ...logos[idx], isDefault: idx === 0 };
    }

    function materialCard(item, onListChanged) {
        const chips = el('div', { class: 'item-chips' });
        const addChip = (text, title) => {
            if (text) chips.append(el('span', { class: 'chip', text, title }));
        };
        addChip(item.codigoAx ? `AX ${item.codigoAx}` : '', 'Código AX');
        addChip(item.noParte ? `NP ${item.noParte}` : '', 'No. Parte');
        addChip(item.descripcion, 'Descripción');
        addChip(item.condicion, 'Condición');
        addChip(item.categoria, 'Categoría');
        const logo = itemLogo(item);
        if (logo) {
            chips.append(el('span', {
                class: 'chip chip--logo',
                title: logo.isDefault ? 'Logo derecho (predeterminado)' : 'Logo derecho',
            }, el('img', { src: logo.src, alt: 'Logo derecho' })));
        }

        // Nombre + dimensión siempre juntos: con varias partidas del mismo
        // material (BANDA, BANDA…) la dimensión es lo que las distingue.
        const title = el('div', { class: 'item-card__title' }, [
            el('span', { text: item.nombre || '(sin nombre)' }),
            item.dimension ? el('span', { class: 'dim-badge', text: item.dimension, title: 'Dimensión / Clave almacén' }) : null,
        ]);

        const materials = Store.state.materials;
        const actions = el('div', { class: 'item-actions' }, [
            actionBtn('✏️', 'Editar', () => {
                editingId = item.id;
                editorJustOpened = true;
                onListChanged();
            }),
            actionBtn('📋', 'Duplicar', () => duplicateItem(materials, item, onListChanged)),
            actionBtn('🗑️', 'Eliminar', () => deleteItem(materials, item, '¿Eliminar esta partida?', onListChanged)),
        ]);

        return el('div', { class: 'item-card' }, [
            el('div', { class: 'qty-badge', title: 'Cantidad de etiquetas', text: `×${item.cantidad}` }),
            el('div', { class: 'item-card__body' }, [title, chips]),
            actions,
        ]);
    }

    /**
     * Cierra el editor plegándolo antes de volver a dibujar la lista, en
     * vez de sustituirlo de golpe por la tarjeta.
     */
    function collapseEditor(editor, onListChanged) {
        editingId = null;
        if (reduceMotion() || !editor.isConnected) {
            onListChanged();
            return;
        }
        editor.classList.remove('item-editor--opening');
        editor.classList.add('item-editor--closing');
        setTimeout(onListChanged, EDITOR_CLOSE_MS);
    }

    /**
     * Tras abrirse, acerca el editor si quedó fuera de la vista. Cuando no
     * cabe entero (móvil), se alinea su cabecera justo bajo la barra
     * superior: así se ve siempre qué partida se está editando.
     */
    function revealEditor(editor) {
        // El foco entra en el editor en cuanto aparece (sin abrir el teclado
        // del móvil). Se hace ya, no al terminar la animación, para no
        // quitárselo a quien empiece a escribir de inmediato.
        const active = document.activeElement;
        if (!active || active === document.body) editor.focus({ preventScroll: true });

        const settle = () => {
            const header = document.querySelector('.app-header');
            const margin = 12;
            const top = (header ? header.getBoundingClientRect().height : 0) + margin;
            const bottom = window.innerHeight - margin;
            const rect = editor.getBoundingClientRect();

            let delta = 0;
            if (rect.top < top || rect.height > bottom - top) delta = rect.top - top;
            else if (rect.bottom > bottom) delta = rect.bottom - bottom;
            if (delta !== 0) window.scrollBy({ top: delta, behavior: reduceMotion() ? 'auto' : 'smooth' });
        };
        if (reduceMotion()) settle();
        else editor.addEventListener('animationend', settle, { once: true });
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

        // Cabecera: la partida no «desaparece» al editarla. Sigue a la
        // vista quién es (cantidad, nombre y dimensión) y se actualiza
        // mientras se escribe, así el editor se siente parte de la ficha.
        const qtyBadge = el('div', { class: 'qty-badge', title: 'Cantidad de etiquetas', text: `×${item.cantidad}` });
        const titleText = el('span', { text: item.nombre || '(sin nombre)' });
        const dimBadge = el('span', { class: 'dim-badge', title: 'Dimensión / Clave almacén', text: item.dimension || '' });
        dimBadge.hidden = !item.dimension;

        const head = el('div', { class: 'item-editor__head' }, [
            qtyBadge,
            el('div', { class: 'item-card__title' }, [titleText, dimBadge]),
            el('span', { class: 'item-editor__tag', text: '✏️ Editando' }),
        ]);

        const syncHead = () => {
            titleText.textContent = fields.nombre.value.trim() || '(sin nombre)';
            dimBadge.textContent = fields.dimension.value.trim();
            dimBadge.hidden = !dimBadge.textContent;
            qtyBadge.textContent = `×${clampInt(fields.cantidad.value, 1, 1)}`;
        };
        for (const key of ['nombre', 'dimension', 'cantidad']) {
            fields[key].addEventListener('input', syncHead);
        }

        // Autocompletar el nombre al escribir el código AX. Al editar una
        // partida el nombre guardado sí se actualiza si cambia el código.
        Autocomplete.attach(fields.codigoAx, fields.nombre, { replaceExisting: true, onFill: syncHead });

        // Selector visual de logo derecho (miniaturas, sin nombres)
        const logos = Store.state.settings.rightLogos;
        let chosenLogo = Number.isInteger(item.logoIndex) && logos[item.logoIndex] ? item.logoIndex : 0;
        if (logos.length > 0) {
            const picker = el('div', { class: 'logo-picker' });
            logos.forEach((logo, idx) => {
                const option = el('button', {
                    type: 'button',
                    class: `logo-option${idx === chosenLogo ? ' logo-option--selected' : ''}`,
                    title: idx === 0 ? 'Logo predeterminado' : 'Logo alternativo',
                }, el('img', { src: logo.src, alt: idx === 0 ? 'Logo predeterminado' : 'Logo alternativo' }));
                option.addEventListener('click', () => {
                    chosenLogo = idx;
                    picker.querySelectorAll('.logo-option').forEach((btn, i) => {
                        btn.classList.toggle('logo-option--selected', i === idx);
                    });
                });
                picker.append(option);
            });
            grid.append(el('div', { class: 'field field--full' }, [
                el('span', { class: 'field__label', text: 'Logo derecho' }),
                picker,
            ]));
        }

        // `editor` se usa dentro de los manejadores; se declara antes de
        // crearlo para que lo vean al ejecutarse.
        let editor;

        const save = () => {
            item.cantidad = clampInt(fields.cantidad.value, 1, 1);
            item.codigoAx = fields.codigoAx.value.trim();
            item.nombre = fields.nombre.value.trim();
            item.dimension = fields.dimension.value.trim();
            item.noParte = fields.noParte.value.trim();
            item.descripcion = fields.descripcion.value.trim();
            item.condicion = fields.condicion.value;
            item.categoria = fields.categoria.value;
            item.logoIndex = chosenLogo;
            // Se guarda ya: el plegado es solo visual y no debe retrasar
            // la persistencia de lo editado.
            Store.save();
            collapseEditor(editor, onListChanged);
        };

        const cancel = () => collapseEditor(editor, onListChanged);

        editor = el('div', { class: 'item-editor', tabindex: '-1' },
            el('div', { class: 'item-editor__clip' }, [
                el('div', { class: 'item-editor__inner' }, [
                    head,
                    grid,
                    el('div', { class: 'inline-controls' }, [
                        el('button', { class: 'btn btn--primary', type: 'button', text: '💾 Guardar', onclick: save }),
                        el('button', { class: 'btn', type: 'button', text: 'Cancelar', onclick: cancel }),
                    ]),
                ]),
            ]));

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
        let opened = null;
        for (const item of Store.state.materials) {
            if (editingId !== item.id) {
                list.append(materialCard(item, onListChanged));
                continue;
            }
            const editor = materialEditor(item, onListChanged);
            if (editorJustOpened) {
                editor.classList.add('item-editor--opening');
                opened = editor;
            }
            list.append(editor);
        }
        editorJustOpened = false;
        if (opened) revealEditor(opened);
        $('materialsSection').hidden = Store.state.materials.length === 0;
        updateCounters();
    }

    /** Cierra el editor abierto sin animación (al deshacer/rehacer). */
    function closeEditor() {
        editingId = null;
        editorJustOpened = false;
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
        const codigoInput = el('input', { type: 'text', value: item.codigoAx });

        // El autocompletado puede escribir en ambos campos a la vez, así que
        // los dos se vuelcan juntos a la partida.
        const sync = () => {
            item.codigoAx = codigoInput.value.trim();
            item.nombre = nombreInput.value.trim();
            Store.save();
        };
        nombreInput.addEventListener('change', sync);
        codigoInput.addEventListener('change', sync);
        Autocomplete.attach(codigoInput, nombreInput, { onFill: sync, replaceExisting: true });

        const row = el('tr', {});
        row.append(
            inputCell(item.cantidad, 'number', (input) => {
                item.cantidad = clampInt(input.value, 1, 1);
                input.value = item.cantidad;
                Store.save();
                updateCounters();
            }),
            el('td', {}, codigoInput),
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

    return { renderMaterials, renderAx, closeEditor, CONDICIONES, CATEGORIAS };
})();
