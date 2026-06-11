'use strict';

/**
 * Parser de CSV con soporte para campos entre comillas (comas y saltos
 * de línea dentro del campo), algo que el split(',') anterior rompía.
 */
const CSV = (() => {
    function parseRows(text) {
        const rows = [];
        let row = [];
        let field = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (inQuotes) {
                if (ch === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; }
                    else inQuotes = false;
                } else {
                    field += ch;
                }
            } else if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                row.push(field);
                field = '';
            } else if (ch === '\n' || ch === '\r') {
                if (ch === '\r' && text[i + 1] === '\n') i++;
                row.push(field);
                field = '';
                rows.push(row);
                row = [];
            } else {
                field += ch;
            }
        }
        if (field !== '' || row.length > 0) {
            row.push(field);
            rows.push(row);
        }
        return rows.filter((r) => r.some((c) => c.trim() !== ''));
    }

    /**
     * Devuelve un mapa CODIGO → NOMBRE a partir de un CSV con columnas
     * que contengan "codigo" y "nombre" en el encabezado.
     */
    function parseCodigosMap(text) {
        const rows = parseRows(text);
        if (rows.length < 2) return {};

        const header = rows[0].map((h) => h.trim().toLowerCase());
        const codeIdx = header.findIndex((h) => h.includes('codigo') || h.includes('código'));
        const nameIdx = header.findIndex((h) => h.includes('nombre'));
        if (codeIdx === -1 || nameIdx === -1) return {};

        const map = {};
        for (const row of rows.slice(1)) {
            const code = (row[codeIdx] || '').trim().toUpperCase();
            const name = (row[nameIdx] || '').trim();
            if (code && name) map[code] = name;
        }
        return map;
    }

    return { parseCodigosMap };
})();
