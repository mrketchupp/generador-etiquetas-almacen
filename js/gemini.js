'use strict';

/**
 * Cliente mínimo de la API de Gemini para extraer las partidas de la
 * foto de un vale de material.
 *
 * Google renombra y retira modelos con frecuencia (el error
 * "model is not found for API version v1beta" viene de ahí). Para no
 * depender de un nombre fijo, el modelo se resuelve consultando
 * ListModels con la API Key del usuario: se elige el mejor modelo
 * "flash" disponible que soporte generateContent, se guarda en la
 * configuración y, si algún día deja de existir, se vuelve a resolver
 * automáticamente.
 */
const Gemini = (() => {
    const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

    // Orden de preferencia si están disponibles (los "lite" son más
    // baratos y suficientes para leer una tabla).
    const PREFERRED_MODELS = [
        'gemini-3.1-flash-lite',
        'gemini-3.1-flash',
        'gemini-3.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
    ];

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

    async function apiError(response) {
        const body = await response.json().catch(() => null);
        return new Error(body?.error?.message || `Error HTTP ${response.status}`);
    }

    /** Modelos disponibles para esta API Key que soportan generateContent. */
    async function listAvailableModels(apiKey) {
        const response = await fetch(`${API_BASE}/models?pageSize=200&key=${encodeURIComponent(apiKey)}`);
        if (!response.ok) throw await apiError(response);
        const data = await response.json();
        return (data.models || [])
            .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
            .map((m) => String(m.name || '').replace(/^models\//, ''))
            .filter(Boolean);
    }

    /** Elige el mejor modelo: preferidos primero, luego flash estables. */
    function pickModel(available) {
        const score = (id) => {
            let s = 0;
            const idx = PREFERRED_MODELS.indexOf(id);
            if (idx !== -1) s += 1000 - idx;
            if (id.includes('flash')) s += 100;
            if (id.includes('lite')) s += 20;
            if (/preview|exp/.test(id)) s -= 500;
            const version = id.match(/(\d+(?:\.\d+)?)/);
            if (version) s += parseFloat(version[1]);
            return s;
        };
        return [...available].sort((a, b) => score(b) - score(a))[0] || null;
    }

    async function resolveModel(apiKey) {
        const cached = Store.state.settings.geminiModel;
        if (cached) return cached;
        const available = await listAvailableModels(apiKey);
        const model = pickModel(available);
        if (!model) {
            throw new Error('Tu API Key no tiene ningún modelo de Gemini compatible disponible');
        }
        Store.state.settings.geminiModel = model;
        Store.save();
        console.log('Modelo de Gemini seleccionado:', model);
        return model;
    }

    function callModel(model, payload, apiKey) {
        return fetch(`${API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

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

        let model = await resolveModel(apiKey);
        let response = await callModel(model, payload, apiKey);

        // Si el modelo guardado fue retirado por Google, se vuelve a
        // resolver contra ListModels y se reintenta una vez.
        if (response.status === 404) {
            console.warn(`El modelo "${model}" ya no existe; buscando uno disponible…`);
            Store.state.settings.geminiModel = '';
            Store.save();
            model = await resolveModel(apiKey);
            response = await callModel(model, payload, apiKey);
        }

        if (!response.ok) throw await apiError(response);

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
