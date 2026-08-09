'use strict';

/**
 * Autocompletado del campo «Nombre» a partir del código AX.
 *
 * Al escribir en un campo de código se muestra un panel con las
 * coincidencias de las listas cargadas (código + nombre + lista de
 * origen) y, en cuanto el código coincide exactamente, el Nombre se
 * rellena solo. También se puede buscar por nombre («BANDA») para
 * quedarse con su código.
 *
 * Reglas de relleno: el Nombre solo se escribe si está vacío o si lo
 * puso el propio autocompletado (marca `dataset.autoName`), nunca se
 * pisa un texto escrito a mano. Si el código deja de coincidir, el
 * nombre autocompletado se limpia para que no queden pares incorrectos.
 *
 * El panel vive en <body> con posición fija: así no lo recorta el
 * `overflow` de las tablas ni de las tarjetas.
 */
const Autocomplete = (() => {
    const { el } = Utils;
    const MAX_ITEMS = 8;

    let panel = null;
    let session = null; // { ctx, entries, index }

    // ---------- Panel ----------

    function ensurePanel() {
        if (panel) return panel;
        panel = el('div', { class: 'ac-panel', id: 'acPanel', role: 'listbox' });
        // Evita que el input pierda el foco (y se cierre el panel) antes
        // de que llegue el click sobre una sugerencia.
        panel.addEventListener('pointerdown', (event) => event.preventDefault());
        document.body.append(panel);
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        return panel;
    }

    function isOpen() {
        return Boolean(session);
    }

    function close() {
        if (panel) {
            panel.classList.remove('ac-panel--open');
            panel.replaceChildren();
        }
        if (session) session.ctx.codeInput.setAttribute('aria-expanded', 'false');
        session = null;
    }

    function reposition() {
        if (!session) return;
        // El campo puede haber desaparecido (una tabla que se redibuja).
        if (!session.ctx.codeInput.isConnected) {
            close();
            return;
        }
        const rect = session.ctx.codeInput.getBoundingClientRect();
        const width = Math.max(rect.width, 240);
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        panel.style.width = `${width}px`;
        panel.style.left = `${left}px`;
        panel.style.top = `${rect.bottom + 2}px`;
        // Si no cabe debajo pero sí encima, se despliega hacia arriba.
        const height = panel.offsetHeight;
        if (rect.bottom + height + 8 > window.innerHeight && rect.top > height + 8) {
            panel.style.top = `${rect.top - height - 2}px`;
        }
    }

    /** Resalta la parte coincidente sin usar innerHTML. */
    function highlight(text, query) {
        const fragment = document.createDocumentFragment();
        const index = query ? text.toUpperCase().indexOf(query) : -1;
        if (index === -1) {
            fragment.append(text);
            return fragment;
        }
        fragment.append(text.slice(0, index));
        fragment.append(el('mark', { text: text.slice(index, index + query.length) }));
        fragment.append(text.slice(index + query.length));
        return fragment;
    }

    function itemRow(ctx, entry, query, index, showList) {
        const row = el('div', { class: 'ac-item', role: 'option', dataset: { index: String(index) } }, [
            el('span', { class: 'ac-item__code' }, highlight(entry.codigo, query)),
            el('span', { class: 'ac-item__name', title: entry.nombre }, highlight(entry.nombre, query)),
            showList ? el('span', { class: 'ac-item__list', text: entry.listName, title: `Lista: ${entry.listName}` }) : null,
        ]);
        row.addEventListener('click', () => choose(ctx, entry));
        row.addEventListener('mousemove', () => setActive(index));
        return row;
    }

    function render(ctx, entries, query) {
        ensurePanel();
        const rows = [];
        const showList = Store.state.codeLists.length > 1 && !Store.state.activeCodeListId;
        entries.forEach((entry, index) => rows.push(itemRow(ctx, entry, query, index, showList)));

        if (entries.length === 0) {
            // Sin coincidencias en la lista elegida: si las hay en otra, se
            // ofrece buscar en todas en lugar de dejar al usuario a ciegas.
            const elsewhere = Store.state.activeCodeListId
                ? Store.searchCodigos(query, { listId: '', limit: MAX_ITEMS })
                : [];
            if (elsewhere.length === 0) {
                close();
                return;
            }
            rows.push(el('button', {
                class: 'ac-more', type: 'button',
                text: `Sin coincidencias en esta lista · ver ${elsewhere.length} en las demás`,
                onclick: () => {
                    Store.setActiveCodeList('');
                    if (typeof App !== 'undefined') App.refreshCodeListUi();
                    syncNombre(ctx);
                    refresh(ctx);
                    ctx.codeInput.focus();
                },
            }));
        }

        panel.replaceChildren(...rows);
        panel.classList.add('ac-panel--open');
        session = { ctx, entries, index: -1 };
        ctx.codeInput.setAttribute('aria-expanded', 'true');
        reposition();
    }

    function setActive(index) {
        if (!session) return;
        session.index = index;
        panel.querySelectorAll('.ac-item').forEach((row, i) => {
            row.classList.toggle('ac-item--active', i === index);
        });
        const current = panel.querySelector('.ac-item--active');
        if (current) current.scrollIntoView({ block: 'nearest' });
    }

    function move(delta) {
        if (!session || session.entries.length === 0) return;
        const total = session.entries.length;
        const next = session.index === -1 && delta < 0 ? total - 1 : (session.index + delta + total) % total;
        setActive(next);
    }

    // ---------- Relleno del campo Nombre ----------

    function setNombre(nameInput, nombre) {
        nameInput.value = nombre;
        nameInput.dataset.autoName = '1';
        nameInput.classList.add('input--autofilled');
    }

    /** Deja de considerar el Nombre como autocompletado (lo edita el usuario). */
    function clearAutofill(nameInput) {
        delete nameInput.dataset.autoName;
        nameInput.classList.remove('input--autofilled');
    }

    /** Limpia el estado de un campo reutilizado (formulario recién enviado). */
    function reset(ctx) {
        ctx.nameTouched = false;
        clearAutofill(ctx.nameInput);
    }

    /**
     * ¿Se puede escribir en el Nombre? Siempre si está vacío o si lo puso
     * el propio autocompletado. Un texto que ya venía en la partida (tabla
     * de revisión, editor) sí se actualiza al cambiar el código —es lo que
     * se espera al corregir un código—, pero nunca se pisa lo que el
     * usuario acaba de escribir a mano.
     */
    function canFill(ctx) {
        if (!ctx.nameInput.value.trim()) return true;
        if (ctx.nameInput.dataset.autoName === '1') return true;
        return ctx.replaceExisting && !ctx.nameTouched;
    }

    /**
     * Sincroniza el Nombre con el código escrito: lo rellena cuando hay
     * coincidencia exacta y lo limpia cuando el código deja de coincidir.
     */
    function syncNombre(ctx) {
        const { codeInput, nameInput } = ctx;
        const nombre = Store.lookupNombre(codeInput.value);
        if (nombre) {
            if (canFill(ctx) && nameInput.value !== nombre) {
                setNombre(nameInput, nombre);
                if (ctx.onFill) ctx.onFill();
            }
        } else if (nameInput.dataset.autoName === '1' && nameInput.value) {
            nameInput.value = '';
            clearAutofill(nameInput);
            if (ctx.onFill) ctx.onFill();
        }
    }

    function choose(ctx, entry) {
        ctx.codeInput.value = entry.codigo;
        setNombre(ctx.nameInput, entry.nombre);
        close();
        if (ctx.onFill) ctx.onFill();
        ctx.nameInput.focus();
    }

    // ---------- Eventos ----------

    function refresh(ctx) {
        const query = ctx.codeInput.value.trim();
        if (!query || Store.state.codeLists.length === 0) {
            close();
            return;
        }
        render(ctx, Store.searchCodigos(query, { limit: MAX_ITEMS }), query.toUpperCase());
    }

    function onKeyDown(event, ctx) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!isOpen()) refresh(ctx);
            if (!isOpen()) return;
            event.preventDefault();
            move(event.key === 'ArrowDown' ? 1 : -1);
        } else if (event.key === 'Enter') {
            // Solo se elige con Enter si el usuario navegó con las flechas;
            // si no, Enter sigue enviando el formulario como siempre.
            if (isOpen() && session.index >= 0) {
                event.preventDefault();
                event.stopPropagation();
                choose(ctx, session.entries[session.index]);
            } else {
                close();
            }
        } else if (event.key === 'Escape') {
            if (isOpen()) {
                event.preventDefault();
                event.stopPropagation();
                close();
            }
        } else if (event.key === 'Tab') {
            close();
        }
    }

    /**
     * Conecta un campo de código AX con su campo de Nombre.
     * @param {HTMLInputElement} codeInput
     * @param {HTMLInputElement} nameInput
     * @param {{onFill?: Function, replaceExisting?: boolean}} [options]
     *        onFill se llama cuando el autocompletado escribe en el Nombre
     *        (para persistir el cambio); replaceExisting permite actualizar
     *        un Nombre que ya traía la partida (tablas y editor).
     * @returns {object} contexto, para poder reiniciarlo con reset()
     */
    function attach(codeInput, nameInput, options = {}) {
        const ctx = {
            codeInput,
            nameInput,
            onFill: options.onFill || null,
            replaceExisting: options.replaceExisting === true,
            nameTouched: false,
        };

        codeInput.setAttribute('autocomplete', 'off');
        codeInput.setAttribute('role', 'combobox');
        codeInput.setAttribute('aria-autocomplete', 'list');
        codeInput.setAttribute('aria-expanded', 'false');
        codeInput.setAttribute('aria-controls', 'acPanel');

        codeInput.addEventListener('input', () => {
            syncNombre(ctx);
            refresh(ctx);
        });
        codeInput.addEventListener('focus', () => {
            if (codeInput.value.trim()) refresh(ctx);
        });
        codeInput.addEventListener('keydown', (event) => onKeyDown(event, ctx));
        codeInput.addEventListener('blur', close);
        codeInput.addEventListener('change', () => {
            syncNombre(ctx);
            // Sin ninguna lista cargada se ofrece cargarla (una vez por sesión).
            if (Store.state.codeLists.length === 0 && codeInput.value.trim() && typeof App !== 'undefined') {
                App.suggestCodigosFile();
            }
        });

        nameInput.addEventListener('input', () => {
            ctx.nameTouched = nameInput.value.trim() !== '';
            clearAutofill(nameInput);
        });
        return ctx;
    }

    return { attach, reset, close };
})();
