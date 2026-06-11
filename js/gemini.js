'use strict';

/**
 * Cliente mínimo de la API de Gemini para extraer las partidas de la
 * foto de un vale de material.
 */
const Gemini = (() => {
    const MODEL = 'gemini-3-flash-lite';
    const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const PROMPT = "Analiza la siguiente imagen de un vale de material. Extrae la información de la tabla de materiales. " +
        "Las columnas relevantes son 'CANTIDAD', 'CODIGO' (la segunda columna, no la que dice 'OC'), " +
        "'DESCRIPCION DEL MATERIAL' y 'CLAVE ALMACEN'. Devuelve el resultado como un array de objetos JSON. " +
        "Asegúrate de que los valores de 'cantidad' sean numéricos.";

    const RESPONSE_SCHEMA = {
        type: 'ARRAY',
        items: {
            type: 'OBJECT',
            properties: {
                cantidad: { type: 'NUMBER' },
                codigo: { type: 'STRING' },
                descripcion: { type: 'STRING' },
                claveAlmacen: { type: 'STRING' },
            },
            required: ['cantidad', 'codigo', 'descripcion', 'claveAlmacen'],
        },
    };

    /**
     * @param {string} dataUrl Imagen como data URL (image/png o image/jpeg)
     * @param {string} apiKey  API Key de Gemini del usuario
     * @returns {Promise<Array<{cantidad:number,codigo:string,descripcion:string,claveAlmacen:string}>>}
     */
    async function extractMaterials(dataUrl, apiKey) {
        const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
        if (!match) throw new Error('La imagen no es válida');
        const [, mimeType, base64] = match;

        const payload = {
            contents: [{
                parts: [
                    { text: PROMPT },
                    { inline_data: { mime_type: mimeType, data: base64 } },
                ],
            }],
            generationConfig: {
                response_mime_type: 'application/json',
                response_schema: RESPONSE_SCHEMA,
            },
        };

        const response = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => null);
            throw new Error(errorBody?.error?.message || `Error HTTP ${response.status}`);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        let items = null;
        try {
            items = text ? JSON.parse(text) : null;
        } catch {
            throw new Error('La respuesta del modelo no es un JSON válido');
        }
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('No se pudieron extraer materiales de la imagen');
        }
        return items;
    }

    return { extractMaterials };
})();
