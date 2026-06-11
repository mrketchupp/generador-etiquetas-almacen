'use strict';

/**
 * Exportación e importación de las partidas como archivo JSON.
 *
 * Flujo pensado: capturar los datos en el teléfono, exportar el archivo
 * (se puede compartir por WhatsApp, correo, AirDrop…), e importarlo en
 * la computadora para imprimir desde ahí.
 *
 * El archivo incluye ambas listas (Material y Código AX). Al importar,
 * las partidas se AÑADEN a las listas actuales (no se borra nada) y cada
 * campo se valida/sanea individualmente.
 */
const Transfer = (() => {
    const FORMAT = 'etiquetas-almacen';
    const VERSION = 1;

    function buildPayload() {
        return {
            format: FORMAT,
            version: VERSION,
            exportedAt: new Date().toISOString(),
            materials: Store.state.materials,
            axItems: Store.state.axItems,
        };
    }

    function exportData() {
        const json = JSON.stringify(buildPayload(), null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

        const link = Utils.el('a', { href: url, download: `etiquetas_${stamp}.json` });
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function text(value) {
        return String(value ?? '').trim();
    }

    function sanitizeMaterial(raw) {
        const item = raw && typeof raw === 'object' ? raw : {};
        return {
            id: Utils.uid(),
            cantidad: Utils.clampInt(item.cantidad, 1, 1),
            codigoAx: text(item.codigoAx),
            nombre: text(item.nombre),
            dimension: text(item.dimension),
            noParte: text(item.noParte),
            descripcion: text(item.descripcion),
            condicion: Tables.CONDICIONES.includes(item.condicion) ? item.condicion : 'NUEVO',
            categoria: Tables.CATEGORIAS.includes(item.categoria) ? item.categoria : 'INVENTARIABLE',
        };
    }

    function sanitizeAx(raw) {
        const item = raw && typeof raw === 'object' ? raw : {};
        return {
            id: Utils.uid(),
            cantidad: Utils.clampInt(item.cantidad, 1, 1),
            codigoAx: text(item.codigoAx),
            nombre: text(item.nombre),
        };
    }

    /**
     * Importa un archivo exportado por esta aplicación y añade su
     * contenido a las listas actuales.
     * @returns {Promise<{materials: number, axItems: number}>} cuántas partidas se añadieron
     */
    async function importFile(file) {
        let payload;
        try {
            payload = JSON.parse(await Utils.readFileAsText(file));
        } catch {
            throw new Error('El archivo no es un JSON válido');
        }
        if (!payload || payload.format !== FORMAT) {
            throw new Error('El archivo no es una exportación de esta aplicación');
        }

        const materials = (Array.isArray(payload.materials) ? payload.materials : []).map(sanitizeMaterial);
        const axItems = (Array.isArray(payload.axItems) ? payload.axItems : []).map(sanitizeAx);
        if (materials.length === 0 && axItems.length === 0) {
            throw new Error('El archivo no contiene partidas');
        }

        Store.state.materials.push(...materials);
        Store.state.axItems.push(...axItems);
        Store.save();
        return { materials: materials.length, axItems: axItems.length };
    }

    return { exportData, importFile };
})();
