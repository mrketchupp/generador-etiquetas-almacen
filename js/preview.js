'use strict';

/**
 * Vista previa de impresión e impresión.
 *
 * Las hojas (.sheet) tienen el tamaño físico exacto del papel y los
 * márgenes como padding interno; @page se imprime con margin: 0. Eso
 * hace que la vista previa en pantalla (escalada con transform) sea
 * idéntica al resultado impreso: sin saltos de página inesperados y sin
 * tener que ajustar márgenes en el diálogo de impresión.
 */
const Preview = (() => {
    const { el, mmToPx, toast } = Utils;
    const $ = (id) => document.getElementById(id);

    const MAX_LABELS = 2000;

    let isOpen = false;
    let sheetsParentBeforePrint = null;

    function currentItems() {
        return Store.state.mode === 'material' ? Store.state.materials : Store.state.axItems;
    }

    function expandLabels() {
        const settings = Store.state.settings;
        const builder = Store.state.mode === 'material' ? Labels.material : Labels.codigoAx;
        const labels = [];
        for (const item of currentItems()) {
            const count = Math.max(1, item.cantidad || 1);
            for (let i = 0; i < count; i++) labels.push(builder(item, settings));
        }
        return labels;
    }

    /** Regenera las hojas a partir del estado actual. */
    function render() {
        const layout = Store.state.settings.layout;
        const grid = Layout.applyToDocument(layout);
        const sheets = $('sheets');
        sheets.replaceChildren();

        const info = $('previewInfo');
        if (grid.perPage === 0) {
            info.textContent = `⚠️ ${grid.warnings.join(' ')} Ajusta el diseño en 📏.`;
            return;
        }

        const labels = expandLabels();
        const totalPages = Math.ceil(labels.length / grid.perPage);
        for (let page = 0; page < totalPages; page++) {
            const gridEl = el('div', { class: 'sheet__grid' });
            for (const label of labels.slice(page * grid.perPage, (page + 1) * grid.perPage)) {
                gridEl.append(label);
            }
            const sheet = el('div', { class: 'sheet' }, gridEl);
            sheets.append(el('div', { class: 'sheet-holder' }, sheet));
        }

        info.textContent = `${labels.length} etiqueta(s) · ${totalPages} hoja(s) · ` +
            `cuadrícula ${grid.cols} × ${grid.rows} (${grid.perPage} por hoja)`;

        applyScale();
    }

    /** Escala las hojas para que quepan en el panel (solo visual). */
    function applyScale() {
        const host = $('previewHost');
        const sheets = $('sheets');
        const page = Store.PAGE_SIZES[Store.state.settings.layout.pageSize] || Store.PAGE_SIZES.letter;
        const pageWpx = mmToPx(page.widthMm);
        const pageHpx = mmToPx(page.heightMm);
        const available = host.clientWidth - 32;
        const scale = available > 0 ? Math.min(1, available / pageWpx) : 1;
        sheets.style.setProperty('--page-w-px', `${pageWpx}px`);
        sheets.style.setProperty('--page-h-px', `${pageHpx}px`);
        sheets.style.setProperty('--scale', String(scale));
    }

    function open() {
        const items = currentItems();
        if (items.length === 0) {
            toast('No hay partidas para imprimir', 'warning');
            return;
        }
        const total = items.reduce((sum, item) => sum + Math.max(1, item.cantidad || 1), 0);
        if (total > MAX_LABELS) {
            toast(`Demasiadas etiquetas (${total}). El máximo es ${MAX_LABELS}.`, 'error');
            return;
        }
        isOpen = true;
        document.body.classList.add('preview-open');
        render();
        window.scrollTo({ top: 0 });
    }

    function close() {
        isOpen = false;
        document.body.classList.remove('preview-open');
    }

    function print() {
        window.print();
    }

    // Durante la impresión las hojas se mueven temporalmente a <body>
    // para que ningún contenedor (scroll, transform) las recorte o desplace.
    window.addEventListener('beforeprint', () => {
        if (!isOpen) render(); // permite Ctrl+P directo con los datos actuales
        const sheets = $('sheets');
        sheetsParentBeforePrint = sheets.parentElement;
        document.body.append(sheets);
        document.body.classList.add('printing');
    });

    window.addEventListener('afterprint', () => {
        const sheets = $('sheets');
        if (sheetsParentBeforePrint) sheetsParentBeforePrint.append(sheets);
        sheetsParentBeforePrint = null;
        document.body.classList.remove('printing');
        applyScale();
    });

    window.addEventListener('resize', () => {
        if (isOpen) applyScale();
    });

    return {
        open,
        close,
        render,
        print,
        applyScale,
        get isOpen() { return isOpen; },
    };
})();
