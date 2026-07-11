'use strict';

/**
 * Lector mínimo de archivos .xlsx sin dependencias externas.
 *
 * Un .xlsx es un ZIP con XML dentro. Se usa DecompressionStream
 * ('deflate-raw', disponible en todos los navegadores modernos) para
 * descomprimir y DOMParser para leer el XML. Cubre lo que necesita la
 * app: celdas de texto y numéricas, cadenas compartidas (sharedStrings)
 * y cadenas en línea.
 */
const Xlsx = (() => {
    async function inflateRaw(bytes) {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    /** Localiza el End Of Central Directory del ZIP. */
    function readEOCD(buf, view) {
        const minPos = Math.max(0, buf.length - 22 - 65535);
        for (let i = buf.length - 22; i >= minPos; i--) {
            if (view.getUint32(i, true) === 0x06054b50) {
                return { count: view.getUint16(i + 10, true), cdOffset: view.getUint32(i + 16, true) };
            }
        }
        throw new Error('El archivo no es un .xlsx válido');
    }

    /** Lee el directorio central del ZIP: nombre → {método, tamaño, offset}. */
    function readEntries(buf, view) {
        const { count, cdOffset } = readEOCD(buf, view);
        const decoder = new TextDecoder();
        const entries = new Map();
        let p = cdOffset;
        for (let i = 0; i < count; i++) {
            if (view.getUint32(p, true) !== 0x02014b50) break;
            const method = view.getUint16(p + 10, true);
            const compSize = view.getUint32(p + 20, true);
            const nameLen = view.getUint16(p + 28, true);
            const extraLen = view.getUint16(p + 30, true);
            const commentLen = view.getUint16(p + 32, true);
            const localOffset = view.getUint32(p + 42, true);
            const name = decoder.decode(buf.subarray(p + 46, p + 46 + nameLen));
            entries.set(name, { method, compSize, localOffset });
            p += 46 + nameLen + extraLen + commentLen;
        }
        return entries;
    }

    async function entryText(buf, view, entry) {
        const p = entry.localOffset;
        if (view.getUint32(p, true) !== 0x04034b50) throw new Error('El archivo .xlsx está corrupto');
        const nameLen = view.getUint16(p + 26, true);
        const extraLen = view.getUint16(p + 28, true);
        const start = p + 30 + nameLen + extraLen;
        const comp = buf.subarray(start, start + entry.compSize);
        const bytes = entry.method === 0 ? comp : await inflateRaw(comp);
        return new TextDecoder('utf-8').decode(bytes);
    }

    function parseXml(text) {
        return new DOMParser().parseFromString(text, 'application/xml');
    }

    /** "C7" → 2 (índice de columna base cero). */
    function colToIndex(ref) {
        let n = 0;
        for (const ch of String(ref || '')) {
            if (ch >= 'A' && ch <= 'Z') n = n * 26 + ch.charCodeAt(0) - 64;
            else break;
        }
        return n - 1;
    }

    function parseSheetXml(doc, shared) {
        const rows = [];
        for (const rowEl of doc.getElementsByTagName('row')) {
            const cells = [];
            for (const c of rowEl.getElementsByTagName('c')) {
                const idx = colToIndex(c.getAttribute('r'));
                const type = c.getAttribute('t');
                let value = '';
                if (type === 'inlineStr') {
                    value = c.textContent;
                } else {
                    const v = c.getElementsByTagName('v')[0];
                    value = v ? v.textContent : '';
                    if (type === 's') value = shared[parseInt(value, 10)] ?? '';
                }
                if (idx >= 0) cells[idx] = value;
                else cells.push(value);
            }
            rows.push(Array.from(cells, (v) => v ?? ''));
        }
        return rows;
    }

    /**
     * Lee un archivo .xlsx.
     * @param {File|Blob} file
     * @returns {Promise<Array<{name: string, rows: string[][]}>>} hojas en orden
     */
    async function read(file) {
        if (typeof DecompressionStream === 'undefined') {
            throw new Error('Tu navegador no soporta leer archivos .xlsx; actualízalo');
        }
        const buf = new Uint8Array(await file.arrayBuffer());
        const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
        const entries = readEntries(buf, view);
        const text = (name) => (entries.has(name) ? entryText(buf, view, entries.get(name)) : Promise.resolve(null));

        const wbXml = await text('xl/workbook.xml');
        if (!wbXml) throw new Error('El archivo no contiene un libro de Excel');
        const wbDoc = parseXml(wbXml);

        const relMap = {};
        const relsXml = await text('xl/_rels/workbook.xml.rels');
        if (relsXml) {
            for (const rel of parseXml(relsXml).getElementsByTagName('Relationship')) {
                relMap[rel.getAttribute('Id')] = rel.getAttribute('Target');
            }
        }

        const shared = [];
        const ssXml = await text('xl/sharedStrings.xml');
        if (ssXml) {
            for (const si of parseXml(ssXml).getElementsByTagName('si')) {
                let s = '';
                for (const t of si.getElementsByTagName('t')) s += t.textContent;
                shared.push(s);
            }
        }

        const RELS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
        const sheets = [];
        for (const sheetEl of wbDoc.getElementsByTagName('sheet')) {
            const rid = sheetEl.getAttribute('r:id') || sheetEl.getAttributeNS(RELS_NS, 'id');
            let target = relMap[rid];
            if (!target) continue;
            target = target.replace(/^\//, '');
            if (!target.startsWith('xl/')) target = `xl/${target}`;
            const xml = await text(target);
            if (!xml) continue;
            sheets.push({
                name: sheetEl.getAttribute('name') || `Hoja ${sheets.length + 1}`,
                rows: parseSheetXml(parseXml(xml), shared),
            });
        }
        if (!sheets.length) throw new Error('El libro no tiene hojas legibles');
        return sheets;
    }

    return { read };
})();
