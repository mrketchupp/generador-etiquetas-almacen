'use strict';

/**
 * Cliente mínimo de la API de Gemini para extraer las partidas de la
 * foto de un vale de material.
 *
 * Diseñado para redes lentas o inestables:
 * - Toda petición tiene tiempo límite (AbortController); nada se queda
 *   colgado esperando un ERR_CONNECTION_TIMED_OUT del navegador.
 * - ListModels es solo una mejora opcional con timeout corto: si no
 *   responde, se prueban directamente los modelos preferidos.
 * - Si un modelo devuelve 404 (Google lo renombró/retiró) se prueba el
 *   siguiente candidato; el que funcione queda guardado para la próxima.
 * - Los errores de red se traducen a mensajes claros en español.
 */
const Gemini = (() => {
    const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

    // Orden de preferencia (los "lite" son más baratos y suficientes
    // para leer una tabla). Se prueban en orden si no hay lista.
    const PREFERRED_MODELS = [
        'gemini-3.1-flash-lite',
        'gemini-3.1-flash',
        'gemini-3.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
    ];

    const PROMPT = "Analiza la siguiente imagen de un vale de material. Extrae la información de la tabla de materiales, un objeto por renglón. " +
        "Las columnas relevantes son 'O.C.', 'CANTIDAD', 'CODIGO', 'DESCRIPCION DEL MATERIAL' y 'CLAVE ALMACEN'. " +
        "Devuelve el resultado como un array de objetos JSON. Asegúrate de que los valores de 'cantidad' sean numéricos. " +
        "'oc' es el valor de la columna O.C. (déjalo como cadena vacía si el renglón no tiene).";

    const RESPONSE_SCHEMA = {
        type: 'ARRAY',
        items: {
            type: 'OBJECT',
            properties: {
                oc: { type: 'STRING' },
                cantidad: { type: 'NUMBER' },
                codigo: { type: 'STRING' },
                descripcion: { type: 'STRING' },
                claveAlmacen: { type: 'STRING' },
            },
            required: ['oc', 'cantidad', 'codigo', 'descripcion', 'claveAlmacen'],
        },
    };

    /** Traduce fallos de red a un mensaje accionable. */
    function networkError() {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return new Error('Sin conexión a internet. Extraer datos del vale necesita conexión; el resto de la app funciona sin ella.');
        }
        return new Error('No se pudo conectar con la API de Gemini (tiempo de espera agotado). ' +
            'Revisa tu conexión, o si tu red/VPN/firewall bloquea generativelanguage.googleapis.com.');
    }

    async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } catch (error) {
            // AbortError (nuestro timeout) o TypeError: Failed to fetch
            throw networkError();
        } finally {
            clearTimeout(timer);
        }
    }

    async function apiError(response) {
        const body = await response.json().catch(() => null);
        return new Error(body?.error?.message || `Error HTTP ${response.status}`);
    }

    /** Modelos disponibles para esta API Key que soportan generateContent. */
    async function listAvailableModels(apiKey, timeoutMs) {
        const response = await fetchWithTimeout(
            `${API_BASE}/models?pageSize=200&key=${encodeURIComponent(apiKey)}`,
            {},
            timeoutMs,
        );
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

    /**
     * Candidatos a probar, en orden: el modelo que ya funcionó antes,
     * el mejor según ListModels (si responde rápido) y los preferidos.
     * ListModels es best-effort: si falla o tarda, no bloquea nada.
     */
    async function candidateModels(apiKey) {
        const candidates = [];
        const push = (model) => {
            if (model && !candidates.includes(model)) candidates.push(model);
        };

        push(Store.state.settings.geminiModel);

        if (!Store.state.settings.geminiModel) {
            try {
                push(pickModel(await listAvailableModels(apiKey, 8000)));
            } catch (error) {
                console.warn('ListModels no respondió; se probarán los modelos preferidos:', error.message);
            }
        }

        for (const model of PREFERRED_MODELS) push(model);
        return candidates;
    }

    function callModel(model, payload, apiKey) {
        return fetchWithTimeout(
            `${API_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            },
            60000, // analizar una imagen puede tardar
        );
    }

    /**
     * @param {string} dataUrl Imagen como data URL (image/png o image/jpeg)
     * @param {string} apiKey  API Key de Gemini del usuario
     * @returns {Promise<Array<{oc:string,cantidad:number,codigo:string,descripcion:string,claveAlmacen:string}>>}
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

        let lastError = null;
        for (const model of await candidateModels(apiKey)) {
            // Los errores de red se propagan de inmediato: si no hay red,
            // no tiene sentido seguir probando modelos.
            const response = await callModel(model, payload, apiKey);

            if (response.status === 404) {
                // Modelo renombrado/retirado por Google: probar el siguiente.
                console.warn(`El modelo "${model}" no existe; probando el siguiente…`);
                if (Store.state.settings.geminiModel === model) {
                    Store.state.settings.geminiModel = '';
                    Store.save();
                }
                lastError = await apiError(response);
                continue;
            }
            if (!response.ok) throw await apiError(response);

            // Este modelo funciona: recordarlo para las próximas veces.
            if (Store.state.settings.geminiModel !== model) {
                Store.state.settings.geminiModel = model;
                Store.save();
                console.log('Modelo de Gemini seleccionado:', model);
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

        throw lastError || new Error('Ningún modelo de Gemini está disponible con tu API Key');
    }

    return { extractMaterials };
})();
