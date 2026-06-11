'use strict';

/**
 * Motor de maquetación de página.
 *
 * A diferencia de la versión anterior (donde el usuario fijaba filas y
 * columnas a mano y podían no caber en la hoja), aquí la cuadrícula se
 * CALCULA a partir de las dimensiones físicas reales: tamaño de hoja,
 * margen, tamaño de etiqueta y separación. Así nunca se generan filas
 * que desborden la página (la causa de los saltos de página inesperados).
 */
const Layout = (() => {
    /** Calcula cuántas etiquetas caben físicamente en una hoja. */
    function computeGrid(layout) {
        const page = Store.PAGE_SIZES[layout.pageSize] || Store.PAGE_SIZES.letter;
        const usableW = page.widthMm - 2 * layout.marginLeftMm;
        const usableH = page.heightMm - 2 * layout.marginTopMm;

        // n etiquetas + (n-1) separaciones <= área útil
        // (+0.05mm de tolerancia para no perder una columna/fila por redondeo)
        const EPSILON = 0.05;
        const cols = Math.max(0, Math.floor((usableW + layout.gapXMm + EPSILON) / (layout.labelWidthMm + layout.gapXMm)));
        const rows = Math.max(0, Math.floor((usableH + layout.gapYMm + EPSILON) / (layout.labelHeightMm + layout.gapYMm)));

        const warnings = [];
        if (cols === 0) warnings.push('El ancho de la etiqueta no cabe en la hoja con el margen actual.');
        if (rows === 0) warnings.push('El alto de la etiqueta no cabe en la hoja con el margen actual.');

        return { page, usableW, usableH, cols, rows, perPage: cols * rows, warnings };
    }

    let pageStyleEl = null;

    /**
     * Aplica el layout al documento: variables CSS y regla @page.
     * @page no acepta var(), por eso la regla se genera desde JS.
     * Con margin: 0 en @page, los márgenes los controla el padding de la
     * hoja (.sheet) y lo que se ve en la vista previa es exactamente lo
     * que se imprime, sin tener que ajustar nada en el diálogo de impresión.
     */
    function applyToDocument(layout) {
        const grid = computeGrid(layout);
        const root = document.documentElement.style;
        root.setProperty('--page-w', `${grid.page.widthMm}mm`);
        root.setProperty('--page-h', `${grid.page.heightMm}mm`);
        root.setProperty('--page-margin-top', `${layout.marginTopMm}mm`);
        root.setProperty('--page-margin-left', `${layout.marginLeftMm}mm`);
        root.setProperty('--label-w', `${layout.labelWidthMm}mm`);
        root.setProperty('--label-h', `${layout.labelHeightMm}mm`);
        root.setProperty('--label-gap-x', `${layout.gapXMm}mm`);
        root.setProperty('--label-gap-y', `${layout.gapYMm}mm`);
        root.setProperty('--label-font', `${layout.fontSizePx}px`);
        root.setProperty('--label-border-w', layout.showBorder === false ? '0mm' : '0.5mm');
        root.setProperty('--grid-cols', String(grid.cols || 1));

        if (!pageStyleEl) {
            pageStyleEl = document.createElement('style');
            document.head.append(pageStyleEl);
        }
        pageStyleEl.textContent = `@page { size: ${grid.page.widthMm}mm ${grid.page.heightMm}mm; margin: 0; }`;

        return grid;
    }

    return { computeGrid, applyToDocument };
})();
